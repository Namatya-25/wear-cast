// 服の登録・更新で送られてきた値を確かめる
// 画面では選ぶ形にしているが、画面を通さずに直接送られることもあるので、サーバーでも確かめる
// 値の一覧は画面と同じにしておく（カテゴリーと温度：register.html・edit.html、色：public/color-picker.js）

const NAME_MAX_LENGTH = 50;
const CATEGORIES = ["トップス", "アウター", "ボトムス"];
const COLORS = [
    "白", "黒", "グレー", "赤", "桃色", "オレンジ", "黄色",
    "うす橙（肌色）", "水色", "青", "紺色", "緑", "紫", "ブラウン"
];
// おすすめの服を選ぶとき（server.js の getTemperatureLabel）もこの文字で探すので、変えるときは両方変える
const TEMPERATURES = [
    "暑い日用（25°C以上）",
    "暖かい日用（21°C~24°C）",
    "肌寒い日用（16°C~20°C）",
    "寒い日用（15°C以下）"
];

// 正しければ { value: { name, category, color, temperature } }、だめなら { error: "理由" } を返す
// 名前は前後の空白を取り、温度は重なりを除いて上の並び順にそろえた、DBに入れる形にして返す
function validateClothes(body) {
    const { name, category, color, temperature } = body || {};

    // 同じ名前の項目が2つ送られると配列になるので、文字列かどうかも確かめる
    if (typeof name !== "string" || !name.trim()) {
        return { error: "洋服の名前を入力してください" };
    }
    const trimmedName = name.trim();
    // 絵文字なども1文字として数える（.length だと2文字になるものがある）
    if ([...trimmedName].length > NAME_MAX_LENGTH) {
        return { error: `洋服の名前は${NAME_MAX_LENGTH}文字までにしてください` };
    }
    if (!CATEGORIES.includes(category)) {
        return { error: "カテゴリーを選び直してください" };
    }
    if (!COLORS.includes(color)) {
        return { error: "色を選び直してください" };
    }
    if (typeof temperature !== "string" || !temperature) {
        return { error: "温度を1つ以上選んでください" };
    }
    // 温度はカンマ区切りの1つの文字列で送られてくる
    const picked = temperature.split(",");
    if (!picked.every((t) => TEMPERATURES.includes(t))) {
        return { error: "温度を選び直してください" };
    }

    return {
        value: {
            name: trimmedName,
            category,
            color,
            temperature: TEMPERATURES.filter((t) => picked.includes(t)).join(",")
        }
    };
}

module.exports = { validateClothes, NAME_MAX_LENGTH };
