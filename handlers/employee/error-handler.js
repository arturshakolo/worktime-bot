import { getHRChatIds } from '../../modules/helpers.js';
import { mainKeyboard } from '../../modules/keyboards.js';
import TelegramBot from 'node-telegram-bot-api';

const HR_BOT_TOKEN = process.env.HR_BOT_TOKEN;
let hrBot = null;
if (HR_BOT_TOKEN) {
  hrBot = new TelegramBot(HR_BOT_TOKEN, { polling: false });
}

async function notifyHRViaBot(message) {
  if (!hrBot) {
    console.warn('⚠️ HR_BOT_TOKEN не задан, уведомление об ошибке не отправлено');
    return;
  }
  const hrIds = await getHRChatIds();
  for (const id of hrIds) {
    try {
      await hrBot.sendMessage(id, message);
    } catch (err) {
      console.error(`Ошибка отправки HR ${id}:`, err.message);
    }
  }
}

export async function handleErrorReport(bot, chatId, userId, text) {
  const report = `❌ ОШИБКА ОТ СОТРУДНИКА\n👤 ID: ${userId}\n📝 Сообщение: ${text}`;
  await notifyHRViaBot(report);
  await bot.sendMessage(chatId, '✅ Сообщение отправлено HR', mainKeyboard);
}