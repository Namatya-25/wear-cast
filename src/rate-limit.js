// 回数制限（同じ人が短い時間に何回も試せないようにする）
// 数はサーバーのメモリに入れておく。Renderが再起動すると0に戻るが、総当たりを止めるにはこれで十分
//
// 使い方：
//   const limiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
//   const wait = limiter.hit(key); // 1回数える。上限を超えていたら「あと何秒待てばいいか」、まだ大丈夫なら0を返す
//   limiter.reset(key);            // 数を0に戻す（ログインに成功したときなど）

function createLimiter({ windowMs, max }) {
    const records = new Map(); // key → { count, resetAt }

    // 期間が終わった記録を1分ごとに消す（メモリが増え続けないように）
    // unref() をつけて、このタイマーのせいでサーバーが終われなくならないようにする
    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of records) {
            if (record.resetAt <= now) records.delete(key);
        }
    }, 60 * 1000).unref();

    function hit(key) {
        const now = Date.now();
        let record = records.get(key);
        if (!record || record.resetAt <= now) {
            record = { count: 0, resetAt: now + windowMs };
            records.set(key, record);
        }
        record.count++;
        if (record.count > max) {
            return Math.ceil((record.resetAt - now) / 1000);
        }
        return 0;
    }

    function reset(key) {
        records.delete(key);
    }

    return { hit, reset };
}

// 制限にかかったときの返事（429）。Retry-Afterヘッダーで何秒待てばいいかも伝える
function sendTooMany(res, waitSeconds) {
    const minutes = Math.max(1, Math.ceil(waitSeconds / 60));
    res.set("Retry-After", String(waitSeconds));
    res.status(429).send(`試した回数が多すぎます。${minutes}分ほど時間をおいてから、もう一度お試しください`);
}

module.exports = { createLimiter, sendTooMany };
