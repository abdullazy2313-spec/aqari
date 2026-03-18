'use strict';
/* ═══════════════════════════════════════════════════════
   عقاري — APP.JS — v6.0  (Image Fix + Full Cleanup)
   - Uploaded images compressed & stored separately
   - No more localStorage quota errors
   - Featured flag set for user properties with real images
═══════════════════════════════════════════════════════ */

/* ─────────────────────────────
   FALLBACK / SAMPLE IMAGES
───────────────────────────────*/
const IMGS = {
  villa: [
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=700&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=700&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=700&q=80',
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=700&q=80'
  ],
  apartment: [
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=700&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=700&q=80',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=700&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=700&q=80'
  ],
  house: [
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=700&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=700&q=80'
  ],
  palace: [
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=700&q=80',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=80',
    'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=700&q=80'
  ],
  land: [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80',
    'https://images.unsplash.com/photo-1504309092620-4d0ec726efa4?w=700&q=80'
  ],
  commercial: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=700&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&q=80',
    'https://images.unsplash.com/photo-1462206092226-f46025ffe607?w=700&q=80'
  ]
};
const FALLBACK = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=700&q=80';
/* SVG placeholder for user properties with no uploaded images */
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='500' viewBox='0 0 700 500'%3E%3Crect fill='%23f0f3f7' width='700' height='500'/%3E%3Ctext x='50%25' y='42%25' text-anchor='middle' font-size='72' fill='%23bdc3cc'%3E%F0%9F%8F%A0%3C/text%3E%3Ctext x='50%25' y='62%25' text-anchor='middle' font-size='22' fill='%23adb5bd' font-family='Arial'%3Eلا توجد صور%3C/text%3E%3C/svg%3E";

/* Returns the first image for a property (for card thumbnails) */
function getPropImage(id, category) {
  const arr = IMGS[category] || IMGS.apartment;
  return arr[Math.abs(id || 0) % arr.length];
}

/* Returns array of images — ONLY uploaded images, no fake Unsplash fallbacks */
function getPropImages(p) {
  // 1. Check separately stored uploaded images (new system)
  const stored = _loadPropImages(p.id);
  if (stored && stored.length > 0) return stored;

  // 2. Check inline images (legacy/sample properties that have them hardcoded via Unsplash)
  if (p.images && Array.isArray(p.images) && p.images.length > 0) return p.images;
  if (p.image && typeof p.image === 'string') return [p.image];

  // 3. Only sample properties (id 1-10) get a placeholder — user properties show empty placeholder
  if (p.id && p.id <= 10) {
    const arr = IMGS[p.category] || IMGS.apartment;
    const s = Math.abs(p.id || 0) % arr.length;
    return [arr[s], arr[(s + 1) % arr.length], arr[(s + 2) % arr.length]];
  }

  // 4. User-added properties with no photos → single gray placeholder
  return [PLACEHOLDER_IMG];
}

/* ─────────────────────────────
   IMAGE STORAGE HELPERS
   Each property's images live in their own localStorage key:
   aqari_imgs_{propId}  →  JSON array of base64 strings
───────────────────────────────*/
function _imgKey(propId) { return 'aqari_imgs_' + propId; }

function _savePropImages(propId, imagesArray) {
  if (!propId || !imagesArray || !imagesArray.length) return;
  try {
    localStorage.setItem(_imgKey(propId), JSON.stringify(imagesArray));
  } catch (e) {
    console.warn('[aqari] Could not save images for prop', propId, e);
  }
}

function _loadPropImages(propId) {
  if (!propId) return null;
  try {
    const raw = localStorage.getItem(_imgKey(propId));
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch (e) { return null; }
}

function _deletePropImages(propId) {
  try { localStorage.removeItem(_imgKey(propId)); } catch (e) {}
}

function _clearAllPropImages() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('aqari_imgs_')) keys.push(k);
  }
  keys.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
}

/* ─────────────────────────────
   IMAGE COMPRESSION
   Resizes to max 900×700 at 78% JPEG quality.
   Typical result: 3MB photo → ~120-200KB base64
───────────────────────────────*/
function _compressImage(file) {
  return new Promise((resolve) => {
    const MAX_W = 900, MAX_H = 700, QUALITY = 0.78;
    const reader = new FileReader();
    reader.onload = function(e) {
      const src = e.target.result;
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        // Scale down while preserving aspect ratio
        if (w > MAX_W || h > MAX_H) {
          const ratio = Math.min(MAX_W / w, MAX_H / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', QUALITY);
          resolve(compressed);
        } catch (canvasErr) {
          // If canvas fails (CORS, etc.), use original
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────
   GEOGRAPHIC DATA
───────────────────────────────*/
const SYRIAN_CITIES = ['دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','دير الزور','الرقة','الحسكة','درعا','السويداء','القنيطرة','إدلب','ريف دمشق','القامشلي','منبج','عفرين','جبلة','بانياس','سلمية','تدمر','دوما','زبداني','صيدنايا'];
const CITY_COORDS = {
  'دمشق':{lat:33.5138,lng:36.2765},'حلب':{lat:36.2021,lng:37.1343},'حمص':{lat:34.7394,lng:36.72},
  'حماة':{lat:35.1318,lng:36.758},'اللاذقية':{lat:35.5317,lng:35.7915},'طرطوس':{lat:34.8956,lng:35.8865},
  'دير الزور':{lat:35.336,lng:40.14},'الرقة':{lat:35.95,lng:38.999},'الحسكة':{lat:36.51,lng:40.75},
  'درعا':{lat:32.619,lng:36.102},'السويداء':{lat:32.709,lng:36.567},'القنيطرة':{lat:33.125,lng:35.824},
  'إدلب':{lat:35.931,lng:36.634},'ريف دمشق':{lat:33.45,lng:36.5},'القامشلي':{lat:37.05,lng:41.233},
  'جبلة':{lat:35.36,lng:35.92},'بانياس':{lat:35.18,lng:35.94},'سلمية':{lat:35.01,lng:37.05},
  'تدمر':{lat:34.55,lng:38.28},'منبج':{lat:36.516,lng:37.945},'عفرين':{lat:36.513,lng:36.868},
  'دوما':{lat:33.571,lng:36.405},'زبداني':{lat:33.726,lng:36.096}
};

/* ─────────────────────────────
   SAMPLE PROPERTIES
───────────────────────────────*/
const SAMPLE_PROPERTIES = [];

/* ─────────────────────────────
   STATE
───────────────────────────────*/
let allProperties = [];
let filteredProperties = [];
let myProperties = [];
let favorites = [];
let notifications_data = [];
let conversations_data = {};
let currentSort = 'newest';
let activeType = 'all';
let activeSubtype = 'all';
let activeCategory = 'all';
let searchQuery = '';

/* Global image store for add-property page */
window.UPLOAD_IMGS = [];

/* ─────────────────────────────
   INIT
───────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  loadData();

  const page = getPage();
  if (!['login', 'map'].includes(page) && !localStorage.getItem('isLoggedIn')) {
    location.href = 'login.html'; return;
  }

  switch (page) {
    case 'index':         initIndex();           break;
    case 'favorites':     renderFavorites();     break;
    case 'details':       renderDetails();       break;
    case 'messages':      renderConvList();      break;
    case 'chat':          initChat();            break;
    case 'notifications': renderNotifications(); break;
    case 'profile':       renderProfile();       break;
    case 'settings':      initSettings();        break;
    case 'login':         initSplash();          break;
    case 'add-property':  window.UPLOAD_IMGS = []; break;
  }
  markNavActive(page);
  updateBadge();
});

function getPage() {
  return location.pathname.split('/').pop().replace('.html', '') || 'index';
}

/* ─────────────────────────────
   DATA PERSISTENCE
   Properties stored WITHOUT inline images (images in separate keys)
───────────────────────────────*/
function loadData() {
  try {
    const raw = localStorage.getItem('aqari_props');
    myProperties = raw ? JSON.parse(raw) : [];
    // Strip any accidentally stored inline base64 to save memory
    myProperties.forEach(p => {
      if (p.images) { delete p.images; }
      if (p.image && p.image.startsWith('data:')) { delete p.image; }
    });
  } catch (e) { myProperties = []; }

  try { favorites = JSON.parse(localStorage.getItem('aqari_favs') || '[]'); } catch (e) { favorites = []; }
  try { notifications_data = JSON.parse(localStorage.getItem('aqari_notifs')) || getDefaultNotifs(); } catch (e) { notifications_data = getDefaultNotifs(); }
  try { conversations_data = JSON.parse(localStorage.getItem('aqari_convs')) || getDefaultConvs(); } catch (e) { conversations_data = getDefaultConvs(); }
  syncAll();
}

function saveData() {
  /* Save properties WITHOUT images (images stored separately) */
  try {
    const propsClean = myProperties.map(p => {
      const clone = Object.assign({}, p);
      delete clone.images;
      delete clone.image;
      return clone;
    });
    localStorage.setItem('aqari_props', JSON.stringify(propsClean));
  } catch (e) { console.warn('[aqari] saveData error', e); }

  try { localStorage.setItem('aqari_favs', JSON.stringify(favorites)); } catch (e) {}
  try { localStorage.setItem('aqari_notifs', JSON.stringify(notifications_data)); } catch (e) {}
  try { localStorage.setItem('aqari_convs', JSON.stringify(conversations_data)); } catch (e) {}
}

function syncAll() {
  /* استخدم Firebase فقط — لا عقارات وهمية */
  var fbProps = (window.allProperties || []).filter(function(p){ return p.isFirebase; });
  if (fbProps.length > 0) {
    allProperties = fbProps;
  } else {
    allProperties = [...myProperties];
  }
  filteredProperties = [...allProperties];
  window.allProperties = allProperties;
  window.myProperties = myProperties;
  window.favorites = favorites;
  window.CITY_COORDS = CITY_COORDS;
  window.SYRIAN_CITIES = SYRIAN_CITIES;
  window.conversations = conversations_data;
  window.notifications = notifications_data;
}

/* ─────────────────────────────
   INDEX
───────────────────────────────*/
function initIndex() {
  /* Update total count in quick-cats strip */
  const tc = document.getElementById('totalCount');
  if (tc) tc.textContent = allProperties.length;
  /* Mark first item active by default */
  const firstQc = document.querySelector('.qc-item');
  if (firstQc) firstQc.classList.add('active');
  renderFeatured();
  renderProperties();
  initSearch();
  applyURLParams();
}

/* Featured cards */
function renderFeatured() {
  const el = document.getElementById('featuredList');
  if (!el) return;
  const list = allProperties.filter(p => p.featured).slice(0, 8);
  el.innerHTML = list.map(p => {
    const imgs = getPropImages(p);
    const isFav = favorites.includes(p.id);
    const isSale = p.type === 'sale';
    const specs = p.rooms > 0
      ? `<div class="featured-specs">
           <div class="featured-spec"><i class="fas fa-door-open"></i>${p.rooms}</div>
           <div class="featured-spec"><i class="fas fa-bath"></i>${p.bathrooms}</div>
           <div class="featured-spec"><i class="fas fa-expand-arrows-alt"></i>${p.area}م²</div>
         </div>`
      : `<div class="featured-specs"><div class="featured-spec"><i class="fas fa-expand-arrows-alt"></i>${p.area}م²</div></div>`;
    return `
    <div class="featured-card" onclick="gotoDetails(${p.id})">
      <div class="featured-img">
        <img src="${imgs[0]}" alt="${p.title}" loading="lazy" onerror="this.src='${FALLBACK}'">
        <div class="featured-overlay"></div>
        <span class="card-badge ${isSale ? 'badge-sale' : 'badge-rent'}" style="position:absolute;top:9px;right:9px">
          <i class="fas fa-${isSale ? 'tag' : 'key'}"></i> ${isSale ? 'للبيع' : 'للإيجار'}
        </span>
        <button class="featured-fav ${isFav ? 'active' : ''}" data-fid="${p.id}" onclick="toggleFav(event,${p.id})">
          <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
        </button>
        ${imgs.length > 1 ? `<span style="position:absolute;bottom:8px;right:10px;background:rgba(0,0,0,0.55);color:white;font-size:0.63rem;font-weight:700;padding:2px 7px;border-radius:99px"><i class="fas fa-images" style="margin-left:3px"></i>${imgs.length}</span>` : ''}
      </div>
      <div class="featured-body">
        <div class="featured-price">$${fmtNum(p.price)}<span style="font-size:0.68rem;color:var(--gray);font-weight:400"> USD${p.type === 'rent' ? '/شهر' : ''}</span></div>
        <div class="featured-title">${p.title}</div>
        <div class="featured-loc"><i class="fas fa-map-marker-alt" style="color:var(--accent)"></i>${p.location}</div>
        ${specs}
      </div>
    </div>`;
  }).join('');
}

/* Property card with swipe gallery */
function makeCard(p, i) {
  const imgs = getPropImages(p);
  const isFav = favorites.includes(p.id);
  const isSale = p.type === 'sale';
  const per = p.type === 'rent' ? '/شهر' : '';
  const specs = p.rooms > 0
    ? `<div class="spec-item"><i class="fas fa-door-open"></i>${p.rooms} غ</div>
       <div class="spec-item"><i class="fas fa-bath"></i>${p.bathrooms}</div>`
    : '';
  const uid = 'c' + p.id;
  const imgTrack = imgs.length > 1
    ? `<div class="card-swipe-wrap" id="sw_${uid}">
         <div class="card-swipe-track" id="tr_${uid}">
           ${imgs.map(src => `<div class="card-swipe-slide"><img src="${src}" alt="${p.title}" loading="lazy" onerror="this.src='${FALLBACK}'"></div>`).join('')}
         </div>
         <div class="card-swipe-dots" id="dt_${uid}">
           ${imgs.map((_, j) => `<span class="csd${j === 0 ? ' on' : ''}"></span>`).join('')}
         </div>
       </div>`
    : `<div class="card-swipe-wrap"><div class="card-swipe-track"><div class="card-swipe-slide"><img src="${imgs[0]}" alt="${p.title}" loading="lazy" onerror="this.src='${FALLBACK}'"></div></div></div>`;

  return `
  <div class="property-card" onclick="gotoDetails(${p.id})" style="animation:fadeUp 0.4s ${i * 0.05}s both">
    <div style="position:relative;overflow:hidden;height:200px;background:var(--gray-light)">
      ${imgTrack}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.52) 0%,transparent 50%);pointer-events:none"></div>
      <div style="position:absolute;top:10px;right:10px;display:flex;gap:5px;z-index:5;pointer-events:none">
        <span class="card-badge ${isSale ? 'badge-sale' : 'badge-rent'}">
          <i class="fas fa-${isSale ? 'tag' : 'key'}"></i>${isSale ? 'للبيع' : 'للإيجار'}
        </span>
        ${p.featured ? '<span class="card-badge badge-featured"><i class="fas fa-star"></i>مميز</span>' : ''}
      </div>
      <button class="card-fav-btn ${isFav ? 'active' : ''}" data-fid="${p.id}" onclick="toggleFav(event,${p.id})" style="z-index:5">
        <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
      </button>
      <div style="position:absolute;bottom:10px;right:12px;color:white;font-weight:900;font-size:1rem;text-shadow:0 2px 8px rgba(0,0,0,0.6);z-index:5;pointer-events:none">
        $${fmtNum(p.price)}<span style="font-size:0.65rem;opacity:0.85"> USD${per}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="card-title">${p.title}</div>
      <div class="card-location"><i class="fas fa-map-marker-alt"></i>${p.location}</div>
      <div class="card-specs">
        ${specs}
        <div class="spec-item"><i class="fas fa-expand-arrows-alt"></i>${p.area}م²</div>
      </div>
    </div>
  </div>`;
}

/* Swipe init */
function initCardSwipes() {
  document.querySelectorAll('[id^="sw_"]').forEach(wrap => {
    const uid = wrap.id.slice(3);
    const track = document.getElementById('tr_' + uid);
    const dotsEl = document.getElementById('dt_' + uid);
    if (!track) return;
    const slides = track.querySelectorAll('.card-swipe-slide');
    if (slides.length < 2) return;
    let cur = 0, startX = 0, dragging = false, moved = false;

    function goTo(idx) {
      if (idx < 0) idx = 0;
      if (idx >= slides.length) idx = slides.length - 1;
      cur = idx;
      track.style.transform = 'translateX(' + (idx * -100) + '%)';
      if (dotsEl) {
        dotsEl.querySelectorAll('.csd').forEach((d, j) => d.classList.toggle('on', j === cur));
      }
    }
    wrap.addEventListener('touchstart', e => { startX = e.touches[0].clientX; dragging = true; moved = false; }, { passive: true });
    wrap.addEventListener('touchmove', e => { if (!dragging) return; moved = Math.abs(e.touches[0].clientX - startX) > 8; }, { passive: true });
    wrap.addEventListener('touchend', e => {
      if (!dragging) return; dragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? cur + 1 : cur - 1);
    });
    wrap.addEventListener('click', e => { if (moved) e.stopPropagation(); });
  });
}

function renderProperties(arr) {
  const list = document.getElementById('propertiesList');
  if (!list) return;
  const data = arr !== undefined ? arr : filteredProperties;
  const cnt = document.getElementById('resultsCount');
  if (cnt) cnt.textContent = data.length + ' نتيجة';
  if (!data.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fas fa-search"></i>
      <p style="font-weight:700;margin-bottom:6px">لا توجد نتائج</p>
      <p style="font-size:0.82rem">جرب تعديل الفلاتر</p></div>`;
    return;
  }
  list.innerHTML = data.map((p, i) => makeCard(p, i)).join('');
  setTimeout(initCardSwipes, 60);
}

/* ─────────────────────────────
   FILTERS
───────────────────────────────*/
function setActiveType(type, el) {
  activeType = type;
  document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active', 'active-sale', 'active-rent'));
  if (el) {
    el.classList.add('active');
    if (type === 'sale') el.classList.add('active-sale');
    if (type === 'rent') el.classList.add('active-rent');
  }
  runFilters();
}
function setActiveSubtype(st, el) {
  activeSubtype = st;
  document.querySelectorAll('.subtype-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  runFilters();
}
function filterData(cat, el) {
  activeCategory = cat;
  document.querySelectorAll('.cat-tile').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  runFilters();
}
function runFilters() {
  let arr = allProperties.filter(p => {
    if (activeType !== 'all' && p.type !== activeType) return false;
    if (activeSubtype !== 'all' && (p.subtype || 'residential') !== activeSubtype) return false;
    /* Category filter: support comma-separated values for multi-match */
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.title.toLowerCase().includes(q) &&
        !p.location.toLowerCase().includes(q) &&
        !(p.city || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  arr = applyExtFilters(arr);
  filteredProperties = arr;
  sortData();
  renderProperties();
  renderFeatured();
}
function sortData() {
  switch (currentSort) {
    case 'price-asc':  filteredProperties.sort((a, b) => a.price - b.price); break;
    case 'price-desc': filteredProperties.sort((a, b) => b.price - a.price); break;
    case 'area':       filteredProperties.sort((a, b) => b.area - a.area); break;
    case 'featured':   filteredProperties.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
    default:           filteredProperties.sort((a, b) => b.id - a.id); break;
  }
}
function changeSort(v) { currentSort = v; runFilters(); }
function setView(type) {
  const list = document.getElementById('propertiesList');
  if (!list) return;
  if (type === 'grid') list.classList.add('grid-2'); else list.classList.remove('grid-2');
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === type));
}

/* ─────────────────────────────
   SEARCH
───────────────────────────────*/
function initSearch() {
  const inp = document.getElementById('searchInput');
  const box = document.getElementById('searchSuggestions');
  if (!inp || !box) return;
  inp.addEventListener('input', () => {
    searchQuery = inp.value.trim();
    const q = searchQuery.toLowerCase();
    if (!q) { box.style.display = 'none'; runFilters(); return; }
    const hits = [
      ...allProperties
        .filter(p => p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q))
        .slice(0, 3)
        .map(p => ({ text: p.title, sub: p.location, icon: 'fa-building', id: p.id })),
      ...SYRIAN_CITIES
        .filter(c => c.includes(q))
        .slice(0, 3)
        .map(c => ({ text: c, sub: 'مدينة سورية', icon: 'fa-map-marker-alt' }))
    ].slice(0, 6);
    if (!hits.length) { box.style.display = 'none'; }
    else {
      box.style.display = 'block';
      box.innerHTML = hits.map(h =>
        `<div class="suggestion-item" onclick="${h.id ? `gotoDetails(${h.id})` : `pickSuggestion('${h.text}')`}">
           <i class="fas ${h.icon}"></i>
           <div><div style="font-weight:600;font-size:0.86rem">${h.text}</div>
           <div style="font-size:0.7rem;color:var(--gray)">${h.sub}</div></div>
         </div>`).join('');
    }
    runFilters();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.hero-search-wrap')) box.style.display = 'none';
  });
}
function pickSuggestion(text) {
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = text;
  searchQuery = text;
  const box = document.getElementById('searchSuggestions');
  if (box) box.style.display = 'none';
  runFilters();
}

/* Apply URL params from filter.html */
function applyURLParams() {
  const params = new URLSearchParams(location.search);
  const t = params.get('type') || 'all';
  const st = params.get('subtype') || 'all';
  const cat = params.get('category') || 'all';
  const city = params.get('city') || '';
  const sort = params.get('sort') || 'newest';
  const mn = parseFloat(params.get('minPrice') || '0');
  const mx = parseFloat(params.get('maxPrice') || '0');
  const mna = parseFloat(params.get('minArea') || '0');
  const mxa = parseFloat(params.get('maxArea') || '0');
  const rooms = parseInt(params.get('rooms') || '0');
  const baths = parseInt(params.get('baths') || '0');
  const furnished = params.get('furnished') === '1';
  const pool = params.get('pool') === '1';
  const featured = params.get('featured') === '1';

  activeType = t;
  const tabMap = { all: 'tabAll', sale: 'tabSale', rent: 'tabRent' };
  Object.entries(tabMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active', 'active-sale', 'active-rent');
    if (key === t) {
      el.classList.add('active');
      if (t === 'sale') el.classList.add('active-sale');
      if (t === 'rent') el.classList.add('active-rent');
    }
  });
  activeSubtype = st;
  activeCategory = cat;
  if (sort) currentSort = sort;
  window._extFilter = { city, mn, mx, mna, mxa, rooms, baths, furnished, pool, featured };
  runFilters();
}

function applyExtFilters(arr) {
  const f = window._extFilter;
  if (!f) return arr;
  return arr.filter(p => {
    if (f.city && (p.city || '') !== f.city) return false;
    if (f.mn > 0 && p.price < f.mn) return false;
    if (f.mx > 0 && p.price > f.mx) return false;
    if (f.mna > 0 && p.area < f.mna) return false;
    if (f.mxa > 0 && p.area > f.mxa) return false;
    if (f.rooms > 0 && (p.rooms || 0) < f.rooms) return false;
    if (f.baths > 0 && (p.bathrooms || 0) < f.baths) return false;
    if (f.furnished && !p.furnished) return false;
    if (f.featured && !p.featured) return false;
    return true;
  });
}

/* ─────────────────────────────
   QUICK FILTER (category strip on index)
───────────────────────────────*/
function quickFilter(type, cat, el) {
  /* Update active state on the strip */
  document.querySelectorAll('.qc-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  /* Update type tabs */
  activeType = type;
  activeCategory = cat;
  document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active', 'active-sale', 'active-rent'));
  const tabMap = { all: 'tabAll', sale: 'tabSale', rent: 'tabRent' };
  const tid = tabMap[type];
  if (tid) {
    const tab = document.getElementById(tid);
    if (tab) {
      tab.classList.add('active');
      if (type === 'sale') tab.classList.add('active-sale');
      if (type === 'rent') tab.classList.add('active-rent');
    }
  }
  runFilters();
  /* Smooth scroll to results */
  const list = document.getElementById('propertiesList');
  if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─────────────────────────────
   NAVIGATION
───────────────────────────────*/
function gotoDetails(id) {
  localStorage.setItem('aqari_selected', id);
  location.href = 'details.html';
}
function markNavActive(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
}

/* ─────────────────────────────
   FAVORITES
───────────────────────────────*/
function toggleFav(ev, id) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const i = favorites.indexOf(id);
  if (i === -1) { favorites.push(id); showToast('تمت الإضافة للمفضلة'); }
  else { favorites.splice(i, 1); showToast('تمت الإزالة من المفضلة'); }
  window.favorites = favorites;
  saveData();
  document.querySelectorAll(`[data-fid="${id}"]`).forEach(btn => {
    const on = favorites.includes(id);
    btn.classList.toggle('active', on);
    const ic = btn.querySelector('i'); if (ic) ic.className = `fa${on ? 's' : 'r'} fa-heart`;
  });
  if (getPage() === 'favorites') renderFavorites();
}
function renderFavorites() {
  const list = document.getElementById('favoritesList');
  if (!list) return;
  const fp = allProperties.filter(p => favorites.includes(p.id));
  if (!fp.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="far fa-heart"></i>
      <p style="font-weight:700;margin-bottom:8px">لا توجد مفضلة</p>
      <a href="index.html" style="display:inline-block;margin-top:12px;padding:10px 22px;background:var(--accent);color:white;border-radius:10px;text-decoration:none;font-weight:700">استعرض العقارات</a>
    </div>`; return;
  }
  list.innerHTML = fp.map((p, i) => makeCard(p, i)).join('');
  setTimeout(initCardSwipes, 60);
}
function clearAllFavorites() {
  if (!favorites.length) { showToast('لا توجد مفضلة'); return; }
  if (!confirm('مسح جميع المفضلة؟')) return;
  favorites = []; window.favorites = favorites; saveData(); renderFavorites(); showToast('تم المسح');
}

/* ─────────────────────────────
   DETAILS
───────────────────────────────*/
let detIdx = 0, detTotal = 0;

function renderDetails() {
  const id = parseInt(localStorage.getItem('aqari_selected'));
  const p = allProperties.find(x => x.id === id);
  const box = document.querySelector('.details-container');
  if (!box) return;
  if (!p) {
    box.innerHTML = `<div class="empty-state"><i class="fas fa-home"></i><p>العقار غير موجود</p>
    <a href="index.html" style="display:inline-block;margin-top:14px;padding:10px 22px;background:var(--accent);color:white;border-radius:10px;text-decoration:none;font-weight:700">العودة</a></div>`;
    return;
  }
  const imgs = getPropImages(p);
  detIdx = 0; detTotal = imgs.length;
  const isFav = favorites.includes(p.id);
  const isSale = p.type === 'sale';
  const blabel = isSale ? 'للبيع' : 'للإيجار';
  const nearby = allProperties.filter(x => x.id !== p.id && x.city === p.city).slice(0, 5);

  const gal = `
  <div class="det-gallery" id="detGallery">
    <div class="det-gallery-track" id="detTrack">
      ${imgs.map((src, i) => `<div class="det-slide">
        <img src="${src}" alt="${p.title}" onerror="this.src='${FALLBACK}'">
      </div>`).join('')}
    </div>
    <button class="det-back" onclick="history.back()"><i class="fas fa-arrow-right"></i></button>
    <div class="det-top-right">
      <button class="det-action-btn" onclick="shareProp()"><i class="fas fa-share-alt"></i></button>
      <button class="det-action-btn ${isFav ? 'active' : ''}" data-fid="${p.id}" onclick="toggleFav(event,${p.id})">
        <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
      </button>
    </div>
    ${imgs.length > 1 ? `
    <div class="det-dots" id="detDots">
      ${imgs.map((_, i) => `<span class="det-dot${i === 0 ? ' active' : ''}" onclick="detGoSlide(${i})"></span>`).join('')}
    </div>
    <div class="det-counter" id="detCounter">1 / ${imgs.length}</div>
    <button class="det-nav det-prev" onclick="detGalleryPrev()"><i class="fas fa-chevron-right"></i></button>
    <button class="det-nav det-next" onclick="detGalleryNext()"><i class="fas fa-chevron-left"></i></button>` : ''}
    <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;z-index:10;white-space:nowrap">
      <span style="display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:99px;font-size:0.78rem;font-weight:800;backdrop-filter:blur(12px);box-shadow:0 3px 16px rgba(0,0,0,0.35);background:${isSale ? 'rgba(27,153,86,0.96)' : 'rgba(31,110,170,0.96)'};color:white">
        <i class="fas fa-${isSale ? 'tag' : 'key'}"></i>${blabel}
      </span>
      ${p.featured ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:99px;font-size:0.78rem;font-weight:800;backdrop-filter:blur(12px);box-shadow:0 3px 16px rgba(0,0,0,0.35);background:rgba(210,100,20,0.96);color:white"><i class="fas fa-star"></i>مميز</span>` : ''}
    </div>
  </div>`;

  const specs = p.rooms > 0
    ? `<div class="specs-grid">
         <div class="spec-card"><i class="fas fa-door-open"></i><span class="spec-val">${p.rooms}</span><span class="spec-lbl">غرفة</span></div>
         <div class="spec-card"><i class="fas fa-bath"></i><span class="spec-val">${p.bathrooms}</span><span class="spec-lbl">حمام</span></div>
         <div class="spec-card"><i class="fas fa-expand-arrows-alt"></i><span class="spec-val">${p.area}</span><span class="spec-lbl">م²</span></div>
         <div class="spec-card"><i class="fas fa-calendar-alt"></i><span class="spec-val">${p.age || 0}</span><span class="spec-lbl">سنة</span></div>
         <div class="spec-card"><i class="fas fa-couch"></i><span class="spec-val">${p.furnished ? 'نعم' : 'لا'}</span><span class="spec-lbl">مفروش</span></div>
         <div class="spec-card"><i class="fas fa-eye"></i><span class="spec-val">${(p.views || 0).toLocaleString()}</span><span class="spec-lbl">مشاهدة</span></div>
       </div>`
    : `<div class="specs-grid">
         <div class="spec-card"><i class="fas fa-expand-arrows-alt"></i><span class="spec-val">${p.area}</span><span class="spec-lbl">م²</span></div>
         <div class="spec-card"><i class="fas fa-eye"></i><span class="spec-val">${(p.views || 0).toLocaleString()}</span><span class="spec-lbl">مشاهدة</span></div>
       </div>`;

  box.innerHTML = gal + `
  <div class="det-body">
    <div class="det-price">$${fmtNum(p.price)} USD ${p.type === 'rent' ? '<span style="font-size:0.82rem;color:var(--gray);font-weight:400">/شهرياً</span>' : ''}</div>
    <div class="det-title">${p.title}</div>
    <div class="det-loc"><i class="fas fa-map-marker-alt"></i>${p.location}</div>
    ${specs}
    <div class="section-title"><i class="fas fa-align-right"></i>وصف العقار</div>
    <p class="det-desc">${p.description || 'لا يوجد وصف.'}</p>
    ${p.features && p.features.length ? `
    <div class="section-title"><i class="fas fa-star"></i>المميزات</div>
    <div class="features-list">${p.features.map(f => `<span class="feature-tag"><i class="fas fa-check"></i>${f}</span>`).join('')}</div>` : ''}
    <div class="section-title"><i class="fas fa-map-marked-alt"></i>الموقع</div>
    <div id="detMapWrap"></div>
    <div class="section-title"><i class="fas fa-user-tie"></i>المعلن</div>
    <div class="agent-card">
      <div class="agent-avatar"><i class="fas fa-user"></i></div>
      <div class="agent-info">
        <div class="agent-name">${p.agentName || 'مالك العقار'}</div>
        <div class="agent-label">مالك مباشر</div>
        ${p.agentVerified ? '<div class="agent-badge"><i class="fas fa-shield-alt"></i> موثق</div>' : ''}
      </div>
    </div>
    <div class="contact-section" style="margin-top:14px">
      <a href="tel:+${p.phone || ''}" class="btn-call"><i class="fas fa-phone"></i> اتصال</a>
      <a href="https://wa.me/${p.phone || ''}?text=${encodeURIComponent('مرحباً، رأيت إعلانك: ' + p.title)}" class="btn-whatsapp" target="_blank"><i class="fab fa-whatsapp"></i> واتساب</a>
      <button class="btn-chat" onclick="startChatWith('${(p.agentName || 'المعلن').replace(/'/g, "\\'")}','${p.id}','${p.title.replace(/'/g, "\\'")}')"><i class="fas fa-comment-dots"></i></button>
    </div>
    ${localStorage.getItem('isLoggedIn') === 'true' ? `
    <button onclick="deleteMyProperty('${p.firestoreId || p.id}')" style="width:100%;margin-top:12px;padding:12px;background:rgba(231,76,60,0.1);border:1.5px solid rgba(231,76,60,0.4);color:var(--danger);border-radius:12px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:6px">
      <i class="fas fa-trash-alt"></i> حذف إعلاني
    </button>` : ''}strict';
/* ═══════════════════════════════════════════════════════
   عقاري — APP.JS — v6.0  (Image Fix + Full Cleanup)
   - Uploaded images compressed & stored separately
   - No more localStorage quota errors
   - Featured flag set for user properties with real images
═══════════════════════════════════════════════════════ */

/* ─────────────────────────────
   FALLBACK / SAMPLE IMAGES
───────────────────────────────*/
const IMGS = {
  villa: [
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=700&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=700&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=700&q=80',
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=700&q=80'
  ],
  apartment: [
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=700&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=700&q=80',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=700&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=700&q=80'
  ],
  house: [
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=700&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=700&q=80'
  ],
  palace: [
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=700&q=80',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=80',
    'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=700&q=80'
  ],
  land: [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80',
    'https://images.unsplash.com/photo-1504309092620-4d0ec726efa4?w=700&q=80'
  ],
  commercial: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=700&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&q=80',
    'https://images.unsplash.com/photo-1462206092226-f46025ffe607?w=700&q=80'
  ]
};
const FALLBACK = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=700&q=80';
/* SVG placeholder for user properties with no uploaded images */
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='500' viewBox='0 0 700 500'%3E%3Crect fill='%23f0f3f7' width='700' height='500'/%3E%3Ctext x='50%25' y='42%25' text-anchor='middle' font-size='72' fill='%23bdc3cc'%3E%F0%9F%8F%A0%3C/text%3E%3Ctext x='50%25' y='62%25' text-anchor='middle' font-size='22' fill='%23adb5bd' font-family='Arial'%3Eلا توجد صور%3C/text%3E%3C/svg%3E";

/* Returns the first image for a property (for card thumbnails) */
function getPropImage(id, category) {
  const arr = IMGS[category] || IMGS.apartment;
  return arr[Math.abs(id || 0) % arr.length];
}

/* Returns array of images — ONLY uploaded images, no fake Unsplash fallbacks */
function getPropImages(p) {
  // 1. Check separately stored uploaded images (new system)
  const stored = _loadPropImages(p.id);
  if (stored && stored.length > 0) return stored;

  // 2. Check inline images (legacy/sample properties that have them hardcoded via Unsplash)
  if (p.images && Array.isArray(p.images) && p.images.length > 0) return p.images;
  if (p.image && typeof p.image === 'string') return [p.image];

  // 3. Only sample properties (id 1-10) get a placeholder — user properties show empty placeholder
  if (p.id && p.id <= 10) {
    const arr = IMGS[p.category] || IMGS.apartment;
    const s = Math.abs(p.id || 0) % arr.length;
    return [arr[s], arr[(s + 1) % arr.length], arr[(s + 2) % arr.length]];
  }

  // 4. User-added properties with no photos → single gray placeholder
  return [PLACEHOLDER_IMG];
}

/* ─────────────────────────────
   IMAGE STORAGE HELPERS
   Each property's images live in their own localStorage key:
   aqari_imgs_{propId}  →  JSON array of base64 strings
───────────────────────────────*/
function _imgKey(propId) { return 'aqari_imgs_' + propId; }

function _savePropImages(propId, imagesArray) {
  if (!propId || !imagesArray || !imagesArray.length) return;
  try {
    localStorage.setItem(_imgKey(propId), JSON.stringify(imagesArray));
  } catch (e) {
    console.warn('[aqari] Could not save images for prop', propId, e);
  }
}

function _loadPropImages(propId) {
  if (!propId) return null;
  try {
    const raw = localStorage.getItem(_imgKey(propId));
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch (e) { return null; }
}

function _deletePropImages(propId) {
  try { localStorage.removeItem(_imgKey(propId)); } catch (e) {}
}

function _clearAllPropImages() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('aqari_imgs_')) keys.push(k);
  }
  keys.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
}

/* ─────────────────────────────
   IMAGE COMPRESSION
   Resizes to max 900×700 at 78% JPEG quality.
   Typical result: 3MB photo → ~120-200KB base64
───────────────────────────────*/
function _compressImage(file) {
  return new Promise((resolve) => {
    const MAX_W = 900, MAX_H = 700, QUALITY = 0.78;
    const reader = new FileReader();
    reader.onload = function(e) {
      const src = e.target.result;
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        // Scale down while preserving aspect ratio
        if (w > MAX_W || h > MAX_H) {
          const ratio = Math.min(MAX_W / w, MAX_H / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', QUALITY);
          resolve(compressed);
        } catch (canvasErr) {
          // If canvas fails (CORS, etc.), use original
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────
   GEOGRAPHIC DATA
───────────────────────────────*/
const SYRIAN_CITIES = ['دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','دير الزور','الرقة','الحسكة','درعا','السويداء','القنيطرة','إدلب','ريف دمشق','القامشلي','منبج','عفرين','جبلة','بانياس','سلمية','تدمر','دوما','زبداني','صيدنايا'];
const CITY_COORDS = {
  'دمشق':{lat:33.5138,lng:36.2765},'حلب':{lat:36.2021,lng:37.1343},'حمص':{lat:34.7394,lng:36.72},
  'حماة':{lat:35.1318,lng:36.758},'اللاذقية':{lat:35.5317,lng:35.7915},'طرطوس':{lat:34.8956,lng:35.8865},
  'دير الزور':{lat:35.336,lng:40.14},'الرقة':{lat:35.95,lng:38.999},'الحسكة':{lat:36.51,lng:40.75},
  'درعا':{lat:32.619,lng:36.102},'السويداء':{lat:32.709,lng:36.567},'القنيطرة':{lat:33.125,lng:35.824},
  'إدلب':{lat:35.931,lng:36.634},'ريف دمشق':{lat:33.45,lng:36.5},'القامشلي':{lat:37.05,lng:41.233},
  'جبلة':{lat:35.36,lng:35.92},'بانياس':{lat:35.18,lng:35.94},'سلمية':{lat:35.01,lng:37.05},
  'تدمر':{lat:34.55,lng:38.28},'منبج':{lat:36.516,lng:37.945},'عفرين':{lat:36.513,lng:36.868},
  'دوما':{lat:33.571,lng:36.405},'زبداني':{lat:33.726,lng:36.096}
};

/* ─────────────────────────────
   SAMPLE PROPERTIES
───────────────────────────────*/
const SAMPLE_PROPERTIES = [];

/* ─────────────────────────────
   STATE
───────────────────────────────*/
let allProperties = [];
let filteredProperties = [];
let myProperties = [];
let favorites = [];
let notifications_data = [];
let conversations_data = {};
let currentSort = 'newest';
let activeType = 'all';
let activeSubtype = 'all';
let activeCategory = 'all';
let searchQuery = '';

/* Global image store for add-property page */
window.UPLOAD_IMGS = [];

/* ─────────────────────────────
   INIT
───────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  loadData();

  const page = getPage();
  if (!['login', 'map'].includes(page) && !localStorage.getItem('isLoggedIn')) {
    location.href = 'login.html'; return;
  }

  switch (page) {
    case 'index':         initIndex();           break;
    case 'favorites':     renderFavorites();     break;
    case 'details':       renderDetails();       break;
    case 'messages':      renderConvList();      break;
    case 'chat':          initChat();            break;
    case 'notifications': renderNotifications(); break;
    case 'profile':       renderProfile();       break;
    case 'settings':      initSettings();        break;
    case 'login':         initSplash();          break;
    case 'add-property':  window.UPLOAD_IMGS = []; break;
  }
  markNavActive(page);
  updateBadge();
});

function getPage() {
  return location.pathname.split('/').pop().replace('.html', '') || 'index';
}

/* ─────────────────────────────
   DATA PERSISTENCE
   Properties stored WITHOUT inline images (images in separate keys)
───────────────────────────────*/
function loadData() {
  try {
    const raw = localStorage.getItem('aqari_props');
    myProperties = raw ? JSON.parse(raw) : [];
    // Strip any accidentally stored inline base64 to save memory
    myProperties.forEach(p => {
      if (p.images) { delete p.images; }
      if (p.image && p.image.startsWith('data:')) { delete p.image; }
    });
  } catch (e) { myProperties = []; }

  try { favorites = JSON.parse(localStorage.getItem('aqari_favs') || '[]'); } catch (e) { favorites = []; }
  try { notifications_data = JSON.parse(localStorage.getItem('aqari_notifs')) || getDefaultNotifs(); } catch (e) { notifications_data = getDefaultNotifs(); }
  try { conversations_data = JSON.parse(localStorage.getItem('aqari_convs')) || getDefaultConvs(); } catch (e) { conversations_data = getDefaultConvs(); }
  syncAll();
}

function saveData() {
  /* Save properties WITHOUT images (images stored separately) */
  try {
    const propsClean = myProperties.map(p => {
      const clone = Object.assign({}, p);
      delete clone.images;
      delete clone.image;
      return clone;
    });
    localStorage.setItem('aqari_props', JSON.stringify(propsClean));
  } catch (e) { console.warn('[aqari] saveData error', e); }

  try { localStorage.setItem('aqari_favs', JSON.stringify(favorites)); } catch (e) {}
  try { localStorage.setItem('aqari_notifs', JSON.stringify(notifications_data)); } catch (e) {}
  try { localStorage.setItem('aqari_convs', JSON.stringify(conversations_data)); } catch (e) {}
}

function syncAll() {
  /* استخدم Firebase فقط — لا عقارات وهمية */
  var fbProps = (window.allProperties || []).filter(function(p){ return p.isFirebase; });
  if (fbProps.length > 0) {
    allProperties = fbProps;
  } else {
    allProperties = [...myProperties];
  }
  filteredProperties = [...allProperties];
  window.allProperties = allProperties;
  window.myProperties = myProperties;
  window.favorites = favorites;
  window.CITY_COORDS = CITY_COORDS;
  window.SYRIAN_CITIES = SYRIAN_CITIES;
  window.conversations = conversations_data;
  window.notifications = notifications_data;
}

/* ─────────────────────────────
   INDEX
───────────────────────────────*/
function initIndex() {
  /* Update total count in quick-cats strip */
  const tc = document.getElementById('totalCount');
  if (tc) tc.textContent = allProperties.length;
  /* Mark first item active by default */
  const firstQc = document.querySelector('.qc-item');
  if (firstQc) firstQc.classList.add('active');
  renderFeatured();
  renderProperties();
  initSearch();
  applyURLParams();
}

/* Featured cards */
function renderFeatured() {
  const el = document.getElementById('featuredList');
  if (!el) return;
  const list = allProperties.filter(p => p.featured).slice(0, 8);
  el.innerHTML = list.map(p => {
    const imgs = getPropImages(p);
    const isFav = favorites.includes(p.id);
    const isSale = p.type === 'sale';
    const specs = p.rooms > 0
      ? `<div class="featured-specs">
           <div class="featured-spec"><i class="fas fa-door-open"></i>${p.rooms}</div>
           <div class="featured-spec"><i class="fas fa-bath"></i>${p.bathrooms}</div>
           <div class="featured-spec"><i class="fas fa-expand-arrows-alt"></i>${p.area}م²</div>
         </div>`
      : `<div class="featured-specs"><div class="featured-spec"><i class="fas fa-expand-arrows-alt"></i>${p.area}م²</div></div>`;
    return `
    <div class="featured-card" onclick="gotoDetails(${p.id})">
      <div class="featured-img">
        <img src="${imgs[0]}" alt="${p.title}" loading="lazy" onerror="this.src='${FALLBACK}'">
        <div class="featured-overlay"></div>
        <span class="card-badge ${isSale ? 'badge-sale' : 'badge-rent'}" style="position:absolute;top:9px;right:9px">
          <i class="fas fa-${isSale ? 'tag' : 'key'}"></i> ${isSale ? 'للبيع' : 'للإيجار'}
        </span>
        <button class="featured-fav ${isFav ? 'active' : ''}" data-fid="${p.id}" onclick="toggleFav(event,${p.id})">
          <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
        </button>
        ${imgs.length > 1 ? `<span style="position:absolute;bottom:8px;right:10px;background:rgba(0,0,0,0.55);color:white;font-size:0.63rem;font-weight:700;padding:2px 7px;border-radius:99px"><i class="fas fa-images" style="margin-left:3px"></i>${imgs.length}</span>` : ''}
      </div>
      <div class="featured-body">
        <div class="featured-price">$${fmtNum(p.price)}<span style="font-size:0.68rem;color:var(--gray);font-weight:400"> USD${p.type === 'rent' ? '/شهر' : ''}</span></div>
        <div class="featured-title">${p.title}</div>
        <div class="featured-loc"><i class="fas fa-map-marker-alt" style="color:var(--accent)"></i>${p.location}</div>
        ${specs}
      </div>
    </div>`;
  }).join('');
}

/* Property card with swipe gallery */
function makeCard(p, i) {
  const imgs = getPropImages(p);
  const isFav = favorites.includes(p.id);
  const isSale = p.type === 'sale';
  const per = p.type === 'rent' ? '/شهر' : '';
  const specs = p.rooms > 0
    ? `<div class="spec-item"><i class="fas fa-door-open"></i>${p.rooms} غ</div>
       <div class="spec-item"><i class="fas fa-bath"></i>${p.bathrooms}</div>`
    : '';
  const uid = 'c' + p.id;
  const imgTrack = imgs.length > 1
    ? `<div class="card-swipe-wrap" id="sw_${uid}">
         <div class="card-swipe-track" id="tr_${uid}">
           ${imgs.map(src => `<div class="card-swipe-slide"><img src="${src}" alt="${p.title}" loading="lazy" onerror="this.src='${FALLBACK}'"></div>`).join('')}
         </div>
         <div class="card-swipe-dots" id="dt_${uid}">
           ${imgs.map((_, j) => `<span class="csd${j === 0 ? ' on' : ''}"></span>`).join('')}
         </div>
       </div>`
    : `<div class="card-swipe-wrap"><div class="card-swipe-track"><div class="card-swipe-slide"><img src="${imgs[0]}" alt="${p.title}" loading="lazy" onerror="this.src='${FALLBACK}'"></div></div></div>`;

  return `
  <div class="property-card" onclick="gotoDetails(${p.id})" style="animation:fadeUp 0.4s ${i * 0.05}s both">
    <div style="position:relative;overflow:hidden;height:200px;background:var(--gray-light)">
      ${imgTrack}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.52) 0%,transparent 50%);pointer-events:none"></div>
      <div style="position:absolute;top:10px;right:10px;display:flex;gap:5px;z-index:5;pointer-events:none">
        <span class="card-badge ${isSale ? 'badge-sale' : 'badge-rent'}">
          <i class="fas fa-${isSale ? 'tag' : 'key'}"></i>${isSale ? 'للبيع' : 'للإيجار'}
        </span>
        ${p.featured ? '<span class="card-badge badge-featured"><i class="fas fa-star"></i>مميز</span>' : ''}
      </div>
      <button class="card-fav-btn ${isFav ? 'active' : ''}" data-fid="${p.id}" onclick="toggleFav(event,${p.id})" style="z-index:5">
        <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
      </button>
      <div style="position:absolute;bottom:10px;right:12px;color:white;font-weight:900;font-size:1rem;text-shadow:0 2px 8px rgba(0,0,0,0.6);z-index:5;pointer-events:none">
        $${fmtNum(p.price)}<span style="font-size:0.65rem;opacity:0.85"> USD${per}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="card-title">${p.title}</div>
      <div class="card-location"><i class="fas fa-map-marker-alt"></i>${p.location}</div>
      <div class="card-specs">
        ${specs}
        <div class="spec-item"><i class="fas fa-expand-arrows-alt"></i>${p.area}م²</div>
      </div>
    </div>
  </div>`;
}

/* Swipe init */
function initCardSwipes() {
  document.querySelectorAll('[id^="sw_"]').forEach(wrap => {
    const uid = wrap.id.slice(3);
    const track = document.getElementById('tr_' + uid);
    const dotsEl = document.getElementById('dt_' + uid);
    if (!track) return;
    const slides = track.querySelectorAll('.card-swipe-slide');
    if (slides.length < 2) return;
    let cur = 0, startX = 0, dragging = false, moved = false;

    function goTo(idx) {
      if (idx < 0) idx = 0;
      if (idx >= slides.length) idx = slides.length - 1;
      cur = idx;
      track.style.transform = 'translateX(' + (idx * -100) + '%)';
      if (dotsEl) {
        dotsEl.querySelectorAll('.csd').forEach((d, j) => d.classList.toggle('on', j === cur));
      }
    }
    wrap.addEventListener('touchstart', e => { startX = e.touches[0].clientX; dragging = true; moved = false; }, { passive: true });
    wrap.addEventListener('touchmove', e => { if (!dragging) return; moved = Math.abs(e.touches[0].clientX - startX) > 8; }, { passive: true });
    wrap.addEventListener('touchend', e => {
      if (!dragging) return; dragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? cur + 1 : cur - 1);
    });
    wrap.addEventListener('click', e => { if (moved) e.stopPropagation(); });
  });
}

function renderProperties(arr) {
  const list = document.getElementById('propertiesList');
  if (!list) return;
  const data = arr !== undefined ? arr : filteredProperties;
  const cnt = document.getElementById('resultsCount');
  if (cnt) cnt.textContent = data.length + ' نتيجة';
  if (!data.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fas fa-search"></i>
      <p style="font-weight:700;margin-bottom:6px">لا توجد نتائج</p>
      <p style="font-size:0.82rem">جرب تعديل الفلاتر</p></div>`;
    return;
  }
  list.innerHTML = data.map((p, i) => makeCard(p, i)).join('');
  setTimeout(initCardSwipes, 60);
}

/* ─────────────────────────────
   FILTERS
───────────────────────────────*/
function setActiveType(type, el) {
  activeType = type;
  document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active', 'active-sale', 'active-rent'));
  if (el) {
    el.classList.add('active');
    if (type === 'sale') el.classList.add('active-sale');
    if (type === 'rent') el.classList.add('active-rent');
  }
  runFilters();
}
function setActiveSubtype(st, el) {
  activeSubtype = st;
  document.querySelectorAll('.subtype-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  runFilters();
}
function filterData(cat, el) {
  activeCategory = cat;
  document.querySelectorAll('.cat-tile').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  runFilters();
}
function runFilters() {
  let arr = allProperties.filter(p => {
    if (activeType !== 'all' && p.type !== activeType) return false;
    if (activeSubtype !== 'all' && (p.subtype || 'residential') !== activeSubtype) return false;
    /* Category filter: support comma-separated values for multi-match */
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.title.toLowerCase().includes(q) &&
        !p.location.toLowerCase().includes(q) &&
        !(p.city || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  arr = applyExtFilters(arr);
  filteredProperties = arr;
  sortData();
  renderProperties();
  renderFeatured();
}
function sortData() {
  switch (currentSort) {
    case 'price-asc':  filteredProperties.sort((a, b) => a.price - b.price); break;
    case 'price-desc': filteredProperties.sort((a, b) => b.price - a.price); break;
    case 'area':       filteredProperties.sort((a, b) => b.area - a.area); break;
    case 'featured':   filteredProperties.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
    default:           filteredProperties.sort((a, b) => b.id - a.id); break;
  }
}
function changeSort(v) { currentSort = v; runFilters(); }
function setView(type) {
  const list = document.getElementById('propertiesList');
  if (!list) return;
  if (type === 'grid') list.classList.add('grid-2'); else list.classList.remove('grid-2');
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === type));
}

/* ─────────────────────────────
   SEARCH
───────────────────────────────*/
function initSearch() {
  const inp = document.getElementById('searchInput');
  const box = document.getElementById('searchSuggestions');
  if (!inp || !box) return;
  inp.addEventListener('input', () => {
    searchQuery = inp.value.trim();
    const q = searchQuery.toLowerCase();
    if (!q) { box.style.display = 'none'; runFilters(); return; }
    const hits = [
      ...allProperties
        .filter(p => p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q))
        .slice(0, 3)
        .map(p => ({ text: p.title, sub: p.location, icon: 'fa-building', id: p.id })),
      ...SYRIAN_CITIES
        .filter(c => c.includes(q))
        .slice(0, 3)
        .map(c => ({ text: c, sub: 'مدينة سورية', icon: 'fa-map-marker-alt' }))
    ].slice(0, 6);
    if (!hits.length) { box.style.display = 'none'; }
    else {
      box.style.display = 'block';
      box.innerHTML = hits.map(h =>
        `<div class="suggestion-item" onclick="${h.id ? `gotoDetails(${h.id})` : `pickSuggestion('${h.text}')`}">
           <i class="fas ${h.icon}"></i>
           <div><div style="font-weight:600;font-size:0.86rem">${h.text}</div>
           <div style="font-size:0.7rem;color:var(--gray)">${h.sub}</div></div>
         </div>`).join('');
    }
    runFilters();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.hero-search-wrap')) box.style.display = 'none';
  });
}
function pickSuggestion(text) {
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = text;
  searchQuery = text;
  const box = document.getElementById('searchSuggestions');
  if (box) box.style.display = 'none';
  runFilters();
}

/* Apply URL params from filter.html */
function applyURLParams() {
  const params = new URLSearchParams(location.search);
  const t = params.get('type') || 'all';
  const st = params.get('subtype') || 'all';
  const cat = params.get('category') || 'all';
  const city = params.get('city') || '';
  const sort = params.get('sort') || 'newest';
  const mn = parseFloat(params.get('minPrice') || '0');
  const mx = parseFloat(params.get('maxPrice') || '0');
  const mna = parseFloat(params.get('minArea') || '0');
  const mxa = parseFloat(params.get('maxArea') || '0');
  const rooms = parseInt(params.get('rooms') || '0');
  const baths = parseInt(params.get('baths') || '0');
  const furnished = params.get('furnished') === '1';
  const pool = params.get('pool') === '1';
  const featured = params.get('featured') === '1';

  activeType = t;
  const tabMap = { all: 'tabAll', sale: 'tabSale', rent: 'tabRent' };
  Object.entries(tabMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active', 'active-sale', 'active-rent');
    if (key === t) {
      el.classList.add('active');
      if (t === 'sale') el.classList.add('active-sale');
      if (t === 'rent') el.classList.add('active-rent');
    }
  });
  activeSubtype = st;
  activeCategory = cat;
  if (sort) currentSort = sort;
  window._extFilter = { city, mn, mx, mna, mxa, rooms, baths, furnished, pool, featured };
  runFilters();
}

function applyExtFilters(arr) {
  const f = window._extFilter;
  if (!f) return arr;
  return arr.filter(p => {
    if (f.city && (p.city || '') !== f.city) return false;
    if (f.mn > 0 && p.price < f.mn) return false;
    if (f.mx > 0 && p.price > f.mx) return false;
    if (f.mna > 0 && p.area < f.mna) return false;
    if (f.mxa > 0 && p.area > f.mxa) return false;
    if (f.rooms > 0 && (p.rooms || 0) < f.rooms) return false;
    if (f.baths > 0 && (p.bathrooms || 0) < f.baths) return false;
    if (f.furnished && !p.furnished) return false;
    if (f.featured && !p.featured) return false;
    return true;
  });
}

/* ─────────────────────────────
   QUICK FILTER (category strip on index)
───────────────────────────────*/
function quickFilter(type, cat, el) {
  /* Update active state on the strip */
  document.querySelectorAll('.qc-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  /* Update type tabs */
  activeType = type;
  activeCategory = cat;
  document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active', 'active-sale', 'active-rent'));
  const tabMap = { all: 'tabAll', sale: 'tabSale', rent: 'tabRent' };
  const tid = tabMap[type];
  if (tid) {
    const tab = document.getElementById(tid);
    if (tab) {
      tab.classList.add('active');
      if (type === 'sale') tab.classList.add('active-sale');
      if (type === 'rent') tab.classList.add('active-rent');
    }
  }
  runFilters();
  /* Smooth scroll to results */
  const list = document.getElementById('propertiesList');
  if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─────────────────────────────
   NAVIGATION
───────────────────────────────*/
function gotoDetails(id) {
  localStorage.setItem('aqari_selected', id);
  location.href = 'details.html';
}
function markNavActive(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
}

/* ─────────────────────────────
   FAVORITES
───────────────────────────────*/
function toggleFav(ev, id) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const i = favorites.indexOf(id);
  if (i === -1) { favorites.push(id); showToast('تمت الإضافة للمفضلة'); }
  else { favorites.splice(i, 1); showToast('تمت الإزالة من المفضلة'); }
  window.favorites = favorites;
  saveData();
  document.querySelectorAll(`[data-fid="${id}"]`).forEach(btn => {
    const on = favorites.includes(id);
    btn.classList.toggle('active', on);
    const ic = btn.querySelector('i'); if (ic) ic.className = `fa${on ? 's' : 'r'} fa-heart`;
  });
  if (getPage() === 'favorites') renderFavorites();
}
function renderFavorites() {
  const list = document.getElementById('favoritesList');
  if (!list) return;
  const fp = allProperties.filter(p => favorites.includes(p.id));
  if (!fp.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="far fa-heart"></i>
      <p style="font-weight:700;margin-bottom:8px">لا توجد مفضلة</p>
      <a href="index.html" style="display:inline-block;margin-top:12px;padding:10px 22px;background:var(--accent);color:white;border-radius:10px;text-decoration:none;font-weight:700">استعرض العقارات</a>
    </div>`; return;
  }
  list.innerHTML = fp.map((p, i) => makeCard(p, i)).join('');
  setTimeout(initCardSwipes, 60);
}
function clearAllFavorites() {
  if (!favorites.length) { showToast('لا توجد مفضلة'); return; }
  if (!confirm('مسح جميع المفضلة؟')) return;
  favorites = []; window.favorites = favorites; saveData(); renderFavorites(); showToast('تم المسح');
}

/* ─────────────────────────────
   DETAILS
───────────────────────────────*/
let detIdx = 0, detTotal = 0;

function renderDetails() {
  const id = parseInt(localStorage.getItem('aqari_selected'));
  const p = allProperties.find(x => x.id === id);
  const box = document.querySelector('.details-container');
  if (!box) return;
  if (!p) {
    box.innerHTML = `<div class="empty-state"><i class="fas fa-home"></i><p>العقار غير موجود</p>
    <a href="index.html" style="display:inline-block;margin-top:14px;padding:10px 22px;background:var(--accent);color:white;border-radius:10px;text-decoration:none;font-weight:700">العودة</a></div>`;
    return;
  }
  const imgs = getPropImages(p);
  detIdx = 0; detTotal = imgs.length;
  const isFav = favorites.includes(p.id);
  const isSale = p.type === 'sale';
  const blabel = isSale ? 'للبيع' : 'للإيجار';
  const nearby = allProperties.filter(x => x.id !== p.id && x.city === p.city).slice(0, 5);

  const gal = `
  <div class="det-gallery" id="detGallery">
    <div class="det-gallery-track" id="detTrack">
      ${imgs.map((src, i) => `<div class="det-slide">
        <img src="${src}" alt="${p.title}" onerror="this.src='${FALLBACK}'">
      </div>`).join('')}
    </div>
    <button class="det-back" onclick="history.back()"><i class="fas fa-arrow-right"></i></button>
    <div class="det-top-right">
      <button class="det-action-btn" onclick="shareProp()"><i class="fas fa-share-alt"></i></button>
      <button class="det-action-btn ${isFav ? 'active' : ''}" data-fid="${p.id}" onclick="toggleFav(event,${p.id})">
        <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
      </button>
    </div>
    ${imgs.length > 1 ? `
    <div class="det-dots" id="detDots">
      ${imgs.map((_, i) => `<span class="det-dot${i === 0 ? ' active' : ''}" onclick="detGoSlide(${i})"></span>`).join('')}
    </div>
    <div class="det-counter" id="detCounter">1 / ${imgs.length}</div>
    <button class="det-nav det-prev" onclick="detGalleryPrev()"><i class="fas fa-chevron-right"></i></button>
    <button class="det-nav det-next" onclick="detGalleryNext()"><i class="fas fa-chevron-left"></i></button>` : ''}
    <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;z-index:10;white-space:nowrap">
      <span style="display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:99px;font-size:0.78rem;font-weight:800;backdrop-filter:blur(12px);box-shadow:0 3px 16px rgba(0,0,0,0.35);background:${isSale ? 'rgba(27,153,86,0.96)' : 'rgba(31,110,170,0.96)'};color:white">
        <i class="fas fa-${isSale ? 'tag' : 'key'}"></i>${blabel}
      </span>
      ${p.featured ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:99px;font-size:0.78rem;font-weight:800;backdrop-filter:blur(12px);box-shadow:0 3px 16px rgba(0,0,0,0.35);background:rgba(210,100,20,0.96);color:white"><i class="fas fa-star"></i>مميز</span>` : ''}
    </div>
  </div>`;

  const specs = p.rooms > 0
    ? `<div class="specs-grid">
         <div class="spec-card"><i class="fas fa-door-open"></i><span class="spec-val">${p.rooms}</span><span class="spec-lbl">غرفة</span></div>
         <div class="spec-card"><i class="fas fa-bath"></i><span class="spec-val">${p.bathrooms}</span><span class="spec-lbl">حمام</span></div>
         <div class="spec-card"><i class="fas fa-expand-arrows-alt"></i><span class="spec-val">${p.area}</span><span class="spec-lbl">م²</span></div>
         <div class="spec-card"><i class="fas fa-calendar-alt"></i><span class="spec-val">${p.age || 0}</span><span class="spec-lbl">سنة</span></div>
         <div class="spec-card"><i class="fas fa-couch"></i><span class="spec-val">${p.furnished ? 'نعم' : 'لا'}</span><span class="spec-lbl">مفروش</span></div>
         <div class="spec-card"><i class="fas fa-eye"></i><span class="spec-val">${(p.views || 0).toLocaleString()}</span><span class="spec-lbl">مشاهدة</span></div>
       </div>`
    : `<div class="specs-grid">
         <div class="spec-card"><i class="fas fa-expand-arrows-alt"></i><span class="spec-val">${p.area}</span><span class="spec-lbl">م²</span></div>
         <div class="spec-card"><i class="fas fa-eye"></i><span class="spec-val">${(p.views || 0).toLocaleString()}</span><span class="spec-lbl">مشاهدة</span></div>
       </div>`;

  box.innerHTML = gal + `
  <div class="det-body">
    <div class="det-price">$${fmtNum(p.price)} USD ${p.type === 'rent' ? '<span style="font-size:0.82rem;color:var(--gray);font-weight:400">/شهرياً</span>' : ''}</div>
    <div class="det-title">${p.title}</div>
    <div class="det-loc"><i class="fas fa-map-marker-alt"></i>${p.location}</div>
    ${specs}
    <div class="section-title"><i class="fas fa-align-right"></i>وصف العقار</div>
    <p class="det-desc">${p.description || 'لا يوجد وصف.'}</p>
    ${p.features && p.features.length ? `
    <div class="section-title"><i class="fas fa-star"></i>المميزات</div>
    <div class="features-list">${p.features.map(f => `<span class="feature-tag"><i class="fas fa-check"></i>${f}</span>`).join('')}</div>` : ''}
    <div class="section-title"><i class="fas fa-map-marked-alt"></i>الموقع</div>
    <div id="detMapWrap"></div>
    <div class="section-title"><i class="fas fa-user-tie"></i>المعلن</div>
    <div class="agent-card">
      <div class="agent-avatar"><i class="fas fa-user"></i></div>
      <div class="agent-info">
        <div class="agent-name">${p.agentName || 'مالك العقار'}</div>
        <div class="agent-label">مالك مباشر</div>
        ${p.agentVerified ? '<div class="agent-badge"><i class="fas fa-shield-alt"></i> موثق</div>' : ''}
      </div>
    </div>
    <div class="contact-section" style="margin-top:14px">
      <a href="tel:+${p.phone || ''}" class="btn-call"><i class="fas fa-phone"></i> اتصال</a>
      <a href="https://wa.me/${p.phone || ''}?text=${encodeURIComponent('مرحباً، رأيت إعلانك: ' + p.title)}" class="btn-whatsapp" target="_blank"><i class="fab fa-whatsapp"></i> واتساب</a>
      <button class="btn-chat" onclick="startChatWith('${(p.agentName || 'المعلن').replace(/'/g, "\\'")}','${p.id}','${p.title.replace(/'/g, "\\'")}')"><i class="fas fa-comment-dots"></i></button>
    </div>
    ${(typeof getCurrentUser !== 'undefined' && getCurrentUser() && (getCurrentUser().uid === p.ownerUID)) ? `
    <button onclick="deleteMyProperty('${p.firestoreId || p.id}')" style="width:100%;margin-top:12px;padding:12px;background:rgba(231,76,60,0.1);border:1.5px solid rgba(231,76,60,0.4);color:var(--danger);border-radius:12px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:6px">
      <i class="fas fa-trash-alt"></i> حذف إعلاني
    </button>` : ''}
    ${nearby.length ? `
    <div class="section-title" style="margin-top:20px"><i class="fas fa-th-large"></i>قريبة في ${p.city}</div>
    <div class="similar-scroll">
      ${nearby.map(n => { const ni = getPropImages(n); return `
        <div class="similar-card" onclick="gotoDetails(${n.id})">
          <div class="similar-img"><img src="${ni[0]}" alt="${n.title}" onerror="this.src='${FALLBACK}'"></div>
          <div class="similar-body">
            <div class="similar-price">$${fmtNum(n.price)} USD</div>
            <div class="similar-title">${n.title.substring(0, 30)}${n.title.length > 30 ? '...' : ''}</div>
          </div>
        </div>`; }).join('')}
    </div>` : ''}
  </div>`;

  if (imgs.length > 1) initGallerySwipe();
  setTimeout(() => buildMap(p), 400);
}

function initGallerySwipe() {
  detIdx = 0;
  const gal = document.getElementById('detGallery');
  if (!gal) return;
  let sx = 0;
  gal.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  gal.addEventListener('touchend', e => { const d = sx - e.changedTouches[0].clientX; if (Math.abs(d) > 40) d > 0 ? detGalleryNext() : detGalleryPrev(); });
  gal.addEventListener('mousedown', e => { sx = e.clientX; });
  gal.addEventListener('mouseup', e => { const d = sx - e.clientX; if (Math.abs(d) > 40) d > 0 ? detGalleryNext() : detGalleryPrev(); });
}
function detGoSlide(i) {
  detIdx = i;
  const tr = document.getElementById('detTrack');
  const ctr = document.getElementById('detCounter');
  if (tr) tr.style.transform = `translateX(${i * 100}%)`;
  if (ctr) ctr.textContent = `${i + 1} / ${detTotal}`;
  document.querySelectorAll('.det-dot').forEach((d, j) => d.classList.toggle('active', j === i));
}
function detGalleryNext() { if (detIdx < detTotal - 1) detGoSlide(detIdx + 1); }
function detGalleryPrev() { if (detIdx > 0) detGoSlide(detIdx - 1); }

function buildMap(p) {
  const box = document.getElementById('detMapWrap');
  if (!box) return;
  const cc = CITY_COORDS[p.city] || CITY_COORDS['دمشق'];
  const lat = p.lat || cc.lat, lng = p.lng || cc.lng;
  const propId = p.id;
  box.innerHTML = `
  <div style="border-radius:14px;overflow:hidden;box-shadow:var(--shadow-md);position:relative;margin-bottom:4px">
    <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${lng - .012}%2C${lat - .012}%2C${lng + .012}%2C${lat + .012}&layer=mapnik&marker=${lat}%2C${lng}"
      style="width:100%;height:210px;border:none;display:block" loading="lazy"></iframe>
    <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.75),transparent);padding:8px;display:flex;gap:6px">
      <button onclick="localStorage.setItem('aqari_map_prop','${propId}');localStorage.setItem('aqari_selected','${propId}');location.href='map.html'" style="flex:1;background:var(--accent);color:white;border:none;border-radius:8px;padding:8px;font-size:0.74rem;font-weight:700;cursor:pointer;font-family:var(--font)">
        <i class="fas fa-expand-alt"></i> الخريطة الكاملة
      </button>
      <a href="https://maps.google.com/maps?q=${lat},${lng}" target="_blank"
        style="background:white;border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:4px;text-decoration:none;color:#333;font-weight:700;font-size:0.74rem">
        <i class="fas fa-directions" style="color:#4285F4"></i>
      </a>
    </div>
  </div>`;
}

function deleteMyProperty(propId) {
  if (!confirm('⚠️ هل أنت متأكد من حذف هذا الإعلان؟ لا يمكن التراجع.')) return;
  if (typeof fbDeleteProperty === 'undefined') {
    showToast('❌ خطأ في الاتصال');
    return;
  }
  showToast('⏳ جاري الحذف...');
  fbDeleteProperty(propId).then(function(res) {
    if (res.success) {
      showToast('✅ تم حذف الإعلان بنجاح');
      setTimeout(function() { window.location.href = 'index.html'; }, 1200);
    } else {
      showToast('❌ فشل الحذف: ' + (res.error || ''));
    }
  });
}
window.deleteMyProperty = deleteMyProperty;

function shareProp() {
  if (navigator.share) navigator.share({ title: document.title, url: location.href });
  else { navigator.clipboard?.writeText(location.href); showToast('تم نسخ الرابط'); }
}

/* ═══════════════════════════════════════════════════════
   IMAGE UPLOAD — نظام رفع الصور (مُعاد كتابته بالكامل)
═══════════════════════════════════════════════════════ */

// مصفوفة الصور المرفوعة
window.UPLOAD_IMGS = window.UPLOAD_IMGS || [];

// الدالة الرئيسية - تُستدعى عند اختيار ملفات
function handleImagesUpload(input) {
  var files = input.files;
  if (!files || !files.length) return;

  var remaining = 6 - (window.UPLOAD_IMGS.length);
  if (remaining <= 0) {
    showToast('الحد الأقصى 6 صور');
    return;
  }

  var toProcess = Math.min(files.length, remaining);
  var processed = 0;
  var added = 0;

  // أظهر رسالة تحميل
  showToast('⏳ جاري معالجة الصور...');

  function processNext(index) {
    if (index >= toProcess) {
      // انتهى المعالجة
      if (added > 0) {
        renderImgGrid();
        showToast('✅ تمت إضافة ' + added + ' صورة');
      } else {
        showToast('❌ تعذر معالجة الصور، حاول مجدداً');
      }
      // إعادة تعيين حقل الملف
      try { input.value = ''; } catch(e) {}
      return;
    }

    var file = files[index];
    if (!file || !file.type.match(/^image\//)) {
      processNext(index + 1);
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        processNext(index + 1);
        return;
      }

      // ضغط الصورة بـ Canvas
      var img = new Image();
      img.onload = function() {
        try {
          var MAX = 900;
          var w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            var r = Math.min(MAX/w, MAX/h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var compressed = canvas.toDataURL('image/jpeg', 0.80);
          if (compressed && compressed.startsWith('data:') && window.UPLOAD_IMGS.length < 6) {
            window.UPLOAD_IMGS.push(compressed);
            added++;
          }
        } catch(canvasErr) {
          // إذا فشل Canvas، استخدم الصورة الأصلية
          if (window.UPLOAD_IMGS.length < 6) {
            window.UPLOAD_IMGS.push(dataUrl);
            added++;
          }
        }
        processNext(index + 1);
      };
      img.onerror = function() {
        // استخدام dataUrl مباشرةً
        if (window.UPLOAD_IMGS.length < 6) {
          window.UPLOAD_IMGS.push(dataUrl);
          added++;
        }
        processNext(index + 1);
      };
      img.src = dataUrl;
    };
    reader.onerror = function() {
      processNext(index + 1);
    };
    reader.readAsDataURL(file);
  }

  processNext(0);
}

// عرض شبكة الصور المضافة
function renderImgGrid() {
  var imgs = window.UPLOAD_IMGS || [];
  var grid = document.getElementById('imgPreviewGrid');
  var gallery = document.getElementById('imgGallery');
  var countNum = document.getElementById('imgCountNum');
  var addMoreBtn = document.getElementById('addMoreBtn');
  var uploadZone = document.getElementById('uploadZone');

  if (!grid) return;

  if (!imgs.length) {
    grid.innerHTML = '';
    if (gallery) gallery.style.display = 'none';
    if (uploadZone) uploadZone.style.display = 'block';
    if (addMoreBtn) addMoreBtn.style.display = 'none';
    return;
  }

  var html = '';
  for (var i = 0; i < imgs.length; i++) {
    html += '<div style="aspect-ratio:1;border-radius:11px;overflow:hidden;position:relative;background:#f1f5f9;box-shadow:0 2px 8px rgba(0,0,0,0.1)">';
    html += '<img src="' + imgs[i] + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="صورة ' + (i+1) + '">';
    html += '<button type="button" onclick="event.stopPropagation();removeImg(' + i + ')" style="position:absolute;top:5px;right:5px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.65);border:none;cursor:pointer;color:white;font-size:0.65rem;display:flex;align-items:center;justify-content:center;z-index:5"><i class="fas fa-times"></i></button>';
    if (i === 0) html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(249,115,22,0.9),transparent);color:white;font-size:0.58rem;text-align:center;padding:7px 4px 4px;font-weight:800">رئيسية</div>';
    html += '</div>';
  }
  grid.innerHTML = html;

  if (countNum) countNum.textContent = imgs.length;
  if (gallery) gallery.style.display = 'block';
  if (uploadZone) uploadZone.style.display = imgs.length >= 6 ? 'none' : 'block';
  if (addMoreBtn) addMoreBtn.style.display = imgs.length < 6 ? 'block' : 'none';
}

// حذف صورة واحدة
function removeImg(i) {
  if (!window.UPLOAD_IMGS || i < 0 || i >= window.UPLOAD_IMGS.length) return;
  window.UPLOAD_IMGS.splice(i, 1);
  renderImgGrid();
  showToast('تم حذف الصورة');
}

// حذف جميع الصور
function clearAllImgs() {
  if (!window.UPLOAD_IMGS || !window.UPLOAD_IMGS.length) {
    showToast('لا توجد صور لحذفها');
    return;
  }
  if (confirm('حذف جميع الصور؟')) {
    window.UPLOAD_IMGS = [];
    renderImgGrid();
    showToast('تم مسح جميع الصور');
  }
}

// تصدير الدوال عالمياً
window.handleImagesUpload = handleImagesUpload;
window.renderImgGrid     = renderImgGrid;
window.removeImg         = removeImg;
window.clearAllImgs      = clearAllImgs;

/* ═══════════════════════════════════════════════════════
   PUBLISH PROPERTY
   - Saves images separately under aqari_imgs_{id}
   - Sets featured:true for properties with uploaded images
═══════════════════════════════════════════════════════ */
function publishProperty() {
  const btn = document.querySelector('#paymentModal .btn-publish');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left:8px"></i> جاري النشر...';
  }

  setTimeout(async () => {
    try {
      const val = (id, def = '') => {
        const el = document.getElementById(id);
        return el ? (el.value || def) : def;
      };
      const ival = (id, def = 0) => parseInt(val(id, def)) || def;
      const fval = (id, def = 0) => parseFloat(val(id, def)) || def;

      const city = val('propCity', 'دمشق').trim() || 'دمشق';
      const cc = CITY_COORDS[city] || CITY_COORDS['دمشق'];
      const lat0 = parseFloat(localStorage.getItem('pending_lat') || '0');
      const lng0 = parseFloat(localStorage.getItem('pending_lng') || '0');
      localStorage.removeItem('pending_lat');
      localStorage.removeItem('pending_lng');

      const nbhd = val('propNeighborhood', '').trim();
      const title0 = val('propTitle', '').trim();
      const catVal = val('propCategory', 'apartment');
      const catNames = { apartment: 'شقة', villa: 'فيلا', house: 'دار عربي', palace: 'قصر', land: 'أرض', commercial: 'محل تجاري', office: 'مكتب', warehouse: 'مستودع', building: 'مبنى' };
      const catTxt = catNames[catVal] || 'عقار';
      const typeV = val('propType', 'sale');
      const stV = val('propSubtype', 'residential');

      const feats = [];
      document.querySelectorAll('.chip.on').forEach(el => {
        const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
        if (t) feats.push(t);
      });
      document.querySelectorAll('.amn-item.selected').forEach(el => {
        const t = (el.dataset.name || el.textContent || '').trim().replace(/\s+/g, ' ');
        if (t) feats.push(t);
      });

      const price = fval('propPrice', 0);
      const area = fval('propArea', 0);
      if (!price || !area) {
        showToast('يرجى إدخال السعر والمساحة');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle" style="margin-left:8px"></i>ادفع وانشر الإعلان'; }
        return;
      }

      /* Uploaded images from window.UPLOAD_IMGS */
      const uploadedImgs = (window.UPLOAD_IMGS && window.UPLOAD_IMGS.length > 0)
        ? [...window.UPLOAD_IMGS]
        : [];

      const hasRealImages = uploadedImgs.length > 0;
      const propId = Date.now();

      /* ── Save images to their own storage key BEFORE creating the property ── */
      if (hasRealImages) {
        _savePropImages(propId, uploadedImgs);
      }

      const newProp = {
        id:          propId,
        type:        typeV,
        subtype:     stV,
        category:    catVal,
        title:       title0 || (catTxt + (nbhd ? ' في ' + nbhd : ' في ' + city)),
        price,
        area,
        rooms:       ival('propRooms', 0),
        bathrooms:   ival('propBathrooms', 0),
        age:         ival('propAge', 0),
        location:    city + (nbhd ? '، ' + nbhd : ''),
        city,
        phone:       val('propPhone', '').trim(),
        /* No images stored inline — they live in aqari_imgs_{id} */
        featured:    hasRealImages, /* auto-featured if real images uploaded */
        furnished:   feats.some(f => f.includes('مفروش')),
        description: val('propDescription', '').trim(),
        features:    feats.filter(Boolean),
        views:       0,
        postedAt:    new Date().toISOString().split('T')[0],
        agentName:   localStorage.getItem('userName') || 'أنت',
        agentVerified: false,
        lat: lat0 || (cc.lat + (Math.random() - 0.5) * 0.02),
        lng: lng0 || (cc.lng + (Math.random() - 0.5) * 0.02)
      };

      myProperties.push(newProp);
      syncAll();
      saveData();

      // ═══ حفظ في Firebase Firestore مباشرةً ═══
      if (typeof fbAddProperty !== 'undefined') {
        try {
          const user = typeof getCurrentUser !== 'undefined' ? getCurrentUser() : null;
          const fbProp = {
            title:       newProp.title,
            price:       newProp.price,
            type:        newProp.type,
            category:    newProp.category,
            city:        newProp.city,
            location:    newProp.location,
            area:        newProp.area,
            rooms:       newProp.rooms,
            bathrooms:   newProp.bathrooms,
            floor:       newProp.floor || 0,
            description: newProp.description,
            features:    newProp.features,
            phone:       newProp.phone,
            lat:         newProp.lat,
            lng:         newProp.lng,
            featured:    newProp.featured,
            ownerUID:    user ? user.uid : '',
            ownerName:   user ? (user.name || 'مستخدم') : 'مستخدم',
            ownerPhone:  newProp.phone,
            images:      uploadedImgs,
            active:      true,
            views:       0,
          };
          await fbAddProperty(fbProp, uploadedImgs);
          console.log('[عقاري] ✅ Saved to Firestore');
        } catch(fbErr) {
          console.warn('[عقاري] Firebase save warning:', fbErr);
        }
      }
      // ══════════════════════════════════════════

      addNotif({
        type: 'new',
        title: 'تم نشر إعلانك!',
        body: newProp.title,
        icon: 'fa-check-circle',
        color: '#27ae60',
        link: 'index.html'
      });

      window.UPLOAD_IMGS = [];

      const m = document.getElementById('paymentModal');
      if (m) { m.classList.remove('show'); document.body.style.overflow = ''; }

      showToast('🎉 تم نشر إعلانك بنجاح!');
      setTimeout(() => { location.href = 'index.html'; }, 1300);

    } catch (err) {
      console.error('[publishProperty ERROR]', err);
      showToast('حدث خطأ: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle" style="margin-left:8px"></i>ادفع وانشر الإعلان';
      }
    }
  }, 1200);
}

function showPaymentModal() {
  const pr = document.getElementById('propPrice')?.value;
  const ar = document.getElementById('propArea')?.value;
  const ct = document.getElementById('propCity')?.value;
  const ph = document.getElementById('propPhone')?.value;
  if (!pr || !ar) { showToast('يرجى إدخال السعر والمساحة'); return; }
  if (!ct) { showToast('يرجى اختيار المحافظة'); return; }
  if (!ph) { showToast('يرجى إدخال رقم الهاتف'); return; }
  const m = document.getElementById('paymentModal');
  if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; }
}
function closeModal() {
  const m = document.getElementById('paymentModal'); if (!m) return;
  m.classList.remove('show'); document.body.style.overflow = '';
  const b = m.querySelector('.btn-publish');
  if (b) { b.disabled = false; b.innerHTML = '<i class="fas fa-check-circle" style="margin-left:8px"></i>ادفع وانشر الإعلان'; }
}
function selectPayment(el) {
  document.querySelectorAll('.payment-method').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
}

/* ─────────────────────────────
   CHAT / MESSAGES
───────────────────────────────*/
function getDefaultConvs() {
  return {
    c1: { id: 'c1', name: 'أحمد الخطيب', avatar: 'AK', propTitle: 'فيلا فاخرة في المزة', propId: 1, unread: 2, lastMsg: 'هل العقار لا يزال متاحاً؟', lastTime: '10:32', messages: [{ id: 1, from: 'them', text: 'مرحباً، هل العقار متاح؟', time: '10:15', read: true }, { id: 2, from: 'me', text: 'نعم متاح!', time: '10:20', read: true }, { id: 3, from: 'them', text: 'هل العقار لا يزال متاحاً؟', time: '10:32', read: false }] },
    c2: { id: 'c2', name: 'سارة القاسم', avatar: 'SQ', propTitle: 'شقة مفروشة في أبو رمانة', propId: 2, unread: 0, lastMsg: 'الجمعة الساعة 4 مناسب', lastTime: 'أمس', messages: [{ id: 1, from: 'them', text: 'هل يمكن المعاينة الجمعة؟', time: 'أمس', read: true }, { id: 2, from: 'me', text: 'الجمعة الساعة 4 مناسب', time: 'أمس', read: true }] }
  };
}
function renderConvList() {
  const box = document.getElementById('messagesContainer'); if (!box) return;
  const list = Object.values(conversations_data);
  const unrd = list.reduce((a, c) => a + (c.unread || 0), 0);
  const bdg = document.getElementById('msgBadge');
  if (bdg) { bdg.textContent = unrd || ''; bdg.style.display = unrd ? 'flex' : 'none'; }
  if (!list.length) {
    box.innerHTML = `<div style="text-align:center;padding:60px 16px;color:var(--gray)"><i class="far fa-comment-dots" style="font-size:3rem;display:block;margin-bottom:12px;opacity:0.3"></i><p style="font-weight:700;margin-bottom:6px">لا توجد محادثات</p></div>`; return;
  }
  box.innerHTML = list.map(c => `
    <div class="chat-item" onclick="openConv('${c.id}')">
      <div class="chat-avatar-wrap">
        <div class="chat-avatar">${c.avatar || c.name.charAt(0)}</div>
        ${c.unread > 0 ? '<span class="chat-online-dot"></span>' : ''}
      </div>
      <div class="chat-info">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <div class="chat-name">${c.name}</div><div class="chat-time">${c.lastTime}</div>
        </div>
        <div class="chat-preview">${c.lastMsg}</div>
        <div style="font-size:0.67rem;color:var(--accent);margin-top:2px"><i class="fas fa-building" style="font-size:0.63rem"></i> ${c.propTitle}</div>
      </div>
      ${c.unread > 0 ? `<div class="chat-unread">${c.unread}</div>` : ''}
    </div>`).join('');
}
function openConv(id) { localStorage.setItem('aqari_chat_id', id); location.href = 'chat.html'; }
function startChatWith(name, propId, propTitle) {
  const ex = Object.values(conversations_data).find(c => String(c.propId) === String(propId));
  if (ex) { openConv(ex.id); return; }
  const id = 'c' + Date.now();
  conversations_data[id] = { id, name, avatar: (name || 'م').substring(0, 2), propTitle, propId: parseInt(propId), unread: 0, lastMsg: '', lastTime: 'الآن', messages: [] };
  window.conversations = conversations_data; saveData(); openConv(id);
}
function initChat() {
  const id = localStorage.getItem('aqari_chat_id');
  const conv = id ? conversations_data[id] : null;
  if (!conv) { location.href = 'messages.html'; return; }
  conv.messages.forEach(m => m.read = true); conv.unread = 0; saveData();
  const ne = document.getElementById('chatName'); if (ne) ne.textContent = conv.name;
  const pe = document.getElementById('chatPropTitle'); if (pe) pe.textContent = conv.propTitle;
  const ae = document.getElementById('chatAvatar'); if (ae) ae.textContent = conv.avatar || conv.name.charAt(0);
  drawMessages(conv);
  const inp = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  if (btn && inp) {
    btn.onclick = () => sendMessage(id, inp);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(id, inp); } });
    inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 100) + 'px'; });
  }
}
function drawMessages(conv) {
  const box = document.getElementById('chatMessages'); if (!box) return;
  box.innerHTML = (conv.messages || []).map(m => `
    <div class="msg-row ${m.from === 'me' ? 'msg-me' : 'msg-them'}">
      <div class="msg-bubble ${m.from === 'me' ? 'msg-bubble-me' : 'msg-bubble-them'}">
        ${m.text}
        <span class="msg-time">${m.time}${m.from === 'me' ? ` <i class="fas fa-check${m.read ? '-double' : ''}" style="font-size:0.58rem;margin-right:2px"></i>` : ''}</span>
      </div>
    </div>`).join('');
  box.scrollTop = box.scrollHeight;
}
function sendMessage(id, inp) {
  const text = (inp.value || '').trim(); if (!text) return;
  const conv = conversations_data[id]; if (!conv) return;
  const now = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  conv.messages.push({ id: Date.now(), from: 'me', text, time: now, read: false });
  conv.lastMsg = text; conv.lastTime = 'الآن';
  inp.value = ''; inp.style.height = 'auto';
  saveData(); drawMessages(conv);
  setTimeout(() => {
    const rs = ['شكراً لتواصلك!', 'سيتم الرد قريباً.', 'هل يمكنك تحديد وقت معاينة؟', 'العقار لا يزال متاحاً.'];
    const r = { id: Date.now() + 1, from: 'them', text: rs[Math.floor(Math.random() * rs.length)], time: new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }), read: false };
    conv.messages.push(r); conv.lastMsg = r.text; conv.lastTime = 'الآن';
    saveData(); drawMessages(conv);
    addNotif({ type: 'msg', title: 'رسالة من ' + conv.name, body: r.text, icon: 'fa-comment-dots', color: '#2980b9', link: 'messages.html' });
  }, 1500);
}

/* ─────────────────────────────
   NOTIFICATIONS
───────────────────────────────*/
function getDefaultNotifs() {
  return [
    { id: 1, type: 'fav', title: 'تمت إضافة عقار للمفضلة', body: 'فيلا فاخرة في المزة', icon: 'fa-heart', color: '#e74c3c', time: 'منذ ساعة', read: false, link: 'details.html' },
    { id: 2, type: 'msg', title: 'رسالة جديدة', body: 'هل لا يزال العقار متاحاً؟', icon: 'fa-comment-dots', color: '#2980b9', time: 'منذ ساعتين', read: false, link: 'messages.html' },
    { id: 3, type: 'promo', title: 'عرض خاص!', body: 'انشر إعلانك هذا الأسبوع!', icon: 'fa-tag', color: '#e67e22', time: 'منذ يوم', read: true, link: 'add-property.html' }
  ];
}
function addNotif(n) {
  notifications_data.unshift({ id: Date.now(), ...n, time: 'الآن', read: false });
  saveData(); updateBadge();
}
function updateBadge() {
  const cnt = notifications_data.filter(n => !n.read).length;
  document.querySelectorAll('.notif-badge').forEach(el => { el.textContent = cnt || ''; el.style.display = cnt ? 'flex' : 'none'; });
}
function renderNotifications() {
  const box = document.getElementById('notifContainer'); if (!box) return;
  updateBadge();
  if (!notifications_data.length) {
    box.innerHTML = `<div class="empty-state"><i class="far fa-bell"></i><p style="font-weight:700">لا توجد إشعارات</p></div>`; return;
  }
  box.innerHTML = notifications_data.map(n => `
    <div class="notif-item ${n.read ? '' : 'notif-unread'}" onclick="markNotifRead(${n.id},'${n.link || '#'}')">
      <div class="notif-icon-wrap" style="background:${n.color}22;color:${n.color}"><i class="fas ${n.icon}"></i></div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-body">${n.body}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      ${!n.read ? '<div class="notif-dot"></div>' : ''}
    </div>`).join('');
}
function markNotifRead(id, link) {
  const n = notifications_data.find(x => x.id === id); if (n) n.read = true;
  saveData(); updateBadge();
  if (link && link !== '#') location.href = link;
}
function markAllNotifRead() {
  notifications_data.forEach(n => n.read = true); saveData(); updateBadge(); renderNotifications(); showToast('تم تعليم الكل كمقروء');
}

/* ─────────────────────────────
   PROFILE
───────────────────────────────*/
function renderProfile() {
  const name = localStorage.getItem('userName') || 'مستخدم عقاري';
  const email = localStorage.getItem('userEmail') || '';
  const ne = document.getElementById('profileName'); if (ne) ne.textContent = name;
  const ee = document.getElementById('profileEmail'); if (ee) ee.textContent = email;
  const myAds = myProperties || [];
  ['myAdsCount', 'myAdsCountBadge'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = myAds.length; });
  const fe = document.getElementById('favsCount'); if (fe) fe.textContent = favorites.length;
  const ve = document.getElementById('viewsCount'); if (ve) ve.textContent = myAds.reduce((a, p) => a + (p.views || 0), 0).toLocaleString();
  const sec = document.getElementById('myAdsSection');
  if (sec) {
    if (!myAds.length) {
      sec.innerHTML = `<div class="empty-state" style="padding:16px 0"><i class="fas fa-plus-square" style="font-size:1.8rem;opacity:0.35;margin-bottom:10px"></i><p style="font-size:0.85rem;font-weight:600;margin-bottom:6px">لم تنشر إعلانات بعد</p><a href="add-property.html" style="font-size:0.82rem;color:var(--accent);font-weight:700;text-decoration:none">انشر الأول</a></div>`;
    } else {
      sec.innerHTML = myAds.slice(0, 3).map(p => {
        const img = getPropImages(p)[0];
        return `<div onclick="gotoDetails(${p.id})" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="width:52px;height:52px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--gray-light)"><img src="${img}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${FALLBACK}'"></div>
          <div style="flex:1;overflow:hidden">
            <div style="font-weight:700;font-size:0.87rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.title}</div>
            <div style="font-size:0.77rem;color:var(--accent);font-weight:700;margin-top:2px">$${fmtNum(p.price)} USD</div>
          </div>
          <span style="font-size:0.68rem;background:#27ae60;color:white;padding:3px 8px;border-radius:99px;font-weight:700">نشط</span>
        </div>`;
      }).join('');
    }
  }
  updateBadge();
}

/* ─────────────────────────────
   SETTINGS & AUTH
───────────────────────────────*/
function initSettings() {
  applyTheme(); updateThemeBtn();
  const ni = document.getElementById('settingsName'); if (ni) ni.value = localStorage.getItem('userName') || '';
  const pi = document.getElementById('settingsPhone'); if (pi) pi.value = localStorage.getItem('userPhone') || '';
}
function saveSettings() {
  const n = document.getElementById('settingsName')?.value?.trim();
  const p = document.getElementById('settingsPhone')?.value?.trim();
  if (n) localStorage.setItem('userName', n);
  if (p) localStorage.setItem('userPhone', p);
  showToast('تم حفظ الإعدادات');
}
function handleLogin() {
  const em = document.getElementById('emailInput')?.value;
  const ps = document.getElementById('passInput')?.value;
  if (!em || !ps) { showToast('يرجى إدخال البريد وكلمة المرور'); return; }
  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left:8px"></i> جاري الدخول...'; }
  setTimeout(() => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', em);
    if (!localStorage.getItem('userName')) localStorage.setItem('userName', 'مستخدم عقاري');
    location.href = 'index.html';
  }, 800);
}
function handleRegister() {
  const nm = document.getElementById('regName')?.value?.trim();
  const em = document.getElementById('regEmail')?.value?.trim();
  const ps = document.getElementById('regPass')?.value;
  const ph = document.getElementById('regPhone')?.value?.trim();
  if (!nm || !em || !ps) { showToast('يرجى ملء جميع الحقول'); return; }
  const btn = document.getElementById('registerBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left:8px"></i> جاري التسجيل...'; }
  setTimeout(() => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', em);
    localStorage.setItem('userName', nm);
    if (ph) localStorage.setItem('userPhone', ph);
    location.href = 'index.html';
  }, 800);
}
function handleLogout() {
  if (!confirm('تسجيل الخروج؟')) return;
  localStorage.removeItem('isLoggedIn'); location.href = 'login.html';
}
function switchTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  ['loginTab', 'registerTab'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const on = id === tab + 'Tab';
    el.style.background = on ? 'var(--card)' : 'transparent';
    el.style.fontWeight = on ? '700' : '600';
    el.style.color = on ? 'var(--text)' : 'var(--gray)';
    el.style.boxShadow = on ? 'var(--shadow-sm)' : 'none';
  });
}
function togglePass() {
  const inp = document.getElementById('passInput'); const ic = document.getElementById('eyeIcon');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (ic) ic.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

/* ─────────────────────────────
   FILTER PAGE
───────────────────────────────*/
function filterOptionToggle(el, cls) {
  document.querySelectorAll('.' + cls).forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}
function filterMultiToggle(el) { el.classList.toggle('selected'); }
function fpRooms(d) {
  const el = document.getElementById('fp_rooms');
  const dp = document.getElementById('fp_roomsDisplay');
  if (!el || !dp) return;
  let v = parseInt(el.dataset.val || '0') + d;
  if (v < 0) v = 0; if (v > 6) v = 6;
  el.dataset.val = v; dp.textContent = v === 0 ? 'الكل' : v === 6 ? '5+' : String(v);
}
function applyFilterPage() {
  const t = document.querySelector('.filter-type-opt.selected')?.dataset.val || 'all';
  const st = document.querySelector('.filter-subtype-opt.selected')?.dataset.val || 'all';
  const c = document.querySelector('.filter-cat-opt.selected')?.dataset.val || 'all';
  const ci = document.querySelector('.filter-city-opt.selected')?.dataset.val || '';
  const mn = document.getElementById('fp_minPrice')?.value || '';
  const mx = document.getElementById('fp_maxPrice')?.value || '';
  location.href = `index.html?type=${t}&subtype=${st}&category=${c}&city=${ci}&minPrice=${mn}&maxPrice=${mx}`;
}
function resetFilterPage() {
  document.querySelectorAll('.filter-type-opt,.filter-subtype-opt,.filter-cat-opt,.filter-city-opt').forEach(el => el.classList.remove('selected'));
  ['fp_minPrice', 'fp_maxPrice'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const fr = document.getElementById('fp_rooms'); if (fr) fr.dataset.val = '0';
  const fd = document.getElementById('fp_roomsDisplay'); if (fd) fd.textContent = 'الكل';
  showToast('تم مسح الفلاتر');
}

/* ─────────────────────────────
   THEME / TOAST / SPLASH
───────────────────────────────*/
function applyTheme() {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('aqari_theme') || 'light');
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const nxt = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', nxt);
  localStorage.setItem('aqari_theme', nxt);
  updateThemeBtn();
}
function updateThemeBtn() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const ic = document.getElementById('themeIcon');
  if (ic) { ic.className = dark ? 'fas fa-toggle-on fa-lg' : 'fas fa-toggle-off fa-lg'; ic.style.color = dark ? 'var(--accent)' : 'var(--gray)'; }
}
function showToast(msg, dur = 2600) {
  const el = document.getElementById('toast'); if (!el) return;
  clearTimeout(el._t); el.textContent = msg; el.classList.add('show');
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}
function initSplash() {
  const s = document.getElementById('splash-screen');
  if (s) { setTimeout(() => { s.classList.add('hidden'); setTimeout(() => s.remove(), 500); }, 1800); }
}
function clearAllData() {
  if (!confirm('مسح جميع البيانات؟')) return;
  const k = { isLoggedIn: localStorage.getItem('isLoggedIn'), userEmail: localStorage.getItem('userEmail'), userName: localStorage.getItem('userName'), aqari_theme: localStorage.getItem('aqari_theme') };
  /* Clear image keys first */
  _clearAllPropImages();
  localStorage.clear();
  Object.entries(k).forEach(([key, v]) => { if (v) localStorage.setItem(key, v); });
  showToast('تم المسح'); setTimeout(() => location.reload(), 800);
}
function fmtNum(n) { return (n || 0).toLocaleString('en-US'); }

/* ─────────────────────────────
   EXPORT ALL TO WINDOW
───────────────────────────────*/
window.getPropImages   = getPropImages;
window.getPropImage    = getPropImage;
window.fmtNum          = fmtNum;
window.CITY_COORDS     = CITY_COORDS;
window.SYRIAN_CITIES   = SYRIAN_CITIES;
window.SAMPLE_PROPERTIES = SAMPLE_PROPERTIES;
window.FALLBACK        = FALLBACK;

window.setActiveType    = setActiveType;
window.quickFilter      = quickFilter;
window.setActiveSubtype = setActiveSubtype;
window.filterData       = filterData;
window.runFilters       = runFilters;
window.changeSort       = changeSort;
window.setView          = setView;
window.pickSuggestion   = pickSuggestion;
window.renderFeatured   = renderFeatured;
window.renderProperties = renderProperties;

window.gotoDetails      = gotoDetails;
window.goToDetails      = gotoDetails;

window.toggleFav        = toggleFav;
window.renderFavorites  = renderFavorites;
window.clearAllFavorites = clearAllFavorites;

window.detGoSlide       = detGoSlide;
window.detGalleryNext   = detGalleryNext;
window.detGalleryPrev   = detGalleryPrev;
window.shareProp        = shareProp;
window.shareProperty    = shareProp;

window.handleImagesUpload = handleImagesUpload;
window.clearAllImgs      = clearAllImgs;
window.renderImgGrid    = renderImgGrid;
window.removeImg        = removeImg;

window.publishProperty  = publishProperty;
window.showPaymentModal = showPaymentModal;
window.openPayModal     = showPaymentModal;
window.closeModal       = closeModal;
window.selectPayment    = selectPayment;

window.openConv         = openConv;
window.openChat         = openConv;
window.startChatWith    = startChatWith;
window.sendMessage      = sendMessage;
window.renderConversationList = renderConvList;

window.markNotifRead    = markNotifRead;
window.markAllNotifRead = markAllNotifRead;
window.addNotif         = addNotif;
window.updateBadge      = updateBadge;

window.handleLogin      = handleLogin;
window.handleRegister   = handleRegister;
window.handleLogout     = handleLogout;
window.switchTab        = switchTab;
window.togglePass       = togglePass;

window.renderProfile    = renderProfile;
window.saveSettings     = saveSettings;

window.filterOptionToggle = filterOptionToggle;
window.filterMultiToggle  = filterMultiToggle;
window.fpRooms            = fpRooms;
window.applyFilterPage    = applyFilterPage;
window.resetFilterPage    = resetFilterPage;

window.toggleTheme      = toggleTheme;
window.clearAllData     = clearAllData;
window.showToast        = showToast;
window.initCardSwipes   = initCardSwipes;

window.conversations    = conversations_data;
window.notifications    = notifications_data;

/* ═══════════════════════════════════════════════════════
   FIREBASE BRIDGE — ربط Firebase بالتطبيق
   يعمل بالتوازي مع localStorage للتوافق
═══════════════════════════════════════════════════════ */

// عند تحميل الصفحة: حمّل العقارات من Firebase
window.addEventListener('load', async function() {
  if (typeof loadFirebase === 'undefined') return;

  const page = (location.pathname.split('/').pop() || 'index').replace('.html','');

  // صفحات تحتاج بيانات Firebase
  if (['index','favorites','map','details'].includes(page)) {
    try {
      await loadFirebase();
      // تحميل العقارات من Firestore بشكل realtime
      fbLoadProperties(function(props) {
        if (!props || !props.length) return;
        // دمج مع العقارات التجريبية
        var fbProps = props.map(function(p, i) {
          return {
            id: p.firestoreId || ('fb_' + i),
            firestoreId: p.firestoreId,
            title: p.title || 'عقار',
            price: p.price || 0,
            type: p.type || 'sale',
            category: p.category || 'apartment',
            city: p.city || 'دمشق',
            location: p.location || p.city || 'دمشق',
            area: p.area || 0,
            rooms: p.rooms || 0,
            bathrooms: p.bathrooms || 0,
            floor: p.floor || 0,
            description: p.description || '',
            features: p.features || [],
            phone: p.ownerPhone || p.phone || '0911000000',
            ownerName: p.ownerName || 'مجهول',
            ownerUID: p.ownerUID || '',
            lat: p.lat || null,
            lng: p.lng || null,
            images: p.images || [],
            featured: p.featured || false,
            views: p.views || 0,
            isFirebase: true
          };
        });

        // دمج مع allProperties
        var existing = (window.allProperties || []).filter(function(p){ return !p.isFirebase; });
        window.allProperties = fbProps.concat(existing);
        window.myProperties = window.allProperties;

        // إعادة رسم الصفحة
        if (page === 'index' && typeof renderIndex === 'function') renderIndex();
        if (page === 'map' && typeof loadMarkers === 'function') loadMarkers();
      });
    } catch(e) {
      console.warn('[FB Bridge] Error:', e);
    }
  }

  // تحميل مفضلتي من Firebase
  if (page === 'favorites') {
    try {
      await loadFirebase();
      fbLoadFavorites(function(props) {
        if (!props.length) return;
        window.allProperties = (window.allProperties || []);
        props.forEach(function(p) {
          if (!window.allProperties.find(function(x){ return x.firestoreId === p.firestoreId; })) {
            window.allProperties.push(p);
          }
        });
        var favIds = props.map(function(p){ return p.firestoreId; });
        window.favorites = favIds;
        if (typeof renderFavorites === 'function') renderFavorites();
      });
    } catch(e) {}
  }
});

// Firebase نشر العقار — مدمج مباشرة في publishProperty (تم الإصلاح)

// تسجيل الخروج عبر Firebase
var _origLogout = window.handleLogout;
window.handleLogout = async function() {
  if (typeof fbLogout !== 'undefined') {
    try { await fbLogout(); } catch(e) {}
  }
  if (_origLogout) _origLogout();
  else {
    localStorage.clear();
    window.location.href = 'login.html';
  }
};

