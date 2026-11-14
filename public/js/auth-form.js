// 新規登録画面(signup.html)とログイン画面(login.html)で共通の処理
// apiUrl: 送り先（/api/signup か /api/login）

// Googleから戻ってきたときのエラー（server.jsのauth.jsが ?error=〜 をつけて戻す）
const googleErrors = {
    google_cancel: "Googleでのログインがキャンセルされました",
    google_failed: "Googleでのログインに失敗しました。もう一度お試しください",
    google_not_ready: "Googleでのログインは準備中です",
    // メールの確認リンク（/auth/verify）がうまくいかなかったとき
    verify_invalid: "確認リンクが正しくないか、すでに使われています。ログインできない場合は確認メールを再送してください",
    verify_expired: "確認リンクの有効期限が切れています。ログインして、確認メールを再送してください"
};

// 確認メールの再送（login.htmlとverify-sent.htmlで使う）
function resendVerification(email) {
    return fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    }).then(res => res.text().then(msg => {
        if (!res.ok) throw new Error(msg);
        return msg;
    }));
}

function setupAuthForm(apiUrl) {
    const form = document.getElementById("auth-form");
    const error = document.getElementById("auth-error");
    const button = form.querySelector("button[type=submit]");

    const errorCode = new URLSearchParams(location.search).get("error");
    if (errorCode && googleErrors[errorCode]) error.textContent = googleErrors[errorCode];

    // 目のアイコンでパスワードの表示・非表示を切り替える
    const password = document.getElementById("password");
    const toggle = document.getElementById("password-toggle");
    toggle.addEventListener("click", () => {
        const show = password.type === "password";
        password.type = show ? "text" : "password";
        toggle.querySelector("i").className = show ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
        toggle.setAttribute("aria-label", show ? "パスワードを隠す" : "パスワードを表示する");
    });

    // 「確認メールを再送する」ボタン（エラーの文の下に出す）
    const resend = document.createElement("button");
    resend.type = "button";
    resend.className = "hidden block mx-auto mt-2 text-sm text-sky-700 underline hover:opacity-60 transition disabled:opacity-50";
    resend.textContent = "確認メールを再送する";
    error.after(resend);
    let resendEmail = "";
    function showResendButton(email) {
        resendEmail = email;
        resend.classList.remove("hidden");
    }
    function hideResendButton() {
        resend.classList.add("hidden");
    }
    resend.addEventListener("click", () => {
        resend.disabled = true;
        resendVerification(resendEmail)
            .then(msg => { error.textContent = msg; hideResendButton(); })
            .catch(err => { error.textContent = err.message; })
            .finally(() => { resend.disabled = false; });
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        error.textContent = "";
        button.disabled = true;

        hideResendButton();
        const email = document.getElementById("email").value;

        fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                password: password.value
            })
        })
            .then(res => {
                if (!res.ok) return res.text().then(msg => {
                    const err = new Error(msg);
                    err.status = res.status;
                    throw err;
                });
                // 新規登録は、メールの確認をお願いする画面へ
                if (apiUrl === "/api/signup") {
                    location.href = "verify-sent.html?email=" + encodeURIComponent(email);
                    return;
                }
                // ホームで「ログインしました！」を出すために ?login=1 をつける（toast.js）
                location.href = "index.html?login=1";
            })
            .catch(err => {
                error.textContent = err.message;
                button.disabled = false;
                // ログインでメールの確認がまだ（403）のときは、再送ボタンを出す
                if (err.status === 403) showResendButton(email);
            });
    });
}
