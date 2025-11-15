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
window.productMap = window.productMap || {};
if (!window._productMappingReadyController) {
  let _resolve;
  const p = new Promise((res) => { _resolve = res; });
  window._productMappingReadyController = { promise: p, resolve: _resolve };
}
window.productMappingReady = window._productMappingReadyController.promise;
const productMap = window.productMap;
const productMappingReady = window.productMappingReady;

// fetch & build productMap (called on load and can be forced)
async function fetchAndBuildProductMap() {
  try {
    const res = await fetch(API_URL + '/api/products');
    if (!res.ok) {
      console.warn('Products fetch failed status', res.status);
      try { window._productMappingReadyController.resolve(false); } catch(e){}
      return false;
    }
    const products = await res.json();
    // build mapping by exact name
    products.forEach(p => {
      if (p && p.name && p.id != null) productMap[String(p.name).trim().toLowerCase()] = String(p.id);
    });
    // try to set numeric dataset.id on existing cards by <h3> match
    document.querySelectorAll('.product-card').forEach(card => {
      const h3 = card.querySelector('h3');
      const title = h3 ? h3.innerText.trim().toLowerCase() : (card.dataset.name || '').trim().toLowerCase();
      if (title && productMap[title]) card.dataset.id = productMap[title];
    });
    console.info('Product map ready, keys:', Object.keys(productMap).length);
    try { window._productMappingReadyController.resolve(true); } catch(e){}
    return true;
  } catch (err) {
    console.error('fetchAndBuildProductMap error', err);
    try { window._productMappingReadyController.resolve(false); } catch(e){}
    return false;
  }
}
fetchAndBuildProductMap().catch(()=>{});

// Force refetch helper (used on modal open and submit)
async function forceFetchProducts() {
  try {
    const res = await fetch(API_URL + '/api/products');
    if (!res.ok) { console.warn('forceFetchProducts failed', res.status); return false; }
    const products = await res.json();
    // clear and rebuild
    Object.keys(productMap).forEach(k => delete productMap[k]);
    products.forEach(p => { if (p && p.name && p.id != null) productMap[String(p.name).trim().toLowerCase()] = String(p.id); });
    // set numeric dataset.id on cards
    document.querySelectorAll('.product-card').forEach(card => {
      const h3 = card.querySelector('h3');
      const title = h3 ? h3.innerText.trim().toLowerCase() : (card.dataset.name || '').trim().toLowerCase();
      if (title && productMap[title]) card.dataset.id = productMap[title];
    });
    console.info('forceFetchProducts: productMap keys=', Object.keys(productMap).length);
    return true;
  } catch (err) {
    console.error('forceFetchProducts error', err);
    return false;
  }
}

// ================= DOM Ready =================
document.addEventListener('DOMContentLoaded', () => {

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

  // close modals
  document.querySelectorAll('.modal').forEach(mod => {
    const close = mod.querySelector('.modal-close');
    if (close) close.addEventListener('click', () => closeModal(mod));
    mod.addEventListener('click', (e) => { if (e.target === mod) closeModal(mod); });
  });
  document.querySelectorAll('[data-modal-cancel]').forEach(btn => btn.addEventListener('click', () => {
    const modal = btn.closest('.modal'); if (modal) closeModal(modal);
  }));

  // Purchase: ensure we force-fetch products when opening modal (if productMap empty)
  async function openPurchaseFor(product) {
    if (!product) product = {};
    let id = product.id || null;
    const name = product.name || 'Товар';

    // If productMap empty, force fetch now (ensures numeric ids)
    if (Object.keys(productMap).length === 0) {
      console.log('openPurchaseFor: productMap empty — forcing products fetch before opening modal');
      await forceFetchProducts();
    } else {
      // wait a short time for initial mapping if still resolving
      await Promise.race([productMappingReady, new Promise(r => setTimeout(() => r(false), 800))]);
    }

    // resolve id (prefer dataset numeric, then match by name)
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
    if (document.getElementById('purchaseMessage')) document.getElementById('purchaseMessage').textContent = '';
    openModal(purchaseModal);
  }

  // delegated click handlers for buy buttons
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

  // Submit handler (improved)
  const purchaseForm = document.getElementById('purchaseForm');
  const purchaseMessage = document.getElementById('purchaseMessage');
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

      console.log('initial productId:', productId, 'productName:', productName);
      console.log('productMap size:', Object.keys(productMap).length, 'token present:', !!getToken());

      if (!name || !phone || !address) {
        if (purchaseMessage) purchaseMessage.textContent = 'Заполните все обязательные поля.';
        console.warn('Form validation failed');
        console.groupEnd();
        return;
      }

      // If productMap empty, force fetch now
      if (Object.keys(productMap).length === 0) {
        console.log('productMap empty on submit — forcing fetch now');
        await forceFetchProducts();
      } else {
        await Promise.race([productMappingReady, new Promise(r => setTimeout(() => r(false), 1000))]);
      }

      // try resolve numeric id
      if (!isRemoteProductId(productId)) {
        const keyByName = (productName || '').toString().trim().toLowerCase();
        if (keyByName && productMap[keyByName]) {
          productId = productMap[keyByName];
          console.log('resolved by exact name ->', productId);
        } else {
          // fuzzy attempt
          for (let k of Object.keys(productMap)) {
            if (!keyByName) break;
            if (k.includes(keyByName) || keyByName.includes(k) || k.includes(keyByName.split(' ')[0])) {
              productId = productMap[k];
              console.log('resolved by fuzzy', k, '->', productId);
              break;
            }
          }
        }
      }

      console.log('final productId:', productId, 'isNumeric?', isRemoteProductId(productId));

      const token = getToken();
      if (API_URL && token && isRemoteProductId(productId)) {
        const payload = { product_id: parseInt(productId, 10), quantity: qty, address, phone, payment_type: payment || 'Не указано' };
        console.info('POST /api/orders payload', payload);
        try {
          const res = await fetch(API_URL + '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch(e) { data = text; }
          console.log('order response', res.status, data);
          if (!res.ok) {
            if (purchaseMessage) purchaseMessage.textContent = data?.message || 'Ошибка при оформлении заказа.';
            console.warn('Order API error', res.status, data);
            console.groupEnd();
            return;
          }
          if (purchaseMessage) purchaseMessage.textContent = 'Заказ оформлен! Номер: ' + (data.orderId || data.id || '—');
          setTimeout(() => { closeModal(purchaseModal); purchaseForm.reset(); if (purchaseMessage) purchaseMessage.textContent = ''; }, 1500);
          console.groupEnd();
          return;
        } catch (err) {
          console.error('Network error on order POST', err);
          if (purchaseMessage) purchaseMessage.textContent = 'Сетевая ошибка при оформлении заказа.';
          console.groupEnd();
          return;
        }
      }

      // As a last resort try sending product_name if token present (will produce server error with message)
      if (API_URL && getToken()) {
        console.log('Attempting fallback send using product_name');
        try {
          const payload = { product_name: productName || null, quantity: qty, address, phone, payment_type: payment || 'Не указано' };
          const res = await fetch(API_URL + '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
            body: JSON.stringify(payload)
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch(e) { data = text; }
          console.log('fallback response', res.status, data);
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

      // Final fallback: save local
      const order = { id: 'o_' + Date.now(), userId: getCurrentUserId(), productId, productName, qty, name, phone, address, payment, created: Date.now() };
      const orders = getOrders(); orders.push(order); setOrders(orders);
      if (purchaseMessage) purchaseMessage.textContent = 'Заказ сохранён локально. Номер: ' + order.id;
      console.warn('Order saved locally', order);
      setTimeout(() => { closeModal(purchaseModal); purchaseForm.reset(); if (purchaseMessage) purchaseMessage.textContent = ''; }, 1500);

    } catch (err) {
      console.error('Unexpected submit error', err);
      if (purchaseMessage) purchaseMessage.textContent = 'Неожиданная ошибка.';
    } finally {
      console.groupEnd();
    }
  });

  // Small UI niceties
  const cards = document.querySelectorAll('.product-card');
  cards.forEach((c, i) => {
    c.addEventListener('mouseenter', () => c.classList.add('card-hover'));
    c.addEventListener('mouseleave', () => c.classList.remove('card-hover'));
    c.style.opacity = 0; c.style.transform = 'translateY(10px)';
    setTimeout(() => { c.style.transition = 'opacity 300ms ease, transform 300ms ease'; c.style.opacity = 1; c.style.transform = 'translateY(0)'; }, 120 + i * 70);
  });

  // Esc closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modals = [loginModal, registerModal, purchaseModal];
      modals.forEach(m => { if (m) closeModal(m); });
    }
  });

}); // DOMContentLoaded end



