require("dotenv").config({ quiet: true });
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

// CLOUDINARY_URLが設定されていれば画像はCloudinaryに保存する（本番用）
// 無ければ今まで通りpublic/uploads/に保存する（ローカル用）
// ※Renderの無料プランはサーバー内のファイルが再起動で消えるため、本番ではCloudinaryが必須
const useCloudinary = !!process.env.CLOUDINARY_URL;
const FOLDER = "wear-cast";

const upload = useCloudinary
    ? multer({ storage: multer.memoryStorage() })
    : multer({ dest: "public/uploads/" });

// アップロードされた画像を保存して、DBに入れるパス（またはURL）を返す
function saveImage(file) {
    if (!file) return Promise.resolve(null);
    if (!useCloudinary) return Promise.resolve("/uploads/" + file.filename);

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: FOLDER }, (err, result) => {
            if (err) return reject(err);
            resolve(result.secure_url);
        });
        stream.end(file.buffer);
    });
}

// 画像を削除する（失敗しても服の削除は成功扱いにするので、ログだけ出す）
function deleteImage(imagePath) {
    if (!imagePath) return;

    if (imagePath.startsWith("http")) {
        // URLの「wear-cast/xxxx.jpg」の部分から拡張子を除いたものがpublic_id
        const match = imagePath.match(new RegExp(`(${FOLDER}/[^/.]+)\\.[a-z0-9]+$`, "i"));
        if (!match) return;
        cloudinary.uploader.destroy(match[1]).catch((err) => {
            console.error("画像の削除に失敗しました:", err);
        });
        return;
    }

    const filePath = path.join(__dirname, "..", "..", "public", imagePath);
    fs.unlink(filePath, (err) => {
        if (err) console.error("画像の削除に失敗しました:", err);
    });
}

module.exports = { upload, saveImage, deleteImage };
