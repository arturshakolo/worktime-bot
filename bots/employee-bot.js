// ============================================================
// БЛОК: EMPLOYEE БОТ - ГЛАВНЫЙ ФАЙЛ
// ============================================================
import TelegramBot from 'node-telegram-bot-api';
import { EMPLOYEE_BOT_TOKEN, validateConfig } from '../config/index.js';
import { COMMANDS } from '../modules/constants.js';
import { mainKeyboard, dateKeyboard, hoursKeyboard } from '../modules/keyboards.js';
import { ensureRegistered } from '../handlers/employee/registration.js';
import { startShift, endShift, editShiftTime } from '../handlers/employee/shift.js';
import { showHoursForDate, showHoursForMonth } from '../handlers/employee/hours.js';
import {
  getUserState, setUserState, clearUserState,
  handleSelectDate, parseInputDate, handleSelectAction
} from '../handlers/employee/date-handler.js';
import { handleErrorReport } from '../handlers/employee/error-handler.js';
import { getLocalDate } from '../utils/time-calculator.js';

validateConfig();

const bot = new TelegramBot(EMPLOYEE_BOT_TOKEN, { polling: true });
console.log('✅ Employee bot запущен');

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`📱 /start от ${msg.from.id}`);
  await bot.sendMessage(chatId, '👋 Добро пожаловать в учёт рабочего времени!', mainKeyboard);
});

bot.on('message', async (msg) => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();
  const from = msg.from;

  console.log(`📨 Сообщение от ${userId}: "${text}"`);
  if (text === '/start') return;

  try {
    const registered = await ensureRegistered(bot, chatId, userId, from.first_name, from.last_name);
    if (!registered) return;

    const state = getUserState(userId);

    if (state) {
      switch (state.state) {
        case 'select_date':
          await handleSelectDate(bot, chatId, userId, text);
          break;
        case 'input_date':
          await parseInputDate(bot, chatId, userId, text);
          break;
        case 'select_action':
          await handleSelectAction(bot, chatId, userId, text);
          break;
        case 'input_time':
          const { date, action } = state;
          if (action === 'start') {
            await startShift(bot, chatId, userId, from, date, text);
          } else if (action === 'end') {
            await endShift(bot, chatId, userId, date, text);
          } else if (action === 'edit_start') {
            await editShiftTime(bot, chatId, userId, date, 'Start', text);
          } else if (action === 'edit_end') {
            await editShiftTime(bot, chatId, userId, date, 'End', text);
          }
          clearUserState(userId);
          await bot.sendMessage(chatId, 'Готово!', mainKeyboard);
          break;
        case 'input_error':
          await handleErrorReport(bot, chatId, userId, text);
          clearUserState(userId);
          break;
        case 'hours_select':
          await handleHoursSelect(bot, chatId, userId, text);
          break;
        case 'hours_month':
          await showHoursForMonth(bot, chatId, userId, text);
          clearUserState(userId);
          break;
        case 'hours_date':
          await handleHoursDate(bot, chatId, userId, text);
          break;
        default:
          clearUserState(userId);
          await bot.sendMessage(chatId, 'Возврат в меню', mainKeyboard);
      }
      return;
    }

    if (text === COMMANDS.START_WORK) {
      await startShift(bot, chatId, userId, from);
    } else if (text === COMMANDS.END_WORK) {
      await endShift(bot, chatId, userId);
    } else if (text === COMMANDS.OTHER_DATE) {
      await bot.sendMessage(chatId, 'Для какой даты?', dateKeyboard);
      setUserState(userId, { state: 'select_date' });
    } else if (text === COMMANDS.MY_HOURS) {
      await bot.sendMessage(chatId, 'Выберите вариант:', hoursKeyboard);
      setUserState(userId, { state: 'hours_select' });
    } else if (text === COMMANDS.REPORT_ERROR) {
      await bot.sendMessage(chatId, 'Опишите проблему:', mainKeyboard);
      setUserState(userId, { state: 'input_error' });
    } else {
      await bot.sendMessage(chatId, 'Неизвестная команда. Используйте кнопки меню.', mainKeyboard);
    }

  } catch (err) {
    console.error('❌ Ошибка:', err);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте снова.', mainKeyboard);
  }
});

// ----- Вспомогательные функции -----
async function handleHoursSelect(bot, chatId, userId, text) {
  if (text === COMMANDS.HOURS_TODAY) {
    const date = getLocalDate();
    await showHoursForDate(bot, chatId, userId, date);
    clearUserState(userId);
  } else if (text === COMMANDS.HOURS_MONTH) {
    await bot.sendMessage(chatId, 'Введите месяц в формате ММ.ГГГГ (или пусто для текущего)', mainKeyboard);
    setUserState(userId, { state: 'hours_month' });
  } else if (text === COMMANDS.HOURS_DATE) {
    await bot.sendMessage(chatId, 'Введите дату в формате ДД.ММ.ГГГГ', mainKeyboard);
    setUserState(userId, { state: 'hours_date' });
  } else if (text === COMMANDS.BACK) {
    clearUserState(userId);
    await bot.sendMessage(chatId, 'Возврат в меню', mainKeyboard);
  }
}

async function handleHoursDate(bot, chatId, userId, text) {
  try {
    const [d, m, y] = text.split('.');
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    await showHoursForDate(bot, chatId, userId, date);
  } catch {
    await bot.sendMessage(chatId, 'Неверный формат даты', mainKeyboard);
  }
  clearUserState(userId);
}

console.log('✅ Employee bot готов к работе');