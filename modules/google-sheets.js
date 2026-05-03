// ============================================================
// БЛОК: РАБОТА С GOOGLE SHEETS
// ============================================================
// Назначение: подключение и базовые операции с таблицами
// ============================================================

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } from '../config/index.js';

let cachedDoc = null;

// ----- Функция: получить значение из ячейки (безопасно) -----
export function getCellValue(row, columnName, defaultValue = null) {
  try {
    // Способ 1: прямое обращение к свойству
    if (row[columnName] !== undefined && row[columnName] !== null) {
      return row[columnName];
    }
    // Способ 2: через _rawData
    if (row._rawData && row._rawData[columnName] !== undefined) {
      return row._rawData[columnName];
    }
    return defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// ----- Функция: установить значение в ячейку -----
export function setCellValue(row, columnName, value) {
  try {
    row[columnName] = value;
  } catch (e) {
    console.error(`Ошибка установки значения ${columnName}:`, e);
  }
}

// ----- Функция: получить лист по названию -----
export async function getSheet(sheetTitle) {
  if (!cachedDoc) {
    if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID не указан');
    
    console.log(`📊 Подключение к таблице: ${SPREADSHEET_ID}`);
    cachedDoc = new GoogleSpreadsheet(SPREADSHEET_ID);
    
    await cachedDoc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    });
    
    await cachedDoc.loadInfo();
    console.log(`✅ Таблица загружена: ${cachedDoc.title}`);
  }
  
  const sheet = cachedDoc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    throw new Error(`❌ Лист "${sheetTitle}" не найден`);
  }
  return sheet;
}

// ----- Функция: сбросить соединение -----
export function resetConnection() {
  cachedDoc = null;
  console.log('🔄 Соединение с Google Sheets сброшено');
}