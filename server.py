from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import telebot
import logging

# Настраиваем логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Конфигурация
BOT_TOKEN = '7825183371:AAGNgci8H30ll6t5z9--ayzdqM_S28WSlYw'
bot = telebot.TeleBot(BOT_TOKEN)
PRODUCTS_FILE = 'products.json'

# Загрузка данных о продуктах
def load_products():
    try:
        if os.path.exists(PRODUCTS_FILE):
            with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        logger.error(f"Ошибка при загрузке продуктов: {e}")
        return []

# API для получения списка продуктов
@app.route('/products.json')
def get_products():
    products = load_products()
    return jsonify(products)

# Обработчик команды /start для бота
@bot.message_handler(commands=['start'])
def send_welcome(message):
    bot.reply_to(message, 
        "Здравствуйте! Переходите в наше приложение по кнопке \"Shop\" возле иконки скрепки."
    )

# Обработчик для получения информации о товаре
@bot.message_handler(func=lambda message: True)
def handle_message(message):
    try:
        # Пытаемся распарсить JSON из сообщения
        data = json.loads(message.text)
        if data.get('action') == 'buy':
            product = data.get('product')
            if product:
                response = f"Заказ товара:\n\n" \
                          f"Название: {product['name']}\n" \
                          f"Цена: {product['price']} ₽\n\n" \
                          f"Для оформления заказа свяжитесь с менеджером @username"
                bot.reply_to(message, response)
    except:
        # Если не удалось распарсить JSON, просто игнорируем сообщение
        pass

# Раздача статических файлов
@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('images', filename)

if __name__ == '__main__':
    # Проверяем наличие файла с продуктами
    if not os.path.exists(PRODUCTS_FILE):
        # Создаем файл с примером товара
        default_products = [{
            "id": 1,
            "name": "Кожаный кошелек",
            "description": "Классический кошелек ручной работы",
            "category": "wallets",
            "price": 3500,
            "image": "images/wallet.jpg"
        }]
        with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_products, f, ensure_ascii=False, indent=2)
    
    # Запускаем бота в отдельном потоке
    import threading
    bot_thread = threading.Thread(target=bot.polling, kwargs={'none_stop': True})
    bot_thread.daemon = True
    bot_thread.start()
    
    # Запускаем сервер
    logger.info("Запуск сервера на http://localhost:3000")
    app.run(host='0.0.0.0', port=3000)