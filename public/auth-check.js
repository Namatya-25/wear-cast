// ログアウトしたあとにブラウザの「戻る」で前の画面が出てきたときは、最初の画面に移動させる
// （「戻る」の画面はブラウザに残っているものなので、server.jsのチェックを通らない）
window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    fetch("/api/me").then(res => {
        if (res.status === 401) location.replace("welcome.html");
    });
});
