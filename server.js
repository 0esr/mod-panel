const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════
// 1. الإعدادات الأساسية والوسائط
// ═══════════════════════════════════════════════════════
app.use(cors());
app.use(express.json());
app.use(express.static('mod-panel/public'));

// ═══════════════════════════════════════════════════════
// 2. قاعدة بيانات الأدوات (tools.json)
// ═══════════════════════════════════════════════════════
const TOOLS_PATH = path.join(__dirname, 'tools.json');

// قراءة قاعدة البيانات مع معالجة الأخطاء
function readToolsDB() {
    try {
        const data = fs.readFileSync(TOOLS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('⚠️ خطأ في قراءة tools.json، إنشاء قاعدة جديدة:', error.message);
        // إنشاء قاعدة بيانات افتراضية إذا كان الملف تالفاً
        const defaultDB = { tools: [], settings: { maxFollows: 30, delay: 1500 } };
        fs.writeFileSync(TOOLS_PATH, JSON.stringify(defaultDB, null, 2));
        return defaultDB;
    }
}

// كتابة قاعدة البيانات
function writeToolsDB(data) {
    fs.writeFileSync(TOOLS_PATH, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════════
// 3. WebSocket للتواصل المباشر مع المستخدمين
// ═══════════════════════════════════════════════════════
const wss = new WebSocket.Server({ port: PORT + 1 }); // استخدام منفذ إضافي

wss.on('connection', (ws) => {
    console.log('🔗 مستخدم جديد متصل عبر WebSocket');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📩 رسالة واردة:', data);
            
            // معالجة الأوامر الصادرة من المستخدم
            if (data.action === 'start_follow') {
                // محاكاة بدء عملية المتابعة
                ws.send(JSON.stringify({ 
                    status: 'started', 
                    message: '✅ بدأت عملية المتابعة',
                    sessionId: Date.now().toString()
                }));
            } else if (data.action === 'get_status') {
                // إرسال إحصائيات وهمية
                ws.send(JSON.stringify({
                    status: 'active',
                    follows: Math.floor(Math.random() * 50),
                    maxFollows: 30,
                    successRate: '95%'
                }));
            }
        } catch (e) {
            console.error('❌ خطأ في معالجة رسالة WebSocket:', e.message);
        }
    });
    
    ws.on('close', () => console.log('🔌 مستخدم قطع الاتصال'));
});

console.log(`🔌 WebSocket يعمل على المنفذ ${PORT + 1}`);

// ═══════════════════════════════════════════════════════
// 4. نقاط نهاية API (Routes)
// ═══════════════════════════════════════════════════════

// 📌 الصفحة الرئيسية (تعليمات API)
app.get('/api', (req, res) => {
    res.json({
        name: '🛡️ TikTok Follow System',
        version: '3.0.0',
        status: 'online',
        endpoints: [
            '/api/tools - قائمة الأدوات',
            '/api/start - بدء التبادل',
            '/api/stop - إيقاف التبادل',
            '/api/status - حالة النظام',
            '/api/settings - إعدادات النظام'
        ]
    });
});

// 🛠️ الحصول على قائمة الأدوات
app.get('/api/tools', (req, res) => {
    const db = readToolsDB();
    res.json({ success: true, tools: db.tools || [] });
});

// ✅ بدء التبادل (محاكاة)
app.post('/api/start', (req, res) => {
    const { maxFollows = 30, delay = 1500 } = req.body;
    const sessionId = Date.now().toString();
    
    // تسجيل الجلسة في قاعدة البيانات
    const db = readToolsDB();
    db.currentSession = {
        id: sessionId,
        startTime: new Date().toISOString(),
        maxFollows,
        delay,
        status: 'active'
    };
    writeToolsDB(db);
    
    res.json({
        success: true,
        message: '✅ تم بدء التبادل بنجاح',
        sessionId,
        config: { maxFollows, delay }
    });
});

// 🛑 إيقاف التبادل
app.post('/api/stop', (req, res) => {
    const db = readToolsDB();
    if (db.currentSession) {
        db.currentSession.status = 'stopped';
        db.currentSession.endTime = new Date().toISOString();
        writeToolsDB(db);
        res.json({ success: true, message: '🛑 تم إيقاف التبادل' });
    } else {
        res.json({ success: false, message: '⚠️ لا توجد جلسة نشطة' });
    }
});

// 📊 حالة النظام
app.get('/api/status', (req, res) => {
    const db = readToolsDB();
    const session = db.currentSession || null;
    
    res.json({
        success: true,
        status: {
            serverTime: new Date().toISOString(),
            activeSession: session ? session.status === 'active' : false,
            session: session,
            totalTools: (db.tools || []).length
        }
    });
});

// ⚙️ إعدادات النظام
app.get('/api/settings', (req, res) => {
    const db = readToolsDB();
    res.json({ success: true, settings: db.settings || {} });
});

app.post('/api/settings', (req, res) => {
    const db = readToolsDB();
    db.settings = { ...db.settings, ...req.body };
    writeToolsDB(db);
    res.json({ success: true, settings: db.settings });
});

// 🎯 تشغيل الخادم
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║         🛡️ TikTok Follow System v3.0                    ║
║         🔒 Server is running securely                   ║
╠══════════════════════════════════════════════════════════╣
║   🌐 Port: ${PORT}                                             ║
║   🔌 WebSocket: ${PORT + 1}                                    ║
║   📊 Status: Online                                         ║
║   📁 Tools DB: ${TOOLS_PATH}                                 ║
╠══════════════════════════════════════════════════════════╣
║   📌 API Endpoints:                                         ║
║   - GET  /api          → معلومات النظام                   ║
║   - GET  /api/tools    → قائمة الأدوات                   ║
║   - POST /api/start    → بدء التبادل                     ║
║   - POST /api/stop     → إيقاف التبادل                   ║
║   - GET  /api/status   → حالة النظام                     ║
║   - GET  /api/settings → إعدادات النظام                 ║
╚══════════════════════════════════════════════════════════╝
    `);
});