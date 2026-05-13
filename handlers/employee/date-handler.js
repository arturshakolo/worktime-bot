import { COMMANDS } from '../../modules/constants.js';
import { actionKeyboard, dateKeyboard, mainKeyboard } from '../../modules/keyboards.js';

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

export async function handleSelectDate(bot, chatId, userId, text) {
  let date;
  if (text === COMMANDS.TODAY) {
    date = new Date().toISOString().split('T')[0];
  } else if (text === COMMANDS.YESTERDAY) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = d.toISOString().split('T')[0];
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

export async function parseInputDate(bot, chatId, userId, text) {
  // Если пользователь ввёл команду меню, а не дату
  if (text === COMMANDS.TODAY || text === COMMANDS.YESTERDAY || text === COMMANDS.BACK || text === COMMANDS.SELECT_DATE) {
    await handleSelectDate(bot, chatId, userId, text);
    return;
  }
  // Парсим дату
  const parts = text.split('.');
  if (parts.length !== 3) {
    await bot.sendMessage(chatId, 'Неверный формат. Введите ДД.ММ.ГГГГ, "Сегодня" или "Назад"', dateKeyboard);
    return;
  }
  const [d, m, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) {
    await bot.sendMessage(chatId, 'Неверный формат. Введите ДД.ММ.ГГГГ, "Сегодня" или "Назад"', dateKeyboard);
    return;
  }
  const dateObj = new Date(Date.UTC(y, m-1, d));
  if (dateObj.getUTCDate() !== d || dateObj.getUTCMonth()+1 !== m || dateObj.getUTCFullYear() !== y) {
    await bot.sendMessage(chatId, 'Неверная дата. Введите реальную дату.', dateKeyboard);
    return;
  }
  const isoDate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  setUserState(userId, { state: 'select_action', date: isoDate });
  await bot.sendMessage(chatId, `Выбрана дата: ${isoDate}\nЧто сделать?`, actionKeyboard);
}

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
  if (!state || !state.date) {
    clearUserState(userId);
    await bot.sendMessage(chatId, 'Ошибка: дата не выбрана. Начните заново.', mainKeyboard);
    return;
  }
  state.action = action;
  state.state = 'input_time';
  setUserState(userId, state);
  await bot.sendMessage(chatId, 'Введите время в формате HH:MM (или оставьте пустым для текущего)', mainKeyboard);
}