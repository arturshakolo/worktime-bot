// ============================================================
// БЛОК: УПРАВЛЕНИЕ СМЕНАМИ (с пересчётом при редактировании)
// ============================================================
import { getSheet, getCellValue, setCellValue } from '../../modules/google-sheets.js';
import { getEmployee, getHRChatIds } from '../../modules/helpers.js';
import { calculateShift, getLocalDate } from '../../utils/time-calculator.js';
import { SHEETS, LOG_COL, STATUS, DAY_TYPE } from '../../modules/constants.js';
import { mainKeyboard } from '../../modules/keyboards.js';
import TelegramBot from 'node-telegram-bot-api';

const HR_BOT_TOKEN = process.env.HR_BOT_TOKEN;
let hrBot = null;
if (HR_BOT_TOKEN) {
  hrBot = new TelegramBot(HR_BOT_TOKEN, { polling: false });
}

async function notifyHRViaBot(message) {
  if (!hrBot) {
    console.warn('⚠️ HR_BOT_TOKEN не задан, уведомления не отправлены');
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

// ----- Пересчёт строки смены (используется при редактировании) -----
async function recalculateShiftRow(row, userId, date) {
  const start = getCellValue(row, LOG_COL.START);
  const end = getCellValue(row, LOG_COL.END);
  if (start && end) {
    const calc = await calculateShift(start, end, date, userId);
    setCellValue(row, LOG_COL.DURATION, calc.actual);
    setCellValue(row, LOG_COL.OVERTIME, calc.overtime);
    setCellValue(row, LOG_COL.CREDITED, calc.credited);
    setCellValue(row, LOG_COL.DAY_TYPE, calc.dayType);
    setCellValue(row, LOG_COL.COEFFICIENT, calc.coefficient);
    setCellValue(row, LOG_COL.STATUS, STATUS.CLOSED);
  } else {
    setCellValue(row, LOG_COL.STATUS, STATUS.OPEN);
  }
  await row.save();
}

// ----- Начать смену -----
export async function startShift(bot, chatId, userId, from, specificDate = null, specificTime = null) {
  const date = specificDate || getLocalDate();
  const time = specificTime || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  console.log(`⏱ Начало смены: user=${userId}, date=${date}, time=${time}`);

  const employee = await getEmployee(userId);
  if (!employee) {
    await bot.sendMessage(chatId, '❌ Сотрудник не найден', mainKeyboard);
    return;
  }

  const logsSheet = await getSheet(SHEETS.LOGS);
  const rows = await logsSheet.getRows();

  // Проверка на открытые смены
  for (const row of rows) {
    const tid = getCellValue(row, LOG_COL.TELEGRAM_ID);
    const end = getCellValue(row, LOG_COL.END);
    if (tid && String(tid) === String(userId) && (!end || end === '')) {
      const openDate = getCellValue(row, LOG_COL.DATE);
      await bot.sendMessage(chatId, `⛔ У вас есть открытая смена за ${openDate}. Сначала закройте её.`, mainKeyboard);
      return;
    }
  }

  let existingRow = null;
  for (const row of rows) {
    const rowDate = getCellValue(row, LOG_COL.DATE);
    const tid = getCellValue(row, LOG_COL.TELEGRAM_ID);
    if (rowDate === date && tid && String(tid) === String(userId)) {
      existingRow = row;
      break;
    }
  }

  if (existingRow && getCellValue(existingRow, LOG_COL.START)) {
    await bot.sendMessage(chatId, `⛔ Смена на ${date} уже начата`, mainKeyboard);
    return;
  }

  if (existingRow) {
    setCellValue(existingRow, LOG_COL.START, time);
    setCellValue(existingRow, LOG_COL.STATUS, STATUS.OPEN);
    await existingRow.save();
  } else {
    await logsSheet.addRow({
      [LOG_COL.DATE]: date,
      [LOG_COL.TELEGRAM_ID]: String(userId),
      [LOG_COL.EMPLOYEE_NAME]: employee.name,
      [LOG_COL.DEPARTMENT]: employee.department,
      [LOG_COL.START]: time,
      [LOG_COL.STATUS]: STATUS.OPEN
    });
  }

  await bot.sendMessage(chatId, `✅ Начало смены: ${time} (${date})`, mainKeyboard);
}

// ----- Завершить смену -----
export async function endShift(bot, chatId, userId, specificDate = null, specificTime = null) {
  const date = specificDate || getLocalDate();
  const time = specificTime || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  console.log(`⏹ Завершение смены: user=${userId}, date=${date}, time=${time}`);

  const employee = await getEmployee(userId);
  if (!employee) {
    await bot.sendMessage(chatId, '❌ Сотрудник не найден', mainKeyboard);
    return;
  }

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

  if (!shiftRow || !getCellValue(shiftRow, LOG_COL.START)) {
    await bot.sendMessage(chatId, `⛔ Нет начатой смены на ${date}`, mainKeyboard);
    return;
  }

  if (getCellValue(shiftRow, LOG_COL.END)) {
    await bot.sendMessage(chatId, `⛔ Смена уже завершена`, mainKeyboard);
    return;
  }

  const start = getCellValue(shiftRow, LOG_COL.START);
  const calculation = await calculateShift(start, time, date, userId);

  if (calculation.actualMinutes === 0) {
    await bot.sendMessage(chatId, '⚠️ Смена не засчитана (отработано 0 часов)', mainKeyboard);
    await shiftRow.delete();
    return;
  }

  setCellValue(shiftRow, LOG_COL.END, time);
  setCellValue(shiftRow, LOG_COL.DURATION, calculation.actual);
  setCellValue(shiftRow, LOG_COL.OVERTIME, calculation.overtime);
  setCellValue(shiftRow, LOG_COL.CREDITED, calculation.credited);
  setCellValue(shiftRow, LOG_COL.DAY_TYPE, calculation.dayType);
  setCellValue(shiftRow, LOG_COL.COEFFICIENT, calculation.coefficient);
  setCellValue(shiftRow, LOG_COL.STATUS, STATUS.CLOSED);
  await shiftRow.save();

  // Короткое сообщение сотруднику
  await bot.sendMessage(chatId,
    `✅ Смена завершена\nОтработано: ${calculation.actual}\nЗачтено: ${calculation.credited}\nПереработка: ${calculation.overtime}`,
    mainKeyboard
  );

  // Расширенное уведомление HR
  let dayTypeText = '';
  if (calculation.dayType === DAY_TYPE.HOLIDAY) {
    dayTypeText = ' (праздничный день, коэффициент 2)';
  } else if (calculation.dayType === DAY_TYPE.WEEKEND) {
    dayTypeText = ' (выходной день, зачтено мин. 10 часов)';
  }
  const hrReport = `📊 ЗАКРЫТА СМЕНА\n👤 Сотрудник: ${employee.name}\n📅 Дата: ${date}\n⏱ ${start} → ${time}\n⏳ Отработано: ${calculation.actual}\n✅ Зачтено: ${calculation.credited}${dayTypeText}\n➕ Переработка: ${calculation.overtime}`;
  await notifyHRViaBot(hrReport);
}

// ----- Редактирование времени с пересчётом -----
export async function editShiftTime(bot, chatId, userId, date, field, time) {
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

  if (!shiftRow) {
    await bot.sendMessage(chatId, `❌ Запись за ${date} не найдена`, mainKeyboard);
    return;
  }

  setCellValue(shiftRow, field, time);

  const start = getCellValue(shiftRow, LOG_COL.START);
  const end = getCellValue(shiftRow, LOG_COL.END);
  if (start && end) {
    await recalculateShiftRow(shiftRow, userId, date);
  } else {
    setCellValue(shiftRow, LOG_COL.STATUS, STATUS.OPEN);
    await shiftRow.save();
  }

  await bot.sendMessage(chatId, `✅ ${field} обновлён на ${time}`, mainKeyboard);
}