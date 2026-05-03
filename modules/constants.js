// ============================================================
// БЛОК: КОНСТАНТЫ ПРОЕКТА
// ============================================================

// ----- Названия колонок в таблице USERS -----
export const USER_COL = {
  NAME: 'name',
  DEPARTMENT: 'department',
  ROLE: 'role',
  NORM_HOURS: 'norm_hours',
  PHONE: 'phone',
  ACTIVE: 'active',
  TELEGRAM_ID: 'telegram_id',
  NORM_START: 'norm_start',
  NORM_END: 'norm_end',
  REGISTERED: 'registered',
  IS_HR: 'is_hr'
};

// ----- Названия колонок в таблице LOGS -----
export const LOG_COL = {
  DATE: 'Дата',
  TELEGRAM_ID: 'Telegram_ID',
  EMPLOYEE_NAME: 'Имя',
  DEPARTMENT: 'Отдел',
  START: 'Start',
  END: 'End',
  DURATION: 'Длительность',
  OVERTIME: 'Переработка',
  CREDITED: 'Зачтено_часов',
  STATUS: 'Статус',
  DAY_TYPE: 'Тип_дня',
  COEFFICIENT: 'Коэффициент'
};

// ----- Названия колонок в таблице PENDING -----
export const PENDING_COL = {
  USER_ID: 'user_id',
  USER_NAME: 'user_name',
  REQUEST_DATE: 'request_date',
  STATUS: 'status'
};

// ----- Названия колонок в таблице HOLIDAYS -----
export const HOLIDAY_COL = {
  DATE: 'date',
  NAME: 'name'
};

// ----- Названия листов Google Sheets -----
export const SHEETS = {
  USERS: 'users',
  LOGS: 'logs',
  PENDING: 'pending_registrations',
  HOLIDAYS: 'holidays'
};

// ----- Статусы -----
export const STATUS = {
  OPEN: 'Открыта',
  CLOSED: 'Завершена',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// ----- Типы дней -----
export const DAY_TYPE = {
  WORKDAY: 'workday',
  WEEKEND: 'weekend',
  HOLIDAY: 'holiday'
};

// ----- Команды бота -----
export const COMMANDS = {
  START_WORK: '⏱ Начал работу',
  END_WORK: '⏹ Закончил работу',
  OTHER_DATE: '📅 Другая дата',
  MY_HOURS: '📊 Мои часы',
  REPORT_ERROR: '❓ Сообщить об ошибке',
  TODAY: 'Сегодня',
  YESTERDAY: 'Вчера',
  SELECT_DATE: 'Выбрать дату 📆',
  BACK: 'Назад',
  START_SHIFT: 'Начать смену',
  END_SHIFT: 'Завершить смену',
  EDIT_START: 'Редактировать Start',
  EDIT_END: 'Редактировать End',
  HOURS_TODAY: 'За сегодня',
  HOURS_MONTH: 'За месяц',
  HOURS_DATE: 'За дату'
};