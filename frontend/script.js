// script.js — обновлённый: никакие alert() не используются; фильтр — select; SVG крестики работают

// ====== Utilities ======
async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
function getUsers() { return JSON.parse(localStorage.getItem('st_users') || '[]'); }
function setUsers(users) { localStorage.setItem('st_users', JSON.stringify(users)); }
function getOrders() { return JSON.parse(localStorage.getItem('st_orders') || '[]'); }
function setOrders(orders) { localStorage.setItem('st_orders', JSON.stringify(orders)); }
function getCurrentUserId() { return localStorage.getItem('st_currentUser') || null; }
function setCurrentUserId(id) { if (id === null) localStorage.removeItem('st_currentUser'); else localStorage.setItem('st_currentUser', id); }
function findUserByEmail(email) { if (!email) return null; return getUsers().find(u => u.email && u.email.toLowerCase() === email.toLowerCase()); }
function findUserById(id) { return getUsers().find(u => u.id === id); }

// ====== DOM Ready ======
document.addEventListener('DOMContentLoaded', () => {

    /* ------------------- FILTER (goods.html) — select ------------------- */
    const categoryFilter = document.getElementById('categoryFilter');
    const productCards = document.querySelectorAll('.product-card');
    if (categoryFilter && productCards) {
        categoryFilter.addEventListener('change', function() {
            const category = this.value;
            productCards.forEach(card => {
                if (category === 'all' || card.dataset.category === category) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
        // init: trigger change to set initial visibility
        categoryFilter.dispatchEvent(new Event('change'));
    }

    /* ------------------- SLIDER (testimonials) ------------------- */
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const prevBtn = document.querySelector('.slider-prev');
    const nextBtn = document.querySelector('.slider-next');
    function showSlide(index) {
        if (!slides.length) return;
        slides.forEach(s => s.classList.remove('active'));
        slides[index].classList.add('active');
    }
    if (nextBtn) nextBtn.addEventListener('click', () => { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); });
    if (prevBtn) prevBtn.addEventListener('click', () => { currentSlide = (currentSlide - 1 + slides.length) % slides.length; showSlide(currentSlide); });
    if (slides.length) setInterval(() => { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); }, 3000);

    /* ------------------- COUNTERS (stat-number) ------------------- */
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => {
        const target = parseInt(counter.dataset.target || '0');
        const increment = target / 100;
        let current = 0;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) { current = target; clearInterval(timer); }
                        counter.textContent = Math.floor(current);
                    }, 20);
                    observer.unobserve(entry.target);
                }
            });
        });
        observer.observe(counter);
    });

    /* ------------------- ACCORDION ------------------- */
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = item.querySelector('.accordion-content');
            const toggle = header.querySelector('.accordion-toggle');
            accordionHeaders.forEach(h => {
                if (h !== header) {
                    const parent = h.parentElement;
                    parent.classList.remove('active');
                    const otherContent = parent.querySelector('.accordion-content');
                    if (otherContent) otherContent.style.maxHeight = '0';
                    const otherToggle = h.querySelector('.accordion-toggle');
                    if (otherToggle) otherToggle.textContent = '+';
                }
            });
            item.classList.toggle('active');
            if (item.classList.contains('active')) {
                if (content) content.style.maxHeight = content.scrollHeight + 'px';
                if (toggle) toggle.textContent = '−';
            } else {
                if (content) content.style.maxHeight = '0';
                if (toggle) toggle.textContent = '+';
            }
        });
    });

    /* ------------------- UI: auth & purchase modals ------------------- */
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const purchaseModal = document.getElementById('purchaseModal');

    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameEl = document.getElementById('userName');

    function updateUserUI() {
        const userId = getCurrentUserId();
        if (userId) {
            const user = findUserById(userId);
            if (user) {
                if (userNameEl) { userNameEl.textContent = `Здравствуйте, ${user.name}`; userNameEl.style.display = 'inline-block'; }
                if (loginBtn) loginBtn.style.display = 'none';
                if (registerBtn) registerBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'inline-block';
            } else {
                setCurrentUserId(null);
                if (userNameEl) userNameEl.style.display = 'none';
                if (loginBtn) loginBtn.style.display = '';
                if (registerBtn) registerBtn.style.display = '';
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        } else {
            if (userNameEl) userNameEl.style.display = 'none';
            if (loginBtn) loginBtn.style.display = '';
            if (registerBtn) registerBtn.style.display = '';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }
    updateUserUI();

    if (loginBtn) loginBtn.addEventListener('click', () => openModal(loginModal));
    if (registerBtn) registerBtn.addEventListener('click', () => openModal(registerModal));
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        setCurrentUserId(null);
        updateUserUI();
        // alert removed intentionally — UI updates silently
    });

    // close modals (close buttons + click outside)
    document.querySelectorAll('.modal').forEach(mod => {
        const close = mod.querySelector('.modal-close');
        if (close) close.addEventListener('click', () => closeModal(mod));
        mod.addEventListener('click', (e) => { if (e.target === mod) closeModal(mod); });
    });

    // cancel buttons inside modals (data-modal-cancel)
    document.querySelectorAll('[data-modal-cancel]').forEach(btn => btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) closeModal(modal);
    }));

    function openModal(mod) {
        if (!mod) return;
        mod.style.display = 'flex';
        mod.setAttribute('aria-hidden', 'false');
        setTimeout(() => mod.classList.add('open'), 10);
    }
    function closeModal(mod) {
        if (!mod) return;
        mod.classList.remove('open');
        mod.setAttribute('aria-hidden', 'true');
        setTimeout(() => { try { mod.style.display = 'none'; } catch (e) {} }, 200);
    }

    /* ------------------- AUTH: register & login (separate modals) ------------------- */
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const registerMessage = document.getElementById('registerMessage');
    const loginMessage = document.getElementById('loginMessage');

    if (registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('regName') && document.getElementById('regName').value.trim()) || '';
        const email = (document.getElementById('regEmail') && document.getElementById('regEmail').value.trim()) || '';
        const pass = (document.getElementById('regPassword') && document.getElementById('regPassword').value) || '';
        const pass2 = (document.getElementById('regPassword2') && document.getElementById('regPassword2').value) || '';

        if (pass.length < 6) {
            if (registerMessage) registerMessage.textContent = 'Пароль должен содержать минимум 6 символов.';
            return;
        }
        if (pass !== pass2) {
            if (registerMessage) registerMessage.textContent = 'Пароли не совпадают.';
            return;
        }
        if (findUserByEmail(email)) {
            if (registerMessage) registerMessage.textContent = 'Пользователь с таким email уже зарегистрирован.';
            return;
        }

        const passHash = await hashPassword(pass);
        const users = getUsers();
        const user = { id: 'u_' + Date.now(), name, email, passwordHash: passHash, created: Date.now() };
        users.push(user);
        setUsers(users);
        setCurrentUserId(user.id);
        if (registerMessage) registerMessage.textContent = 'Регистрация успешна. Вы вошли в систему.';
        updateUserUI();
        setTimeout(() => closeModal(registerModal), 1100);
        if (registerForm) registerForm.reset();
    });

    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('loginEmail') && document.getElementById('loginEmail').value.trim()) || '';
        const pass = (document.getElementById('loginPassword') && document.getElementById('loginPassword').value) || '';

        const user = findUserByEmail(email);
        if (!user) {
            if (loginMessage) loginMessage.textContent = 'Пользователь не найден.';
            return;
        }
        const passHash = await hashPassword(pass);
        if (passHash !== user.passwordHash) {
            if (loginMessage) loginMessage.textContent = 'Неверный пароль.';
            return;
        }

        setCurrentUserId(user.id);
        if (loginMessage) loginMessage.textContent = 'Вход успешен.';
        updateUserUI();
        setTimeout(() => closeModal(loginModal), 800);
        if (loginForm) loginForm.reset();
    });

    /* ------------------- PURCHASE FLOW ------------------- */
    const buyBtns = document.querySelectorAll('.buy-btn');       // карточки
    const buySingleBtns = document.querySelectorAll('.buy-single'); // страница товара
    const purchaseForm = document.getElementById('purchaseForm');
    const purchaseMessage = document.getElementById('purchaseMessage');

    function openPurchaseFor(product) {
        if (!product) product = {};
        const id = product.id || ('p_' + Date.now());
        const name = product.name || 'Товар';
        const pidEl = document.getElementById('purchaseProductId');
        const pnameEl = document.getElementById('purchaseProductName');
        const qtyEl = document.getElementById('purchaseQty');
        const nameEl = document.getElementById('purchaseName');
        const phoneEl = document.getElementById('purchasePhone');
        const addrEl = document.getElementById('purchaseAddress');
        const payEl = document.getElementById('purchasePayment');

        if (pidEl) pidEl.value = id;
        if (pnameEl) pnameEl.value = name;
        if (qtyEl) qtyEl.value = 1;
        const userId = getCurrentUserId();
        if (userId) {
            const user = findUserById(userId);
            if (user && nameEl) nameEl.value = user.name || '';
        } else {
            if (nameEl) nameEl.value = '';
        }
        if (phoneEl) phoneEl.value = '';
        if (addrEl) addrEl.value = '';
        if (payEl) payEl.selectedIndex = 0;
        if (purchaseMessage) purchaseMessage.textContent = '';
        openModal(purchaseModal);
    }

    buyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            if (!card) return;
            const id = card.dataset.id || ('p_' + Date.now());
            const name = card.dataset.name || (card.querySelector('h3') && card.querySelector('h3').innerText) || 'Товар';
            openPurchaseFor({ id, name });
        });
    });

    buySingleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.target;
            const id = el.dataset.id || el.getAttribute('data-id') || null;
            const nameAttr = el.dataset.name || el.getAttribute('data-name') || null;
            let resolvedName = nameAttr;
            if (!resolvedName) {
                const h1 = document.querySelector('main h1') || document.querySelector('h1');
                if (h1) resolvedName = h1.innerText.trim();
            }
            openPurchaseFor({ id: id || ('p_' + Date.now()), name: resolvedName || 'Товар' });
        });
    });

    if (purchaseForm) purchaseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const productId = document.getElementById('purchaseProductId') ? document.getElementById('purchaseProductId').value : null;
        const productName = document.getElementById('purchaseProductName') ? document.getElementById('purchaseProductName').value : null;
        const qty = document.getElementById('purchaseQty') ? parseInt(document.getElementById('purchaseQty').value) || 1 : 1;
        const name = document.getElementById('purchaseName') ? document.getElementById('purchaseName').value.trim() : '';
        const phone = document.getElementById('purchasePhone') ? document.getElementById('purchasePhone').value.trim() : '';
        const address = document.getElementById('purchaseAddress') ? document.getElementById('purchaseAddress').value.trim() : '';
        const payment = document.getElementById('purchasePayment') ? document.getElementById('purchasePayment').value : '';

        if (!name || !phone || !address) {
            if (purchaseMessage) purchaseMessage.textContent = 'Заполните все обязательные поля.';
            return;
        }

        const order = { id: 'o_' + Date.now(), userId: getCurrentUserId(), productId, productName, qty, name, phone, address, payment, created: Date.now() };
        const orders = getOrders();
        orders.push(order);
        setOrders(orders);

        if (purchaseMessage) purchaseMessage.textContent = 'Заказ оформлен! Номер заказа: ' + order.id;
        setTimeout(() => {
            closeModal(purchaseModal);
            if (purchaseForm) purchaseForm.reset();
            if (purchaseMessage) purchaseMessage.textContent = '';
        }, 1500);
    });

    /* ------------------- Dynamic effects: hover + staggered appearance ------------------- */
    const cards = document.querySelectorAll('.product-card');
    cards.forEach((c, i) => {
        c.addEventListener('mouseenter', () => c.classList.add('card-hover'));
        c.addEventListener('mouseleave', () => c.classList.remove('card-hover'));
        c.style.opacity = 0;
        c.style.transform = 'translateY(10px)';
        setTimeout(() => {
            c.style.transition = 'opacity 300ms ease, transform 300ms ease';
            c.style.opacity = 1;
            c.style.transform = 'translateY(0)';
        }, 120 + i * 70);
    });

    /* Accessibility: close modals on Esc */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (loginModal) closeModal(loginModal);
            if (registerModal) closeModal(registerModal);
            if (purchaseModal) closeModal(purchaseModal);
        }
    });

}); // DOMContentLoaded end
