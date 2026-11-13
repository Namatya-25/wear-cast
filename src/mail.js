require("dotenv").config({ quiet: true });

// メールはGmail API（https）で送る。Renderの無料プランではSMTPが使えないことがあるので、SMTPは使わない
// GMAIL_REFRESH_TOKENなどが無いとき（ローカルなど）は、送る代わりにターミナルにリンクを出す
// クライアントIDとシークレットは、書かなければ「Googleでログイン」と同じものを使う
const CLIENT_ID = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN; // gmail.send の権限で取ったリフレッシュトークン
const MAIL_FROM = process.env.MAIL_FROM;               // 送信に使うGmailのアドレス（トークンを取ったアカウント）
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "WearCast";

// アクセストークンは1時間くらい使えるので、切れるまで使い回す
let accessToken = null;
let accessTokenExpiresAt = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < accessTokenExpiresAt) {
        return accessToken;
    }
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: REFRESH_TOKEN,
            grant_type: "refresh_token"
        })
    });
    if (!res.ok) {
        throw new Error(`Googleのトークンのエラー: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    accessToken = data.access_token;
    accessTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // 1分早めに取り直す
    return accessToken;
}

// 日本語の件名・名前はそのままだと文字化けするので、MIMEの形に変える
function encodeHeader(value) {
    return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

// 本文はbase64にして76文字ごとに改行する（メールの決まり）
function encodeBody(value) {
    return Buffer.from(value, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
}

// テキスト版とHTML版の両方を入れたメール（multipart/alternative）を作る
function buildMessage(to, subject, text, html) {
    const boundary = "wearcast_" + Date.now().toString(36);
    return [
        `From: ${encodeHeader(MAIL_FROM_NAME)} <${MAIL_FROM}>`,
        `To: ${to}`,
        `Subject: ${encodeHeader(subject)}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        encodeBody(text),
        `--${boundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        encodeBody(html),
        `--${boundary}--`,
        ""
    ].join("\r\n");
}

async function sendMail(to, subject, text, html) {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !MAIL_FROM) {
        console.log(`\n[メールの代わりに表示] 宛先: ${to}\n件名: ${subject}\n${text}\n`);
        return;
    }

    const raw = Buffer.from(buildMessage(to, subject, text, html), "utf8").toString("base64url");
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${await getAccessToken()}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw })
    });
    if (!res.ok) {
        throw new Error(`Gmail APIのエラー: ${res.status} ${await res.text()}`);
    }
}

// 新規登録のときの確認メール
function sendVerificationEmail(to, url) {
    const subject = "【WearCast】メールアドレスの確認";
    const text =
        "WearCastにご登録いただきありがとうございます。\n" +
        "下のリンクを開いて、メールアドレスの確認を完了してください（24時間有効です）。\n\n" +
        url + "\n\n" +
        "このメールに心当たりがない場合は、何もせずに削除してください。";
    const html = `
        <div style="font-family:sans-serif;line-height:1.7;color:#333">
            <p>WearCastにご登録いただきありがとうございます。</p>
            <p>下のボタンを押して、メールアドレスの確認を完了してください（24時間有効です）。</p>
            <p style="margin:24px 0">
                <a href="${url}" style="background:#4FC3F7;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:bold">メールアドレスを確認する</a>
            </p>
            <p style="font-size:12px;color:#666">ボタンが押せないときは、このURLをブラウザに貼り付けてください。<br>${url}</p>
            <p style="font-size:12px;color:#666">このメールに心当たりがない場合は、何もせずに削除してください。</p>
        </div>`;
    return sendMail(to, subject, text, html);
}

module.exports = { sendVerificationEmail };
