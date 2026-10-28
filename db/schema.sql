-- 本番DB（TiDB Cloud）でテーブルを作るためのSQL
-- TiDB CloudのSQL Editorに貼り付けて、Shift + Ctrl + Enterで全部実行する
-- （SQL EditorではUSEが次の文に引き継がれないので、テーブル名にDB名をつけている）
CREATE DATABASE IF NOT EXISTS wear_cast_db;

CREATE TABLE IF NOT EXISTS wear_cast_db.clothes (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  category varchar(100) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  image_path varchar(255) DEFAULT NULL,
  temperature varchar(50) DEFAULT NULL,
  is_favorite tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- すでにテーブルがある場合は、お気に入りの列だけこれで追加する
-- ALTER TABLE wear_cast_db.clothes ADD COLUMN is_favorite tinyint(1) NOT NULL DEFAULT 0;
