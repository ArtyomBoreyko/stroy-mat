// frontend/script.js — улучшенная версия: жёсткий фикс для оформления заказов
// ================= Utilities =================
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

// ================= Remote API support =================
const API_URL = (window.API_URL && window.API_URL.replace(/\/$/, '')) || 'https://stroy-mat.onrender.com';
function setToken(token) { if (token) localStorage.setItem('st_token', token); else localStorage.removeItem('st_token'); }
function getToken() { return localStorage.getItem('st_token'); }
function setRemoteUser(u) { if (u) localStorage.setItem('st_user', JSON.stringify(u)); else localStorage.removeItem('st_user'); }
function getRemoteUser() { try { return JSON.parse(localStorage.getItem('st_user')); } catch (e) { return null; } }

function isRemoteProductId(id) { if (!id) return false; return /^\d+$/.test(String(id)); }

// ================= productMap / readiness (global + local aliases) =================
window.productMap = window.productMap || {}; // name.lower -> id
if (!window._productMappingReadyController) {
  let _resolve;
  const p = new Promise((res) => { _resolve = res; });
  window._productMappingReadyController = { promise: p, resolve: _resolve };
}
window.productMappingReady = window._productMappingReadyController.promise;
const productMap = window.productMap;
const productMappingReady = window.productMappingReady;

// fetch & build product map (first attempt)
async function fetchAndBuildProductMap() {
  try {
    const res = await fetch(API_URL + '/api/products');
    if (!res.ok) {
      console.warn('Products fetch failed with status', res.status);
      try { window._productMappingReadyController.resolve(false); } catch(e){}
      return false;
    }
    const products = await res.json();
    products.forEach(p => {
      if (p && p.name && p.id != null) {
        productMap[String(p.name).trim().toLowerCase()] = String(p.id);
      }
    });
    // set dataset.id on cards (match by h3)
    document.querySelectorAll('.product-card').forEach(card => {
      const h3 = card.querySelector('h3');
      const title = h3 ? h3.innerText.trim().toLowerCase() : (card.dataset.name || '').trim().toLowerCase();
      if (title && productMap[title]) card.dataset.id = productMap[title];
    });
    console.info('Product map built keys=', Object.keys(productMap).length);
    try { window._productMappingReadyController.resolve(true); } catch(e){}
    return true;
  } catch (err) {
    console.error('Error fetching products:', err);
    try { window._productMappingReadyController.resolve(false); } catch(e){}
    return false;
  }
}
fetchAndBuildProductMap().catch(()=>{});

// ================= DOM Ready =================
document.addEventListener('DOMContentLoaded', () => {

  // UI helpers
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

  // Filter select
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', function() {
      const category = this.value;
      document.querySelectorAll('.product-card').forEach(card => {
        if (category === 'all' || card.dataset.category === category) card.style.display = 'block';
        else card.style.display = 'none';
      });
    });
    categoryFilter.dispatchEvent(new Event('change'));
  }

  // Header/auth
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  const purchaseModal = document.getElementById('purchaseModal');

  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userNameEl = document.getElementById('userName');

  function updateUserUI() {
    const token = getToken();
    const remoteUser = getRemoteUser();
    const localUserId = getCurrentUserId();

    if (token && remoteUser) {
      if (userNameEl) { userNameEl.textContent = `Здравствуйте, ${remoteUser.name}`; userNameEl.style.display = 'inline-block'; }
      if (loginBtn) loginBtn.style.display = 'none';
      if (registerBtn) registerBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      return;
    }
    if (localUserId) {
      const user = findUserById(localUserId);
      if (user) {
        if (userNameEl) { userNameEl.textContent = `Здравствуйте, ${user.name}`; userNameEl.style.display = 'inline-block'; }
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        return;
      } else setCurrentUserId(null);
    }
    if (userNameEl) userNameEl.style.display = 'none';
    if (loginBtn) loginBtn.style.display = '';
    if (registerBtn) registerBtn.style.display = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
  updateUserUI();
  if (loginBtn) loginBtn.addEventListener('click', () => openModal(loginModal));
  if (registerBtn) registerBtn.addEventListener('click', () => openModal(registerModal));
  if (logoutBtn) logoutBtn.addEventListener('click', () => { setToken(null); setRemoteUser(null); setCurrentUserId(null); updateUserUI(); });

  // close modal handlers
  document.querySelectorAll('.modal').forEach(mod => {
    const close = mod.querySelector('.modal-close');
    if (close) close.addEventListener('click', () => closeModal(mod));
    mod.addEventListener('click', (e) => { if (e.target === mod) closeModal(mod); });
  });
  document.querySelectorAll('[data-modal-cancel]').forEach(btn => btn.addEventListener('click', () => {
    const modal = btn.closest('.modal'); if (modal) closeModal(modal);
  }));

  // Auth forms (unchanged)
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
    if (pass.length < 6) { if (registerMessage) registerMessage.textContent = 'Пароль должен содержать минимум 6 символов.'; return; }
    if (pass !== pass2) { if (registerMessage) registerMessage.textContent = 'Пароли не совпадают.'; return; }
    try {
      const res = await fetch(API_URL + '/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, email, password: pass})});
      const data = await res.json();
      if (!res.ok) { if (registerMessage) registerMessage.textContent = data.message || 'Ошибка регистрации.'; return; }
      setToken(data.token); setRemoteUser(data.user); if (registerMessage) registerMessage.textContent = 'Регистрация успешна. Вы вошли в систему.'; updateUserUI();
      setTimeout(() => closeModal(registerModal), 1100); registerForm.reset(); return;
    } catch (err) {
      console.error('Register remote error', err);
      const passHash = await hashPassword(pass);
      const users = getUsers(); const user = { id: 'u_' + Date.now(), name, email, passwordHash: passHash, created: Date.now() };
      users.push(user); setUsers(users); setCurrentUserId(user.id);
      if (registerMessage) registerMessage.textContent = 'Регистрация (локально) успешна.'; updateUserUI();
      setTimeout(() => closeModal(registerModal), 1100); registerForm.reset();
    }
  });

  if (loginForm) loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('loginEmail') && document.getElementById('loginEmail').value.trim()) || '';
    const pass = (document.getElementById('loginPassword') && document.getElementById('loginPassword').value) || '';
    try {
      const res = await fetch(API_URL + '/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: pass})});
      const data = await res.json();
      if (!res.ok) { if (loginMessage) loginMessage.textContent = data.message || 'Ошибка входа.'; return; }
      setToken(data.token); setRemoteUser(data.user); if (loginMessage) loginMessage.textContent = 'Вход успешен.'; updateUserUI();
      setTimeout(() => closeModal(loginModal), 800); loginForm.reset(); return;
    } catch (err) {
      console.error('Login remote error', err);
      const user = findUserByEmail(email);
      if (!user) { if (loginMessage) loginMessage.textContent = 'Пользователь не найден.'; return; }
      const passHash = await hashPassword(pass); if (passHash !== user.passwordHash) { if (loginMessage) loginMessage.textContent = 'Неверный пароль.'; return; }
      setCurrentUserId(user.id); if (loginMessage) loginMessage.textContent = 'Вход успешен (локально).'; updateUserUI();
      setTimeout(() => closeModal(loginModal), 800); loginForm.reset();
    }
  });

  // Purchase flow (FIXED)
  const purchaseForm = document.getElementById('purchaseForm');
  const purchaseMessage = document.getElementById('purchaseMessage');

  async function openPurchaseFor(product) {
    if (!product) product = {};
    let id = product.id || null;
    const name = product.name || 'Товар';
    await Promise.race([productMappingReady, new Promise(r => setTimeout(() => r(false), 2500))]);

    if (!id || !isRemoteProductId(id)) {
      if (product.element) {
        const ds = product.element.dataset.id;
        if (ds && isRemoteProductId(ds)) id = ds;
      }
      const lookup = (product.name || product.id || '').toString().trim().toLowerCase();
      if ((!id || !isRemoteProductId(id)) && lookup && productMap[lookup]) id = productMap[lookup];
      if ((!id || !isRemoteProductId(id)) && product.element) {
        const h3 = product.element.querySelector('h3');
        if (h3) {
          const t = h3.innerText.trim().toLowerCase();
          if (productMap[t]) id = productMap[t];
        }
      }
    }

    const pidEl = document.getElementById('purchaseProductId');
    const pnameEl = document.getElementById('purchaseProductName');
    const qtyEl = document.getElementById('purchaseQty');
    const nameEl = document.getElementById('purchaseName');
    const phoneEl = document.getElementById('purchasePhone');
    const addrEl = document.getElementById('purchaseAddress');
    const payEl = document.getElementById('purchasePayment');

    if (pidEl) pidEl.value = id || '';
    if (pnameEl) pnameEl.value = name;
    if (qtyEl) qtyEl.value = 1;

    const userId = getCurrentUserId();
    if (userId) {
      const user = findUserById(userId);
      if (user && nameEl) nameEl.value = user.name || '';
    } else {
      const ru = getRemoteUser();
      if (ru && nameEl) nameEl.value = ru.name || '';
      else if (nameEl) nameEl.value = '';
    }

    if (phoneEl) phoneEl.value = '';
    if (addrEl) addrEl.value = '';
    if (payEl) payEl.selectedIndex = 0;
    if (purchaseMessage) purchaseMessage.textContent = '';
    openModal(purchaseModal);
  }

  // delegated buy handlers
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.buy-btn');
    if (!btn) return;
    const card = btn.closest('.product-card');
    if (!card) return;
    const id = card.dataset.id || null;
    const name = card.dataset.name || (card.querySelector('h3') && card.querySelector('h3').innerText) || 'Товар';
    openPurchaseFor({ id, name, element: card });
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.buy-single');
    if (!btn) return;
    const id = btn.dataset.id || btn.getAttribute('data-id') || null;
    const nm = btn.dataset.name || btn.getAttribute('data-name') || null;
    let resolvedName = nm;
    if (!resolvedName) {
      const h1 = document.querySelector('main h1') || document.querySelector('h1');
      if (h1) resolvedName = h1.innerText.trim();
    }
    openPurchaseFor({ id: id || null, name: resolvedName || 'Товар' });
  });

  // Helper: try to re-fetch products (force) and rebuild map
  async function forceFetchProducts() {
    try {
      const res = await fetch(API_URL + '/api/products');
      if (!res.ok) { console.warn('forceFetchProducts failed', res.status); return false; }
      const products = await res.json();
      // rebuild productMap (overwrite)
      Object.keys(productMap).forEach(k => delete productMap[k]);
      products.forEach(p => {
        if (p && p.name && p.id != null) productMap[String(p.name).trim().toLowerCase()] = String(p.id);
      });
      // set dataset.id on cards
      document.querySelectorAll('.product-card').forEach(card => {
        const h3 = card.querySelector('h3');
        const title = h3 ? h3.innerText.trim().toLowerCase() : (card.dataset.name || '').trim().toLowerCase();
        if (title && productMap[title]) card.dataset.id = productMap[title];
      });
      console.info('forceFetchProducts: keys=', Object.keys(productMap).length);
      return true;
    } catch (err) {
      console.error('forceFetchProducts error', err);
      return false;
    }
  }

  // Submit handler — улучшенный, с логированием и форс-резолвом id
  if (purchaseForm) purchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    console.group('ORDER DEBUG');
    try {
      const pidEl = document.getElementById('purchaseProductId');
      let productId = pidEl ? (pidEl.value || '').toString().trim() : '';
      const productName = document.getElementById('purchaseProductName') ? document.getElementById('purchaseProductName').value : '';
      const qty = document.getElementById('purchaseQty') ? parseInt(document.getElementById('purchaseQty').value) || 1 : 1;
      const name = document.getElementById('purchaseName') ? document.getElementById('purchaseName').value.trim() : '';
      const phone = document.getElementById('purchasePhone') ? document.getElementById('purchasePhone').value.trim() : '';
      const address = document.getElementById('purchaseAddress') ? document.getElementById('purchaseAddress').value.trim() : '';
      const payment = document.getElementById('purchasePayment') ? document.getElementById('purchasePayment').value : '';

      console.log('initial productId:', productId);
      console.log('productName:', productName);
      console.log('token present:', !!getToken());
      console.log('productMap size:', Object.keys(productMap).length);

      // quick validation
      if (!name || !phone || !address) {
        if (purchaseMessage) purchaseMessage.textContent = 'Заполните все обязательные поля.';
        console.warn('Validation failed: empty name/phone/address');
        console.groupEnd();
        return;
      }

      // ensure mapping attempted
      await Promise.race([productMappingReady, new Promise(r => setTimeout(() => r(false), 2000))]);

      // If productId not numeric, try to resolve:
      if (!isRemoteProductId(productId)) {
        // first direct lookup by exact productName
        const keyByName = (productName || '').toString().trim().toLowerCase();
        if (keyByName && productMap[keyByName]) {
          productId = productMap[keyByName];
          console.log('resolved by exact name ->', productId);
        } else {
          // if productMap empty or failed, force fetch products once
          if (Object.keys(productMap).length === 0) {
            console.log('productMap empty, forcing fetch /api/products');
            await forceFetchProducts();
            if (keyByName && productMap[keyByName]) {
              productId = productMap[keyByName];
              console.log('resolved after forceFetch by exact name ->', productId);
            }
          }
          // fuzzy: find first key that contains a substring of productName or vice versa
          if (!isRemoteProductId(productId) && keyByName) {
            const keys = Object.keys(productMap);
            for (let k of keys) {
              if (k.includes(keyByName) || keyByName.includes(k) || k.includes(keyByName.split(' ')[0])) {
                productId = productMap[k];
                console.log('resolved by fuzzy match:', k, '->', productId);
                break;
              }
            }
          }
        }
      }

      console.log('final productId to send:', productId, 'isNumeric?', isRemoteProductId(productId));

      const token = getToken();

      // If we have a numeric id and token -> attempt remote order
      if (API_URL && token && isRemoteProductId(productId)) {
        const payload = { product_id: parseInt(productId, 10), quantity: qty, address, phone, payment_type: payment || 'Не указано' };
        console.info('Attempting POST /api/orders with payload', payload);
        try {
          const res = await fetch(API_URL + '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch(e) { data = text; }
          console.log('response status', res.status, 'body', data);
          if (!res.ok) {
            if (purchaseMessage) purchaseMessage.textContent = data?.message || 'Ошибка при оформлении заказа.';
            console.warn('Order API returned error', res.status, data);
            console.groupEnd();
            return;
          }
          // success
          if (purchaseMessage) purchaseMessage.textContent = 'Заказ оформлен! Номер заказа: ' + (data.orderId || data.id || '—');
          console.info('Order created on server', data);
          setTimeout(() => { closeModal(purchaseModal); purchaseForm.reset(); if (purchaseMessage) purchaseMessage.textContent = ''; }, 1500);
          console.groupEnd();
          return;
        } catch (err) {
          console.error('Network / fetch error while creating order', err);
          if (purchaseMessage) purchaseMessage.textContent = 'Сетевая ошибка при оформлении заказа.';
          console.groupEnd();
          return;
        }
      }

      // If we are here: couldn't send remote order (missing token or productId).
      // Try to send with product_name as last resort (we'll see server error body).
      if (API_URL && getToken()) {
        console.log('Trying fallback send with product_name because product_id not numeric');
        const payload = { product_name: productName || null, quantity: qty, address, phone, payment_type: payment || 'Не указано' };
        try {
          const res = await fetch(API_URL + '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch(e) { data = text; }
          console.log('fallback response status', res.status, 'body', data);
          if (res.ok) {
            if (purchaseMessage) purchaseMessage.textContent = 'Заказ оформлен (fallback).';
            setTimeout(() => { closeModal(purchaseModal); purchaseForm.reset(); if (purchaseMessage) purchaseMessage.textContent = ''; }, 1500);
            console.groupEnd();
            return;
          } else {
            if (purchaseMessage) purchaseMessage.textContent = data?.message || 'Ошибка при оформлении заказа.';
            console.warn('Fallback server error', res.status, data);
          }
        } catch (err) {
          console.error('Fallback fetch error', err);
        }
      }

      // Final fallback: save local order and inform user (local storage)
      const order = { id: 'o_' + Date.now(), userId: getCurrentUserId(), productId, productName, qty, name, phone, address, payment, created: Date.now() };
      const orders = getOrders(); orders.push(order); setOrders(orders);
      if (purchaseMessage) purchaseMessage.textContent = 'Заказ сохранён локально. Номер: ' + order.id;
      console.warn('Order saved locally because remote send was not possible. order=', order);

      setTimeout(() => { closeModal(purchaseModal); purchaseForm.reset(); if (purchaseMessage) purchaseMessage.textContent = ''; }, 1500);

    } catch (err) {
      console.error('Unexpected error in purchase submit', err);
      if (purchaseMessage) purchaseMessage.textContent = 'Неожиданная ошибка.';
    } finally {
      console.groupEnd();
    }
  });

  // UI niceties
  const cards = document.querySelectorAll('.product-card');
  cards.forEach((c, i) => {
    c.addEventListener('mouseenter', () => c.classList.add('card-hover'));
    c.addEventListener('mouseleave', () => c.classList.remove('card-hover'));
    c.style.opacity = 0; c.style.transform = 'translateY(10px)';
    setTimeout(() => { c.style.transition = 'opacity 300ms ease, transform 300ms ease'; c.style.opacity = 1; c.style.transform = 'translateY(0)'; }, 120 + i * 70);
  });

  // Esc key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modals = [loginModal, registerModal, purchaseModal];
      modals.forEach(m => { if (m) closeModal(m); });
    }
  });
});




