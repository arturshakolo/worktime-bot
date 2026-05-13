import { GoogleSpreadsheet } from 'google-spreadsheet';
import { SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } from '../config/index.js';

let cachedDoc = null;
let loadingPromise = null;

function normalizePrivateKey(key) {
  if (!key) return key;
  let trimmed = key.trim();
  // Удаляем внешние кавычки, если есть
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  // Заменяем \n на реальные переводы строк
  return trimmed.replace(/\\n/g, '\n');
}

// Инициализация документа (вызывается один раз)
async function initDoc() {
  if (cachedDoc) return cachedDoc;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID не указан');
    console.log(`📊 Подключение к таблице: ${SPREADSHEET_ID}`);
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
    const email = GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    const privateKey = normalizePrivateKey(GOOGLE_PRIVATE_KEY);
    if (!email || !privateKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL или GOOGLE_PRIVATE_KEY не заданы');
    }
    await doc.useServiceAccountAuth({ client_email: email, private_key: privateKey });
    await doc.loadInfo(); // <-- ОБЯЗАТЕЛЬНО!
    console.log(`✅ Таблица загружена: ${doc.title}`);
    cachedDoc = doc;
    return doc;
  })();

  return loadingPromise;
}

// Получение листа (с повторными попытками)
export async function getSheet(sheetTitle, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const doc = await initDoc();
      const sheet = doc.sheetsByTitle[sheetTitle];
      if (!sheet) throw new Error(`Лист "${sheetTitle}" не найден`);
      return sheet;
    } catch (err) {
      console.error(`Ошибка получения листа "${sheetTitle}" (попытка ${attempt}):`, err.message);
      if (attempt === retries) throw err;
      // Сбрасываем кеш и пробуем заново
      cachedDoc = null;
      loadingPromise = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Безопасное чтение значения ячейки
export function getCellValue(row, columnName, defaultValue = null) {
  try {
    if (row[columnName] !== undefined && row[columnName] !== null) return row[columnName];
    if (row._rawData && row._rawData[columnName] !== undefined) return row._rawData[columnName];
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

// Безопасная запись значения ячейки
export function setCellValue(row, columnName, value) {
  try {
    row[columnName] = value;
  } catch (err) {
    console.error(`Ошибка записи ${columnName}:`, err);
  }
}

// Сброс соединения
export function resetConnection() {
  cachedDoc = null;
  loadingPromise = null;
  console.log('🔄 Соединение с Google Sheets сброшено');
}