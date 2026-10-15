const TelegramBot = require('node-telegram-bot-api');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// ضع التوكن الجديد هنا بعد إلغاء التوكن المكشوف
const TOKEN = '8959271512:AAFstE9EaYTaNsI2mk4u9s6j9L4fxyw1f30';

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🎬 أهلاً بك في بوت تحميل يوتيوب\n\n' +
    'أرسل رابط فيديو يوتيوب لتحميله.\n\n' +
    'مثال:\nhttps://www.youtube.com/watch?v=VIDEO_ID\n\n' +
    '⚠️ استخدمه للمقاطع التي تملكها أو تملك إذن تحميلها.'
  );
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  let url;

  try {
    url = new URL(msg.text.trim());
  } catch {
    return bot.sendMessage(chatId, '❌ أرسل رابطاً صحيحاً.');
  }

  const validHost = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'www.youtube-nocookie.com'
  ];

  if (!validHost.includes(url.hostname)) {
    return bot.sendMessage(
      chatId,
      '❌ الرابط غير مدعوم. أرسل رابط يوتيوب فقط.'
    );
  }

  const folder = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ytbot-')
  );

  const output = path.join(folder, 'video.%(ext)s');

  const status = await bot.sendMessage(
    chatId,
    '⏳ جاري تحميل الفيديو...'
  );

  try {
    const args = [
      '--no-playlist',
      '--max-filesize', '45M',
      '-f', 'best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', output,
      url.href
    ];

    await new Promise((resolve, reject) => {
      const process = spawn('yt-dlp', args);
      let errorText = '';

      process.stderr.on('data', (data) => {
        errorText += data.toString();
      });

      process.on('error', reject);

      process.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(errorText || 'فشل التحميل'));
      });
    });

    const files = fs.readdirSync(folder)
      .filter(name => fs.statSync(path.join(folder, name)).isFile());

    if (!files.length) {
      throw new Error('لم يتم العثور على ملف الفيديو.');
    }

    const file = path.join(folder, files[0]);
    const size = fs.statSync(file).size;

    // حد احتياطي لحجم الملف المرسل
    if (size > 45 * 1024 * 1024) {
      throw new Error('حجم الفيديو أكبر من 45 ميجابايت.');
    }

    await bot.sendDocument(
      chatId,
      file,
      { caption: '✅ تم التحميل بنجاح' }
    );

    await bot.deleteMessage(chatId, status.message_id)
      .catch(() => {});

  } catch (error) {
    console.error(error);

    await bot.editMessageText(
      '❌ تعذّر تحميل الفيديو.\n' +
      'قد يكون حجمه كبيراً أو غير متاح أو يحتاج إلى طريقة تحميل أخرى.',
      {
        chat_id: chatId,
        message_id: status.message_id
      }
    ).catch(() => {});

  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

bot.on('polling_error', (error) => {
  console.error('Telegram error:', error.message);
});

console.log('🤖 YouTube bot is running...');