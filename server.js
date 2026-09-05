const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Configuration
const API_TOKEN = '8980817673:AAHq_YAAzJhuu2qSt2z2BmBfrVW_bdk2L7c';
const DEVELOPER_ID = 8486153265;
const bot = new TelegramBot(API_TOKEN, { polling: false });

// Statistics variables
let usersWithCountries = {};
let searchOperationsCount = 0;
let searchedAccountsCount = 0;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// LordGivt Class
class LordGivt {
    constructor(username) {
        this.username = username.replace('@', '');
        this.jsonData = null;
        this.errorMessage = null;
    }

    async admin() {
        const errorMessage = await this.sendRequest();
        if (errorMessage) {
            this.errorMessage = errorMessage;
            return this.errorMessage;
        }
        return this.output();
    }

    async sendRequest() {
        const headers = {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 GIVT"
        };
        
        try {
            searchOperationsCount++;
            const response = await axios.get(`https://www.tiktok.com/@${this.username}`, { headers });
            
            const $ = cheerio.load(response.data);
            const scriptTag = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
            
            if (scriptTag.length > 0) {
                const scriptText = scriptTag.text().trim();
                const data = JSON.parse(scriptText);
                this.jsonData = data.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo;
                
                const region = this.accountRegion();
                if (region !== "غير معروف") {
                    usersWithCountries[region] = (usersWithCountries[region] || 0) + 1;
                }
                searchedAccountsCount++;
                return null;
            }
            return "[X] خطأ: لم يتم العثور على اسم المستخدم.";
        } catch (error) {
            return `[X] خطأ: ${error.message}`;
        }
    }

    getUserID() {
        try {
            return this.jsonData.user.id.toString();
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
            const urlId = parseInt(this.getUserID());
            const binary = urlId.toString(2);
            const bits = binary.substring(0, 31);
            const timestamp = parseInt(bits, 2);
            return new Date(timestamp * 1000);
        } catch {
            return "غير معروف";
        }
    }

    lastChangeName() {
        try {
            const time = this.jsonData.user.nickNameModifyTime;
            return new Date(time * 1000);
        } catch {
            return "غير معروف";
        }
    }

    accountRegion() {
        try {
            return this.jsonData.user.region;
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
            return this.jsonData.user.followingVisibility === "1" ? "نعم" : "لا";
        } catch {
            return "غير معروف";
        }
    }

    language() {
        try {
            return this.jsonData.user.language.toString();
        } catch {
            return "غير معروف";
        }
    }

    heartCount() {
        try {
            return this.jsonData.stats.heart.toString();
        } catch {
            return "غير معروف";
        }
    }

    getCountryFlag(regionCode) {
        try {
            const flagOffset = '🇦'.codePointAt(0) - 'A'.codePointAt(0);
            return String.fromCodePoint(regionCode[0].codePointAt(0) + flagOffset) +
                   String.fromCodePoint(regionCode[1].codePointAt(0) + flagOffset);
        } catch {
            return "🚩";
        }
    }

    output() {
        if (!this.jsonData) {
            return "[X] خطأ: لم يتم جلب البيانات.";
        }

        const region = this.accountRegion();
        const flag = region !== "غير معروف" ? this.getCountryFlag(region) : "🚩";

        return `معلومات الحساب لـ @${this.username}

• معرف المستخدم : ${this.getUserID()}
• اللقب : ${this.getName()}
• موثق : ${this.isVerified()}
• حساب خاص : ${this.isPrivate()}
• secUid : ${this.secUid()}
• عدد المتابعين : ${this.followers()}
• عدد المتابعين له : ${this.following()}
• عدد الإعجابات : ${this.heartCount()}
• عدد الفيديوهات : ${this.videoCount()}
• مفضلة مفتوحة : ${this.openFavorite()}
• يمكن رؤية قائمة المتابعين : ${this.seeFollowing()}
• لغة المستخدم : ${this.language()}
• وقت إنشاء الحساب : ${this.userCreateTime()}
• آخر تغيير للقب : ${this.lastChangeName()}
︆∙ الدولة: ${region} ${flag}

• <a href='https://t.me/YOUR_TELEGRAM_CHANNEL_LINK'>Telegram</a>
• <a href='https://www.instagram.com/YOUR_INSTAGRAM_PROFILE'>Instagram</a>
• <a href='https://youtube.com/YOUR_YOUTUBE_CHANNEL'>YouTube</a>
• <a href='https://x.com/1llfll'>X</a>`;
    }
}

// Bot status function
function getBotStatus() {
    let status = "🟢 البوت يعمل بشكل صحيح.\n";
    status += "• عدد المستخدمين مع دولهم:\n";
    for (const [region, count] of Object.entries(usersWithCountries)) {
        status += `  - ${region}: ${count}\n`;
    }
    status += `• عدد عمليات البحث: ${searchOperationsCount}\n`;
    status += `• عدد الحسابات التي تم البحث عنها: ${searchedAccountsCount}\n`;
    return status;
}

// Webhook routes
app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// API routes
app.get('/api/status', (req, res) => {
    res.json({
        status: "running",
        usersWithCountries,
        searchOperationsCount,
        searchedAccountsCount,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/search/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const lord = new LordGivt(username);
        const result = await lord.admin();
        res.json({
            success: true,
            username,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Telegram Bot command handlers
bot.onText(/\/start|\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, "مرحبًا! أنا بوت لجمع بعض المعلومات من TikTok. أرسل اسم المستخدم الذي ترغب في البحث عنه.");
});

bot.onText(/\/status/, async (msg) => {
    if (msg.from.id === DEVELOPER_ID) {
        const status = getBotStatus();
        bot.sendMessage(msg.chat.id, status, { parse_mode: 'HTML' });
    } else {
        bot.sendMessage(msg.chat.id, "لا يمكنك استخدام هذا الأمر.");
    }
});

bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || text.startsWith('/')) return;

    const username = text.trim().replace('@', '');
    try {
        const lord = new LordGivt(username);
        const result = await lord.admin();
        bot.sendMessage(msg.chat.id, result, { parse_mode: 'HTML' });
    } catch (error) {
        bot.sendMessage(msg.chat.id, `حدث خطأ: ${error.message}`);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Bot is ready to receive webhooks');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

module.exports = app;