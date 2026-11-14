// 通信中に出すローディング画面
// すぐ終わる通信で画面がチカチカしないように、少し待ってから表示する
let loadingTimer = null;

function showLoading(message = "読み込み中") {
    hideLoading();

    // 0.3秒たってもまだ通信してる時の処理
    loadingTimer = setTimeout(() => {
        const overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.className = "loading-overlay fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FBF7EF]/90 px-4";
        overlay.innerHTML = `
            <img src="images/tshirt-wind.svg" alt="" class="w-64 max-w-full rounded-2xl shadow-sm">
            <p class="loading-text mt-6 text-lg font-medium text-gray-800 font-['Zen_Maru_Gothic',sans-serif]"></p>
        `;
        // 文字はtextContentで入れる（HTMLとして読まれないように）
        overlay.querySelector("p").textContent = message;
        // bodyにローディング画面を追加
        document.body.appendChild(overlay);
    }, 300);
}


//0.3秒以内で取得できた時の処理
function hideLoading() {
    // 予約されてた処理を取り消すためのメソッド
    clearTimeout(loadingTimer);
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.remove();
}
