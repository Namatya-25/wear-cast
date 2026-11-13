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

// 写真はブラウザで縮めてから送るのでふつうは1MBもないが、縮められない写真（HEICなど）はそのまま来るので10MBまでにする
// 本番ではいったんメモリに入れるので、上限が無いと大きなファイルでサーバーのメモリが足りなくなる
const MAX_IMAGE_MB = 10;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

const upload = multer({
    storage: useCloudinary ? multer.memoryStorage() : multer.diskStorage({ destination: "public/uploads/" }),
    limits: {
        fileSize: MAX_IMAGE_MB * 1024 * 1024,
        files: 1,       // 写真は1枚だけ
        fields: 10,     // 写真以外の項目（名前・カテゴリーなど）の数
        fieldSize: 10 * 1024 // 写真以外の項目は1つ10KBまで
    },
    // 画像以外のファイルは受け取らない
    fileFilter: (req, file, cb) => {
        if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
        const err = new Error("画像はJPEG・PNG・WebP・GIF・HEICのどれかを選んでください");
        err.status = 400;
        cb(err);
    }
});

// 写真を1枚受け取る（name="image"）。大きすぎる・画像ではないときは、500ではなく400で理由を返す
function uploadImage(req, res, next) {
    upload.single("image")(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? `画像は${MAX_IMAGE_MB}MBまでにしてください`
                : "送られたデータが正しくありません";
            return res.status(400).send(message);
        }
        if (err.status === 400) return res.status(400).send(err.message);
        console.error(err);
        res.status(500).send("画像の受け取りに失敗しました");
    });
}

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

module.exports = { uploadImage, saveImage, deleteImage };
