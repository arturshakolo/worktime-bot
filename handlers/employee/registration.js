// ============================================================
// БЛОК: РЕГИСТРАЦИЯ СОТРУДНИКОВ (с inline-кнопками в уведомлении)
// ============================================================
import { getSheet, getCellValue } from '../../modules/google-sheets.js';
import { getEmployee, isRegistered, getHRChatIds } from '../../modules/helpers.js';
import { SHEETS, USER_COL, PENDING_COL, STATUS } from '../../modules/constants.js';
import { mainKeyboard } from '../../modules/keyboards.js';
import TelegramBot from 'node-telegram-bot-api';

const HR_BOT_TOKEN = process.env.HR_BOT_TOKEN;
let hrBot = null;
if (HR_BOT_TOKEN) {
  hrBot = new TelegramBot(HR_BOT_TOKEN, { polling: false });
}

async function notifyHRViaBot(message, userId, userName) {
  if (!hrBot) {
    console.warn('⚠️ HR_BOT_TOKEN не задан, уведомления не отправлены');
    return;
  }
  const hrIds = await getHRChatIds();
  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Одобрить', callback_data: `approve_${userId}` },
          { text: '❌ Отклонить', callback_data: `reject_${userId}` }
        ]
      ]
    }
  };
  for (const id of hrIds) {
    try {
      await hrBot.sendMessage(id, message, inlineKeyboard);
    } catch (err) {
      console.error(`Ошибка отправки HR ${id}:`, err.message);
    }
  }
}

export async function ensureRegistered(bot, chatId, userId, firstName, lastName) {
  try {
    console.log(`🔍 Проверка регистрации: ${userId}`);
    const registered = await isRegistered(userId);
    if (registered) {
      console.log(`✅ Пользователь ${userId} зарегистрирован`);
      return true;
    }

    const pendingSheet = await getSheet(SHEETS.PENDING);
    const pendingRows = await pendingSheet.getRows();

    let existingRequest = false;
    for (const row of pendingRows) {
      const pid = getCellValue(row, PENDING_COL.USER_ID);
      const status = getCellValue(row, PENDING_COL.STATUS);
      if (pid && String(pid) === String(userId) && status === STATUS.PENDING) {
        existingRequest = true;
        break;
      }
    }

    if (!existingRequest) {
      await pendingSheet.addRow({
        [PENDING_COL.USER_ID]: String(userId),
        [PENDING_COL.USER_NAME]: `${firstName} ${lastName}`,
        [PENDING_COL.REQUEST_DATE]: new Date().toISOString(),
        [PENDING_COL.STATUS]: STATUS.PENDING
      });

      const report = `🆕 НОВАЯ ЗАЯВКА НА РЕГИСТРАЦИЮ\n👤 Имя: ${firstName} ${lastName}\n🆔 ID: ${userId}`;
      await notifyHRViaBot(report, userId, `${firstName} ${lastName}`);
      console.log(`📝 Создана заявка для ${userId}, уведомление отправлено через HR-бота с кнопками`);
    }

    await bot.sendMessage(chatId,
      '⚠️ Вы не зарегистрированы в системе.\n' +
      'Запрос на регистрацию отправлен HR.\n' +
      'Дождитесь подтверждения.',
      mainKeyboard
    );
    return false;

  } catch (err) {
    console.error('❌ Ошибка в ensureRegistered:', err);
    return false;
  }
}