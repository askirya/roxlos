// Глобальные переменные
let products = [];
let availableImages = [];
let isAdmin = false;
const ADMIN_PASSWORD = '56541597';  // Правильный пароль администратора

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Загрузка продуктов при запуске
document.addEventListener('DOMContentLoaded', () => {
    hideLoader();
    loadProducts();
    loadAvailableImages();
    setupEventListeners();
});

// Загрузка доступных изображений
async function loadAvailableImages() {
    try {
        const response = await fetch('/available-images');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        availableImages = await response.json();
        updateImageSelector();
    } catch (error) {
        console.error('Ошибка при загрузке изображений:', error);
        showError('Не удалось загрузить список доступных изображений');
    }
}

// Обновление селектора изображений
function updateImageSelector() {
    const imageSelect = document.getElementById('existingImages');
    if (!imageSelect) return;

    imageSelect.innerHTML = '<option value="">Выберите изображение</option>';
    availableImages.forEach(image => {
        const option = document.createElement('option');
        option.value = image.path;
        option.textContent = image.name;
        imageSelect.appendChild(option);
    });
}

// Функция загрузки продуктов
async function loadProducts() {
    showLoader();
    try {
        const response = await fetch('/products.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        products = await response.json();
        if (!Array.isArray(products)) {
            throw new Error('Получены некорректные данные');
        }
        displayProducts(products);
    } catch (error) {
        console.error('Ошибка при загрузке продуктов:', error);
        showError('Не удалось загрузить продукты. Пожалуйста, обновите страницу.');
    } finally {
        hideLoader();
    }
}

// Отображение продуктов
function displayProducts(productsToShow) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    productsToShow.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <p class="price">${product.price} ₽</p>
                ${isAdmin ? `
                    <button onclick="editProduct(${product.id})">Редактировать</button>
                    <button onclick="deleteProduct(${product.id})" style="background-color: #dc3545;">Удалить</button>
                ` : `
                    <button onclick="buyProduct(${product.id})">Купить</button>
                `}
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск и фильтрация
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
    }
    if (filterSelect) {
        filterSelect.addEventListener('change', filterProducts);
    }

    // Админ панель
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const addProductBtn = document.getElementById('addProductBtn');
    const productForm = document.getElementById('productForm');
    const cancelProductBtn = document.getElementById('cancelProductBtn');

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', toggleAdminPanel);
    }
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            productForm.style.display = 'grid';
            productForm.dataset.mode = 'add';
        });
    }
    if (cancelProductBtn) {
        cancelProductBtn.addEventListener('click', () => {
            productForm.style.display = 'none';
        });
    }
    if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
    }
}

// Фильтрация продуктов
function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('filterSelect').value;

    const filtered = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            product.description.toLowerCase().includes(searchTerm);
        const matchesCategory = category === 'all' || product.category === category;
        return matchesSearch && matchesCategory;
    });

    displayProducts(filtered);
}

// Сохранение продуктов
async function saveProducts() {
    try {
        console.log('Начало сохранения продуктов');
        console.log('Отправляемые данные:', products);

        const response = await fetch('/save-products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(products)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Ошибка сервера: ${response.status}`);
        }

        if (!result.success) {
            throw new Error(result.error || 'Неизвестная ошибка при сохранении');
        }

        console.log('Продукты успешно сохранены');
        return result;
    } catch (error) {
        console.error('Ошибка при сохранении продуктов:', error);
        throw new Error(`Ошибка при сохранении: ${error.message}`);
    }
}

// Обработка отправки формы продукта
async function handleProductSubmit(event) {
    event.preventDefault();
    showLoader();

    try {
        const form = event.target;
        const formData = new FormData(form);
        
        // Проверка обязательных полей
        const name = formData.get('productName');
        const description = formData.get('productDescription');
        const category = formData.get('productCategory');
        const price = formData.get('productPrice');
        const existingImage = formData.get('existingImages');

        if (!name || !description || !category || !price) {
            throw new Error('Пожалуйста, заполните все обязательные поля');
        }

        const mode = form.dataset.mode;
        const productId = form.dataset.productId;

        // Обработка изображения
        let imageData = '';
        const imageFile = formData.get('productImage');

        if (existingImage) {
            // Если выбрано существующее изображение
            imageData = existingImage;
        } else if (imageFile instanceof File && imageFile.size > 0) {
            // Если загружено новое изображение
            if (imageFile.size > 5 * 1024 * 1024) { // 5MB
                throw new Error('Размер изображения не должен превышать 5MB');
            }
            imageData = await convertImageToBase64(imageFile);
        } else {
            // Если редактируем продукт, сохраняем текущее изображение
            if (mode === 'edit') {
                const currentProduct = products.find(p => p.id === parseInt(productId));
                imageData = currentProduct ? currentProduct.image : 'images/placeholder.jpg';
            } else {
                imageData = 'images/placeholder.jpg';
            }
        }

        const productData = {
            id: mode === 'add' ? Date.now() : parseInt(productId),
            name: name.trim(),
            description: description.trim(),
            category: category,
            price: parseInt(price),
            image: imageData
        };

        // Проверка корректности данных
        if (isNaN(productData.price) || productData.price <= 0) {
            throw new Error('Пожалуйста, укажите корректную цену');
        }

        if (mode === 'add') {
            products.push(productData);
        } else {
            const index = products.findIndex(p => p.id === parseInt(productId));
            if (index !== -1) {
                products[index] = productData;
            } else {
                throw new Error('Продукт для редактирования не найден');
            }
        }

        await saveProducts();
        form.style.display = 'none';
        form.reset();
        displayProducts(products);
        showError('Продукт успешно сохранен', 'success');
    } catch (error) {
        console.error('Ошибка при сохранении продукта:', error);
        showError(error.message);
    } finally {
        hideLoader();
    }
}

// Конвертация изображения в base64
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Функции для работы с продуктами
function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const form = document.getElementById('productForm');
    form.dataset.mode = 'edit';
    form.dataset.productId = productId;

    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;

    form.style.display = 'grid';
}

function deleteProduct(productId) {
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        products = products.filter(p => p.id !== productId);
        saveProducts().then(() => {
            displayProducts(products);
        }).catch(error => {
            console.error('Ошибка при удалении:', error);
            showError('Не удалось удалить товар');
        });
    }
}

function buyProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        tg.sendData(JSON.stringify({
            action: 'buy',
            product: product
        }));
    }
}

// Управление админ-панелью
function toggleAdminPanel() {
    const adminPanel = document.getElementById('admin');
    const loginBtn = document.getElementById('adminLoginBtn');
    
    if (!isAdmin) {
        const password = prompt('Введите пароль администратора:');
        if (password === ADMIN_PASSWORD) {
            isAdmin = true;
            adminPanel.classList.add('active');
            loginBtn.textContent = 'Выйти';
            displayProducts(products);
        } else {
            alert('Неверный пароль');
        }
    } else {
        isAdmin = false;
        adminPanel.classList.remove('active');
        loginBtn.textContent = 'Войти в админ-панель';
        displayProducts(products);
    }
}

// Управление загрузчиком
function showLoader() {
    document.getElementById('loader').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Отображение ошибок и сообщений
function showError(message, type = 'error') {
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass}`;
    alertDiv.textContent = message;
    
    // Удаляем предыдущие алерты
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Добавляем новый алерт в начало страницы
    document.body.insertBefore(alertDiv, document.body.firstChild);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}