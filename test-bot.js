import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const token = process.env.EMPLOYEE_BOT_TOKEN;
if (!token) {
    console.error('❌ Нет токена');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Бот работает!');
});

console.log('Бот запущен');
