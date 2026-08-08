const express = require("express");
const app = express();
const db = require("./src/config/db.js");
const port = 3000;
const multer = require("multer");
const upload = multer({ dest: "public/uploads/"});
app.use(express.static('public'));

app.use(express.json());

app.get("/", (req, res) => {
    res.send("サーバーは正常に稼働中です")
});


app.listen(port, () => {
    console.log(`サーバがポート ${port} で起動しました`)
});

//画像アップロード機能付きの登録API
app.post("/add-clothes", upload.single("image"), (req, res) => {
    const {name, category, temperature} = req.body;
    const imagePath = req.file ? "/uploads/" + req.file.filename : null;

    const sql = "INSERT INTO clothes (name, category, temperature, image_path) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, category, temperature, imagePath], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("保存に失敗しました");
        }
        res.send("服を登録しました");
    });
});


// 服の一覧を取る機能
app.get("/get-clothes", (req, res) => {
    const sql = "SELECT * FROM clothes";

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("取得に失敗しました");
        }
        res.json(results);
    });
});



//詳細画面の取得用エンドポイント（最終的にjsonを返す）
app.get("/api/clothes/:id", (req, res) => {
    // そのidの行のデータをすべて取得(nameとかcategoryとか)
    const sql = "SELECT * FROM clothes WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if(err) {
            console.error(err);
            return res.status(500).send("エラーが発生しました");
        }
        if(result.length === 0) {
            return res.status(404).send("見つかりません");
        }
        res.json(result[0]);
    });
});







