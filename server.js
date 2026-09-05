const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const TelegramBot = require("node-telegram-bot-api");

// ===============================
// Environment Variables
// ===============================

const API_TOKEN = process.env.BOT_TOKEN;
const DEVELOPER_ID = String(process.env.DEVELOPER_ID || "");

if (!API_TOKEN) {
    console.error("❌ BOT_TOKEN غير موجود.");
    process.exit(1);
}

if (!DEVELOPER_ID) {
    console.warn("⚠️ DEVELOPER_ID غير موجود.");
}

// ===============================
// Telegram Bot
// ===============================

const bot = new TelegramBot(API_TOKEN, {
    polling: true
});

// ===============================
// Express Server
// ===============================

const app = express();

app.get("/", (req, res) => {
    res.send("🟢 Telegram Bot is running.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🟢 Server running on port ${PORT}`);
});

// ===============================
// Statistics
// ===============================

const usersWithCountries = {};

let searchOperationsCount = 0;
let searchedAccountsCount = 0;

// ===============================
// TikTok Class
// ===============================

class LordGivt {

    constructor(username) {

        this.username = username.replace("@", "").trim();
        this.jsonData = null;
        this.errorMessage = null;

        this.admin();
    }

    async admin() {

        const errorMessage = await this.sendRequest();

        if (errorMessage) {
            this.errorMessage = errorMessage;
        }
    }

    async sendRequest() {

        const headers = {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/131.0.0.0 Safari/537.36"
        };

        try {

            searchOperationsCount++;

            const url =
                `https://www.tiktok.com/@${encodeURIComponent(this.username)}`;

            const response = await axios.get(url, {
                headers,
                timeout: 15000
            });

            const $ = cheerio.load(response.data);

            const scriptTag =
                $("#__UNIVERSAL_DATA_FOR_REHYDRATION__").html();

            if (!scriptTag) {
                return "❌ خطأ: لم يتم العثور على بيانات الحساب.";
            }

            const data = JSON.parse(scriptTag);

            const userInfo =
                data?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;

            if (!userInfo) {
                return "❌ خطأ: لم يتم العثور على معلومات المستخدم.";
            }

            this.jsonData = userInfo;

            const region = this.accountRegion();

            if (region !== "غير معروف") {

                if (!usersWithCountries[region]) {
                    usersWithCountries[region] = 0;
                }

                usersWithCountries[region]++;
            }

            searchedAccountsCount++;

            return null;

        } catch (error) {

            console.error("TikTok Error:", error.message);

            return `❌ خطأ: ${error.message}`;
        }
    }

    getUserId() {

        try {
            return String(this.jsonData.user.id);
        } catch {
            return "غير معروف";
        }
    }

    getName() {

        try {
            return this.jsonData.user.nickname;
        } catch {
            return "غير معروف";
        }
    }

    isVerified() {

        try {
            return this.jsonData.user.verified ? "نعم" : "لا";
        } catch {
            return "غير معروف";
        }
    }

    secUid() {

        try {
            return this.jsonData.user.secUid;
        } catch {
            return "غير معروف";
        }
    }

    isPrivate() {

        try {
            return this.jsonData.user.privateAccount ? "نعم" : "لا";
        } catch {
            return "غير معروف";
        }
    }

    followers() {

        try {
            return this.jsonData.stats.followerCount;
        } catch {
            return "غير معروف";
        }
    }

    following() {

        try {
            return this.jsonData.stats.followingCount;
        } catch {
            return "غير معروف";
        }
    }

    userCreateTime() {

        try {

            const userId = parseInt(this.getUserId());

            if (!Number.isFinite(userId)) {
                return "غير معروف";
            }

            const binary = userId.toString(2);

            const bits = binary.substring(0, 31);

            const timestamp = parseInt(bits, 2);

            const date = new Date(timestamp * 1000);

            return formatDate(date);

        } catch {
            return "غير معروف";
        }
    }

    lastChangeName() {

        try {

            const time =
                this.jsonData.user.nickNameModifyTime;

            if (!time) {
                return "غير معروف";
            }

            return formatDate(new Date(parseInt(time) * 1000));

        } catch {
            return "غير معروف";
        }
    }

    accountRegion() {

        try {
            return this.jsonData.user.region || "غير معروف";
        } catch {
            return "غير معروف";
        }
    }

    videoCount() {

        try {
            return this.jsonData.stats.videoCount;
        } catch {
            return "غير معروف";
        }
    }

    openFavorite() {

        try {
            return this.jsonData.user.openFavorite ? "نعم" : "لا";
        } catch {
            return "غير معروف";
        }
    }

    seeFollowing() {

        try {

            const value =
                String(this.jsonData.user.followingVisibility);

            return value === "1" ? "نعم" : "لا";

        } catch {
            return "غير معروف";
        }
    }

    language() {

        try {
            return String(this.jsonData.user.language);
        } catch {
            return "غير معروف";
        }
    }

    heartCount() {

        try {
            return String(this.jsonData.stats.heart);
        } catch {
            return "غير معروف";
        }
    }

    getCountryFlag(regionCode) {

        try {

            if (!regionCode || regionCode.length !== 2) {
                return "🚩";
            }

            const offset =
                "🇦".codePointAt(0) - "A".charCodeAt(0);

            const first =
                String.fromCodePoint(
                    regionCode.charCodeAt(0) + offset
                );

            const second =
                String.fromCodePoint(
                    regionCode.charCodeAt(1) + offset
                );

            return first + second;

        } catch {
            return "🚩";
        }
    }

    output() {

        if (!this.jsonData) {
            return "❌ خطأ: لم يتم جلب البيانات.";
        }

        const region = this.accountRegion();

        const flag =
            region !== "غير معروف"
                ? this.getCountryFlag(region)
                : "🚩";

        return (
            `📊 <b>معلومات الحساب</b>\n\n` +

            `👤 <b>الحساب:</b> @${escapeHTML(this.username)}\n\n` +

            `• معرف المستخدم: <code>${escapeHTML(this.getUserId())}</code>\n` +
            `• اللقب: ${escapeHTML(this.getName())}\n` +
            `• موثق: ${this.isVerified()}\n` +
            `• حساب خاص: ${this.isPrivate()}\n` +
            `• secUid: <code>${escapeHTML(this.secUid())}</code>\n` +
            `• عدد المتابعين: ${this.followers()}\n` +
            `• يتابع: ${this.following()}\n` +
            `• عدد الإعجابات: ${this.heartCount()}\n` +
            `• عدد الفيديوهات: ${this.videoCount()}\n` +
            `• المفضلة مفتوحة: ${this.openFavorite()}\n` +
            `• يمكن رؤية قائمة المتابعين: ${this.seeFollowing()}\n` +
            `• لغة المستخدم: ${escapeHTML(this.language())}\n` +
            `• وقت إنشاء الحساب: ${escapeHTML(this.userCreateTime())}\n` +
            `• آخر تغيير للقب: ${escapeHTML(this.lastChangeName())}\n` +
            `• الدولة: ${escapeHTML(region)} ${flag}\n\n` +

            `━━━━━━━━━━━━━━\n` +

            `• <a href="https://t.me/YOUR_TELEGRAM_CHANNEL_LINK">Telegram</a>\n` +
            `• <a href="https://www.instagram.com/YOUR_INSTAGRAM_PROFILE">Instagram</a>\n` +
            `• <a href="https://youtube.com/YOUR_YOUTUBE_CHANNEL">YouTube</a>\n` +
            `• <a href="https://x.com/1llfll">X</a>`
        );
    }
}

// ===============================
// Helpers
// ===============================

function formatDate(date) {

    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return "غير معروف";
    }

    return date.toLocaleString("ar-SA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ===============================
// /start /help
// ===============================

bot.onText(/^\/(start|help)$/, async (message) => {

    const text =
        `👋 <b>مرحبًا بك</b>\n\n` +
        `أنا بوت لجلب بعض المعلومات العامة من حسابات TikTok.\n\n` +
        `📌 أرسل اسم المستخدم مثل:\n` +
        `<code>@username</code>\n\n` +
        `أو:\n` +
        `<code>username</code>`;

    await bot.sendMessage(
        message.chat.id,
        text,
        {
            parse_mode: "HTML"
        }
    );
});

// ===============================
// /status
// ===============================

bot.onText(/^\/status$/, async (message) => {

    const userId = String(message.from.id);

    if (userId !== DEVELOPER_ID) {

        return bot.sendMessage(
            message.chat.id,
            "❌ لا يمكنك استخدام هذا الأمر."
        );
    }

    let status =
        `🟢 <b>البوت يعمل بشكل صحيح</b>\n\n`;

    status +=
        `📊 <b>الإحصائيات</b>\n\n`;

    status +=
        `• عدد عمليات البحث: ` +
        `<code>${searchOperationsCount}</code>\n`;

    status +=
        `• عدد الحسابات التي تم البحث عنها: ` +
        `<code>${searchedAccountsCount}</code>\n\n`;

    status +=
        `🌍 <b>الدول</b>\n`;

    const regions =
        Object.entries(usersWithCountries);

    if (regions.length === 0) {

        status += "لا توجد بيانات دول حتى الآن.\n";

    } else {

        for (const [region, count] of regions) {

            status +=
                `• ${escapeHTML(region)}: ` +
                `<code>${count}</code>\n`;
        }
    }

    await bot.sendMessage(
        message.chat.id,
        status,
        {
            parse_mode: "HTML"
        }
    );
});

// ===============================
// TikTok Search
// ===============================

bot.on("message", async (message) => {

    if (!message.text) {
        return;
    }

    if (message.text.startsWith("/")) {
        return;
    }

    let username = message.text.trim();

    username = username.replace(/^@/, "");

    if (!username) {
        return;
    }

    // منع إدخال روابط أو نصوص طويلة جدًا
    if (
        username.length > 100 ||
        username.includes(" ") ||
        username.includes("/")
    ) {

        return bot.sendMessage(
            message.chat.id,
            "❌ أرسل اسم مستخدم TikTok فقط.\n\nمثال: @username"
        );
    }

    const loadingMessage =
        await bot.sendMessage(
            message.chat.id,
            "🔎 جاري البحث عن الحساب..."
        );

    try {

        const account =
            new LordGivt(username);

        const error =
            await account.sendRequest();

        if (error) {

            await bot.editMessageText(
                error,
                {
                    chat_id: message.chat.id,
                    message_id: loadingMessage.message_id
                }
            );

            return;
        }

        const result =
            account.output();

        await bot.editMessageText(
            result,
            {
                chat_id: message.chat.id,
                message_id: loadingMessage.message_id,
                parse_mode: "HTML",
                disable_web_page_preview: true
            }
        );

    } catch (error) {

        console.error(error);

        await bot.editMessageText(
            "❌ حدث خطأ أثناء جلب بيانات الحساب.",
            {
                chat_id: message.chat.id,
                message_id: loadingMessage.message_id
            }
        );
    }
});

// ===============================
// Errors
// ===============================

bot.on("polling_error", (error) => {
    console.error("Telegram Polling Error:", error.message);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
});

console.log("🤖 Telegram bot started...");