// 画面の上に小さいお知らせ（トースト）を出して、少したったら消す
function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast fixed top-4 left-1/2 z-50 flex items-center gap-2 bg-white border-2 border-[#5ad8e0] rounded-full shadow-lg pl-2 pr-5 py-2 text-gray-900 font-medium whitespace-nowrap font-['Zen_Maru_Gothic',sans-serif]";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
        <span class="w-6 h-6 rounded-full bg-[#4FC3F7] text-white flex items-center justify-center text-xs"><i class="fa-solid fa-check"></i></span>
        <span class="toast-text"></span>
    `;
    toast.querySelector(".toast-text").textContent = message;
    document.body.appendChild(toast);

    // 2.5秒たったら上に消える
    setTimeout(() => {
        toast.classList.add("toast-hide");
        toast.addEventListener("animationend", () => toast.remove());
    }, 2500);
}

// ログインした直後（URLに ?login=1 がついているとき）は「ログインしました！」を出す
// 再読み込みでもう一度出ないように、URLから ?login=1 を消しておく
window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    // メールの確認リンクから来たとき（?verified=1）は「登録が完了しました！」を出す
    if (params.get("verified") === "1") {
        showToast("登録が完了しました！");
    } else if (params.get("login") === "1") {
        showToast("ログインしました！");
    } else {
        return;
    }
    history.replaceState(null, "", location.pathname);
});
