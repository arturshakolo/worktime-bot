// ============================================================
// БЛОК: КАЛЬКУЛЯТОР ВРЕМЕНИ
// ============================================================
// Назначение: все расчёты времени, длительности, переработки
// ============================================================

import { getEmployee } from '../modules/helpers.js';
import { getSheet, getCellValue } from '../modules/google-sheets.js';
import { SHEETS, HOLIDAY_COL, DAY_TYPE } from '../modules/constants.js';
import { DEFAULTS } from '../config/index.js';

// ============================================================
// Глобальная переменная
// ============================================================
let holidaysCache = null;
let holidaysCacheTime = 0;

export async function isHoliday(dateString) {
  if (!holidaysCache || (Date.now() - holidaysCacheTime) > 60000) { // обновлять раз в минуту
    const sheet = await getSheet(SHEETS.HOLIDAYS);
    const rows = await sheet.getRows();
    holidaysCache = new Set();
    for (const row of rows) {
      let holidayDate = getCellValue(row, HOLIDAY_COL.DATE);
      if (holidayDate) holidayDate = new Date(holidayDate).toISOString().split('T')[0];
      if (holidayDate) holidaysCache.add(holidayDate);
    }
    holidaysCacheTime = Date.now();
  }
  const normalized = new Date(dateString).toISOString().split('T')[0];
  return holidaysCache.has(normalized);
}

// ----- Функция: текущая локальная дата в формате YYYY-MM-DD -----
export function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ----- Функция: время в минуты -----
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

// ----- Функция: минуты в формат HH:MM -----
export function formatMinutes(minutes) {
  const sign = minutes < 0 ? '-' : '';
  const absMin = Math.abs(minutes);
  const hours = Math.floor(absMin / 60);
  const mins = absMin % 60;
  return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// ----- Функция: длительность смены в минутах -----
export function getDurationMinutes(start, end) {
  let startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin < startMin) endMin += 24 * 60;
  return endMin - startMin;
}

// ----- Функция: проверка выходного дня -----
export function isWeekend(dateString) {
  const date = new Date(dateString);
  const day = date.getDay();
  return day === 6 || day === 0; // 6 - суббота, 0 - воскресенье
}

// ----- Функция: проверка праздника -----
export async function isHoliday(dateString) {
  try {
    const sheet = await getSheet(SHEETS.HOLIDAYS);
    const rows = await sheet.getRows();
    for (const row of rows) {
      const holidayDate = getCellValue(row, HOLIDAY_COL.DATE);
      if (holidayDate === dateString) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ... функция расчета времени рабрчей смены ...

export async function calculateShift(start, end, dateString, userId) {
  const actualMinutes = getDurationMinutes(start, end);
  const employee = await getEmployee(userId);
  const normMinutes = (employee?.normHours || DEFAULTS.NORM_HOURS) * 60;
  const weekend = isWeekend(dateString);
  const holiday = await isHoliday(dateString);

  let creditedMinutes = actualMinutes;
  let dayType = DAY_TYPE.WORKDAY;
  let coefficient = 1;

  if (holiday) {
    dayType = DAY_TYPE.HOLIDAY;
    coefficient = DEFAULTS.HOLIDAY_MULTIPLIER;
    // Новая логика: зачтённые часы = факт × 2
    creditedMinutes = actualMinutes * DEFAULTS.HOLIDAY_MULTIPLIER;
  } else if (weekend) {
    dayType = DAY_TYPE.WEEKEND;
    const weekendMin = DEFAULTS.WEEKEND_MIN_HOURS * 60;
    creditedMinutes = Math.max(actualMinutes, weekendMin);
  }

  const overtimeMinutes = Math.max(0, actualMinutes - normMinutes);

  return {
    actual: formatMinutes(actualMinutes),
    credited: formatMinutes(creditedMinutes),
    overtime: formatMinutes(overtimeMinutes),
    coefficient,
    dayType,
    actualMinutes
  };
}