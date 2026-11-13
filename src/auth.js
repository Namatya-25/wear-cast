require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const cookieSession = require("cookie-session");
const db = require("./config/db.js");
const { sendVerificationEmail } = require("./mail.js");
const { createLimiter, sendTooMany } = require("./rate-limit.js");

// ---------- 回数制限 ----------
// ログイン：同じIPから15分に10回まで、同じメールアドレスへは15分に5回まで（成功したらメールアドレスの数は0に戻す）
//   パスワードを調べる前に数えるので、同時にたくさん送られても上限より多くは試せない
// 新規登録・確認メールの再送：メールを送るので、同じIPから合わせて1時間に5回まで
//   （同じメールアドレスへの再送は、これとは別に1分に1回まで。RESEND_WAIT_SECONDS）
const MINUTE = 60 * 1000;
const loginIpLimiter = createLimiter({ windowMs: 15 * MINUTE, max: 10 });
const loginEmailLimiter = createLimiter({ windowMs: 15 * MINUTE, max: 5 });
const mailIpLimiter = createLimiter({ windowMs: 60 * MINUTE, max: 5 });

// アプリのURL（GoogleのログインのあとにGoogleが戻ってくる先に使う）。本番では https://〜.onrender.com を入れる
const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = BASE_URL + "/auth/google/callback";

if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRETが設定されていません。本番では必ず設定してください");
}

// ログインしていなくても見られる画面
const PUBLIC_PAGES = ["/welcome.html", "/login.html", "/signup.html", "/verify-sent.html"];
// ログインしていてもいなくても見られる画面（ログイン中でもホームに飛ばさない）
const OPEN_PAGES = ["/privacy.html", "/terms.html"];

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
    app.get("/auth/verify", verifyEmail);
    app.post("/api/resend-verification", resendVerification);
    app.get("/auth/google", googleStart);
    app.get("/auth/google/callback", googleCallback);
}

// 画面（HTML）を返す前のチェック
function guardPages(req, res, next) {
    const isPage = req.path === "/" || req.path.endsWith(".html");
    if (!isPage || OPEN_PAGES.includes(req.path)) return next();

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
    const wait = mailIpLimiter.hit(req.ip);
    if (wait) return sendTooMany(res, wait);

    try {
        const passwordHash = await hashPassword(password);
        const [rows] = await db.promise().query(
            `SELECT id, email_verified,
                verify_sent_at > DATE_SUB(NOW(), INTERVAL ${RESEND_WAIT_SECONDS} SECOND) AS too_soon
             FROM users WHERE email = ?`, [email]);
        const user = rows[0];

        if (user && user.email_verified) {
            return res.status(409).send("このメールアドレスはすでに登録されています");
        }
        if (user) {
            // 何度も押されてメールが大量に送られないようにする
            if (user.too_soon) {
                return res.status(429).send("少し時間をおいてから、もう一度お試しください");
            }
            // 登録したけれど確認がまだの人は、パスワードを入れ直して確認メールを送り直す
            // （確認するまではログインできないので、洋服のデータはまだ無い）
            await db.promise().query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
            await startVerification(user.id, email);
        } else {
            const [result] = await db.promise().query(
                "INSERT INTO users (email, password_hash, email_verified) VALUES (?, ?, 0)", [email, passwordHash]);
            await startVerification(result.insertId, email);
        }
        // ここではまだログインさせない（メールのリンクを開いたらログインする）
        res.send("確認メールを送りました");
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).send("このメールアドレスはすでに登録されています");
        }
        console.error(err);
        res.status(500).send("登録に失敗しました");
    }
}


// ---------- メールアドレスの確認 ----------
// 流れ：新規登録 → ランダムな合言葉（トークン）入りのリンクをメールで送る
//      → リンクを開くと /auth/verify?token=〜 に来る → 確認済みにしてログイン
// トークンはそのままDBに入れず、SHA-256のハッシュにして保存する（DBが見られても使えないように）

const VERIFY_HOURS = 24;       // リンクの有効期限
const RESEND_WAIT_SECONDS = 60; // 再送は1分に1回まで

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// 新しいトークンを作って保存し、確認メールを送る
async function startVerification(userId, email) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.promise().query(
        `UPDATE users SET verify_token_hash = ?,
            verify_expires_at = DATE_ADD(NOW(), INTERVAL ${VERIFY_HOURS} HOUR),
            verify_sent_at = NOW()
         WHERE id = ?`, [hashToken(token), userId]);
    await sendVerificationEmail(email, `${BASE_URL}/auth/verify?token=${token}`);
}

async function verifyEmail(req, res) {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!/^[0-9a-f]{64}$/.test(token)) return res.redirect("/login.html?error=verify_invalid");

    try {
        const [rows] = await db.promise().query(
            "SELECT id, verify_expires_at > NOW() AS valid FROM users WHERE verify_token_hash = ?", [hashToken(token)]);
        const user = rows[0];
        if (!user) return res.redirect("/login.html?error=verify_invalid");
        if (!user.valid) return res.redirect("/login.html?error=verify_expired");

        await db.promise().query(
            `UPDATE users SET email_verified = 1, verify_token_hash = NULL, verify_expires_at = NULL
             WHERE id = ?`, [user.id]);
        req.session.userId = user.id;
        res.redirect("/index.html?verified=1");
    } catch (err) {
        console.error(err);
        res.redirect("/login.html?error=verify_invalid");
    }
}

// 確認メールの再送
// 登録されているかどうかを調べられないように、どんな場合も同じ返事をする
async function resendVerification(req, res) {
    const email = normalizeEmail(req.body.email);
    const reply = "確認がまだのアカウントであれば、確認メールを送りました";
    if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).send("メールアドレスを正しく入力してください");
    }
    const wait = mailIpLimiter.hit(req.ip);
    if (wait) return sendTooMany(res, wait);

    try {
        const [rows] = await db.promise().query(
            `SELECT id, email_verified,
                verify_sent_at > DATE_SUB(NOW(), INTERVAL ${RESEND_WAIT_SECONDS} SECOND) AS too_soon
             FROM users WHERE email = ?`, [email]);
        const user = rows[0];
        if (user && !user.email_verified) {
            if (user.too_soon) {
                return res.status(429).send("少し時間をおいてから、もう一度お試しください");
            }
            await startVerification(user.id, email);
        }
        res.send(reply);
    } catch (err) {
        console.error(err);
        res.status(500).send("送信に失敗しました。時間をおいてもう一度お試しください");
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
    // IPとメールアドレスの両方を数える（片方だけ数えて、もう片方を数え忘れないように先に両方hitする）
    const ipWait = loginIpLimiter.hit(req.ip);
    const emailWait = loginEmailLimiter.hit(email);
    if (ipWait || emailWait) return sendTooMany(res, Math.max(ipWait, emailWait));

    try {
        const [rows] = await db.promise().query(
            "SELECT id, password_hash, email_verified FROM users WHERE email = ?", [email]);
        const user = rows[0];
        if (!user) return res.status(401).send(failMessage);
        // Googleで登録した人・Googleをつなげた人はパスワードを持っていない
        if (!user.password_hash) {
            return res.status(401).send("このアカウントはGoogleでログインするようになっています。「Googleでログイン」を使ってください");
        }
        if (!(await verifyPassword(password, user.password_hash))) {
            return res.status(401).send(failMessage);
        }
        // パスワードが合っていたら、このメールアドレスの数は0に戻す（本人が少し間違えただけなら、すぐまた試せる）
        loginEmailLimiter.reset(email);
        // パスワードは合っているが、メールアドレスの確認がまだ（画面に再送ボタンを出すので403で返す）
        if (!user.email_verified) {
            return res.status(403).send("メールアドレスの確認がまだです。届いたメールのリンクを開いてください");
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

        // 同じメールアドレスがパスワードで登録されているときは、そのアカウントにGoogleをつなげる
        // メールの確認がまだのときは、他人が先に登録していたかもしれないのでパスワードを消す
        // （Googleで確認できたこの人が本当の持ち主なので、他人が入れないようにする）。確認済みならパスワードは残す
        const [sameEmail] = await db.promise().query("SELECT id, google_id FROM users WHERE email = ?", [email]);
        if (sameEmail[0]) {
            // 別のGoogleアカウントがすでにつながっているときはつなげない
            if (sameEmail[0].google_id) return fail("google_failed");
            await db.promise().query(
                `UPDATE users SET google_id = ?,
                    password_hash = IF(email_verified = 1, password_hash, NULL),
                    email_verified = 1, verify_token_hash = NULL, verify_expires_at = NULL
                 WHERE id = ?`, [googleId, sameEmail[0].id]);
            req.session.userId = sameEmail[0].id;
            return res.redirect("/index.html?login=1");
        }

        // 初めての人は新しく登録する
        const [result] = await db.promise().query(
            "INSERT INTO users (email, google_id, email_verified) VALUES (?, ?, 1)", [email, googleId]);
        req.session.userId = result.insertId;
        res.redirect("/index.html?login=1");
    } catch (err) {
        console.error(err);
        fail("google_failed");
    }
}

module.exports = { setup, guardPages, requireLogin };
