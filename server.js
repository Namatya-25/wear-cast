const express = require("express");
const app = express();
const db = require("./src/config/db.js");
// Renderではポート番号が環境変数PORTで渡される
const port = process.env.PORT || 3000;
const { upload, saveImage, deleteImage } = require("./src/config/storage.js");
app.use(express.static('public'));

app.use(express.json());

app.get("/", (req, res) => {
    res.send("サーバーは正常に稼働中です")
});


app.listen(port, () => {
    console.log(`サーバがポート ${port} で起動しました`)
});

//画像アップロード機能付きの登録API
app.post("/add-clothes", upload.single("image"), async (req, res) => {
    const {name, category, temperature} = req.body;

    // 必須項目のチェック（名前・服の種類・温度）
    if (!name || !name.trim() || !category || !temperature) {
        return res.status(400).send("名前・カテゴリー・温度は必須です");
    }

    let imagePath;
    try {
        imagePath = await saveImage(req.file);
    } catch (err) {
        console.error(err);
        return res.status(500).send("画像の保存に失敗しました");
    }

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
app.put("/api/clothes/:id", upload.single("image"), async (req, res) => {
    const {name, category, temperature} = req.body;

    let sql = "UPDATE clothes SET name = ?, category = ?, temperature = ? WHERE id = ?";
    let values = [name, category, temperature, req.params.id];

    if (req.file) {
        let imagePath;
        try {
            imagePath = await saveImage(req.file);
        } catch (err) {
            console.error(err);
            return res.status(500).send("画像の保存に失敗しました");
        }
        sql = "UPDATE clothes SET name = ?, category = ?, temperature = ?, image_path = ? WHERE id = ?";
        values = [name, category, temperature, imagePath, req.params.id];
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
            deleteImage(imagePath);
            res.send("服を削除しました");
        });
    });
});







//ホーム画面の天気API（都市名 → 緯度経度 → 現在の気温と天気）
//緯度経度はNominatim(OpenStreetMap)、天気はOpen-Meteoから取得（どちらもAPIキー不要）
const weatherNames = {
    0: "快晴", 1: "晴れ", 2: "晴れ時々曇り", 3: "曇り",
    45: "霧", 48: "霧",
    51: "霧雨", 53: "霧雨", 55: "霧雨", 56: "霧雨", 57: "霧雨",
    61: "雨", 63: "雨", 65: "大雨", 66: "雨", 67: "大雨",
    71: "雪", 73: "雪", 75: "大雪", 77: "雪",
    80: "にわか雨", 81: "にわか雨", 82: "強いにわか雨",
    85: "にわか雪", 86: "にわか雪",
    95: "雷雨", 96: "雷雨", 99: "雷雨"
};

app.get("/api/weather", async (req, res) => {
    const city = req.query.city;
    if (!city) {
        return res.status(400).send("都市名を入力してください");
    }

    try {
        // 都市名をurlに変換
        const geoUrl = "https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ja&q=" + encodeURIComponent(city);
        // 身分証明書の提示
        const geoRes = await fetch(geoUrl, { headers: { "User-Agent": "wear-cast" } });
        const places = await geoRes.json();
        if (places.length === 0) {
            return res.status(404).send("都市が見つかりません");
        }
        const place = places[0];

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weather = await weatherRes.json();
        // エラーのときは{error: true, reason: "..."}が返ってくるので、理由をログに出す
        if (!weather.current) {
            console.error("Open-Meteoのエラー:", weatherRes.status, weather.reason);
            return res.status(502).send("天気の取得に失敗しました");
        }

        res.json({
            city: place.display_name.split(",")[0],
            temperature: Math.round(weather.current.temperature_2m),
            weather: weatherNames[weather.current.weather_code] || "不明"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("天気の取得に失敗しました");
    }
});


//ホーム画面のおすすめコーディネートAPI（気温 → 温度区分 → カテゴリーごとに1着ずつランダムに選ぶ）
//温度区分の文字列は登録画面(register.html)の選択肢と同じにする
function getTemperatureLabel(temperature) {
    if (temperature >= 25) return "暑い日用（25°C以上）";
    if (temperature >= 21) return "暖かい日用（21°C~24°C）";
    if (temperature >= 16) return "肌寒い日用（16°C~20°C）";
    return "寒い日用（15°C以下）";
}

app.get("/api/recommend", async (req, res) => {
    const temperature = Number(req.query.temperature);
    if (req.query.temperature === undefined || Number.isNaN(temperature)) {
        return res.status(400).send("気温を指定してください");
    }

    const label = getTemperatureLabel(temperature);

    // 20°C以下の日はアウターも追加する
    const categories = { tops: "トップス", bottoms: "ボトムス" };
    if (temperature <= 20) categories.outer = "アウター";

    try {
        const sql = "SELECT id, name, category, image_path FROM clothes WHERE temperature = ? AND category = ? ORDER BY RAND() LIMIT 1";
        const result = { label };

        // 服が登録されていないカテゴリーはnullにする
        for (const [key, category] of Object.entries(categories)) {
            const [rows] = await db.promise().query(sql, [label, category]);
            result[key] = rows[0] || null;
        }
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send("おすすめの取得に失敗しました");
    }
});
