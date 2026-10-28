// 登録・更新が終わったときに出すモーダル
// message: 表示する文字　nextUrl: 閉じたあとに移動するページ
function showDoneModal(message, nextUrl) {
    const overlay = document.createElement("div");
    overlay.className = "done-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4";
    overlay.innerHTML = `
        <div class="done-modal-box relative w-full max-w-md bg-white border-[5px] border-[#5ad8e0] rounded-3xl shadow-xl px-8 pt-12 pb-10 text-center">
            <button type="button" class="done-modal-close absolute top-4 right-5 text-3xl leading-none text-gray-800 hover:opacity-60 transition" aria-label="閉じる">&times;</button>
            <p class="text-2xl text-gray-900 mb-8 font-medium font-['Zen_Maru_Gothic',sans-serif]"></p>
            <svg class="w-40 mx-auto" viewBox="0 0 120 100" aria-hidden="true">
                <!-- Tシャツ -->
                <path d="M42 8 L20 18 L4 42 L20 52 L30 40 L30 94 L90 94 L90 40 L100 52 L116 42 L100 18 L78 8 Q60 26 42 8 Z"
                    fill="#E0F4FF" stroke="#1E9BF0" stroke-width="3.5" stroke-linejoin="round" />
                <!-- チェックマーク -->
                <circle cx="88" cy="76" r="20" fill="#4FC3F7" stroke="#ffffff" stroke-width="4" />
                <path d="M79 76 L86 83 L98 70" fill="none" stroke="#ffffff" stroke-width="4"
                    stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </div>
    `;
    // 文字はtextContentで入れる（HTMLとして読まれないように）
    overlay.querySelector("p").textContent = message;

    // ×ボタンか、モーダルの外側を押したら次のページへ
    function close() {
        window.location.href = nextUrl;
    }
    overlay.querySelector(".done-modal-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
}
