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
    const {name, category, color, temperature} = req.body;

    // 必須項目のチェック（名前・服の種類・色・温度）
    if (!name || !name.trim() || !category || !color || !temperature) {
        return res.status(400).send("名前・カテゴリー・色・温度は必須です");
    }

    let imagePath;
    try {
        imagePath = await saveImage(req.file);
    } catch (err) {
        console.error(err);
        return res.status(500).send("画像の保存に失敗しました");
    }

    const sql = "INSERT INTO clothes (name, category, color, temperature, image_path) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [name, category, color, temperature, imagePath], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("保存に失敗しました");
        }
        res.send("服を登録しました");
    });
});


// 服の一覧を取る機能
app.get("/get-clothes", (req, res) => {
    // 新しく登録した服が一覧の左上に来るように、新しい順（idの大きい順）に並べる
    const sql = "SELECT * FROM clothes ORDER BY id DESC";

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
    const {name, category, color, temperature} = req.body;

    let sql = "UPDATE clothes SET name = ?, category = ?, color = ?, temperature = ? WHERE id = ?";
    let values = [name, category, color, temperature, req.params.id];

    if (req.file) {
        let imagePath;
        try {
            imagePath = await saveImage(req.file);
        } catch (err) {
            console.error(err);
            return res.status(500).send("画像の保存に失敗しました");
        }
        sql = "UPDATE clothes SET name = ?, category = ?, color = ?, temperature = ?, image_path = ? WHERE id = ?";
        values = [name, category, color, temperature, imagePath, req.params.id];
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


//お気に入りの切り替えAPI（一覧・詳細の星ボタンから {favorite: true/false} が送られてくる）
app.patch("/api/clothes/:id/favorite", (req, res) => {
    const favorite = req.body && req.body.favorite ? 1 : 0;

    const sql = "UPDATE clothes SET is_favorite = ? WHERE id = ?";
    db.query(sql, [favorite, req.params.id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("お気に入りの更新に失敗しました");
        }
        if (result.affectedRows === 0) {
            return res.status(404).send("見つかりません");
        }
        res.json({ favorite: !!favorite });
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
//緯度経度はPhoton(予備にNominatim、どちらもOpenStreetMap)、天気はMET Norway(ノルウェー気象局)から取得（どちらもAPIキー不要）
//※Open-MeteoはIPアドレスごとの上限があり、Renderの共有IPだと上限を超えてしまうので使わない
//どちらのAPIも「アプリ名と連絡先」をUser-Agentで名乗ることが利用条件になっている
const USER_AGENT = "wear-cast/1.0 https://github.com/Namatya-25/wear-cast";

//MET Norwayの天気記号(symbol_code)を日本語にする（_day/_nightは外してから探す）
//背景画像の判定(index.htmlのsetWeatherBackground)に使うので「晴」「曇」「雨」「雪」「雷」「霧」の字を入れる
const weatherNames = {
    clearsky: "快晴", fair: "晴れ", partlycloudy: "晴れ時々曇り", cloudy: "曇り", fog: "霧",
    lightrain: "小雨", rain: "雨", heavyrain: "大雨",
    lightrainshowers: "にわか雨", rainshowers: "にわか雨", heavyrainshowers: "強いにわか雨",
    lightsleet: "みぞれ（雨と雪）", sleet: "みぞれ（雨と雪）", heavysleet: "みぞれ（雨と雪）",
    lightsleetshowers: "みぞれ（雨と雪）", sleetshowers: "みぞれ（雨と雪）", heavysleetshowers: "みぞれ（雨と雪）",
    lightsnow: "雪", snow: "雪", heavysnow: "大雪",
    lightsnowshowers: "にわか雪", snowshowers: "にわか雪", heavysnowshowers: "にわか雪"
};

function getWeatherName(symbolCode) {
    const name = symbolCode.split("_")[0];
    // 「〜andthunder」は全部雷雨にする
    if (name.includes("thunder")) return "雷雨";
    return weatherNames[name] || "不明";
}

//一度調べた都市の緯度経度を覚えておく（同じ問い合わせを何度も送らないため）
const placeCache = new Map();

//都市名 → {name, lat, lon}（見つからなければnull）
//まずPhotonで探し、Photonがエラーを返したらNominatim(同じOpenStreetMapのデータ)で探す
//※日本の地名はPhotonのほうが正確（例：「那覇」がNominatimだと中国の町になる）
//※RenderのIPはNominatimに断られることがあるので、Nominatimは予備にしている
async function findPlace(city) {
    if (placeCache.has(city)) return placeCache.get(city);

    let place;
    try {
        const photonUrl = "https://photon.komoot.io/api/?limit=1&q=" + encodeURIComponent(city);
        const photonRes = await fetch(photonUrl, { headers: { "User-Agent": USER_AGENT } });
        if (!photonRes.ok) throw new Error(`${photonRes.status} ${(await photonRes.text()).slice(0, 200)}`);
        const feature = (await photonRes.json()).features[0];
        // Photonの座標は[経度, 緯度]の順
        place = feature ? { name: feature.properties.name, lat: feature.geometry.coordinates[1], lon: feature.geometry.coordinates[0] } : null;
    } catch (err) {
        console.error("Photonのエラー（Nominatimで探しなおします）:", err.message);
        const geoUrl = "https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ja&q=" + encodeURIComponent(city);
        const geoRes = await fetch(geoUrl, { headers: { "User-Agent": USER_AGENT } });
        if (!geoRes.ok) throw new Error(`Nominatimのエラー: ${geoRes.status}`);
        const places = await geoRes.json();
        place = places[0] ? { name: places[0].display_name.split(",")[0], lat: places[0].lat, lon: places[0].lon } : null;
    }

    placeCache.set(city, place);
    return place;
}

app.get("/api/weather", async (req, res) => {
    const city = req.query.city;
    if (!city) {
        return res.status(400).send("都市名を入力してください");
    }

    try {
        const place = await findPlace(city);
        if (!place) {
            return res.status(404).send("都市が見つかりません");
        }

        // 緯度経度は小数点4桁までにする（MET Norwayの決まり）
        const lat = Number(place.lat).toFixed(4);
        const lon = Number(place.lon).toFixed(4);
        const weatherUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
        const weatherRes = await fetch(weatherUrl, { headers: { "User-Agent": USER_AGENT } });
        if (!weatherRes.ok) {
            console.error("MET Norwayのエラー:", weatherRes.status, await weatherRes.text());
            return res.status(502).send("天気の取得に失敗しました");
        }
        const weather = await weatherRes.json();

        // timeseriesの先頭が今の時間の予報
        const now = weather.properties.timeseries[0].data;
        res.json({
            city: place.name,
            temperature: Math.round(now.instant.details.air_temperature),
            weather: getWeatherName(now.next_1_hours.summary.symbol_code)
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
        // 温度はカンマ区切りで複数入っているので、FIND_IN_SETでその中に含まれているかを調べる
        const sql = "SELECT id, name, category, image_path FROM clothes WHERE FIND_IN_SET(?, temperature) AND category = ? ORDER BY RAND() LIMIT 1";
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
