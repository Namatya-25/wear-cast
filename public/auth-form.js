// 新規登録画面(signup.html)とログイン画面(login.html)で共通の処理
// apiUrl: 送り先（/api/signup か /api/login）

// Googleから戻ってきたときのエラー（server.jsのauth.jsが ?error=〜 をつけて戻す）
const googleErrors = {
    google_cancel: "Googleでのログインがキャンセルされました",
    google_failed: "Googleでのログインに失敗しました。もう一度お試しください",
    google_not_ready: "Googleでのログインは準備中です"
};

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

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        error.textContent = "";
        button.disabled = true;

        fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: document.getElementById("email").value,
                password: password.value
            })
        })
            .then(res => {
                if (!res.ok) return res.text().then(msg => { throw new Error(msg); });
                // ホームで「ログインしました！」を出すために ?login=1 をつける（toast.js）
                location.href = "index.html?login=1";
            })
            .catch(err => {
                error.textContent = err.message;
                button.disabled = false;
            });
    });
}
