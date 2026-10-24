# WearCast

今日の天気と気温に合わせて、手持ちの服からコーディネートを提案するWebアプリです。
自分の服を写真付きで登録しておくと、都市名を検索したときにその気温に合った服を「アウター＋トップス＋ボトムス」で表示します。

## 作った理由

毎朝、その日の気温に合う服を考えるのに時間がかかっていたため、
手持ちの服から気温に合ったコーディネートを自動で提案するアプリを作りました。

## 主な機能

- **天気検索**：都市名を入力すると、現在の気温と天気を表示
- **おすすめコーディネート**：気温に合う服をカテゴリーごとにランダムで1着ずつ表示（20°C以下のときはアウターも表示）
- **服の登録**：名前・カテゴリー・温度区分・画像を登録
- **一覧**：登録した服をページネーション付きで表示
- **詳細・編集・削除**：服の情報を確認、変更、削除（削除時は画像ファイルも削除）

## 使用技術

| 区分 | 技術 |
| --- | --- |
| フロントエンド | HTML / JavaScript / Tailwind CSS |
| バックエンド | Node.js / Express |
| データベース | MySQL（MariaDB） |
| 画像アップロード | multer |
| 外部API | [Nominatim](https://nominatim.org/)（都市名 → 緯度経度）、[Open-Meteo](https://open-meteo.com/)（天気） ※どちらもAPIキー不要 |

## セットアップ

### 1. 必要なもの

- Node.js（v18以上。`fetch` を使っているため）
- MySQL または MariaDB（XAMPPなど）

### 2. パッケージのインストール

```bash
npm install
```

### 3. データベースの作成

```sql
CREATE DATABASE wear_cast_db DEFAULT CHARACTER SET utf8mb4;
USE wear_cast_db;

CREATE TABLE clothes (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  image_path VARCHAR(255) DEFAULT NULL,
  temperature VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (id)
) DEFAULT CHARSET=utf8mb4;
```

接続設定は `src/config/db.js` にあります（初期値：`localhost` / ユーザー `root` / パスワードなし）。

### 4. サーバーの起動

```bash
node server.js
```

起動したら http://localhost:3000 を開きます。

## API

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/weather?city=都市名` | 都市の現在の気温と天気 |
| GET | `/api/recommend?temperature=気温` | 気温に合うおすすめの服 |
| POST | `/add-clothes` | 服の登録（multipart/form-data） |
| GET | `/get-clothes` | 服の一覧 |
| GET | `/api/clothes/:id` | 服の詳細 |
| PUT | `/api/clothes/:id` | 服の更新（画像は選んだときだけ差し替え） |
| DELETE | `/api/clothes/:id` | 服の削除 |

## 登録データの区分

**カテゴリー**：トップス / アウター / ボトムス

**温度区分**（おすすめは気温からこの区分を選びます）

| 区分 | 気温 |
| --- | --- |
| 暑い日用 | 25°C以上 |
| 暖かい日用 | 21°C〜24°C |
| 肌寒い日用 | 16°C〜20°C |
| 寒い日用 | 15°C以下 |

## ディレクトリ構成

```
wear-cast/
├── server.js           # Expressサーバー・API
├── src/config/db.js    # DB接続設定
└── public/             # 画面（静的ファイル）
    ├── index.html
    ├── register.html
    ├── list.html
    ├── detail.html
    ├── edit.html
    ├── style.css
    └── uploads/        # アップロードされた画像
```
