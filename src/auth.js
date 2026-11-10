require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const cookieSession = require("cookie-session");
const db = require("./config/db.js");

// アプリのURL（GoogleのログインのあとにGoogleが戻ってくる先に使う）。本番では https://〜.onrender.com を入れる
const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = BASE_URL + "/auth/google/callback";

if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRETが設定されていません。本番では必ず設定してください");
}

// ログインしていなくても見られる画面
const PUBLIC_PAGES = ["/welcome.html", "/login.html", "/signup.html"];

// パスワードは8〜20字の半角英数字
const PASSWORD_PATTERN = /^[A-Za-z0-9]{8,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setup(app) {
    // ログイン状態は署名つきのCookieに入れる（サーバーに保存しないので、Renderが再起動しても消えない）
    app.use(cookieSession({
        name: "session",
        secret: process.env.SESSION_SECRET || "wear-cast-local-secret",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30日間ログインしたままにする
        httpOnly: true,
        sameSite: "lax", // Googleから戻ってきたときにもCookieが送られるようにlaxにする
        secure: BASE_URL.startsWith("https")
    }));

    // サーバーに届けるための窓口
    app.post("/api/signup", signup);
    app.post("/api/login", login);
    app.post("/logout", logout);
    app.get("/api/me", me);
    app.get("/auth/google", googleStart);
    app.get("/auth/google/callback", googleCallback);
}

// 画面（HTML）を返す前のチェック
function guardPages(req, res, next) {
    const isPage = req.path === "/" || req.path.endsWith(".html");
    if (!isPage) return next();

    const loggedIn = !!req.session.userId;
    if (PUBLIC_PAGES.includes(req.path)) {
        return loggedIn ? res.redirect("/index.html") : next();
    }
    if (!loggedIn) return res.redirect("/welcome.html");
    next();
}

// APIのチェック（ログインしていなければ401を返す）
function requireLogin(req, res, next) {
    if (!req.session.userId) return res.status(401).send("ログインしてください");
    next();
}


// ---------- パスワード ----------
// パスワードはそのまま保存せず、scrypt（Node.jsに入っている仕組み）で「ソルト:ハッシュ」にして保存する

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");
        crypto.scrypt(password, salt, 64, (err, key) => {
            if (err) return reject(err);
            resolve(salt + ":" + key.toString("hex"));
        });
    });
}

function verifyPassword(password, stored) {
    return new Promise((resolve, reject) => {
        const [salt, hash] = stored.split(":");
        crypto.scrypt(password, salt, 64, (err, key) => {
            if (err) return reject(err);
            // 比べるのにかかる時間からパスワードを推測されないように、timingSafeEqualで比べる
            resolve(crypto.timingSafeEqual(Buffer.from(hash, "hex"), key));
        });
    });
}

function normalizeEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}


// ---------- メールアドレスで新規登録・ログイン ----------

async function signup(req, res) {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).send("メールアドレスを正しく入力してください");
    }
    if (typeof password !== "string" || !PASSWORD_PATTERN.test(password)) {
        return res.status(400).send("パスワードは8〜20字の半角英数字で設定してください");
    }

    try {
        const passwordHash = await hashPassword(password);
        const [result] = await db.promise().query(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)", [email, passwordHash]);
        req.session.userId = result.insertId;
        res.send("登録しました");
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).send("このメールアドレスはすでに登録されています");
        }
        console.error(err);
        res.status(500).send("登録に失敗しました");
    }
}

// ここから

async function login(req, res) {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    // どちらが違うのかは教えない（登録されているメールアドレスを調べられないようにする）
    const failMessage = "メールアドレスまたはパスワードが違います";

    if (!email || typeof password !== "string" || !password) {
        return res.status(400).send("メールアドレスとパスワードを入力してください");
    }

    try {
        const [rows] = await db.promise().query("SELECT id, password_hash FROM users WHERE email = ?", [email]);
        const user = rows[0];
        if (!user) return res.status(401).send(failMessage);
        // Googleで登録した人・Googleをつなげた人はパスワードを持っていない
        if (!user.password_hash) {
            return res.status(401).send("このアカウントはGoogleでログインするようになっています。「Googleでログイン」を使ってください");
        }
        if (!(await verifyPassword(password, user.password_hash))) {
            return res.status(401).send(failMessage);
        }
        req.session.userId = user.id;
        res.send("ログインしました");
    } catch (err) {
        console.error(err);
        res.status(500).send("ログインに失敗しました");
    }
}

function logout(req, res) {
    req.session = null;
    res.redirect("/welcome.html");
}

async function me(req, res) {
    if (!req.session.userId) return res.status(401).send("ログインしてください");
    try {
        const [rows] = await db.promise().query("SELECT email FROM users WHERE id = ?", [req.session.userId]);
        // ユーザーが消えていたらログアウト扱いにする
        if (!rows[0]) {
            req.session = null;
            return res.status(401).send("ログインしてください");
        }
        res.json({ email: rows[0].email });
    } catch (err) {
        console.error(err);
        res.status(500).send("取得に失敗しました");
    }
}


// ---------- Googleで新規登録・ログイン ----------
// 流れ：Googleの画面へ移動 → ユーザーがアカウントを選ぶ → /auth/google/callback?code=〜 に戻ってくる
//      → codeをGoogleに送ってユーザー情報（id_token）をもらう → usersに保存してログイン
// エラーのときは、元の画面（login.htmlかsignup.html）に ?error=〜 をつけて戻す

function googleStart(req, res) {
    const from = req.query.from === "signup" ? "signup" : "login";
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.redirect(`/${from}.html?error=google_not_ready`);
    }

    // stateは、戻ってきたのが本当にこのアプリから始めたログインかを確かめるための合言葉
    const state = crypto.randomBytes(16).toString("hex");
    req.session.googleState = state;
    req.session.googleFrom = from;

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: "openid email",
        state,
        prompt: "select_account" // 毎回アカウントを選べるようにする
    });
    res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params);
}




async function googleCallback(req, res) {
    const from = req.session.googleFrom || "login";
    const expectedState = req.session.googleState;
    delete req.session.googleState;
    delete req.session.googleFrom;
    const fail = (code) => res.redirect(`/${from}.html?error=${code}`);

    // Googleの画面でキャンセルされたとき
    if (req.query.error) return fail("google_cancel");
    if (!req.query.code || !expectedState || req.query.state !== expectedState) return fail("google_failed");

    try {
        // codeをGoogleに送って、ユーザー情報の入ったid_tokenをもらう
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: req.query.code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: "authorization_code"
            })
        });
        if (!tokenRes.ok) {
            console.error("Googleのエラー:", tokenRes.status, await tokenRes.text());
            return fail("google_failed");
        }
        const { id_token } = await tokenRes.json();

        // id_tokenは「ヘッダー.中身.署名」の形。Googleから直接(https)受け取ったので、中身をそのまま読んでよい
        const profile = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString());
        const googleId = profile.sub;
        const email = normalizeEmail(profile.email);
        if (!googleId || !email || !profile.email_verified) return fail("google_failed");

        // 前にGoogleで登録している人はそのままログイン
        const [users] = await db.promise().query("SELECT id FROM users WHERE google_id = ?", [googleId]);
        if (users[0]) {
            req.session.userId = users[0].id;
            return res.redirect("/index.html?login=1");
        }

        // 同じメールアドレスがパスワードで登録されているときは、そのアカウントにGoogleをつなげて、パスワードは消す
        // （新規登録ではメールアドレスが本人のものか確かめていないので、他人が先に登録していたかもしれない。
        //   Googleで確認できたこの人が本当の持ち主なので、パスワードを消して他人が入れないようにする）
        const [sameEmail] = await db.promise().query("SELECT id, google_id FROM users WHERE email = ?", [email]);
        if (sameEmail[0]) {
            // 別のGoogleアカウントがすでにつながっているときはつなげない
            if (sameEmail[0].google_id) return fail("google_failed");
            await db.promise().query(
                "UPDATE users SET google_id = ?, password_hash = NULL WHERE id = ?", [googleId, sameEmail[0].id]);
            req.session.userId = sameEmail[0].id;
            return res.redirect("/index.html?login=1");
        }

        // 初めての人は新しく登録する
        const [result] = await db.promise().query(
            "INSERT INTO users (email, google_id) VALUES (?, ?)", [email, googleId]);
        req.session.userId = result.insertId;
        res.redirect("/index.html?login=1");
    } catch (err) {
        console.error(err);
        fail("google_failed");
    }
}

module.exports = { setup, guardPages, requireLogin };
