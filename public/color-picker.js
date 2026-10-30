// 洋服の色
// 登録・編集画面：14色の丸を並べて、タップした色に✓を付ける（1つだけ選べる・もう一度押すと外れる）
// 詳細画面：選んだ色の丸と名前を出す

// 色の名前と丸の色（lightは明るい色：✓を黒にして、白い背景でも見えるように枠線を付ける）
const CLOTHES_COLORS = [
    { name: "白", hex: "#FFFFFF", light: true },
    { name: "黒", hex: "#222222" },
    { name: "グレー", hex: "#9E9E9E" },
    { name: "赤", hex: "#E53935" },
    { name: "桃色", hex: "#F48FB1", light: true },
    { name: "オレンジ", hex: "#FB8C00" },
    { name: "黄色", hex: "#FDD835", light: true },
    { name: "うす橙（肌色）", hex: "#F8D3B0", light: true },
    { name: "水色", hex: "#81D4FA", light: true },
    { name: "青", hex: "#1E88E5" },
    { name: "紺色", hex: "#1A237E" },
    { name: "緑", hex: "#43A047" },
    { name: "紫", hex: "#8E24AA" },
    { name: "ブラウン", hex: "#795548" }
];

function findClothesColor(name) {
    return CLOTHES_COLORS.find((c) => c.name === name);
}

// 色の丸（sizeClassで大きさを決める）
function colorCircleHtml(color, sizeClass) {
    return `<span class="${sizeClass} shrink-0 rounded-full border border-gray-300 inline-flex items-center justify-center" style="background-color: ${color.hex}"></span>`;
}

// 登録・編集画面用：色の丸を並べる（選んだ色はhiddenの<input id="color">に入れるので、送信側はそのvalueを読むだけでよい）
function renderColorPicker(boxId) {
    const box = document.getElementById(boxId);
    box.innerHTML = `
        <input type="hidden" id="color" value="">
        <div class="grid grid-cols-7 gap-2 justify-items-center">
            ${CLOTHES_COLORS.map((c) => `
                <button type="button" data-color="${c.name}" onclick="selectColor(this.dataset.color)"
                    aria-label="${c.name}" aria-pressed="false" title="${c.name}"
                    class="color-swatch w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center transition hover:scale-110"
                    style="background-color: ${c.hex}">
                    <i class="fa-solid fa-check text-lg hidden ${c.light ? "text-gray-800" : "text-white"}"></i>
                </button>`).join("")}
        </div>
        <p id="color-selected" class="text-sm text-gray-600 mt-2">選択中：なし</p>`;
}

// 色を選ぶ（同じ色をもう一度押したら外す）。編集画面で保存されている色を入れるときにも使う
function selectColor(name) {
    const input = document.getElementById("color");
    const next = findClothesColor(name) && input.value !== name ? name : "";
    input.value = next;
    document.querySelectorAll(".color-swatch").forEach((btn) => {
        const selected = btn.dataset.color === next;
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        btn.querySelector("i").classList.toggle("hidden", !selected);
    });
    document.getElementById("color-selected").textContent = `選択中：${next || "なし"}`;
}

// 詳細画面用：色の丸と名前（登録されていない服は「未設定」）
function colorLabelHtml(name) {
    const color = findClothesColor(name);
    if (!color) return "未設定";
    return `<span class="inline-flex items-center gap-2">${colorCircleHtml(color, "w-6 h-6")}${color.name}</span>`;
}
