// お気に入りの星
// 詳細画面：押すたびに黄色⇔灰色が切り替わるボタン（サーバーに保存する）
// 一覧画面：お気に入りの服にだけ黄色い星の印を出す（押せない）

// 星の絵（白いふち取りがなめらかになるようにSVGで描く。色はcurrentColor、影はstyle.cssのfavorite-star）
function favoriteStarSvg(isFavorite) {
    return `
        <svg class="favorite-star w-6 h-6 ${isFavorite ? "text-yellow-400" : "text-gray-300"}" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
                fill="currentColor" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" paint-order="stroke" />
        </svg>`;
}

// 一覧画面用：お気に入りの印（位置はclassNameで呼ぶ側が決める）
function favoriteMarkHtml(className = "") {
    return `<span class="${className} w-9 h-9 flex items-center justify-center pointer-events-none" title="お気に入り">${favoriteStarSvg(true)}</span>`;
}

// 詳細画面用：星ボタンのHTMLを作る（位置はclassNameで呼ぶ側が決める）
function favoriteButtonHtml(id, isFavorite, className = "") {
    return `
        <button type="button" onclick="toggleFavorite(event, ${Number(id)})"
            data-favorite="${isFavorite ? "true" : "false"}"
            aria-pressed="${isFavorite ? "true" : "false"}"
            aria-label="お気に入り"
            class="favorite-btn ${className} w-9 h-9 flex items-center justify-center">
            ${favoriteStarSvg(isFavorite)}
        </button>`;
}

// ボタンの見た目を、お気に入りかどうかに合わせる
function setFavoriteLook(button, isFavorite) {
    button.dataset.favorite = isFavorite ? "true" : "false";
    button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
    const star = button.querySelector("svg");
    star.classList.toggle("text-yellow-400", isFavorite);
    star.classList.toggle("text-gray-300", !isFavorite);
}

// 星を押したとき：先に色を変えてから保存し、失敗したら元に戻す
function toggleFavorite(event, id) {
    // ボタンを押したときにまわりのリンクなどが動かないようにする
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const next = button.dataset.favorite !== "true";
    setFavoriteLook(button, next);

    fetch(`/api/clothes/${id}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: next })
    }).then(res => {
        if (!res.ok) throw new Error("お気に入りの更新に失敗しました");
    }).catch(err => {
        console.error("お気に入りエラー:", err);
        setFavoriteLook(button, !next);
        alert("お気に入りの更新に失敗しました");
    });
}
