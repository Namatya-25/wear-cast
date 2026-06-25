const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: ""
});

connection.connect((err) => {
    if (err) throw err;
    console.log("データベースに接続しました");
});

module.exports = connection;