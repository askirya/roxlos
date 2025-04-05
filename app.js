import { db, storage } from './firebase-config.js';

// Глобальные переменные
let products = [];
let cart = [];
let isAdmin = false;
let isLoading = false;
const ADMIN_PASSWORD = '56541597';  // Правильный пароль администратора

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Загрузка продуктов при запуске
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница загружена, API URL:', config.API_URL);
    hideLoader();
    loadProducts();
    setupEventListeners();
    
    // Добавляем кнопку корзины
    const header = document.querySelector('header');
    const cartButton = document.createElement('button');
    cartButton.id = 'cartButton';
    cartButton.className = 'cart-button';
    cartButton.textContent = 'Корзина (0)';
    cartButton.onclick = showCart;
    header.appendChild(cartButton);
});

// Функция загрузки продуктов
async function loadProducts() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoader();
        
        console.log('Загрузка продуктов...');
        const response = await fetch('products.json');
        console.log('Статус ответа:', response.status);
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        products = await response.json();
        console.log('Получено продуктов:', products.length);
        
        displayProducts(products);
    } catch (error) {
        console.error('Ошибка при загрузке продуктов:', error);
        showError('Не удалось загрузить продукты');
        displayProducts([]); // Показываем пустой список
    } finally {
        isLoading = false;
        hideLoader();
    }
}

// Отображение продуктов
function displayProducts(productsToShow) {
    const container = document.getElementById('productsContainer');
    if (!container) {
        console.error('Контейнер продуктов не найден');
        return;
    }
    
    container.innerHTML = '';

    if (productsToShow.length === 0) {
        container.innerHTML = '<p class="no-products">Нет доступных товаров</p>';
        return;
    }

    productsToShow.forEach(product => {
        try {
            const productElement = document.createElement('div');
            productElement.className = 'product-card';
            
            let adminControls = '';
            if (isAdmin) {
                adminControls = `
                    <div class="admin-controls">
                        <button onclick="editProduct(${product.id})" class="edit-btn">Редактировать</button>
                        <button onclick="deleteProduct(${product.id})" class="delete-btn">Удалить</button>
                    </div>
                `;
            }

            productElement.innerHTML = `
                <img src="${product.image}" alt="${product.name}" class="product-image" onerror="this.src='images/placeholder.jpg'">
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <p class="price">${product.price} ₽</p>
                    <button onclick="addToCart(${product.id})" class="buy-btn">Купить</button>
                    ${adminControls}
                </div>
            `;
            container.appendChild(productElement);
        } catch (error) {
            console.error('Ошибка при отображении продукта:', error);
        }
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
            showProductForm();
        });
    }
    if (cancelProductBtn) {
        cancelProductBtn.addEventListener('click', () => {
            hideProductForm();
        });
    }
    if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
    }

    // Делаем функции доступными глобально для обработки событий из HTML
    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
    window.buyProduct = buyProduct;
}

// Фильтрация продуктов
function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('filterSelect').value;

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            product.description.toLowerCase().includes(searchTerm);
        const matchesCategory = category === 'all' || product.category === category;
        return matchesSearch && matchesCategory;
    });

    displayProducts(filteredProducts);
}

// Функции для работы с формой продукта
function showProductForm(product = null) {
    const form = document.getElementById('productForm');
    form.style.display = 'block';
    
    if (product) {
        document.getElementById('productName').value = product.name;
        document.getElementById('productDescription').value = product.description;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        form.dataset.productId = product.id;
    } else {
        form.reset();
        delete form.dataset.productId;
    }
}

function hideProductForm() {
    document.getElementById('productForm').style.display = 'none';
}

// Обработка отправки формы продукта
async function handleProductSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('productName').value);
    formData.append('description', document.getElementById('productDescription').value);
    formData.append('category', document.getElementById('productCategory').value);
    formData.append('price', document.getElementById('productPrice').value);
    
    const imageFile = document.getElementById('productImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const productId = event.target.dataset.productId;
    const url = productId 
        ? `${config.API_URL}/update-product/${productId}` 
        : `${config.API_URL}/add-product`;

    try {
        showLoader();
        const response = await fetch(url, {
            method: productId ? 'POST' : 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при сохранении продукта');
        }

        await loadProducts();
        hideProductForm();
    } catch (error) {
        console.error('Ошибка:', error);
        showError(error.message);
    } finally {
        hideLoader();
    }
}

// Функция удаления продукта
async function deleteProduct(productId) {
    if (!confirm('Вы уверены, что хотите удалить этот продукт?')) {
        return;
    }

    try {
        showLoader();
        const response = await fetch(`${config.API_URL}/delete-product/${productId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Ошибка при удалении продукта');
        }

        await loadProducts();
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Не удалось удалить продукт');
    } finally {
        hideLoader();
    }
}

// Функция редактирования продукта
function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        showProductForm(product);
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
            loadProducts();
        } else {
            alert('Неверный пароль');
        }
    } else {
        isAdmin = false;
        adminPanel.classList.remove('active');
        loginBtn.textContent = 'Войти в админ-панель';
        loadProducts();
    }
}

// Покупка продукта
function buyProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        tg.sendData(JSON.stringify({
            action: 'buy',
            product: product
        }));
    }
}

// Управление загрузчиком
function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Отображение ошибок и сообщений
function showError(message) {
    console.error(message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // Удаляем предыдущие сообщения об ошибках
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(err => err.remove());
    
    // Добавляем новое сообщение
    document.body.insertBefore(errorDiv, document.body.firstChild);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Функция добавления в корзину
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        cart.push(product);
        updateCartButton();
        showMessage('Товар добавлен в корзину');
    }
}

// Обновление кнопки корзины
function updateCartButton() {
    const cartButton = document.getElementById('cartButton');
    if (cartButton) {
        cartButton.textContent = `Корзина (${cart.length})`;
    }
}

// Показать корзину
function showCart() {
    if (cart.length === 0) {
        showMessage('Корзина пуста');
        return;
    }

    const total = cart.reduce((sum, product) => sum + product.price, 0);
    const message = {
        action: 'buy',
        products: cart,
        total: total
    };

    // Отправляем данные в Telegram
    tg.sendData(JSON.stringify(message));
}

// Вспомогательные функции
function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}