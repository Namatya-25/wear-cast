// 天気の文字（server.jsのweatherNames）に合わせた天気アイコン（SVG）
// 太陽はオレンジ、雲は灰色、雨は青、雷は黄色のフラットなデザイン

const ICON_COLORS = {
    sun: "#FBB03B",
    cloud: "#DDE3EA",
    cloudLine: "#AEBAC5",
    rain: "#3A9AD9",
    snow: "#7FB3D5",
    bolt: "#F5C21B",
    fog: "#AEBAC5"
};

// 太陽（cx, cy：中心、r：丸の大きさ）
function sunSvg(cx, cy, r) {
    let rays = "";
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const x1 = cx + Math.cos(angle) * (r + 3);
        const y1 = cy + Math.sin(angle) * (r + 3);
        const x2 = cx + Math.cos(angle) * (r + 7);
        const y2 = cy + Math.sin(angle) * (r + 7);
        rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    return `
        <g stroke="${ICON_COLORS.sun}" stroke-width="3" stroke-linecap="round">${rays}</g>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${ICON_COLORS.sun}"/>`;
}

// 雲（dx, dy：ずらす量）
function cloudSvg(dx = 0, dy = 0) {
    return `
        <path transform="translate(${dx} ${dy})" fill="${ICON_COLORS.cloud}" stroke="${ICON_COLORS.cloudLine}" stroke-width="1.5" stroke-linejoin="round"
            d="M20 46H46A10 10 0 0 0 46 26A13 13 0 0 0 22 28A9.5 9.5 0 0 0 20 46Z"/>`;
}

// 雨つぶ（xsの位置に並べる）
function dropsSvg(xs, y = 46) {
    return xs.map(x => `<path fill="${ICON_COLORS.rain}" d="M${x} ${y}c2.5 3.5 3.5 6 0 7.5c-3.5-1.5-2.5-4 0-7.5z"/>`).join("");
}

// 強い雨（ななめの線）
function streaksSvg(xs, y = 45) {
    return `<g stroke="${ICON_COLORS.rain}" stroke-width="3" stroke-linecap="round">` +
        xs.map(x => `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 10}"/>`).join("") + "</g>";
}

// 雪の結晶（3本の線を重ねた形）
function flakesSvg(xs, y = 51) {
    return `<g stroke="${ICON_COLORS.snow}" stroke-width="2.2" stroke-linecap="round">` +
        xs.map(x => `
            <line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 4}"/>
            <line x1="${x - 3.5}" y1="${y - 2}" x2="${x + 3.5}" y2="${y + 2}"/>
            <line x1="${x - 3.5}" y1="${y + 2}" x2="${x + 3.5}" y2="${y - 2}"/>`).join("") + "</g>";
}

// 雷
function boltSvg() {
    return `<path fill="${ICON_COLORS.bolt}" stroke="#E0A800" stroke-width="1" stroke-linejoin="round" d="M33 40L26 52H32L28 62L40 48H34L38 40Z"/>`;
}

// 霧（横線）
function fogSvg() {
    return `<g stroke="${ICON_COLORS.fog}" stroke-width="3" stroke-linecap="round">
        <line x1="12" y1="46" x2="52" y2="46"/><line x1="16" y1="52" x2="48" y2="52"/><line x1="12" y1="58" x2="44" y2="58"/></g>`;
}

// 天気の文字 → アイコンの中身（雨や雪のときは雲を上にずらして下に降るものを描く）
const WEATHER_ICONS = {
    "快晴": () => sunSvg(32, 32, 12),
    "晴れ": () => sunSvg(32, 32, 10),
    "晴れ時々曇り": () => sunSvg(42, 22, 8) + cloudSvg(-4, 6),
    "曇り": () => cloudSvg(-1, 0),
    "霧": () => cloudSvg(0, -10) + fogSvg(),
    "小雨": () => cloudSvg(0, -10) + dropsSvg([26, 38]),
    "雨": () => cloudSvg(0, -10) + dropsSvg([20, 30, 40]),
    "大雨": () => cloudSvg(0, -10) + streaksSvg([22, 32, 42]),
    "にわか雨": () => sunSvg(44, 16, 7) + cloudSvg(-4, -6) + dropsSvg([22, 34]),
    "強いにわか雨": () => sunSvg(44, 16, 7) + cloudSvg(-4, -6) + streaksSvg([24, 34]),
    "みぞれ（雨と雪）": () => cloudSvg(0, -10) + dropsSvg([22, 32]) + flakesSvg([42]),
    "雪": () => cloudSvg(0, -10) + flakesSvg([24, 40]),
    "大雪": () => cloudSvg(0, -10) + flakesSvg([18, 32, 46]),
    "にわか雪": () => sunSvg(44, 16, 7) + cloudSvg(-4, -6) + flakesSvg([22, 36]),
    "雷雨": () => cloudSvg(0, -10) + boltSvg()
};

// 天気の文字からアイコンのSVGを作る（わからない天気のときは空文字）
function getWeatherIcon(weather) {
    const draw = WEATHER_ICONS[weather];
    if (!draw) return "";
    return `<svg viewBox="0 0 64 64" class="w-full h-full" role="img" aria-label="${weather}のアイコン">${draw()}</svg>`;
}
