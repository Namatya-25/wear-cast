const express = require("express");
const app = express();
const db = require("./src/config/db.js");
const port = 3000;

app.use(express.json());

app.get("/", (req, res) => {
    res.send("サーバーは正常に稼働中です")
});


app.listen(port, () => {
    console.log(`サーバがポート ${port} で起動しました`)
});

//データを登録する機能 多分仮
app.post("/add-clothes", (req, res) => {
    const {name, category} = req.body;
    const sql = "INSERT INTO clothes (name, category) VALUES (?, ?)";

    db.query(sql, [name, category], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("保存に失敗しました");
        }
        res.send("服を登録しました");
    });
});
