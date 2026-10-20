const express = require("express");
const app = express();
const db = require("./src/config/db.js");
const port = 3000;
const multer = require("multer");
const fs = require("fs");
const path = require("path");
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


//編集画面からの更新API（画像は新しく選ばれたときだけ差し替える）
app.put("/api/clothes/:id", upload.single("image"), (req, res) => {
    const {name, category, temperature} = req.body;

    let sql = "UPDATE clothes SET name = ?, category = ?, temperature = ? WHERE id = ?";
    let values = [name, category, temperature, req.params.id];

    if (req.file) {
        sql = "UPDATE clothes SET name = ?, category = ?, temperature = ?, image_path = ? WHERE id = ?";
        values = [name, category, temperature, "/uploads/" + req.file.filename, req.params.id];
    }

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("更新に失敗しました");
        }
        if (result.affectedRows === 0) {
            return res.status(404).send("見つかりません");
        }
        res.send("服を更新しました");
    });
});


//詳細画面からの削除API（画像ファイルも一緒に消す）
app.delete("/api/clothes/:id", (req, res) => {
    // 先に画像のパスを取得しておく
    const selectSql = "SELECT image_path FROM clothes WHERE id = ?";

    db.query(selectSql, [req.params.id], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send("削除に失敗しました");
        }
        if (rows.length === 0) {
            return res.status(404).send("見つかりません");
        }
        const imagePath = rows[0].image_path;

        const deleteSql = "DELETE FROM clothes WHERE id = ?";
        db.query(deleteSql, [req.params.id], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("削除に失敗しました");
            }

            // 画像ファイルを削除（ファイルが無くても服の削除は成功扱い）
            if (imagePath) {
                const filePath = path.join(__dirname, "public", imagePath);
                fs.unlink(filePath, (err) => {
                    if (err) console.error("画像の削除に失敗しました:", err);
                });
            }
            res.send("服を削除しました");
        });
    });
});







