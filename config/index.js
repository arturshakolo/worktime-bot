// ============================================================
// БЛОК: КОНФИГУРАЦИЯ ПРОЕКТА
// ============================================================
// Назначение: централизованное хранение всех настроек
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

// ----- Токены ботов -----
export const EMPLOYEE_BOT_TOKEN = process.env.EMPLOYEE_BOT_TOKEN?.trim();
export const HR_BOT_TOKEN = process.env.HR_BOT_TOKEN?.trim();
export const HR_CHAT_ID = process.env.HR_CHAT_ID?.trim();

// ----- Google Sheets -----
export const SPREADSHEET_ID = process.env.SPREADSHEET_ID?.trim();
export const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
export const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

// ----- Названия листов -----
export const SHEETS = {
  USERS: 'users',
  LOGS: 'logs',
  PENDING: 'pending_registrations',
  HOLIDAYS: 'holidays'
};

// ----- Настройки по умолчанию -----
export const DEFAULTS = {
  NORM_HOURS: 8,
  NORM_START: '08:00',
  NORM_END: '20:00',
  WEEKEND_MIN_HOURS: 10,
  HOLIDAY_MULTIPLIER: 2
};

// ----- Временные интервалы (в минутах) -----
export const INTERVALS = {
  REMINDER_CHECK: 5,
  REMINDER_REPEAT: 30,
  REMINDER_BEFORE_START: 5,
  REMINDER_AFTER_END: 5,
  MAX_REMINDERS: 4
};

// ----- Проверка обязательных переменных -----
export function validateConfig() {
  const errors = [];
  if (!EMPLOYEE_BOT_TOKEN) errors.push('EMPLOYEE_BOT_TOKEN');
  if (!HR_BOT_TOKEN) errors.push('HR_BOT_TOKEN');
  if (!SPREADSHEET_ID) errors.push('SPREADSHEET_ID');
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) errors.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!GOOGLE_PRIVATE_KEY) errors.push('GOOGLE_PRIVATE_KEY');
  
  if (errors.length > 0) {
    throw new Error(`❌ Отсутствуют переменные окружения: ${errors.join(', ')}`);
  }
}