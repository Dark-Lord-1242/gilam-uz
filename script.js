// =================== GILAM ZAKAZ - SCRIPT v5.3 (Firebase) ===================

// =================== FIREBASE CONFIG ===================
// O'z Firebase URL ingizni shu yerga yozing:
var FIREBASE_URL = 'https://gilamuz-8308f-default-rtdb.firebaseio.com/';

// =================== STATE ===================
var orders = [];
var currentFilter = 'all';
var currentQueueFilter = 'all';
var currentQueueSort = 'newest';
var currentPage = 'home';
var currentImageIndex = 0;
var imageGallery = [];
var currentOrderId = null;
var PRICE_PER_SQM = 80000;
var priceItems = [];
var selectedPriceItem = null;
var productItemsList = [];
var productItemCounter = 0;

var PRODUCT_PRICES = {
    gilam:    { emoji: '🧺', name: 'Gilam',    pricingType: 'sqm',  pricePerSqm: 80000 },
    adyol:    { emoji: '🛏️', name: 'Adyol',    pricingType: 'size', priceSmall: 40000, priceLarge: 70000 },
    yakandoz: { emoji: '🪣', name: 'Yakandoz', pricingType: 'sqm',  pricePerSqm: 50000 },
    parda:    { emoji: '🪟', name: 'Parda',    pricingType: 'kg',   pricePerKg: 15000 },
    korpa:    { emoji: '🛌', name: "Ko'rpa",   pricingType: 'size', priceSmall: 35000, priceLarge: 60000 },
};

function loadProductPricesFromAdmin() {
    var saved = localStorage.getItem('gilam_product_prices_v2');
    if (saved) {
        try {
            var parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(function(key) {
                if (PRODUCT_PRICES[key]) Object.assign(PRODUCT_PRICES[key], parsed[key]);
            });
        } catch(e) {}
    }
}

// =================== INITIALIZATION ===================
document.addEventListener('DOMContentLoaded', function () {
    var savedPrice = localStorage.getItem('gilam_global_price');
    if (savedPrice && parseInt(savedPrice) >= 1000) PRICE_PER_SQM = parseInt(savedPrice);
    loadPriceItems();
    loadOrdersFromFirebase(function() {
        finishInit();
        startAutoRefresh();
    });
});

function finishInit() {
    loadProductPricesFromAdmin();
    setupEventListeners();
    updateDateTime();
    updateStats();
    displayRecentOrders();
    displayQueuePreview();
    setTimeout(function() {
        var ls = document.getElementById('loadingScreen');
        if (ls) ls.classList.add('hide');
    }, 600);
}

function startAutoRefresh() {
    setInterval(function() {
        loadOrdersFromFirebase(function() {
            updateStats();
            displayRecentOrders();
            displayQueuePreview();
            if (currentPage === 'queue')  displayQueue();
            if (currentPage === 'orders') filterOrders();
        });
    }, 8000);
}

// =================== FIREBASE ===================
function firebaseFetch(method, path, data, callback) {
    var url = FIREBASE_URL + path + '.json';
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (data !== null && data !== undefined) opts.body = JSON.stringify(data);
    fetch(url, opts)
        .then(function(r) { return r.json(); })
        .then(function(res) { callback(null, res); })
        .catch(function(e) { callback(e.message || 'Network xato', null); });
}

function loadOrdersFromFirebase(callback) {
    firebaseFetch('GET', '/orders', null, function(err, data) {
        if (err) {
            console.error('Firebase xato:', err);
            orders = [];
            if (callback) callback();
            return;
        }
        if (!data) { orders = []; if (callback) callback(); return; }
        orders = Object.values(data)
            .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
            .map(function(o) {
                return Object.assign({
                    status: 'new', paymentStatus: 'unpaid',
                    paymentMethod: null, paidAt: null, queueNumber: null
                }, o, { id: Number(o.id) });
            });
        if (callback) callback();
    });
}

function loadOrdersFromDB(callback) { loadOrdersFromFirebase(callback); }

function saveOrderToDB(order, callback) {
    firebaseFetch('PUT', '/orders/' + order.id, order, function(err) {
        if (err) { callback('Saqlash xato: ' + err); return; }
        callback(null, order.id);
    });
}

function updateOrderInDB(order, callback) {
    firebaseFetch('PUT', '/orders/' + order.id, order, function(err) {
        if (err) { if (callback) callback('Yangilash xato: ' + err); return; }
        if (callback) callback(null);
    });
}

function deleteOrderFromDB(id, callback) {
    firebaseFetch('DELETE', '/orders/' + id, null, function(err) {
        if (err) { if (callback) callback('Ochirish xato: ' + err); return; }
        if (callback) callback(null);
    });
}

// =================== PRICE ITEMS ===================
function loadPriceItems() {
    var pi = localStorage.getItem('gilam_price_items');
    if (pi) { try { priceItems = JSON.parse(pi); } catch(e) { priceItems = []; } }
    if (!priceItems.length) {
        priceItems = [
            {id:1, name:'Oddiy gilam', price:80000,  type:'sqm', emoji:'🧺', color:'#667eea'},
            {id:2, name:'Jun gilam',   price:120000, type:'sqm', emoji:'🐑', color:'#764ba2'},
            {id:3, name:'Atlas gilam', price:60000,  type:'sqm', emoji:'✨', color:'#22c55e'},
            {id:4, name:'Xali gilam',  price:100000, type:'sqm', emoji:'🏺', color:'#f97316'},
        ];
    }
    var gp = localStorage.getItem('gilam_global_price');
    if (gp && parseInt(gp) >= 1000) PRICE_PER_SQM = parseInt(gp);
}

function renderProductTypeSelector() {
    var container = document.getElementById('productTypeSelector');
    if (!container) return;
    loadPriceItems();
    container.innerHTML = '';
    priceItems.forEach(function(item, idx) {
        var card = document.createElement('div');
        card.className = 'product-type-card' + (idx === 0 && !selectedPriceItem ? ' selected' : '');
        if (selectedPriceItem && selectedPriceItem.id === item.id) card.className += ' selected';
        var bgColor = item.color ? hexToRgba(item.color, 0.12) : 'rgba(102,126,234,0.1)';
        card.innerHTML =
            '<div class="pt-emoji" style="background:' + bgColor + '">' + (item.emoji||'🧺') + '</div>' +
            '<div class="pt-info">' +
                '<div class="pt-name">' + item.name + '</div>' +
                '<div class="pt-price">' + Number(item.price).toLocaleString() + " so'm/m²</div>" +
            '</div>' +
            '<div class="pt-check"><i class="fas fa-check"></i></div>';
        card.onclick = function() {
            selectedPriceItem = item;
            PRICE_PER_SQM = item.price;
            container.querySelectorAll('.product-type-card').forEach(function(c) { c.classList.remove('selected'); });
            card.classList.add('selected');
            calculatePrice();
        };
        container.appendChild(card);
    });
    if (!selectedPriceItem && priceItems.length > 0) {
        selectedPriceItem = priceItems[0];
        PRICE_PER_SQM = priceItems[0].price;
    }
}

function hexToRgba(hex, a) {
    var r=0,g=0,b=0;
    if (hex && hex.length===7) {
        r=parseInt(hex.slice(1,3),16);
        g=parseInt(hex.slice(3,5),16);
        b=parseInt(hex.slice(5,7),16);
    }
    return 'rgba('+r+','+g+','+b+','+a+')';
}

// =================== EVENT LISTENERS ===================
function setupEventListeners() {
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', filterOrders);

    var dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = '#667eea';
        });
        dropZone.addEventListener('dragleave', function() {
            dropZone.style.borderColor = '#e2e8f0';
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = '#e2e8f0';
            showPreview(e.dataTransfer.files);
        });
    }

    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) closeModal(e.target);
    });
}

// =================== NAVIGATION ===================
function switchPage(page) {
    document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
    var nav = document.querySelector('[data-page="' + page + '"]');
    if (nav) nav.classList.add('active');
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    var pg = document.getElementById(page + 'Page');
    if (pg) pg.classList.add('active');
    currentPage = page;
    if      (page === 'home')   { updateStats(); displayRecentOrders(); displayQueuePreview(); }
    else if (page === 'orders') { filterOrders(); }
    else if (page === 'queue')  { displayQueue(); }
    else if (page === 'stats')  { displayStats(); }
}

function updateDateTime() {
    var dateEl = document.getElementById('currentDate');
    if (!dateEl) return;
    var now = new Date();
    var months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    var days = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    dateEl.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()];
}

// =================== MODALS ===================
function openOrderModal() {
    var modal = document.getElementById('orderModal');
    if (modal) { modal.classList.add('show'); document.body.style.overflow = 'hidden'; resetForm(); }
}
function closeOrderModal() {
    var modal = document.getElementById('orderModal');
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
}
function closeDetailsModal() {
    var modal = document.getElementById('detailsModal');
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
}
function openAdminLoginModal() {
    var modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        var pw = document.getElementById('adminPassword');
        if (pw) pw.value = '';
    }
}
function closeAdminLoginModal() {
    var modal = document.getElementById('adminLoginModal');
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
}
function closeModal(element) {
    if (element) { element.classList.remove('show'); document.body.style.overflow = ''; }
}

// =================== FORMS ===================
function resetForm() {
    ['phone','village','comment','customOrderId'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    var fi = document.getElementById('images'); if (fi) fi.value = '';
    var prev = document.getElementById('imagePreview'); if (prev) prev.innerHTML = '';
    var err = document.getElementById('phoneError'); if (err) err.style.display = 'none';
    productItemsList = [];
    productItemCounter = 0;
    renderProductItems();
    loadPriceItems();
}

// =================== MAHSULOT ELEMENTLARI ===================
function addProductItem(type, emoji, name) {
    productItemCounter++;
    loadProductPricesFromAdmin();
    var priceInfo = PRODUCT_PRICES[type] || { pricingType: 'sqm', pricePerSqm: 80000 };
    var item = {
        id: productItemCounter,
        type: type,
        emoji: emoji,
        name: name,
        pricingType: priceInfo.pricingType || 'sqm',
        width: 3,
        height: 2,
        pricePerSqm: priceInfo.pricePerSqm || 80000,
        area: 6,
        sizeVariant: 'large',
        priceSmall: priceInfo.priceSmall || 35000,
        priceLarge: priceInfo.priceLarge || 60000,
        kg: 1,
        pricePerKg: priceInfo.pricePerKg || 15000,
        price: 0
    };
    item.price = calcItemPrice(item);
    productItemsList.push(item);
    renderProductItems();
}

function calcItemPrice(item) {
    if (item.pricingType === 'sqm') {
        item.area = (item.width || 0) * (item.height || 0);
        return item.area * (item.pricePerSqm || 0);
    } else if (item.pricingType === 'size') {
        return item.sizeVariant === 'small' ? (item.priceSmall || 0) : (item.priceLarge || 0);
    } else if (item.pricingType === 'kg') {
        return (item.kg || 0) * (item.pricePerKg || 0);
    }
    return 0;
}

function removeProductItem(itemId) {
    productItemsList = productItemsList.filter(function(i) { return i.id !== itemId; });
    renderProductItems();
}

function updateProductItem(itemId, field, value) {
    var item = productItemsList.find(function(i) { return i.id === itemId; });
    if (!item) return;
    if (field === 'sizeVariant') {
        item.sizeVariant = value;
    } else {
        item[field] = parseFloat(value) || 0;
    }
    item.price = calcItemPrice(item);
    if (item.pricingType === 'sqm') {
        var areaEl = document.getElementById('area_' + itemId);
        if (areaEl) areaEl.textContent = item.area.toFixed(2) + ' m²';
    }
    var priceEl = document.getElementById('price_' + itemId);
    if (priceEl) priceEl.textContent = Number(item.price).toLocaleString() + " so'm";
    updateTotalCalc();
}

function selectSizeVariant(itemId, variant, btnEl) {
    var item = productItemsList.find(function(i) { return i.id === itemId; });
    if (!item) return;
    item.sizeVariant = variant;
    item.price = calcItemPrice(item);
    var container = document.getElementById('sizeBtns_' + itemId);
    if (container) {
        container.querySelectorAll('.pic-size-btn').forEach(function(b) { b.classList.remove('active'); });
        btnEl.classList.add('active');
    }
    var priceEl = document.getElementById('price_' + itemId);
    if (priceEl) priceEl.textContent = Number(item.price).toLocaleString() + " so'm";
    var labelEl = document.getElementById('sizelabel_' + itemId);
    if (labelEl) labelEl.textContent = variant === 'small' ? "Kichik o'lcham" : "Katta o'lcham";
    updateTotalCalc();
}

function renderProductItems() {
    var container = document.getElementById('productItemsList');
    if (!container) return;
    container.innerHTML = '';
    if (productItemsList.length === 0) {
        container.innerHTML = '<div class="empty-products-hint"><i class="fas fa-hand-point-up"></i> Yuqoridagi tugmalardan mahsulot qo\'shing</div>';
        updateTotalCalc();
        return;
    }
    var colorMap = {
        gilam: '#667eea', adyol: '#f97316', yakandoz: '#22c55e',
        parda: '#8b5cf6', korpa: '#ec4899'
    };
    productItemsList.forEach(function(item, idx) {
        var color = colorMap[item.type] || '#667eea';
        var card = document.createElement('div');
        card.className = 'product-item-card';
        card.style.borderLeftColor = color;
        var now = new Date();
        var timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
        var dateStr = now.getDate() + '.' + (now.getMonth()+1).toString().padStart(2,'0') + '.' + now.getFullYear();
        var bodyHtml = '';
        if (item.pricingType === 'sqm') {
            bodyHtml =
                '<div class="pic-dimensions">' +
                    '<div class="pic-dim-group">' +
                        '<label>Eni (m)</label>' +
                        '<input type="number" class="pic-input" value="' + item.width + '" step="0.1" min="0.1" ' +
                            'oninput="updateProductItem(' + item.id + ',\'width\',this.value)" ' +
                            'onchange="updateProductItem(' + item.id + ',\'width\',this.value)">' +
                    '</div>' +
                    '<div class="pic-multiply">✕</div>' +
                    '<div class="pic-dim-group">' +
                        '<label>Bo\'yi (m)</label>' +
                        '<input type="number" class="pic-input" value="' + item.height + '" step="0.1" min="0.1" ' +
                            'oninput="updateProductItem(' + item.id + ',\'height\',this.value)" ' +
                            'onchange="updateProductItem(' + item.id + ',\'height\',this.value)">' +
                    '</div>' +
                    '<div class="pic-equals">=</div>' +
                    '<div class="pic-area-result">' +
                        '<div class="pic-area-val" id="area_' + item.id + '">' + item.area.toFixed(2) + ' m²</div>' +
                        '<div class="pic-area-label">maydon</div>' +
                    '</div>' +
                '</div>' +
                '<div class="pic-price-row">' +
                    '<div class="pic-price-per">' + Number(item.pricePerSqm).toLocaleString() + " so'm/m²</div>" +
                    '<div class="pic-total-price" id="price_' + item.id + '" style="color:' + color + ';">' + Number(item.price).toLocaleString() + " so'm</div>" +
                '</div>';
        } else if (item.pricingType === 'size') {
            var isSmall = item.sizeVariant === 'small';
            bodyHtml =
                '<div class="pic-size-selector">' +
                    '<div class="pic-size-label">O\'lcham tanlang:</div>' +
                    '<div class="pic-size-btns" id="sizeBtns_' + item.id + '">' +
                        '<button type="button" class="pic-size-btn' + (isSmall ? ' active' : '') + '" ' +
                            'data-color="' + color + '" ' +
                            'onclick="selectSizeVariant(' + item.id + ',\'small\',this)">' +
                            '<span class="size-btn-icon">📦</span>' +
                            '<span class="size-btn-name">Kichik</span>' +
                            '<span class="size-btn-price">' + Number(item.priceSmall).toLocaleString() + " so'm</span>" +
                        '</button>' +
                        '<button type="button" class="pic-size-btn' + (!isSmall ? ' active' : '') + '" ' +
                            'data-color="' + color + '" ' +
                            'onclick="selectSizeVariant(' + item.id + ',\'large\',this)">' +
                            '<span class="size-btn-icon">📦</span>' +
                            '<span class="size-btn-name">Katta</span>' +
                            '<span class="size-btn-price">' + Number(item.priceLarge).toLocaleString() + " so'm</span>" +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="pic-price-row" style="margin-top:8px;">' +
                    '<div class="pic-price-per" id="sizelabel_' + item.id + '">' + (isSmall ? 'Kichik o\'lcham' : 'Katta o\'lcham') + '</div>' +
                    '<div class="pic-total-price" id="price_' + item.id + '" style="color:' + color + ';">' + Number(item.price).toLocaleString() + " so'm</div>" +
                '</div>';
        } else if (item.pricingType === 'kg') {
            bodyHtml =
                '<div class="pic-dimensions">' +
                    '<div class="pic-dim-group" style="flex:none;min-width:100px;">' +
                        '<label>Og\'irlik (kg)</label>' +
                        '<input type="number" class="pic-input" value="' + item.kg + '" step="0.1" min="0.1" ' +
                            'oninput="updateProductItem(' + item.id + ',\'kg\',this.value)" ' +
                            'onchange="updateProductItem(' + item.id + ',\'kg\',this.value)">' +
                    '</div>' +
                    '<div class="pic-equals" style="padding-top:16px;">×</div>' +
                    '<div class="pic-area-result" style="padding-top:12px;min-width:80px;">' +
                        '<div class="pic-area-val" style="color:' + color + ';">' + Number(item.pricePerKg).toLocaleString() + '</div>' +
                        '<div class="pic-area-label">so\'m/kg</div>' +
                    '</div>' +
                '</div>' +
                '<div class="pic-price-row">' +
                    '<div class="pic-price-per">Parda narxi (kg bo\'yicha)</div>' +
                    '<div class="pic-total-price" id="price_' + item.id + '" style="color:' + color + ';">' + Number(item.price).toLocaleString() + " so'm</div>" +
                '</div>';
        }
        card.innerHTML =
            '<div class="pic-header" style="border-bottom:2px solid ' + color + '20;">' +
                '<div class="pic-title">' +
                    '<span class="pic-emoji" style="background:' + color + '20;">' + item.emoji + '</span>' +
                    '<div>' +
                        '<div class="pic-name" style="color:' + color + ';">' + item.name + ' #' + (idx+1) + '</div>' +
                        '<div class="pic-datetime">📅 ' + dateStr + ' ⏰ ' + timeStr + '</div>' +
                    '</div>' +
                '</div>' +
                '<button type="button" class="pic-remove" onclick="removeProductItem(' + item.id + ')" title="O\'chirish">✕</button>' +
            '</div>' +
            '<div class="pic-body">' + bodyHtml + '</div>';
        container.appendChild(card);
    });
    updateTotalCalc();
}

function updateTotalCalc() {
    var totalBox = document.getElementById('totalCalcBox');
    var priceEl = document.getElementById('livePrice');
    var countEl = document.getElementById('liveItemCount');
    var total = productItemsList.reduce(function(s, i) { return s + (i.price || 0); }, 0);
    if (productItemsList.length === 0) {
        if (totalBox) totalBox.style.display = 'none';
    } else {
        if (totalBox) totalBox.style.display = 'block';
        if (priceEl) priceEl.textContent = total.toLocaleString() + " so'm";
        if (countEl) countEl.textContent = productItemsList.length + ' ta';
    }
}

function calculatePrice() {
    updateTotalCalc();
    return { area: 0, price: productItemsList.reduce(function(s,i){return s+i.price;}, 0) };
}

function showPreview(files) {
    var preview = document.getElementById('imagePreview');
    if (!preview) return;
    preview.innerHTML = '';
    var arr = Array.from(files);
    if (arr.length > 10) { showToast("Eng ko'pi 10 ta rasm!", 'error'); return; }
    arr.forEach(function(file, idx) {
        if (!file.type.startsWith('image/')) { showToast('"' + file.name + '" rasm emas!', 'error'); return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            var container = document.createElement('div');
            container.className = 'preview-item';
            var img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'Rasm ' + (idx + 1);
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'remove-preview';
            btn.textContent = 'x';
            btn.onclick = function() { container.remove(); };
            container.appendChild(img);
            container.appendChild(btn);
            preview.appendChild(container);
        };
        reader.readAsDataURL(file);
    });
}

function validatePhone(input) {
    var error = document.getElementById('phoneError');
    if (!error) return true;
    if (input.value.length !== 9) {
        error.style.display = 'block'; input.style.borderColor = '#f44336'; return false;
    } else {
        error.style.display = 'none'; input.style.borderColor = '#e2e8f0'; return true;
    }
}

// =================== ZAKAZ SAQLASH ===================
function saveOrder() {
    var phoneEl    = document.getElementById('phone');
    var villageEl  = document.getElementById('village');
    var commentEl  = document.getElementById('comment');
    var customIdEl = document.getElementById('customOrderId');

    var phone    = phoneEl    ? phoneEl.value.trim()    : '';
    var village  = villageEl  ? villageEl.value.trim()  : '';
    var comment  = commentEl  ? commentEl.value.trim()  : '';
    var customId = customIdEl ? customIdEl.value.trim() : '';

    if (!phone)   { showToast("Telefon raqamni kiriting", 'error'); return; }
    if (phone.length !== 9) { showToast("9 raqamli bolishi kerak", 'error'); return; }
    if (!village) { showToast("Qishloqni kiriting", 'error'); return; }
    if (productItemsList.length === 0) { showToast("Kamida 1 ta mahsulot qo'shing", 'error'); return; }

    // Duplicate displayId tekshirish
    if (customId) {
        var exists = orders.find(function(o) { return String(o.displayId) === String(customId); });
        if (exists) { showToast('Bu ID allaqachon bor: #' + customId, 'error'); return; }
    }

    var saveBtn = document.getElementById('saveOrder');
    if (saveBtn) saveBtn.disabled = true;
    showToast("Saqlanmoqda...", 'info');

    var fullPhone    = '+998' + phone;
    var totalPrice   = productItemsList.reduce(function(s,i){return s+(i.price||0);}, 0);
    var totalArea    = productItemsList.reduce(function(s,i){return s+(i.area||0);}, 0);
    var firstItem    = productItemsList[0];
    var productType  = productItemsList.map(function(i){return i.name;}).join(', ');
    var productEmoji = firstItem ? firstItem.emoji       : '🧺';
    var pricePerSqm  = firstItem ? firstItem.pricePerSqm : PRICE_PER_SQM;

    // Rasmlarni olish
    var images = [];
    var previewImgs = document.querySelectorAll('#imagePreview .preview-item img');
    previewImgs.forEach(function(img) {
        if (img.src && img.src.startsWith('data:')) images.push(img.src);
    });

    function doSave() {
        var orderId   = Date.now();
        var displayId = customId ? String(customId) : String(orderId).slice(-6);

        var order = {
            id:           orderId,
            displayId:    displayId,
            phone:        fullPhone,
            location:     village,
            width:        firstItem ? firstItem.width  : 3,
            height:       firstItem ? firstItem.height : 2,
            price:        totalPrice,
            pricePerSqm:  pricePerSqm,
            totalArea:    totalArea,
            productType:  productType,
            productEmoji: productEmoji,
            productItems: JSON.stringify(productItemsList),
            comment:      comment,
            images:       JSON.stringify(images),
            createdAt:    new Date().toISOString(),
            status:       'new',
            paymentStatus: 'unpaid',
            paymentMethod: null,
            paidAt:        null,
            queueNumber:   null
        };

        saveOrderToDB(order, function(err) {
            if (saveBtn) saveBtn.disabled = false;
            if (err) {
                showToast('Saqlashda xatolik: ' + err, 'error');
                return;
            }
            loadOrdersFromDB(function() {
                updateStats();
                displayRecentOrders();
                displayQueuePreview();
                closeOrderModal();
                showToast('✅ Zakaz saqlandi! #' + displayId, 'success');
            });
        });
    }

    if (images.length === 0) {
        var fi = document.getElementById('images');
        if (fi && fi.files && fi.files.length > 0) {
            var files = Array.from(fi.files);
            var processed = 0;
            files.forEach(function(file) {
                var reader = new FileReader();
                reader.onload = function(e) { images.push(e.target.result); processed++; if (processed === files.length) doSave(); };
                reader.onerror = function() { processed++; if (processed === files.length) doSave(); };
                reader.readAsDataURL(file);
            });
        } else {
            doSave();
        }
    } else {
        doSave();
    }
}

// =================== STATS ===================
function updateStats() {
    var today = new Date(); today.setHours(0,0,0,0);
    var todayOrders = orders.filter(function(o) {
        var d = new Date(o.createdAt); d.setHours(0,0,0,0);
        return d.getTime() === today.getTime();
    });
    var totalArea = orders.reduce(function(s,o) { return s + ((o.width||0)*(o.height||0)); }, 0);
    var t1 = document.getElementById('totalOrdersStat'); if (t1) t1.textContent = orders.length;
    var t2 = document.getElementById('todayOrdersStat'); if (t2) t2.textContent = todayOrders.length;
    var t3 = document.getElementById('totalAreaStat');   if (t3) t3.textContent = totalArea.toFixed(1);
    var b1 = document.getElementById('ordersBadge');     if (b1) b1.textContent = todayOrders.length;
    var qCount = orders.filter(function(o) { return ['queue','washing','ready'].indexOf(o.status) >= 0; }).length;
    var b2 = document.getElementById('queueBadge'); if (b2) b2.textContent = qCount;
}

// =================== HOME PAGE ===================
function displayRecentOrders() {
    var container = document.getElementById('recentOrders');
    if (!container) return;
    var recent = orders.slice(0, 5);
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Zakazlar yoq</p></div>';
        return;
    }
    var sE = { new:'🆕', queue:'⏳', washing:'🧼', ready:'✅', done:'✔️' };
    container.innerHTML = '';
    recent.forEach(function(order) {
        var showId = order.displayId || String(order.id).slice(-6);
        var div = document.createElement('div');
        div.className = 'order-card status-' + order.status;
        div.innerHTML =
            '<div class="order-header"><span class="order-id">#' + showId + '</span>' +
            '<span class="order-status">' + (sE[order.status]||'📦') + '</span></div>' +
            '<div class="order-phone">' + (order.productEmoji||'🧺') + ' ' + (order.phone||'') + '</div>' +
            '<div class="order-details"><span>📍 ' + (order.location||'') + '</span></div>' +
            '<div class="order-price">' + Number(order.price||0).toLocaleString() + " so'm</div>";
        div.onclick = function() { openDetailsModal(order); };
        container.appendChild(div);
    });
}

function displayQueuePreview() {
    var container = document.getElementById('queuePreview');
    if (!container) return;
    var preview = orders.filter(function(o) { return ['queue','washing','ready'].indexOf(o.status) >= 0; })
        .sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0,3);
    if (preview.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-list-ol"></i><p>Navbat bo\'sh</p></div>';
        return;
    }
    var sE = { queue:'⏳', washing:'🧼', ready:'✅' };
    container.innerHTML = '';
    preview.forEach(function(order, idx) {
        var showId = order.displayId || String(order.id).slice(-6);
        var div = document.createElement('div');
        div.className = 'queue-item status-' + order.status;
        div.innerHTML = '<div class="queue-number">' + (idx+1) + '</div>' +
            '<div class="queue-info"><div class="queue-phone">📍 ' + (order.location||'—') + '</div>' +
            '<div class="queue-time">' + (sE[order.status]||'') + ' #' + showId + ' · ' + (order.phone||'') + '</div></div>';
        div.onclick = function() { openDetailsModal(order); };
        container.appendChild(div);
    });
}

// =================== ORDERS PAGE ===================
function filterOrders() {
    var searchEl = document.getElementById('searchInput');
    var searchTerm = searchEl ? searchEl.value.trim().toLowerCase() : '';
    var filtered = orders.slice();

    if (searchTerm) {
        filtered = filtered.filter(function(o) {
            var pd = (o.phone||'').replace(/\D/g,'');
            var sd = searchTerm.replace(/\D/g,'');
            var dId = String(o.displayId||'').toLowerCase();
            var shortId = String(o.id||'').slice(-6);
            return dId.includes(searchTerm) ||
                   shortId.includes(searchTerm) ||
                   pd.includes(sd) ||
                   (sd.length >= 4 && pd.slice(-4) === sd) ||
                   (o.phone||'').toLowerCase().includes(searchTerm) ||
                   (o.location||'').toLowerCase().includes(searchTerm);
        });
    }

    if (currentFilter !== 'all') {
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = filtered.filter(function(o) {
            var d = new Date(o.createdAt); d.setHours(0,0,0,0);
            if (currentFilter === 'today') return d.getTime() === today.getTime();
            if (currentFilter === 'week')  { var w = new Date(today); w.setDate(w.getDate()-7); return d >= w; }
            if (currentFilter === 'month') { var m = new Date(today); m.setMonth(m.getMonth()-1); return d >= m; }
            return true;
        });
    }

    displayFilteredOrders(filtered);
}

function displayFilteredOrders(filtered) {
    var container = document.getElementById('ordersList');
    if (!container) return;
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Zakazlar topilmadi</p></div>';
        return;
    }
    var sE = { new:'🆕', queue:'⏳', washing:'🧼', ready:'✅', done:'✔️' };
    container.innerHTML = '';
    filtered.forEach(function(order) {
        var showId = order.displayId || String(order.id).slice(-6);
        var div = document.createElement('div');
        div.className = 'order-card status-' + order.status;
        div.innerHTML =
            '<div class="order-header"><span class="order-id">#' + showId + '</span>' +
            '<span class="order-status">' + (sE[order.status]||'📦') + ' ' + (order.paymentStatus==='paid'?'💰':'💳') + '</span></div>' +
            '<div class="order-phone">' + (order.productEmoji||'🧺') + ' ' + (order.phone||'') + '</div>' +
            '<div class="order-details"><span>📍 ' + (order.location||'') + '</span>' +
            '<span class="order-price">' + Number(order.price||0).toLocaleString() + "</span></div>";
        div.onclick = function() { openDetailsModal(order); };
        container.appendChild(div);
    });
}

function setFilter(element, filter) {
    document.querySelectorAll('.filter-chips .chip').forEach(function(c) { c.classList.remove('active'); });
    element.classList.add('active');
    currentFilter = filter;
    filterOrders();
}

// =================== QUEUE PAGE ===================
function displayQueue() {
    var container = document.getElementById('queueList');
    if (!container) return;
    var filtered = orders.filter(function(o) { return ['queue','washing','ready'].indexOf(o.status) >= 0; });
    if (currentQueueFilter !== 'all') {
        filtered = filtered.filter(function(o) { return o.status === currentQueueFilter; });
    }
    if (currentQueueSort === 'newest') {
        filtered.sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    } else if (currentQueueSort === 'oldest') {
        filtered.sort(function(a,b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    } else if (currentQueueSort === 'village') {
        filtered.sort(function(a,b) { return (a.location||'').localeCompare(b.location||''); });
    } else if (currentQueueSort === 'time') {
        filtered.sort(function(a,b) {
            var ta = new Date(a.createdAt), tb = new Date(b.createdAt);
            return (ta.getHours()*60+ta.getMinutes()) - (tb.getHours()*60+tb.getMinutes());
        });
    } else {
        filtered.sort(function(a,b) { return (a.queueNumber||999)-(b.queueNumber||999); });
    }

    var qt = document.getElementById('queueTotal'); if (qt) qt.textContent = filtered.length;
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-list-ol"></i><p>Navbat bo\'sh</p></div>';
        return;
    }
    var sL = { queue:'Kutilmoqda', washing:'Yuvilmoqda', ready:'Tayyor' };
    container.innerHTML = '';
    filtered.forEach(function(order, idx) {
        var div = document.createElement('div');
        div.className = 'queue-item status-' + order.status;
        var cDate = new Date(order.createdAt);
        var timeStr = cDate.toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
        var dateStr = cDate.getDate() + '.' + String(cDate.getMonth()+1).padStart(2,'0');
        var showId = order.displayId || String(order.id).slice(-6);
        var area = ((order.width||0)*(order.height||0)).toFixed(1);
        div.innerHTML =
            '<div class="queue-number">' + (idx+1) + '</div>' +
            '<div class="queue-info">' +
                '<div class="queue-phone">#' + showId + ' · ' + (order.phone||'') + '</div>' +
                '<div class="queue-meta">' +
                    '<span>📍 ' + (order.location||'') + '</span>' +
                    '<span>📐 ' + area + 'm²</span>' +
                '</div>' +
                '<div class="queue-meta">' +
                    '<span>📅 ' + dateStr + '</span>' +
                    '<span>⏰ ' + timeStr + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="queue-right">' +
                '<span class="queue-status-badge status-' + order.status + '">' + (sL[order.status]||order.status) + '</span>' +
                '<span class="queue-price-sm">' + Number(order.price||0).toLocaleString() + '</span>' +
            '</div>';
        div.onclick = function() { openDetailsModal(order); };
        container.appendChild(div);
    });
}

function setQueueSort(element, sort) {
    document.querySelectorAll('[data-qsort]').forEach(function(c) { c.classList.remove('active'); });
    element.classList.add('active');
    currentQueueSort = sort;
    displayQueue();
}

function setQueueStatus(element, status) {
    document.querySelectorAll('[data-queue]').forEach(function(c) { c.classList.remove('active'); });
    element.classList.add('active');
    currentQueueFilter = status;
    displayQueue();
}

// =================== SWIPE BUTTON ===================
function initSwipeButton(orderId) {
    var container = document.getElementById('swipeContainer');
    var track = document.getElementById('swipeTrack');
    var thumb = document.getElementById('swipeThumb');
    var label = document.querySelector('.swipe-label');
    var success = document.getElementById('swipeSuccess');
    if (!container || !track || !thumb) return;
    var startX = 0, isDragging = false;
    var maxSwipe = container.offsetWidth - 76;
    function handleStart(e) {
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        isDragging = true;
        thumb.style.transition = 'none';
    }
    function handleMove(e) {
        if (!isDragging) return;
        var x = e.touches ? e.touches[0].clientX : e.clientX;
        var newLeft = Math.max(0, Math.min(x - startX, maxSwipe));
        thumb.style.left = newLeft + 'px';
        if (label) label.style.opacity = String(1 - newLeft / maxSwipe);
    }
    function handleEnd() {
        if (!isDragging) return;
        isDragging = false;
        var finalLeft = parseInt(thumb.style.left) || 0;
        if (finalLeft > maxSwipe * 0.7) {
            thumb.style.transition = 'all 0.4s ease';
            thumb.style.left = maxSwipe + 'px';
            if (label) label.style.opacity = '0';
            setTimeout(function() { if (success) success.classList.add('show'); }, 300);
            setTimeout(function() { addToQueue(orderId); }, 1500);
        } else {
            thumb.style.transition = 'all 0.3s ease';
            thumb.style.left = '0px';
            if (label) label.style.opacity = '1';
        }
    }
    thumb.addEventListener('touchstart', handleStart, {passive:true});
    thumb.addEventListener('mousedown', handleStart);
    document.addEventListener('touchmove', handleMove, {passive:true});
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);
}

function addToQueue(orderId) {
    var id = Number(orderId);
    var order = orders.find(function(o) { return o.id === id; });
    if (!order) return;
    var qOrders = orders.filter(function(o) { return ['queue','washing','ready'].indexOf(o.status) >= 0; });
    order.status = 'queue';
    order.queueNumber = qOrders.length > 0 ? Math.max.apply(null, qOrders.map(function(o) { return o.queueNumber||0; })) + 1 : 1;
    order.queueStartTime = new Date().toISOString();
    updateOrderInDB(order, function(err) {
        if (err) { showToast('Xatolik: ' + err, 'error'); return; }
        loadOrdersFromDB(function() {
            updateStats(); displayRecentOrders(); displayQueuePreview(); displayQueue();
            closeDetailsModal();
            showToast('Navbatga qoshildi!', 'success');
        });
    });
}

// =================== STATS PAGE ===================
function displayStats() {
    var today = new Date(); today.setHours(0,0,0,0);
    var ws = new Date(today); ws.setDate(ws.getDate()-7);
    var ms = new Date(today); ms.setMonth(ms.getMonth()-1);
    function calcRev(list) {
        return list.filter(function(o){return o.paymentStatus==='paid';}).reduce(function(s,o){return s+(Number(o.price)||0);},0);
    }
    var todayO = orders.filter(function(o){var d=new Date(o.createdAt);d.setHours(0,0,0,0);return d.getTime()===today.getTime();});
    var weekO  = orders.filter(function(o){return new Date(o.createdAt)>=ws;});
    var monthO = orders.filter(function(o){return new Date(o.createdAt)>=ms;});
    var r1=document.getElementById('repToday'); if(r1) r1.textContent=calcRev(todayO).toLocaleString()+" so'm";
    var r2=document.getElementById('repWeek');  if(r2) r2.textContent=calcRev(weekO).toLocaleString()+" so'm";
    var r3=document.getElementById('repMonth'); if(r3) r3.textContent=calcRev(monthO).toLocaleString()+" so'm";
    var stats=document.getElementById('reportStats');
    if (stats) {
        var paid=orders.filter(function(o){return o.paymentStatus==='paid';}).length;
        var qCount=orders.filter(function(o){return ['queue','washing','ready'].indexOf(o.status)>=0;}).length;
        stats.innerHTML='<div class="stat-row"><span class="stat-row-label">📦 Jami</span><span class="stat-row-value">'+orders.length+'</span></div>' +
            '<div class="stat-row"><span class="stat-row-label">💰 Tolangan</span><span class="stat-row-value">'+paid+'</span></div>' +
            '<div class="stat-row"><span class="stat-row-label">❌ Tolanmagan</span><span class="stat-row-value">'+(orders.length-paid)+'</span></div>' +
            '<div class="stat-row"><span class="stat-row-label">⏳ Navbatda</span><span class="stat-row-value">'+qCount+'</span></div>';
    }
}

// =================== DETAILS MODAL ===================
function openDetailsModal(order) {
    if (!order) return;
    var modal = document.getElementById('detailsModal');
    var content = document.getElementById('detailsContent');
    var navDiv = document.getElementById('detailsNavigation');
    if (!modal || !content) return;

    currentOrderId = Number(order.id);
    var showId = order.displayId || String(order.id).slice(-6);
    var area = ((order.width||0)*(order.height||0)).toFixed(2);
    var sCfg = {
        new:     {label:'Yangi',       emoji:'🆕', color:'#667eea', bg:'#ebf4ff'},
        queue:   {label:'Navbatda',    emoji:'⏳', color:'#ff9800', bg:'#fff3e0'},
        washing: {label:'Yuvilmoqda',  emoji:'🧼', color:'#2196f3', bg:'#e3f2fd'},
        ready:   {label:'Tayyor',      emoji:'✅', color:'#4caf50', bg:'#e8f5e9'},
        done:    {label:'Yakunlangan', emoji:'✔️', color:'#9e9e9e', bg:'#f5f5f5'}
    };
    var sc = sCfg[order.status] || sCfg.new;

    var images = [];
    try { images = JSON.parse(order.images||'[]'); } catch(e) {}
    imageGallery = images;

    var imagesHtml = '';
    if (images.length > 0) {
        imagesHtml = '<div class="details-images">' +
            images.map(function(img, idx) {
                return '<div class="details-img-wrap" onclick="openGallery(' + idx + ')" style="cursor:pointer">' +
                    '<img src="' + img + '" alt="Rasm"><div class="details-img-overlay"><i class="fas fa-expand"></i></div></div>';
            }).join('') + '</div>';
    }

    var STATS = ['new','queue','washing','ready','done'];
    var curIdx = STATS.indexOf(order.status);
    var progressHtml = STATS.map(function(s, i) {
        var s2 = sCfg[s];
        var isActive = i === curIdx, isDone = i < curIdx;
        return '<div class="det-progress-step ' + (isActive?'active':'') + (isDone?' done':'') + '">' +
            '<div class="det-progress-dot">' + (isDone?'✓':s2.emoji) + '</div>' +
            '<span>' + s2.label + '</span></div>' +
            (i < STATS.length-1 ? '<div class="det-progress-line' + (isDone?' done':'') + '"></div>' : '');
    }).join('');

    var payColor = order.paymentStatus==='paid'?'#4caf50':'#f44336';
    var payBg    = order.paymentStatus==='paid'?'#e8f5e9':'#fce4ec';
    var payText  = order.paymentStatus==='paid'?'✅ Tolangan':'❌ Tolanmagan';

    content.innerHTML = imagesHtml +
        '<div class="det-header-card">' +
            '<div class="det-header-top">' +
                '<div class="det-order-id"><span class="det-id-label">ZAKAZ</span><span class="det-id-num">#' + showId + '</span></div>' +
                '<div class="det-status-badge" style="background:' + sc.bg + ';color:' + sc.color + ';">' + sc.emoji + ' ' + sc.label + '</div>' +
            '</div>' +
            '<div class="det-header-phone"><i class="fas fa-phone-alt"></i><span>' + (order.phone||'') + '</span></div>' +
        '</div>' +
        '<div class="det-info-grid">' +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#ebf4ff;color:#667eea;"><i class="fas fa-map-marker-alt"></i></div><div class="det-info-text"><span class="det-info-label">Manzil</span><span class="det-info-val">' + (order.location||'') + '</span></div></div>' +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#f3e8ff;color:#764ba2;"><i class="fas fa-tag"></i></div><div class="det-info-text"><span class="det-info-label">Mahsulot</span><span class="det-info-val">' + (order.productEmoji||'🧺') + ' ' + (order.productType||'Oddiy gilam') + '</span></div></div>' +
            (function() {
                var items = [];
                try { items = JSON.parse(order.productItems || '[]'); } catch(e) {}
                if (items.length > 1) {
                    var colorMap = {gilam:'#667eea',adyol:'#f97316',yakandoz:'#22c55e',parda:'#8b5cf6',korpa:'#ec4899'};
                    return '<div style="grid-column:1/-1;background:#f8f9ff;border-radius:12px;padding:12px;margin-top:-4px;">' +
                        '<div style="font-size:11px;font-weight:700;color:#667eea;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">📦 Mahsulotlar ro\'yxati</div>' +
                        items.map(function(it, idx) {
                            var c = colorMap[it.type] || '#667eea';
                            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:white;border-radius:8px;margin-bottom:4px;border-left:3px solid '+c+';">' +
                                '<span style="font-size:13px;">' + it.emoji + ' ' + it.name + ' #'+(idx+1)+'</span>' +
                                '<span style="font-size:11px;color:#888;">' + (it.width||0) + 'm × ' + (it.height||0) + 'm = <strong>' + (it.area||0).toFixed(1) + 'm²</strong></span>' +
                                '<span style="font-weight:700;color:'+c+';font-size:13px;">' + Number(it.price||0).toLocaleString() + " so'm</span></div>";
                        }).join('') +
                    '</div>';
                }
                return '';
            })() +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#e8f5e9;color:#4caf50;"><i class="fas fa-ruler-combined"></i></div><div class="det-info-text"><span class="det-info-label">Olcham</span><span class="det-info-val">' + (order.width||0) + 'm x ' + (order.height||0) + 'm = <strong>' + area + 'm²</strong></span></div></div>' +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#fff3e0;color:#ff9800;"><i class="fas fa-tag"></i></div><div class="det-info-text"><span class="det-info-label">Narx</span><span class="det-info-val" style="color:#4caf50;font-weight:700;">' + Number(order.price||0).toLocaleString() + " so'm</span></div></div>" +
            '<div class="det-info-card"><div class="det-info-icon" style="background:' + payBg + ';color:' + payColor + ';"><i class="fas fa-credit-card"></i></div><div class="det-info-text"><span class="det-info-label">Tolov</span><span class="det-info-val" style="color:' + payColor + ';font-weight:600;">' + payText + '</span></div></div>' +
        '</div>' +
        '<div class="det-progress">' + progressHtml + '</div>' +
        (order.status === 'new' ?
            '<div class="swipe-container" id="swipeContainer"><div class="swipe-track" id="swipeTrack">' +
            '<div class="swipe-thumb" id="swipeThumb"><i class="fas fa-chevron-right"></i></div>' +
            '<div class="swipe-label"><span>Navbatga qoshish uchun suring →</span></div></div>' +
            '<div class="swipe-success" id="swipeSuccess"><i class="fas fa-check-circle"></i> Qoshildi</div></div>' : '') +
        (order.comment ? '<div style="background:#f8f9fa;padding:12px;border-radius:10px;margin-top:12px;font-size:13px;color:#666;">' + order.comment + '</div>' : '');

    navDiv.innerHTML =
        '<button class="det-nav-btn det-nav-call" onclick="callOrderNumber(\'' + (order.phone||'') + '\')"><i class="fas fa-phone"></i> Qongiroq</button>' +
        '<button class="det-nav-btn det-nav-status" onclick="openStatusNavigator(' + Number(order.id) + ')"><i class="fas fa-exchange-alt"></i> Holat</button>' +
        (order.paymentStatus==='unpaid' && order.status==='ready' ? '<button class="det-nav-btn det-nav-status" onclick="openPaymentModal(' + Number(order.id) + ')" style="background:linear-gradient(135deg,#2196f3,#1976d2);"><i class="fas fa-money-bill"></i> Tolov</button>' : '') +
        '<button class="det-nav-btn det-nav-delete" onclick="confirmDeleteOrder(' + Number(order.id) + ')"><i class="fas fa-trash"></i></button>';

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (order.status === 'new') setTimeout(function() { initSwipeButton(order.id); }, 150);
}

// =================== GALLERY ===================
function openGallery(startIndex) {
    currentImageIndex = startIndex;
    var old = document.getElementById('galleryModal'); if (old) old.remove();
    var modal = document.createElement('div');
    modal.className = 'gallery-modal'; modal.id = 'galleryModal';
    var img = document.createElement('img'); img.className = 'gallery-image'; img.src = imageGallery[currentImageIndex];
    var counter = document.createElement('div'); counter.className = 'gallery-counter';
    counter.textContent = (currentImageIndex+1) + ' / ' + imageGallery.length;
    var prevBtn = document.createElement('button'); prevBtn.className = 'gallery-nav prev'; prevBtn.innerHTML = '❮';
    prevBtn.onclick = function(e) { e.stopPropagation(); navigateGallery(-1); };
    var nextBtn = document.createElement('button'); nextBtn.className = 'gallery-nav next'; nextBtn.innerHTML = '❯';
    nextBtn.onclick = function(e) { e.stopPropagation(); navigateGallery(1); };
    var closeBtn = document.createElement('button'); closeBtn.className = 'gallery-close'; closeBtn.innerHTML = '✕';
    closeBtn.onclick = function() { modal.remove(); };
    modal.append(img, counter, prevBtn, nextBtn, closeBtn);
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}
function navigateGallery(dir) {
    var ni = currentImageIndex + dir;
    if (ni >= 0 && ni < imageGallery.length) {
        currentImageIndex = ni;
        var img = document.querySelector('.gallery-image'); if (img) img.src = imageGallery[ni];
        var c = document.querySelector('.gallery-counter'); if (c) c.textContent = (ni+1) + ' / ' + imageGallery.length;
    }
}

// =================== PAYMENT MODAL ===================
function openPaymentModal(orderId) {
    var id = Number(orderId);
    var order = orders.find(function(o){return o.id===id;});
    if (!order) return;
    var content = document.getElementById('detailsContent');
    var navDiv = document.getElementById('detailsNavigation');
    content.innerHTML =
        '<div style="text-align:center;padding:20px;"><div style="font-size:60px;">💳</div>' +
        '<h2 style="font-size:22px;font-weight:800;color:#667eea;">Tolovni qabul qiling</h2></div>' +
        '<div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;border-radius:16px;margin-bottom:20px;text-align:center;">' +
        '<div style="font-size:32px;font-weight:800;">' + Number(order.price||0).toLocaleString() + " so'm</div></div>" +
        '<div><p style="font-size:12px;color:#666;font-weight:600;margin-bottom:10px;">Tolov usuli:</p></div>';

    var btn1 = document.createElement('button');
    btn1.style.cssText = 'width:100%;padding:14px;margin-bottom:10px;background:linear-gradient(135deg,#3b82f6,#2196f3);color:white;border:none;border-radius:12px;font-weight:600;cursor:pointer;';
    btn1.innerHTML = '<i class="fas fa-credit-card"></i> Karta bilan';
    btn1.onclick = function() { processPayment(id, 'card'); };
    content.appendChild(btn1);

    var btn2 = document.createElement('button');
    btn2.style.cssText = 'width:100%;padding:14px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:12px;font-weight:600;cursor:pointer;';
    btn2.innerHTML = '<i class="fas fa-money-bill-wave"></i> Naqd pul';
    btn2.onclick = function() { processPayment(id, 'cash'); };
    content.appendChild(btn2);

    var backBtn = document.createElement('button');
    backBtn.style.cssText = 'flex:1;background:#f5f5f5;color:#666;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;width:100%;margin-top:8px;';
    backBtn.textContent = '← Orqaga';
    backBtn.onclick = function() { openDetailsModal(orders.find(function(o){return o.id===id;})); };
    navDiv.innerHTML = '';
    navDiv.appendChild(backBtn);
}

function processPayment(orderId, method) {
    var id = Number(orderId);
    var order = orders.find(function(o){return o.id===id;});
    if (!order) return;
    order.paymentMethod = method;
    order.paymentStatus = 'paid';
    order.paidAt = new Date().toISOString();
    updateOrderInDB(order, function(err) {
        if (err) { showToast('Tolov saqlashda xatolik: ' + err, 'error'); return; }
        loadOrdersFromDB(function() {
            updateStats(); displayRecentOrders(); displayQueue(); closeDetailsModal();
            showToast('Tolov qabul qilindi! ' + (method==='card'?'💳 Karta':'💵 Naqd'), 'success');
        });
    });
}

// =================== STATUS NAVIGATOR ===================
function openStatusNavigator(orderId) {
    var id = Number(orderId);
    currentOrderId = id;
    var order = orders.find(function(o){return o.id===id;});
    if (!order) return;
    var content = document.getElementById('detailsContent');
    var navDiv = document.getElementById('detailsNavigation');
    var showId = order.displayId || String(order.id).slice(-6);
    var STEPS = [
        {status:'new',     num:1, label:'Yangi',  color:'#667eea', bg:'#ebf4ff'},
        {status:'queue',   num:2, label:'Navbat', color:'#ff9800', bg:'#fff3e0'},
        {status:'washing', num:3, label:'Yuvish', color:'#2196f3', bg:'#e3f2fd'},
        {status:'ready',   num:4, label:'Tayyor', color:'#4caf50', bg:'#e8f5e9'}
    ];
    content.innerHTML =
        '<div style="background:#f0f3ff;padding:12px;border-radius:10px;margin-bottom:16px;border-left:4px solid #667eea;">' +
        '<div style="font-weight:600;color:#667eea;">#' + showId + ' — ' + (order.phone||'') + '</div></div>' +
        STEPS.map(function(s) {
            var isActive = order.status === s.status;
            return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:12px;background:' + (isActive?s.bg:'#f5f5f5') + ';border-radius:10px;border-left:4px solid ' + (isActive?s.color:'#ddd') + ';">' +
                '<div style="width:40px;height:40px;background:' + (isActive?s.color:'#e0e0e0') + ';border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">' + s.num + '</div>' +
                '<div style="font-weight:600;color:' + (isActive?s.color:'#999') + ';">' + s.label + '</div></div>';
        }).join('');

    navDiv.innerHTML = '';
    var btns = [
        {s:'queue',   label:'⏳ Navbatga', grad:'#ff9800,#f57c00'},
        {s:'washing', label:'🧼 Yuvishga', grad:'#2196f3,#1976d2'},
        {s:'ready',   label:'✅ Tayyor',   grad:'#4caf50,#45a049'}
    ];
    btns.forEach(function(b) {
        var btn = document.createElement('button');
        btn.style.cssText = 'flex:1;background:linear-gradient(135deg,' + b.grad + ');color:white;border:none;padding:10px;border-radius:8px;font-weight:600;cursor:pointer;margin-right:4px;font-size:12px;';
        btn.innerHTML = b.label;
        btn.onclick = function() { changeOrderStatus(b.s); };
        navDiv.appendChild(btn);
    });
}

function changeOrderStatus(status) {
    var order = orders.find(function(o){return o.id===currentOrderId;});
    if (!order) return;
    var so = ['new','queue','washing','ready','done'];
    if (so.indexOf(status) < so.indexOf(order.status)) {
        showToast('Orqaga qaytib bolmaydi!', 'error'); return;
    }
    order.status = status;
    if (status === 'queue' && !order.queueNumber) {
        var max = Math.max.apply(null, [0].concat(orders.filter(function(o){return o.queueNumber;}).map(function(o){return o.queueNumber;})));
        order.queueNumber = max + 1;
    }
    updateOrderInDB(order, function(err) {
        if (err) { showToast('Xatolik: ' + err, 'error'); return; }
        loadOrdersFromDB(function() {
            updateStats(); displayRecentOrders(); displayQueue(); closeDetailsModal();
            showToast('Holat ozgartirildi!', 'success');
        });
    });
}

// =================== DELETE ===================
function confirmDeleteOrder(orderId) {
    if (!confirm('Bu zakazni ochirishni xohlaysizmi?')) return;
    deleteOrderFromDB(Number(orderId), function(err) {
        if (err) { showToast('Ochirishda xatolik: ' + err, 'error'); return; }
        loadOrdersFromDB(function() {
            updateStats(); displayRecentOrders(); displayQueuePreview(); displayQueue(); closeDetailsModal();
            showToast('Zakaz ochirildi', 'info');
        });
    });
}

// =================== CALL ===================
function callOrderNumber(phone) { window.location.href = 'tel:' + phone; }

// =================== TOAST ===================
function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show ' + (type||'info');
    clearTimeout(toast._t);
    toast._t = setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

// =================== ADMIN ===================
function adminLogin() {
    var pw = document.getElementById('adminPassword');
    if (!pw) return;
    if (pw.value === '2007') {
        localStorage.setItem('admin_logged_in', 'true');
        closeAdminLoginModal();
        window.location.href = 'admin.html';
    } else {
        showToast('Parol notogri!', 'error');
        pw.value = ''; pw.focus();
    }
}

// =================== WINDOW EXPORTS ===================
window.switchPage=switchPage; window.openOrderModal=openOrderModal; window.closeOrderModal=closeOrderModal;
window.openDetailsModal=openDetailsModal; window.closeDetailsModal=closeDetailsModal;
window.openAdminLoginModal=openAdminLoginModal; window.closeAdminLoginModal=closeAdminLoginModal;
window.calculatePrice=calculatePrice; window.showPreview=showPreview; window.validatePhone=validatePhone;
window.saveOrder=saveOrder; window.filterOrders=filterOrders; window.setFilter=setFilter;
window.setQueueStatus=setQueueStatus; window.displayQueue=displayQueue; window.displayStats=displayStats;
window.adminLogin=adminLogin; window.showToast=showToast; window.openGallery=openGallery;
window.navigateGallery=navigateGallery; window.initSwipeButton=initSwipeButton; window.addToQueue=addToQueue;
window.openPaymentModal=openPaymentModal; window.processPayment=processPayment;
window.openStatusNavigator=openStatusNavigator; window.changeOrderStatus=changeOrderStatus;
window.confirmDeleteOrder=confirmDeleteOrder; window.callOrderNumber=callOrderNumber;
window.loadPriceItems=loadPriceItems; window.renderProductTypeSelector=renderProductTypeSelector;
window.addProductItem=addProductItem; window.removeProductItem=removeProductItem;
window.updateProductItem=updateProductItem; window.renderProductItems=renderProductItems;
window.selectSizeVariant=selectSizeVariant; window.setQueueSort=setQueueSort;

console.log('✅ Script v5.3 yuklandi');
