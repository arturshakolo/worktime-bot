// ============================================================
// БЛОК: ПРОСМОТР ЧАСОВ
// ============================================================
import { getSheet, getCellValue } from '../../modules/google-sheets.js';
import { formatMinutes, getLocalDate } from '../../utils/time-calculator.js';
import { SHEETS, LOG_COL, STATUS } from '../../modules/constants.js';
import { mainKeyboard } from '../../modules/keyboards.js';

// ----- Функция: показать часы за конкретную дату -----
export async function showHoursForDate(bot, chatId, userId, date) {
  const logsSheet = await getSheet(SHEETS.LOGS);
  const rows = await logsSheet.getRows();

  let shiftRow = null;
  for (const row of rows) {
    const rowDate = getCellValue(row, LOG_COL.DATE);
    const tid = getCellValue(row, LOG_COL.TELEGRAM_ID);
    if (rowDate === date && tid && String(tid) === String(userId)) {
      shiftRow = row;
      break;
    }
  }

  if (!shiftRow || !getCellValue(shiftRow, LOG_COL.END)) {
    await bot.sendMessage(chatId, `📅 ${date}\nНет завершённой смены`, mainKeyboard);
    return;
  }

  const message = `📅 ${date}\n` +
    `Начало: ${getCellValue(shiftRow, LOG_COL.START)}\n` +
    `Конец: ${getCellValue(shiftRow, LOG_COL.END)}\n` +
    `Отработано: ${getCellValue(shiftRow, LOG_COL.DURATION)}\n` +
    `Зачтено: ${getCellValue(shiftRow, LOG_COL.CREDITED)}\n` +
    `Переработка: ${getCellValue(shiftRow, LOG_COL.OVERTIME)}`;

  await bot.sendMessage(chatId, message, mainKeyboard);
}

// ----- Функция: показать часы за месяц (исправлено суммирование) -----
export async function showHoursForMonth(bot, chatId, userId, monthStr) {
  let monthPrefix;
  let displayMonth;

  if (!monthStr) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    monthPrefix = `${year}-${month}`;
    displayMonth = `${month}.${year}`;
  } else {
    const [m, y] = monthStr.split('.');
    monthPrefix = `${y}-${m.padStart(2, '0')}`;
    displayMonth = monthStr;
  }

  const logsSheet = await getSheet(SHEETS.LOGS);
  const rows = await logsSheet.getRows();

  let totalCreditedMinutes = 0;
  let shiftCount = 0;

  for (const row of rows) {
    const tid = getCellValue(row, LOG_COL.TELEGRAM_ID);
    const rowDate = getCellValue(row, LOG_COL.DATE);
    const status = getCellValue(row, LOG_COL.STATUS);

    if (tid && String(tid) === String(userId) && rowDate && rowDate.startsWith(monthPrefix) && status === STATUS.CLOSED) {
      shiftCount++;
      const creditedStr = getCellValue(row, LOG_COL.CREDITED);
      if (creditedStr) {
        const [h, m] = creditedStr.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) totalCreditedMinutes += h * 60 + m;
      }
    }
  }

  const totalHours = formatMinutes(totalCreditedMinutes);
  await bot.sendMessage(chatId, `📆 Месяц ${displayMonth}\nСмен: ${shiftCount}\n✅ Всего зачтено: ${totalHours}`, mainKeyboard);
}