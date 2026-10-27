require("dotenv").config({ quiet: true });
const mysql = require("mysql2");

// 接続情報は.envから読む（無ければローカルのXAMPPの設定を使う）
// 本番のTiDB CloudはSSL接続が必須なので、DB_SSL=trueのときだけSSLを有効にする
// 長時間放置すると接続が切れるので、createConnectionではなくpoolを使う
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wear_cast_db",
    ssl: process.env.DB_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 5
});

// 起動時に一度だけ接続できるか確認する
pool.getConnection((err, connection) => {
    if (err) {
        console.error("データベース接続失敗: " + err.stack);
        return;
    }
    console.log("データベースに接続しました");
    connection.release();
});

module.exports = pool;
