/* ═══════════════════════════════════════════════════════
   عقاري — Firebase Integration (firebase.js)
   - Authentication (Email + Google)
   - Firestore Database (Properties, Users, Messages)
   - Real-time sync across devices
═══════════════════════════════════════════════════════ */

// Firebase Config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCvVYtCsC7UR52bGLYvHebQqOumtat7poU",
  authDomain: "aqari-app-7c43f.firebaseapp.com",
  projectId: "aqari-app-7c43f",
  storageBucket: "aqari-app-7c43f.firebasestorage.app",
  messagingSenderId: "61607617094",
  appId: "1:61607617094:web:6939a1e6ef47c7885b2047"
};

// Firebase SDK URLs (CDN)
const FB_SDK = 'https://www.gstatic.com/firebasejs/10.7.1/';

// Load Firebase dynamically
async function loadFirebase() {
  if (window._fbLoaded) return;
  window._fbLoaded = true;

  // Load scripts
  await Promise.all([
    loadScript(FB_SDK + 'firebase-app-compat.js'),
    loadScript(FB_SDK + 'firebase-auth-compat.js'),
    loadScript(FB_SDK + 'firebase-firestore-compat.js'),
  ]);

  // Initialize
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  window.db   = firebase.firestore();
  window.auth = firebase.auth();

  console.log('[عقاري] Firebase initialized ✅');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ═══════════════════════════════════════════════════════
   AUTH FUNCTIONS
═══════════════════════════════════════════════════════ */

// Register with email/password
async function fbRegister(name, email, phone, password) {
  await loadFirebase();
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Update display name
    await cred.user.updateProfile({ displayName: name });

    // Save user profile to Firestore
    await db.collection('users').doc(uid).set({
      uid, name, email, phone,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      verified: false,
      avatar: null
    });

    // Save to localStorage
    saveUserLocal({ uid, name, email, phone });
    return { success: true, uid };
  } catch (e) {
    return { success: false, error: getAuthError(e.code) };
  }
}

// Login with email/password
async function fbLogin(email, password) {
  await loadFirebase();
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Load user profile from Firestore
    const doc = await db.collection('users').doc(uid).get();
    const userData = doc.exists ? doc.data() : { uid, email, name: cred.user.displayName || 'مستخدم' };
    saveUserLocal(userData);
    return { success: true, user: userData };
  } catch (e) {
    return { success: false, error: getAuthError(e.code) };
  }
}

// Login with Google
async function fbLoginGoogle() {
  await loadFirebase();
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await auth.signInWithPopup(provider);
    const uid = cred.user.uid;
    const name = cred.user.displayName || 'مستخدم';
    const email = cred.user.email;

    // Create/update user in Firestore
    await db.collection('users').doc(uid).set({
      uid, name, email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      verified: true
    }, { merge: true });

    saveUserLocal({ uid, name, email });
    return { success: true };
  } catch (e) {
    return { success: false, error: getAuthError(e.code) };
  }
}

// Logout
async function fbLogout() {
  await loadFirebase();
  await auth.signOut();
  localStorage.removeItem('fb_user');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
}

// Save user to localStorage
function saveUserLocal(user) {
  localStorage.setItem('fb_user', JSON.stringify(user));
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userEmail', user.email || '');
  localStorage.setItem('userName', user.name || user.displayName || '');
  localStorage.setItem('userUID', user.uid || '');
}

// Get current user
function getCurrentUser() {
  const raw = localStorage.getItem('fb_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Auth error messages in Arabic
function getAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'البريد الإلكتروني مستخدم مسبقاً',
    'auth/weak-password': 'كلمة المرور ضعيفة — 6 أحرف على الأقل',
    'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
    'auth/too-many-requests': 'محاولات كثيرة — حاول لاحقاً',
    'auth/network-request-failed': 'خطأ في الاتصال بالإنترنت',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول',
  };
  return map[code] || 'حدث خطأ، حاول مجدداً';
}

/* ═══════════════════════════════════════════════════════
   PROPERTIES FUNCTIONS
═══════════════════════════════════════════════════════ */

// Add new property to Firestore
async function fbAddProperty(propData, images) {
  await loadFirebase();
  const user = getCurrentUser();
  if (!user) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  try {
    const docRef = await db.collection('properties').add({
      ...propData,
      images: images || [],
      ownerUID: user.uid,
      ownerName: user.name || 'مجهول',
      ownerPhone: user.phone || propData.phone,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      views: 0,
      active: true,
      featured: (images && images.length > 0)
    });
    return { success: true, id: docRef.id };
  } catch (e) {
    console.error('[FB] Add property error:', e);
    return { success: false, error: 'فشل نشر الإعلان' };
  }
}

// Load all properties from Firestore (realtime)
async function fbLoadProperties(callback) {
  await loadFirebase();
  return db.collection('properties')
    .where('active', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .onSnapshot(snapshot => {
      const props = [];
      snapshot.forEach(doc => {
        props.push({ firestoreId: doc.id, ...doc.data() });
      });
      callback(props);
    }, err => {
      console.error('[FB] Load properties error:', err);
    });
}

// Load my properties
async function fbLoadMyProperties(callback) {
  await loadFirebase();
  const user = getCurrentUser();
  if (!user) return;
  return db.collection('properties')
    .where('ownerUID', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const props = [];
      snapshot.forEach(doc => props.push({ firestoreId: doc.id, ...doc.data() }));
      callback(props);
    });
}

// Increment view count
async function fbIncrementView(firestoreId) {
  if (!firestoreId) return;
  await loadFirebase();
  try {
    await db.collection('properties').doc(firestoreId).update({
      views: firebase.firestore.FieldValue.increment(1)
    });
  } catch(e) {}
}

// Toggle favorite in Firestore
async function fbToggleFavorite(firestoreId, isFav) {
  await loadFirebase();
  const user = getCurrentUser();
  if (!user) return;
  const ref = db.collection('users').doc(user.uid);
  if (isFav) {
    await ref.update({ favorites: firebase.firestore.FieldValue.arrayUnion(firestoreId) });
  } else {
    await ref.update({ favorites: firebase.firestore.FieldValue.arrayRemove(firestoreId) });
  }
}

// Load favorites
async function fbLoadFavorites(callback) {
  await loadFirebase();
  const user = getCurrentUser();
  if (!user) { callback([]); return; }
  const doc = await db.collection('users').doc(user.uid).get();
  const favIds = doc.exists ? (doc.data().favorites || []) : [];
  if (!favIds.length) { callback([]); return; }
  // Load actual properties
  const props = [];
  for (const id of favIds) {
    const p = await db.collection('properties').doc(id).get();
    if (p.exists) props.push({ firestoreId: p.id, ...p.data() });
  }
  callback(props);
}

/* ═══════════════════════════════════════════════════════
   MESSAGES FUNCTIONS
═══════════════════════════════════════════════════════ */

// Send message
async function fbSendMessage(toUID, propId, propTitle, text) {
  await loadFirebase();
  const user = getCurrentUser();
  if (!user) return { success: false };

  const chatId = [user.uid, toUID].sort().join('_') + '_' + propId;

  try {
    // Add message
    await db.collection('chats').doc(chatId).collection('messages').add({
      text,
      fromUID: user.uid,
      fromName: user.name,
      toUID,
      propId,
      propTitle,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    // Update chat metadata
    await db.collection('chats').doc(chatId).set({
      participants: [user.uid, toUID],
      propId, propTitle,
      lastMsg: text,
      lastTime: firebase.firestore.FieldValue.serverTimestamp(),
      [`unread_${toUID}`]: firebase.firestore.FieldValue.increment(1)
    }, { merge: true });

    return { success: true, chatId };
  } catch(e) {
    return { success: false };
  }
}

// Load messages for a chat
async function fbLoadMessages(chatId, callback) {
  await loadFirebase();
  return db.collection('chats').doc(chatId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      const msgs = [];
      snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      callback(msgs);
    });
}

// Load all chats for current user
async function fbLoadChats(callback) {
  await loadFirebase();
  const user = getCurrentUser();
  if (!user) return;
  return db.collection('chats')
    .where('participants', 'array-contains', user.uid)
    .orderBy('lastTime', 'desc')
    .onSnapshot(snapshot => {
      const chats = [];
      snapshot.forEach(doc => chats.push({ chatId: doc.id, ...doc.data() }));
      callback(chats);
    });
}

// Export all functions globally
window.fbRegister      = fbRegister;
window.fbLogin         = fbLogin;
window.fbLoginGoogle   = fbLoginGoogle;
window.fbLogout        = fbLogout;
window.getCurrentUser  = getCurrentUser;
window.fbAddProperty   = fbAddProperty;
window.fbLoadProperties= fbLoadProperties;
window.fbLoadMyProperties = fbLoadMyProperties;
window.fbIncrementView = fbIncrementView;
window.fbToggleFavorite= fbToggleFavorite;
window.fbLoadFavorites = fbLoadFavorites;
window.fbSendMessage   = fbSendMessage;
window.fbLoadMessages  = fbLoadMessages;
window.fbLoadChats     = fbLoadChats;
window.loadFirebase    = loadFirebase;
