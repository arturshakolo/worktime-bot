import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { getSheet, getCellValue, setCellValue } from '../modules/google-sheets.js';
import { SHEETS, USER_COL, LOG_COL, PENDING_COL, STATUS, DAY_TYPE } from '../modules/constants.js';
import { formatMinutes, calculateShift } from '../utils/time-calculator.js';
import { getEmployee, getAllActiveEmployees, getEmployeeNameById } from '../modules/helpers.js';

dotenv.config();

const TOKEN = process.env.HR_BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ HR_BOT_TOKEN не найден');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const employeeBot = new TelegramBot(process.env.EMPLOYEE_BOT_TOKEN);

async function isHR(userId) {
  const emp = await getEmployee(userId);
  return emp && (emp.role === 'hr' || emp.role === 'admin');
}

async function getMainKeyboard(userId) {
  const emp = await getEmployee(userId);
  const isAdmin = emp && emp.role === 'admin';
  const buttons = [
    [{ text: '📋 Запросы на регистрацию' }],
    [{ text: '📊 Смены за сегодня' }, { text: '📅 Смены за дату' }],
    [{ text: '👤 Часы сотрудника за день' }, { text: '📆 Часы сотрудника за месяц' }],
    [{ text: '⚙️ Изменить норму часов' }]
  ];
  if (isAdmin) {
    buttons.push([{ text: '👑 Назначить HR' }, { text: '🔄 Пересчитать праздники' }]);
  }
  return { reply_markup: { keyboard: buttons, resize_keyboard: true } };
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!(await isHR(userId))) {
    return bot.sendMessage(chatId, '⛔ У вас нет прав доступа к HR-боту.');
  }
  const keyboard = await getMainKeyboard(userId);
  bot.sendMessage(chatId, '🧑‍💼 HR-панель управления', keyboard);
});

bot.on('message', async (msg) => {
  if (!msg.text) return;
  if (msg.text === '/start') return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!(await isHR(userId))) {
    return bot.sendMessage(chatId, '⛔ Нет доступа.');
  }

  try {
    if (text === '📋 Запросы на регистрацию') {
      await showPendingRequests(chatId);
    } else if (text === '📊 Смены за сегодня') {
      const today = new Date().toISOString().split('T')[0];
      await showAllShiftsForDate(chatId, today);
    } else if (text === '📅 Смены за дату') {
      await bot.sendMessage(chatId, 'Введите дату в формате ДД.ММ.ГГГГ');
      const replyListener = async (response) => {
        if (response.text && response.chat.id === chatId) {
          bot.removeListener('message', replyListener);
          const parts = response.text.split('.');
          if (parts.length === 3) {
            const date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            await showAllShiftsForDate(chatId, date);
          } else {
            bot.sendMessage(chatId, 'Неверный формат');
          }
        }
      };
      bot.on('message', replyListener);
    } else if (text === '👤 Часы сотрудника за день') {
      await selectEmployee(chatId, 'day');
    } else if (text === '📆 Часы сотрудника за месяц') {
      await selectEmployee(chatId, 'month');
    } else if (text === '⚙️ Изменить норму часов') {
      await selectEmployee(chatId, 'norm');
    } else if (text === '👑 Назначить HR') {
      await assignHRRole(chatId);
    } else if (text === '🔄 Пересчитать праздники') {
      await recalcAllShifts(chatId);
    }
  } catch (err) {
    console.error('Ошибка:', err);
    bot.sendMessage(chatId, '❌ Ошибка. Попробуйте позже.');
  }
});

// ---------- Запросы на регистрацию ----------
async function showPendingRequests(chatId) {
  const sheet = await getSheet(SHEETS.PENDING);
  const rows = await sheet.getRows();
  const pending = rows.filter(r => getCellValue(r, PENDING_COL.STATUS) === STATUS.PENDING);
  if (pending.length === 0) return bot.sendMessage(chatId, 'Нет активных запросов');
  for (const req of pending) {
    const userId = getCellValue(req, PENDING_COL.USER_ID);
    const userName = getCellValue(req, PENDING_COL.USER_NAME);
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Одобрить', callback_data: `approve_${userId}` }, { text: '❌ Отклонить', callback_data: `reject_${userId}` }]
        ]
      }
    };
    await bot.sendMessage(chatId, `🆕 Запрос от: ${userName}\nID: ${userId}`, keyboard);
  }
}

bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = data.split('_')[1];
  const adminId = callbackQuery.from.id;

  if (!(await isHR(adminId))) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Нет прав' });
    return;
  }

  if (data.startsWith('approve')) {
    const usersSheet = await getSheet(SHEETS.USERS);
    const users = await usersSheet.getRows();
    let userRow = null;
    for (const row of users) {
      const tid = getCellValue(row, USER_COL.TELEGRAM_ID);
      if (tid && String(tid) === userId) {
        userRow = row;
        break;
      }
    }
    const pendingSheet = await getSheet(SHEETS.PENDING);
    const pendingRows = await pendingSheet.getRows();
    let userName = '';
    let pendingRow = null;
    for (const pRow of pendingRows) {
      const pid = getCellValue(pRow, PENDING_COL.USER_ID);
      if (pid && String(pid) === userId) {
        userName = getCellValue(pRow, PENDING_COL.USER_NAME);
        pendingRow = pRow;
        break;
      }
    }
    if (!userRow) {
      await usersSheet.addRow({
        [USER_COL.TELEGRAM_ID]: userId,
        [USER_COL.NAME]: userName,
        [USER_COL.DEPARTMENT]: 'Не указано',
        [USER_COL.ROLE]: 'employee',
        [USER_COL.NORM_HOURS]: 8,
        [USER_COL.NORM_START]: '08:00',
        [USER_COL.NORM_END]: '20:00',
        [USER_COL.ACTIVE]: 'TRUE',
        [USER_COL.REGISTERED]: 'TRUE'
      });
      await bot.sendMessage(chatId, `✅ Сотрудник ${userName} добавлен`);
    } else {
      setCellValue(userRow, USER_COL.REGISTERED, 'TRUE');
      setCellValue(userRow, USER_COL.ACTIVE, 'TRUE');
      await userRow.save();
      await bot.sendMessage(chatId, `✅ Сотрудник ${userName} активирован`);
    }
    if (pendingRow) await pendingRow.delete();
    try {
      await employeeBot.sendMessage(userId, '✅ Регистрация подтверждена!');
    } catch (e) {}
  } else if (data.startsWith('reject')) {
    const pendingSheet = await getSheet(SHEETS.PENDING);
    const pendingRows = await pendingSheet.getRows();
    for (const pRow of pendingRows) {
      const pid = getCellValue(pRow, PENDING_COL.USER_ID);
      if (pid && String(pid) === userId) {
        await pRow.delete();
        break;
      }
    }
    await bot.sendMessage(chatId, `❌ Отказано сотруднику ${userId}`);
    try {
      await employeeBot.sendMessage(userId, '❌ В регистрации отказано.');
    } catch (e) {}
  }
  await bot.answerCallbackQuery(callbackQuery.id);
});

// ---------- Кнопка "Смены за дату" (показывает все смены) ----------
async function showAllShiftsForDate(chatId, date) {
  const logsSheet = await getSheet(SHEETS.LOGS);
  const rows = await logsSheet.getRows();
  const shifts = rows.filter(r => getCellValue(r, LOG_COL.DATE) === date);
  if (shifts.length === 0) {
    return bot.sendMessage(chatId, `Нет смен на ${date}`);
  }
  let msg = `📋 Смены за ${date}:\n`;
  for (const s of shifts) {
    const name = getCellValue(s, LOG_COL.EMPLOYEE_NAME);
    const start = getCellValue(s, LOG_COL.START) || '—';
    const end = getCellValue(s, LOG_COL.END) || '—';
    const status = getCellValue(s, LOG_COL.STATUS);
    msg += `👤 ${name} | ${start} → ${end} | ${status}\n`;
  }
  await bot.sendMessage(chatId, msg);
}

// ---------- Выбор сотрудника по имени (п.6) ----------
async function selectEmployee(chatId, mode) {
  const employees = await getAllActiveEmployees();
  if (employees.length === 0) {
    return bot.sendMessage(chatId, 'Нет активных сотрудников');
  }
  let msg = 'Выберите сотрудника (введите номер):\n';
  employees.forEach((emp, idx) => {
    msg += `${idx+1}. ${emp.name}\n`;
  });
  await bot.sendMessage(chatId, msg);
  const listener = async (response) => {
    if (response.text && response.chat.id === chatId) {
      bot.removeListener('message', listener);
      const num = parseInt(response.text);
      if (num && num >= 1 && num <= employees.length) {
        const selected = employees[num-1];
        if (mode === 'day') await askForDate(chatId, selected.id);
        else if (mode === 'month') await askForMonth(chatId, selected.id);
        else if (mode === 'norm') await changeNorm(chatId, selected.id);
      } else {
        bot.sendMessage(chatId, 'Неверный номер');
      }
    }
  };
  bot.on('message', listener);
}

async function askForDate(chatId, empId) {
  const name = await getEmployeeNameById(empId);
  await bot.sendMessage(chatId, `Сотрудник: ${name}\nВведите дату (ДД.ММ.ГГГГ):`);
  const listener = async (response) => {
    if (response.text && response.chat.id === chatId) {
      bot.removeListener('message', listener);
      const parts = response.text.split('.');
      if (parts.length === 3) {
        const date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        await showEmployeeHoursForDate(chatId, empId, date);
      } else bot.sendMessage(chatId, 'Неверный формат');
    }
  };
  bot.on('message', listener);
}

async function askForMonth(chatId, empId) {
  const name = await getEmployeeNameById(empId);
  await bot.sendMessage(chatId, `Сотрудник: ${name}\nВведите месяц (ММ.ГГГГ):`);
  const listener = async (response) => {
    if (response.text && response.chat.id === chatId) {
      bot.removeListener('message', listener);
      const [m, y] = response.text.split('.');
      if (m && y) {
        const monthPrefix = `${y}-${m.padStart(2, '0')}`;
        await showEmployeeHoursForMonth(chatId, empId, monthPrefix);
      } else bot.sendMessage(chatId, 'Неверный формат');
    }
  };
  bot.on('message', listener);
}

async function changeNorm(chatId, empId) {
  const name = await getEmployeeNameById(empId);
  const usersSheet = await getSheet(SHEETS.USERS);
  const rows = await usersSheet.getRows();
  let userRow = null;
  for (const row of rows) {
    const tid = getCellValue(row, USER_COL.TELEGRAM_ID);
    if (tid && String(tid) === empId) {
      userRow = row;
      break;
    }
  }
  if (!userRow) return bot.sendMessage(chatId, 'Сотрудник не найден');
  const currentNorm = getCellValue(userRow, USER_COL.NORM_HOURS) || 8;
  await bot.sendMessage(chatId, `Сотрудник: ${name}\nТекущая норма: ${currentNorm} часов. Введите новую норму (число):`);
  const normListener = async (res) => {
    if (res.text && res.chat.id === chatId) {
      bot.removeListener('message', normListener);
      const newNorm = parseFloat(res.text);
      if (isNaN(newNorm)) return bot.sendMessage(chatId, 'Некорректное число');
      setCellValue(userRow, USER_COL.NORM_HOURS, newNorm);
      await userRow.save();
      await bot.sendMessage(chatId, `✅ Норма часов для ${name} изменена на ${newNorm}`);
    }
  };
  bot.on('message', normListener);
}

// ---------- Часы сотрудника (с именем) ----------
async function showEmployeeHoursForDate(chatId, empId, date) {
  const logsSheet = await getSheet(SHEETS.LOGS);
  const rows = await logsSheet.getRows();
  const shift = rows.find(r => getCellValue(r, LOG_COL.DATE) === date && String(getCellValue(r, LOG_COL.TELEGRAM_ID)) === empId && getCellValue(r, LOG_COL.STATUS) === STATUS.CLOSED);
  if (!shift) return bot.sendMessage(chatId, `Нет завершённой смены на ${date}`);
  const name = getCellValue(shift, LOG_COL.EMPLOYEE_NAME);
  const credited = getCellValue(shift, LOG_COL.CREDITED);
  const overtime = getCellValue(shift, LOG_COL.OVERTIME);
  await bot.sendMessage(chatId, `👤 Сотрудник: ${name}\n📅 ${date}\n✅ Зачтено: ${credited}\n➕ Переработка: ${overtime}`);
}

async function showEmployeeHoursForMonth(chatId, empId, monthPrefix) {
  const logsSheet = await getSheet(SHEETS.LOGS);
  const rows = await logsSheet.getRows();
  let totalCredited = 0, totalOvertime = 0, shiftCount = 0;
  let employeeName = '';
  for (const row of rows) {
    const tid = getCellValue(row, LOG_COL.TELEGRAM_ID);
    const rowDate = getCellValue(row, LOG_COL.DATE);
    const status = getCellValue(row, LOG_COL.STATUS);
    if (tid && String(tid) === empId && rowDate && rowDate.startsWith(monthPrefix) && status === STATUS.CLOSED) {
      if (!employeeName) employeeName = getCellValue(row, LOG_COL.EMPLOYEE_NAME);
      shiftCount++;
      const creditedStr = getCellValue(row, LOG_COL.CREDITED);
      const overtimeStr = getCellValue(row, LOG_COL.OVERTIME);
      if (creditedStr) {
        const [h, m] = creditedStr.split(':').map(Number);
        totalCredited += h * 60 + m;
      }
      if (overtimeStr) {
        const [h, m] = overtimeStr.split(':').map(Number);
        totalOvertime += h * 60 + m;
      }
    }
  }
  if (shiftCount === 0) return bot.sendMessage(chatId, `Нет завершённых смен за ${monthPrefix}`);
  const totalCreditedFmt = formatMinutes(totalCredited);
  const totalOvertimeFmt = formatMinutes(totalOvertime);
  await bot.sendMessage(chatId, `👤 Сотрудник: ${employeeName}\n📆 Месяц ${monthPrefix}\nСмен: ${shiftCount}\n✅ Зачтено: ${totalCreditedFmt}\n➕ Переработка: ${totalOvertimeFmt}`);
}

// ---------- Назначить HR (только admin) ----------
async function assignHRRole(chatId) {
  const employees = await getAllActiveEmployees();
  if (employees.length === 0) return bot.sendMessage(chatId, 'Нет активных сотрудников');
  let msg = 'Кому назначить роль HR? (введите номер):\n';
  employees.forEach((emp, idx) => {
    msg += `${idx+1}. ${emp.name}\n`;
  });
  await bot.sendMessage(chatId, msg);
  const listener = async (response) => {
    if (response.text && response.chat.id === chatId) {
      bot.removeListener('message', listener);
      const num = parseInt(response.text);
      if (num && num >= 1 && num <= employees.length) {
        const selected = employees[num-1];
        const usersSheet = await getSheet(SHEETS.USERS);
        const rows = await usersSheet.getRows();
        for (const row of rows) {
          const tid = getCellValue(row, USER_COL.TELEGRAM_ID);
          if (tid && String(tid) === selected.id) {
            setCellValue(row, USER_COL.ROLE, 'hr');
            await row.save();
            await bot.sendMessage(chatId, `✅ Сотрудник ${selected.name} теперь HR.`);
            try {
              await employeeBot.sendMessage(selected.id, '🎉 Вам назначена роль HR. Используйте /start для доступа к HR-боту.');
            } catch (e) {}
            break;
          }
        }
      } else {
        bot.sendMessage(chatId, 'Неверный номер');
      }
    }
  };
  bot.on('message', listener);
}

// ---------- Пересчитать все смены (п.5) ----------
async function recalcAllShifts(chatId) {
  await bot.sendMessage(chatId, '🔄 Пересчитываю все смены с учётом праздников и выходных...');
  const logsSheet = await getSheet(SHEETS.LOGS);
  const rows = await logsSheet.getRows();
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const date = getCellValue(row, LOG_COL.DATE);
    const start = getCellValue(row, LOG_COL.START);
    const end = getCellValue(row, LOG_COL.END);
    const userId = getCellValue(row, LOG_COL.TELEGRAM_ID);
    if (start && end && userId) {
      const calc = await calculateShift(start, end, date, userId);
      setCellValue(row, LOG_COL.DURATION, calc.actual);
      setCellValue(row, LOG_COL.OVERTIME, calc.overtime);
      setCellValue(row, LOG_COL.CREDITED, calc.credited);
      setCellValue(row, LOG_COL.DAY_TYPE, calc.dayType);
      setCellValue(row, LOG_COL.COEFFICIENT, calc.coefficient);
      await row.save();
      count++;
      // Пауза после каждых 10 строк
      if (count % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  await bot.sendMessage(chatId, `✅ Пересчитано ${count} смен.`);
}

console.log('✅ HR-бот запущен (полная версия)');