// 写真をアップロードする前にブラウザで小さくする
// スマホの写真は数MBあり送るのに時間がかかるので、長い辺をmaxSizeピクセルまで縮めてJPEGにする
// 読み込めない画像（HEICなど）のときは元のファイルをそのまま返す
async function resizeImage(file, maxSize = 1280, quality = 0.85) {
    try {
        // 写真の向き（縦・横）の情報に合わせて読み込む
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

        // もともと小さい画像はそのまま送る
        if (Math.max(bitmap.width, bitmap.height) <= maxSize && file.size <= 500 * 1024) {
            bitmap.close();
            return file;
        }

        const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);

        const ctx = canvas.getContext("2d");
        // 透明な部分がJPEGで黒くならないように白で塗っておく
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (!blob) return file;

        // 縮めたほうが大きくなったときは元のファイルを使う
        if (blob.size >= file.size) return file;

        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
    } catch (err) {
        console.error("画像の縮小に失敗しました:", err);
        return file;
    }
}
