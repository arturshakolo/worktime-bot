// ============================================================
// БЛОК: ОБРАБОТКА ДАТ
// ============================================================
import { COMMANDS } from '../../modules/constants.js';
import { actionKeyboard, dateKeyboard, mainKeyboard } from '../../modules/keyboards.js';
import { getLocalDate } from '../../utils/time-calculator.js';

// ----- Состояния пользователей -----
const userState = {};

export function getUserState(userId) {
  return userState[userId];
}

export function setUserState(userId, state) {
  userState[userId] = state;
}

export function clearUserState(userId) {
  delete userState[userId];
}

// ----- Функция: обработка выбора даты -----
export async function handleSelectDate(bot, chatId, userId, text) {
  let date;

  if (text === COMMANDS.TODAY) {
    date = getLocalDate();
  } else if (text === COMMANDS.YESTERDAY) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    date = `${year}-${month}-${day}`;
  } else if (text === COMMANDS.SELECT_DATE) {
    await bot.sendMessage(chatId, 'Введите дату в формате ДД.ММ.ГГГГ', mainKeyboard);
    setUserState(userId, { state: 'input_date' });
    return;
  } else if (text === COMMANDS.BACK) {
    clearUserState(userId);
    await bot.sendMessage(chatId, 'Возврат в меню', mainKeyboard);
    return;
  } else {
    clearUserState(userId);
    await bot.sendMessage(chatId, 'Возврат в меню', mainKeyboard);
    return;
  }

  setUserState(userId, { state: 'select_action', date });
  await bot.sendMessage(chatId, `Выбрана дата: ${date}\nЧто сделать?`, actionKeyboard);
}

// ----- Функция: парсинг введённой даты (с поддержкой команд) -----
export async function parseInputDate(bot, chatId, userId, text) {
  // Если пользователь ввёл не дату, а команду меню – обрабатываем как выбор даты
  if (text === COMMANDS.TODAY || text === COMMANDS.YESTERDAY || text === COMMANDS.BACK || text === COMMANDS.SELECT_DATE) {
    await handleSelectDate(bot, chatId, userId, text);
    return;
  }

  try {
    const parts = text.split('.');
    if (parts.length !== 3) throw new Error();
    const [d, m, y] = parts.map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(dateObj.getTime())) throw new Error();
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    setUserState(userId, { state: 'select_action', date });
    await bot.sendMessage(chatId, `Выбрана дата: ${date}\nЧто сделать?`, actionKeyboard);
  } catch {
    await bot.sendMessage(chatId, 'Неверный формат. Введите ДД.ММ.ГГГГ, "Сегодня" или "Назад"', dateKeyboard);
  }
}

// ----- Функция: обработка выбора действия -----
export async function handleSelectAction(bot, chatId, userId, text) {
  if (text === COMMANDS.BACK) {
    clearUserState(userId);
    await bot.sendMessage(chatId, 'Возврат в меню', mainKeyboard);
    return;
  }

  let action;
  if (text === COMMANDS.START_SHIFT) action = 'start';
  else if (text === COMMANDS.END_SHIFT) action = 'end';
  else if (text === COMMANDS.EDIT_START) action = 'edit_start';
  else if (text === COMMANDS.EDIT_END) action = 'edit_end';
  else {
    clearUserState(userId);
    await bot.sendMessage(chatId, 'Возврат в меню', mainKeyboard);
    return;
  }

  const state = getUserState(userId);
  state.action = action;
  state.state = 'input_time';
  setUserState(userId, state);

  await bot.sendMessage(chatId, 'Введите время в формате HH:MM (или оставьте пустым для текущего)', mainKeyboard);
}