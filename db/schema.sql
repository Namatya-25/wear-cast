-- 本番DB（TiDB Cloud）でテーブルを作るためのSQL
-- TiDB CloudのSQL Editorに貼り付けて、Shift + Ctrl + Enterで全部実行する
-- （SQL EditorではUSEが次の文に引き継がれないので、テーブル名にDB名をつけている）
CREATE DATABASE IF NOT EXISTS wear_cast_db;

CREATE TABLE IF NOT EXISTS wear_cast_db.clothes (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  category varchar(100) DEFAULT NULL,
  color varchar(50) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  image_path varchar(255) DEFAULT NULL,
  temperature varchar(255) DEFAULT NULL,
  is_favorite tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- すでにテーブルがある場合は、お気に入りの列だけこれで追加する
-- ALTER TABLE wear_cast_db.clothes ADD COLUMN is_favorite tinyint(1) NOT NULL DEFAULT 0;

-- 温度を複数選べるようにしたので（カンマ区切りで保存）、すでにテーブルがある場合は列を長くする
-- ALTER TABLE wear_cast_db.clothes MODIFY temperature varchar(255) DEFAULT NULL;

-- 洋服の色を選べるようにしたので、すでにテーブルがある場合は色の列を追加する
-- ALTER TABLE wear_cast_db.clothes ADD COLUMN color varchar(50) DEFAULT NULL AFTER category;
