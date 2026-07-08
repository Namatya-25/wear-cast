const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "wear_cast_db"
});

connection.connect((err) => {
    if (err) {
        console.error("データベース接続失敗: " + err.stack);
        return;
    }
    console.log("データベースに接続しました");
});

module.exports = connection;