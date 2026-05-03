// ============================================================
// БЛОК: КЛАВИАТУРЫ БОТА
// ============================================================
// Назначение: все клавиатуры для Employee бота
// ============================================================

import { COMMANDS } from './constants.js';

// ----- Главное меню -----
export const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: COMMANDS.START_WORK }, { text: COMMANDS.END_WORK }],
      [{ text: COMMANDS.OTHER_DATE }, { text: COMMANDS.MY_HOURS }],
      [{ text: COMMANDS.REPORT_ERROR }]
    ],
    resize_keyboard: true
  }
};

// ----- Меню выбора даты -----
export const dateKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: COMMANDS.TODAY }, { text: COMMANDS.YESTERDAY }],
      [{ text: COMMANDS.SELECT_DATE }, { text: COMMANDS.BACK }]
    ],
    resize_keyboard: true
  }
};

// ----- Меню действий с датой -----
export const actionKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: COMMANDS.START_SHIFT }, { text: COMMANDS.END_SHIFT }],
      [{ text: COMMANDS.EDIT_START }, { text: COMMANDS.EDIT_END }],
      [{ text: COMMANDS.BACK }]
    ],
    resize_keyboard: true
  }
};

// ----- Меню просмотра часов -----
export const hoursKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: COMMANDS.HOURS_TODAY }, { text: COMMANDS.HOURS_MONTH }],
      [{ text: COMMANDS.HOURS_DATE }, { text: COMMANDS.BACK }]
    ],
    resize_keyboard: true
  }
};