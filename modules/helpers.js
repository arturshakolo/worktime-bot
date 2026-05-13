// ============================================================
// БЛОК: ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (с getEmployeeNameById)
// ============================================================
import { getSheet, getCellValue } from './google-sheets.js';
import { USER_COL, SHEETS } from './constants.js';
import { DEFAULTS } from '../config/index.js';

let employeeCache = new Map();
const CACHE_TTL = 10000; // 10 секунд

export async function getEmployee(userId) {
  const cached = employeeCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const sheet = await getSheet(SHEETS.USERS);
  const rows = await sheet.getRows();
  for (const row of rows) {
    const tid = getCellValue(row, USER_COL.TELEGRAM_ID);
    if (tid && String(tid).trim() === String(userId).trim()) {
      const employee = {
        name: getCellValue(row, USER_COL.NAME, 'Не указано'),
        department: getCellValue(row, USER_COL.DEPARTMENT, 'Не указано'),
        normHours: parseFloat(getCellValue(row, USER_COL.NORM_HOURS, DEFAULTS.NORM_HOURS)) || DEFAULTS.NORM_HOURS,
        normStart: getCellValue(row, USER_COL.NORM_START, DEFAULTS.NORM_START),
        normEnd: getCellValue(row, USER_COL.NORM_END, DEFAULTS.NORM_END),
        registered: getCellValue(row, USER_COL.REGISTERED, 'FALSE') === 'TRUE',
        role: getCellValue(row, USER_COL.ROLE, 'employee'),
        active: getCellValue(row, USER_COL.ACTIVE, 'TRUE') === 'TRUE'
      };
      employeeCache.set(userId, { data: employee, timestamp: Date.now() });
      return employee;
    }
  }
  employeeCache.set(userId, { data: null, timestamp: Date.now() });
  return null;
}

export async function getEmployeeNameById(userId) {
  const emp = await getEmployee(userId);
  return emp ? emp.name : String(userId);
}

export async function isRegistered(userId) {
  const emp = await getEmployee(userId);
  return emp ? emp.registered : false;
}

export async function getHRChatIds() {
  const sheet = await getSheet(SHEETS.USERS);
  const rows = await sheet.getRows();
  const hrIds = [];
  for (const row of rows) {
    const role = getCellValue(row, USER_COL.ROLE);
    const tid = getCellValue(row, USER_COL.TELEGRAM_ID);
    const active = getCellValue(row, USER_COL.ACTIVE, 'TRUE') === 'TRUE';
    if (tid && (role === 'hr' || role === 'admin') && active) {
      hrIds.push(String(tid));
    }
  }
  return hrIds;
}

export async function notifyHR(bot, message, excludeUserId = null) {
  const hrIds = await getHRChatIds();
  for (const id of hrIds) {
    if (excludeUserId && String(id) === String(excludeUserId)) continue;
    try {
      await bot.sendMessage(id, message);
    } catch (err) {
      console.error(`Ошибка отправки HR ${id}:`, err.message);
    }
  }
}

export async function getAllActiveEmployees() {
  const sheet = await getSheet(SHEETS.USERS);
  const rows = await sheet.getRows();
  const employees = [];
  for (const row of rows) {
    const tid = getCellValue(row, USER_COL.TELEGRAM_ID);
    const name = getCellValue(row, USER_COL.NAME);
    const active = getCellValue(row, USER_COL.ACTIVE, 'TRUE') === 'TRUE';
    if (tid && active) {
      employees.push({ id: String(tid), name });
    }
  }
  return employees;
}