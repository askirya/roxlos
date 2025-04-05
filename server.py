from flask import Flask, request, jsonify, send_from_directory
import json
import os
import telebot
from threading import Thread, Lock
import base64
import time

app = Flask(__name__)
bot_lock = Lock()

# Конфигурация Telegram бота
BOT_TOKEN = '7825183371:AAGNgci8H30ll6t5z9--ayzdqM_S28WSlYw'
bot = None

def init_bot():
    global bot
    try:
        temp_bot = telebot.TeleBot(BOT_TOKEN)
        # Очищаем очередь обновлений
        temp_bot.get_updates(offset=-1, timeout=1)
        bot = temp_bot
        print("Бот Telegram успешно инициализирован")
        return True
    except Exception as e:
        print(f"Ошибка инициализации бота: {e}")
        return False

# Инициализация бота
init_bot()

# Пути к файлам
PRODUCTS_FILE = 'products.json'
IMAGES_DIR = 'images'

# Проверяем существование файла с продуктами
def ensure_products_file():
    try:
        if not os.path.exists(PRODUCTS_FILE):
            print(f"Создаем файл {PRODUCTS_FILE}")
            default_products = [{
                "id": 1,
                "name": "Кожаный кошелек",
                "description": "Классический кошелек ручной работы",
                "category": "wallets",
                "price": 3500,
                "image": "images/placeholder.jpg"
            }]
            with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(default_products, f, ensure_ascii=False, indent=2)
            print("Файл с продуктами успешно создан")
            return True
        return True
    except Exception as e:
        print(f"Ошибка при создании файла продуктов: {e}")
        return False

# Получение списка доступных изображений
@app.route('/available-images')
def get_available_images():
    try:
        if not os.path.exists(IMAGES_DIR):
            return jsonify([])
        
        images = []
        for filename in os.listdir(IMAGES_DIR):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                images.append({
                    'path': f'{IMAGES_DIR}/{filename}',
                    'name': filename
                })
        return jsonify(images)
    except Exception as e:
        print(f"Ошибка при получении списка изображений: {e}")
        return jsonify([])

# Обработчик команды /start для бота
@bot.message_handler(commands=['start'])
def send_welcome(message):
    try:
        bot.reply_to(message, 
            "Здравствуйте! Переходите в наше приложение по кнопке \"Shop\" возле иконки скрепки."
        )
    except Exception as e:
        print(f"Ошибка при отправке сообщения: {e}")

# Функция для запуска бота в отдельном потоке
def run_bot():
    global bot
    while True:
        try:
            with bot_lock:
                if bot:
                    bot.polling(none_stop=True, interval=3)
        except Exception as e:
            print(f"Ошибка в работе бота: {e}")
            time.sleep(5)  # Пауза перед повторной попыткой
            init_bot()  # Переинициализация бота

# Загрузка продуктов
@app.route('/products.json')
def get_products():
    try:
        ensure_products_file()
        if not os.path.exists(PRODUCTS_FILE):
            print(f"Файл {PRODUCTS_FILE} не найден")
            return jsonify([])
            
        with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
            products = json.load(f)
            print(f"Успешно загружено {len(products)} продуктов")
            return jsonify(products)
    except json.JSONDecodeError as e:
        print(f"Ошибка при парсинге JSON: {e}")
        return jsonify([])
    except Exception as e:
        print(f"Ошибка при чтении файла: {e}")
        return jsonify([])

# Сохранение продуктов
@app.route('/save-products', methods=['POST'])
def save_products():
    try:
        print("Начало сохранения продуктов")
        if not request.is_json:
            print("Ошибка: данные не в формате JSON")
            return jsonify({"error": "Неверный формат данных"}), 400

        data = request.json
        if not isinstance(data, list):
            print("Ошибка: данные не являются списком")
            return jsonify({"error": "Данные должны быть списком"}), 400

        print(f"Получено {len(data)} продуктов для сохранения")
        
        # Проверяем и создаем директорию для изображений
        try:
            if not os.path.exists(IMAGES_DIR):
                os.makedirs(IMAGES_DIR)
                print(f"Создана директория {IMAGES_DIR}")
        except Exception as e:
            print(f"Ошибка при создании директории {IMAGES_DIR}: {e}")
            return jsonify({"error": f"Не удалось создать директорию для изображений: {str(e)}"}), 500

        # Обрабатываем изображения
        for product in data:
            # Если путь к изображению уже существует в images/, оставляем его как есть
            if 'image' in product and product['image'].startswith(IMAGES_DIR):
                continue
                
            # Если получили новое изображение в формате base64
            if 'image' in product and isinstance(product['image'], str) and product['image'].startswith('data:image'):
                try:
                    # Извлекаем данные base64 и формат изображения
                    image_parts = product['image'].split(',')
                    if len(image_parts) != 2:
                        print(f"Неверный формат base64 для продукта {product['id']}")
                        continue
                        
                    image_data = image_parts[1]
                    image_format = product['image'].split(';')[0].split('/')[1]
                    
                    # Создаем имя файла
                    filename = f"product_{product['id']}_{int(time.time())}.{image_format}"
                    filepath = os.path.join(IMAGES_DIR, filename)
                    
                    # Сохраняем изображение
                    with open(filepath, 'wb') as f:
                        f.write(base64.b64decode(image_data))
                    print(f"Изображение сохранено: {filepath}")
                    # Обновляем путь к изображению в данных продукта
                    product['image'] = filepath
                except Exception as e:
                    print(f"Ошибка при сохранении изображения для продукта {product['id']}: {e}")
                    continue

        # Сохраняем обновленные данные продуктов
        try:
            with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("Данные продуктов успешно сохранены")
            return jsonify({"success": True})
        except Exception as e:
            print(f"Ошибка при сохранении в файл {PRODUCTS_FILE}: {e}")
            return jsonify({"error": f"Не удалось сохранить данные: {str(e)}"}), 500
            
    except Exception as e:
        error_msg = f"Общая ошибка при сохранении данных: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500

# Раздача статических файлов
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    if path.startswith('images/'):
        return send_from_directory('.', path)
    return send_from_directory('.', path)

if __name__ == '__main__':
    # Создаем директорию для изображений, если её нет
    if not os.path.exists(IMAGES_DIR):
        os.makedirs(IMAGES_DIR)
    
    # Проверяем наличие файла с продуктами
    ensure_products_file()
    
    # Запускаем бота в отдельном потоке только если он инициализирован
    if bot:
        bot_thread = Thread(target=run_bot)
        bot_thread.daemon = True
        bot_thread.start()
    else:
        print("ВНИМАНИЕ: Бот Telegram не инициализирован. Веб-приложение будет работать без функционала бота.")
    
    # Запускаем сервер
    app.run(host='0.0.0.0', port=3000, debug=False)  # Отключаем debug режим 