-- 本番DB（TiDB Cloud）でテーブルを作るためのSQL
-- TiDB CloudのSQL Editorに貼り付けて、Shift + Ctrl + Enterで全部実行する
-- （SQL EditorではUSEが次の文に引き継がれないので、テーブル名にDB名をつけている）
CREATE DATABASE IF NOT EXISTS wear_cast_db;

CREATE TABLE IF NOT EXISTS wear_cast_db.clothes (
  id int NOT NULL AUTO_INCREMENT,
  user_id int DEFAULT NULL,
  name varchar(255) NOT NULL,
  category varchar(100) DEFAULT NULL,
  color varchar(50) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  image_path varchar(255) DEFAULT NULL,
  temperature varchar(255) DEFAULT NULL,
  is_favorite tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY user_id (user_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- すでにテーブルがある場合は、お気に入りの列だけこれで追加する
-- ALTER TABLE wear_cast_db.clothes ADD COLUMN is_favorite tinyint(1) NOT NULL DEFAULT 0;

-- 温度を複数選べるようにしたので（カンマ区切りで保存）、すでにテーブルがある場合は列を長くする
-- ALTER TABLE wear_cast_db.clothes MODIFY temperature varchar(255) DEFAULT NULL;

-- 洋服の色を選べるようにしたので、すでにテーブルがある場合は色の列を追加する
-- ALTER TABLE wear_cast_db.clothes ADD COLUMN color varchar(50) DEFAULT NULL AFTER category;

-- ログイン機能のためのユーザーのテーブル
-- メールアドレスで登録した人はpassword_hash、Googleで登録した人はgoogle_idが入る
CREATE TABLE IF NOT EXISTS wear_cast_db.users (
  id int NOT NULL AUTO_INCREMENT,
  email varchar(255) NOT NULL,
  password_hash varchar(255) DEFAULT NULL,
  google_id varchar(255) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY google_id (google_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 洋服を誰が登録したかを入れる列（すでにテーブルがある場合はこれで追加する）
-- ALTER TABLE wear_cast_db.clothes ADD COLUMN user_id int DEFAULT NULL AFTER id, ADD INDEX user_id (user_id);

-- ログイン機能を入れる前に登録した洋服を、自分のアカウントのものにする
-- （先にアプリで新規登録して、SELECT id, email FROM wear_cast_db.users; で自分のidを調べてから実行する）
-- UPDATE wear_cast_db.clothes SET user_id = 自分のid WHERE user_id IS NULL;
