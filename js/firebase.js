/* ═══════════════════════════════════════════════════════
   عقاري — Firebase v2 (إصلاح كامل للمزامنة)
═══════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCvVYtCsC7UR52bGLYvHebQqOumtat7poU",
  authDomain: "aqari-app-7c43f.firebaseapp.com",
  projectId: "aqari-app-7c43f",
  storageBucket: "aqari-app-7c43f.firebasestorage.app",
  messagingSenderId: "61607617094",
  appId: "1:61607617094:web:6939a1e6ef47c7885b2047"
};

var _fbReady = false;
var _fbReadyCallbacks = [];
var _propsUnsubscribe = null;

/* تحميل Firebase SDK */
function loadFirebase() {
  return new Promise(function(resolve) {
    if (_fbReady) { resolve(); return; }
    _fbReadyCallbacks.push(resolve);
    if (_fbReadyCallbacks.length > 1) return; // already loading

    function loadScript(src, cb) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = cb;
      s.onerror = cb;
      document.head.appendChild(s);
    }

    var base = 'https://www.gstatic.com/firebasejs/9.23.0/';
    loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js', function() {
      loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js', function() {
        loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js', function() {
          try {
            if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
            window.db   = firebase.firestore();
            window.auth = firebase.auth();
            _fbReady = true;
            console.log('[عقاري] ✅ Firebase ready');
          } catch(e) {
            console.error('[عقاري] Firebase init error:', e);
          }
          _fbReadyCallbacks.forEach(function(cb){ cb(); });
          _fbReadyCallbacks = [];
        });
      });
    });
  });
}

/* ── AUTH ────────────────────────────────────────────── */

function fbRegister(name, email, phone, password) {
  return loadFirebase().then(function() {
    return firebase.auth().createUserWithEmailAndPassword(email, password);
  }).then(function(cred) {
    var uid = cred.user.uid;
    return cred.user.updateProfile({ displayName: name }).then(function() {
      return firebase.firestore().collection('users').doc(uid).set({
        uid: uid, name: name, email: email, phone: phone,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        verified: false
      });
    }).then(function() {
      saveUserLocal({ uid: uid, name: name, email: email, phone: phone });
      return { success: true };
    });
  }).catch(function(e) {
    return { success: false, error: getAuthError(e.code) };
  });
}

function fbLogin(email, password) {
  return loadFirebase().then(function() {
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }).then(function(cred) {
    var uid = cred.user.uid;
    return firebase.firestore().collection('users').doc(uid).get().then(function(doc) {
      var data = doc.exists ? doc.data() : { uid: uid, email: email, name: cred.user.displayName || 'مستخدم' };
      saveUserLocal(data);
      return { success: true };
    });
  }).catch(function(e) {
    return { success: false, error: getAuthError(e.code) };
  });
}

function fbLoginGoogle() {
  return loadFirebase().then(function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return firebase.auth().signInWithPopup(provider);
  }).then(function(cred) {
    var uid = cred.user.uid;
    var name = cred.user.displayName || 'مستخدم';
    var email = cred.user.email;
    return firebase.firestore().collection('users').doc(uid).set(
      { uid: uid, name: name, email: email, verified: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    ).then(function() {
      saveUserLocal({ uid: uid, name: name, email: email });
      return { success: true };
    });
  }).catch(function(e) {
    return { success: false, error: getAuthError(e.code) };
  });
}

function fbLogout() {
  return loadFirebase().then(function() {
    return firebase.auth().signOut();
  }).then(function() {
    localStorage.removeItem('fb_user');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userUID');
  });
}

function saveUserLocal(user) {
  localStorage.setItem('fb_user', JSON.stringify(user));
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userEmail', user.email || '');
  localStorage.setItem('userName',  user.name  || '');
  localStorage.setItem('userUID',   user.uid   || '');
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('fb_user') || 'null'); }
  catch(e) { return null; }
}

function getAuthError(code) {
  var map = {
    'auth/email-already-in-use': 'البريد الإلكتروني مستخدم مسبقاً',
    'auth/weak-password':        'كلمة المرور ضعيفة — 6 أحرف على الأقل',
    'auth/invalid-email':        'البريد الإلكتروني غير صحيح',
    'auth/user-not-found':       'لا يوجد حساب بهذا البريد',
    'auth/wrong-password':       'كلمة المرور غير صحيحة',
    'auth/invalid-credential':   'البريد أو كلمة المرور غير صحيحة',
    'auth/too-many-requests':    'محاولات كثيرة — حاول لاحقاً',
    'auth/network-request-failed':'خطأ في الاتصال بالإنترنت',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول',
  };
  return map[code] || 'حدث خطأ، حاول مجدداً';
}

/* ── PROPERTIES ──────────────────────────────────────── */

function fbAddProperty(propData, images) {
  return loadFirebase().then(function() {
    var user = getCurrentUser();
    var data = Object.assign({}, propData, {
      images:    images || [],
      ownerUID:  user ? user.uid  : '',
      ownerName: user ? (user.name || 'مستخدم') : 'مستخدم',
      ownerPhone:propData.phone || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      views: 0, active: true,
      featured: (images && images.length > 0)
    });
    return firebase.firestore().collection('properties').add(data);
  }).then(function(ref) {
    console.log('[عقاري] ✅ Property saved:', ref.id);
    return { success: true, id: ref.id };
  }).catch(function(e) {
    console.error('[عقاري] ❌ Save error:', e);
    return { success: false, error: e.message };
  });
}

/* تحميل العقارات realtime — يُطلق callback عند أي تغيير */
function fbLoadProperties(callback) {
  return loadFirebase().then(function() {
    if (_propsUnsubscribe) _propsUnsubscribe();
    _propsUnsubscribe = firebase.firestore()
      .collection('properties')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .onSnapshot(function(snapshot) {
        var props = [];
        snapshot.forEach(function(doc) {
          var d = doc.data();
          props.push({
            id:          doc.id,
            firestoreId: doc.id,
            title:       d.title       || 'عقار',
            price:       d.price       || 0,
            type:        d.type        || 'sale',
            category:    d.category    || 'apartment',
            city:        d.city        || 'دمشق',
            location:    d.location    || d.city || 'دمشق',
            area:        d.area        || 0,
            rooms:       d.rooms       || 0,
            bathrooms:   d.bathrooms   || 0,
            floor:       d.floor       || 0,
            description: d.description || '',
            features:    d.features    || [],
            phone:       d.ownerPhone  || d.phone || '',
            ownerName:   d.ownerName   || 'مستخدم',
            ownerUID:    d.ownerUID    || '',
            lat:         d.lat         || null,
            lng:         d.lng         || null,
            images:      d.images      || [],
            featured:    d.featured    || false,
            views:       d.views       || 0,
            isFirebase:  true
          });
        });
        callback(props);
      }, function(err) {
        console.error('[عقاري] Firestore error:', err.code, err.message);
      });
    return _propsUnsubscribe;
  });
}

function fbLoadMyProperties(callback) {
  var user = getCurrentUser();
  if (!user) { callback([]); return Promise.resolve(); }
  return loadFirebase().then(function() {
    return firebase.firestore().collection('properties')
      .where('ownerUID', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot(function(snapshot) {
        var props = [];
        snapshot.forEach(function(doc) {
          var d = doc.data();
          props.push(Object.assign({ id: doc.id, firestoreId: doc.id, isFirebase: true }, d));
        });
        callback(props);
      });
  });
}

function fbIncrementView(firestoreId) {
  if (!firestoreId) return;
  loadFirebase().then(function() {
    firebase.firestore().collection('properties').doc(firestoreId).update({
      views: firebase.firestore.FieldValue.increment(1)
    }).catch(function(){});
  });
}

function fbToggleFavorite(firestoreId, isFav) {
  var user = getCurrentUser();
  if (!user) return;
  loadFirebase().then(function() {
    var ref = firebase.firestore().collection('users').doc(user.uid);
    var op = isFav
      ? firebase.firestore.FieldValue.arrayUnion(firestoreId)
      : firebase.firestore.FieldValue.arrayRemove(firestoreId);
    ref.update({ favorites: op }).catch(function() {
      ref.set({ favorites: isFav ? [firestoreId] : [] }, { merge: true });
    });
  });
}

function fbLoadFavorites(callback) {
  var user = getCurrentUser();
  if (!user) { callback([]); return; }
  loadFirebase().then(function() {
    firebase.firestore().collection('users').doc(user.uid).get().then(function(doc) {
      var favIds = doc.exists ? (doc.data().favorites || []) : [];
      if (!favIds.length) { callback([]); return; }
      var promises = favIds.map(function(id) {
        return firebase.firestore().collection('properties').doc(id).get();
      });
      Promise.all(promises).then(function(docs) {
        var props = docs.filter(function(d){ return d.exists; }).map(function(d) {
          return Object.assign({ id: d.id, firestoreId: d.id, isFirebase: true }, d.data());
        });
        callback(props);
      });
    });
  });
}

/* ── MESSAGES ────────────────────────────────────────── */

function fbSendMessage(toUID, propId, propTitle, text) {
  var user = getCurrentUser();
  if (!user) return Promise.resolve({ success: false });
  return loadFirebase().then(function() {
    var chatId = [user.uid, toUID].sort().join('_') + '_' + propId;
    var db = firebase.firestore();
    return db.collection('chats').doc(chatId).collection('messages').add({
      text: text, fromUID: user.uid, fromName: user.name,
      toUID: toUID, propId: propId, propTitle: propTitle,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), read: false
    }).then(function() {
      var upd = { participants: [user.uid, toUID], propId: propId,
        propTitle: propTitle, lastMsg: text,
        lastTime: firebase.firestore.FieldValue.serverTimestamp() };
      upd['unread_' + toUID] = firebase.firestore.FieldValue.increment(1);
      return db.collection('chats').doc(chatId).set(upd, { merge: true });
    }).then(function() {
      return { success: true, chatId: chatId };
    });
  }).catch(function() { return { success: false }; });
}

function fbLoadMessages(chatId, callback) {
  return loadFirebase().then(function() {
    return firebase.firestore().collection('chats').doc(chatId)
      .collection('messages').orderBy('createdAt', 'asc')
      .onSnapshot(function(snap) {
        var msgs = [];
        snap.forEach(function(doc) { msgs.push(Object.assign({ id: doc.id }, doc.data())); });
        callback(msgs);
      });
  });
}

function fbLoadChats(callback) {
  var user = getCurrentUser();
  if (!user) return;
  return loadFirebase().then(function() {
    return firebase.firestore().collection('chats')
      .where('participants', 'array-contains', user.uid)
      .orderBy('lastTime', 'desc')
      .onSnapshot(function(snap) {
        var chats = [];
        snap.forEach(function(doc) { chats.push(Object.assign({ chatId: doc.id }, doc.data())); });
        callback(chats);
      });
  });
}

/* ── INIT ON PAGE LOAD ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  var page = (location.pathname.split('/').pop() || 'index').replace('.html','');

  if (['index','map','details','favorites'].includes(page)) {
    loadFirebase().then(function() {

      /* onSnapshot = يستمع للتغييرات في realtime */
      firebase.firestore()
        .collection('properties')
        .where('active', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .onSnapshot(function(snapshot) {

          var fbProps = [];
          snapshot.forEach(function(doc) {
            var d = doc.data();
            fbProps.push({
              id:          doc.id,
              firestoreId: doc.id,
              title:       d.title       || 'عقار',
              price:       d.price       || 0,
              type:        d.type        || 'sale',
              category:    d.category    || 'apartment',
              city:        d.city        || 'دمشق',
              location:    d.location    || d.city || 'دمشق',
              area:        d.area        || 0,
              rooms:       d.rooms       || 0,
              bathrooms:   d.bathrooms   || 0,
              floor:       d.floor       || 0,
              description: d.description || '',
              features:    d.features    || [],
              phone:       d.ownerPhone  || d.phone || '',
              ownerName:   d.ownerName   || 'مستخدم',
              ownerUID:    d.ownerUID    || '',
              lat:         d.lat         || null,
              lng:         d.lng         || null,
              images:      d.images      || [],
              featured:    d.featured    || (d.images && d.images.length > 0),
              views:       d.views       || 0,
              isFirebase:  true
            });
          });

          /* دمج مع العقارات التجريبية */
          var sample = (window.SAMPLE_PROPERTIES || []);
          window.allProperties = fbProps.concat(sample);
          window.myProperties  = window.allProperties;
          window.filteredProperties = window.allProperties;

          /* إعادة رسم الصفحة فوراً عند كل تحديث */
          if (page === 'index' && typeof initIndex === 'function') {
            initIndex();
          } else if (page === 'map' && (typeof loadAll === 'function' || typeof loadMarkers === 'function')) {
            if (typeof loadAll === 'function') loadAll();
            else loadMarkers();
          } else if (page === 'favorites' && typeof renderFavorites === 'function') {
            renderFavorites();
          } else if (page === 'details' && typeof renderDetails === 'function') {
            renderDetails();
          }

        }, function(err) {
          console.error('[عقاري] Firestore listen error:', err.code, err.message);
        });

    });
  }
});

/* ── EXPORTS ─────────────────────────────────────────── */
window.loadFirebase         = loadFirebase;
window.fbRegister           = fbRegister;
window.fbLogin              = fbLogin;
window.fbLoginGoogle        = fbLoginGoogle;
window.fbLogout             = fbLogout;
window.getCurrentUser       = getCurrentUser;
window.saveUserLocal        = saveUserLocal;
window.fbAddProperty        = fbAddProperty;
window.fbLoadProperties     = fbLoadProperties;
window.fbLoadMyProperties   = fbLoadMyProperties;
window.fbIncrementView      = fbIncrementView;
window.fbToggleFavorite     = fbToggleFavorite;
window.fbLoadFavorites      = fbLoadFavorites;
window.fbSendMessage        = fbSendMessage;
window.fbLoadMessages       = fbLoadMessages;
window.fbLoadChats          = fbLoadChats;
