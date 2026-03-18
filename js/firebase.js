/* عقاري Firebase v3 - مزامنة فورية */
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyCvVYtCsC7UR52bGLYvHebQqOumtat7poU",
  authDomain: "aqari-app-7c43f.firebaseapp.com",
  projectId: "aqari-app-7c43f",
  storageBucket: "aqari-app-7c43f.firebasestorage.app",
  messagingSenderId: "61607617094",
  appId: "1:61607617094:web:6939a1e6ef47c7885b2047"
};

var _fbReady = false;
var _fbCallbacks = [];
var _unsubscribe = null;

function loadFirebase() {
  return new Promise(function(resolve) {
    if (_fbReady) { resolve(); return; }
    _fbCallbacks.push(resolve);
    if (_fbCallbacks.length > 1) return;

    function s(src, cb) {
      var el = document.createElement('script');
      el.src = src; el.onload = cb; el.onerror = cb;
      document.head.appendChild(el);
    }

    s('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js', function() {
    s('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js', function() {
    s('https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js', function() {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      window.db   = firebase.firestore();
      window.auth = firebase.auth();
      _fbReady = true;
      _fbCallbacks.forEach(function(cb){ cb(); });
      _fbCallbacks = [];
    });});});
  });
}

/* تحويل document إلى property object */
function docToprop(doc) {
  var d = doc.data();
  return {
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
    featured:    !!(d.featured || (d.images && d.images.length > 0)),
    views:       d.views       || 0,
    isFirebase:  true
  };
}

/* تحديث allProperties وإعادة رسم الصفحة */
function applyProps(fbProps, page) {
  window.allProperties      = fbProps;
  window.myProperties       = fbProps;
  window.filteredProperties = fbProps;

  if (page === 'index') {
    var tc = document.getElementById('totalCount');
    if (tc) tc.textContent = fbProps.length;
    if (typeof initIndex === 'function') initIndex();
  } else if (page === 'map') {
    if (typeof loadAll === 'function') loadAll();
    else if (typeof loadMarkers === 'function') loadMarkers();
  } else if (page === 'favorites') {
    if (typeof renderFavorites === 'function') renderFavorites();
  } else if (page === 'details') {
    if (typeof renderDetails === 'function') renderDetails();
  }
}

/* ── AUTH ── */
function fbRegister(name, email, phone, password) {
  return loadFirebase().then(function() {
    return firebase.auth().createUserWithEmailAndPassword(email, password);
  }).then(function(cred) {
    var uid = cred.user.uid;
    return cred.user.updateProfile({ displayName: name }).then(function() {
      return firebase.firestore().collection('users').doc(uid).set({
        uid: uid, name: name, email: email, phone: phone,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).then(function() {
      saveUserLocal({ uid: uid, name: name, email: email, phone: phone });
      return { success: true };
    });
  }).catch(function(e) { return { success: false, error: getAuthError(e.code) }; });
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
  }).catch(function(e) { return { success: false, error: getAuthError(e.code) }; });
}

function fbLoginGoogle() {
  return loadFirebase().then(function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return firebase.auth().signInWithPopup(provider);
  }).then(function(cred) {
    var uid = cred.user.uid, name = cred.user.displayName || 'مستخدم', email = cred.user.email;
    return firebase.firestore().collection('users').doc(uid).set(
      { uid: uid, name: name, email: email, verified: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    ).then(function() { saveUserLocal({ uid: uid, name: name, email: email }); return { success: true }; });
  }).catch(function(e) { return { success: false, error: getAuthError(e.code) }; });
}

function fbLogout() {
  return loadFirebase().then(function() { return firebase.auth().signOut(); }).then(function() {
    ['fb_user','isLoggedIn','userEmail','userName','userUID'].forEach(function(k){ localStorage.removeItem(k); });
  });
}

function saveUserLocal(u) {
  localStorage.setItem('fb_user', JSON.stringify(u));
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userEmail', u.email || '');
  localStorage.setItem('userName',  u.name  || '');
  localStorage.setItem('userUID',   u.uid   || '');
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('fb_user') || 'null'); } catch(e) { return null; }
}

function getAuthError(code) {
  var m = {
    'auth/email-already-in-use':'البريد مستخدم مسبقاً',
    'auth/weak-password':'كلمة المرور ضعيفة',
    'auth/invalid-email':'البريد غير صحيح',
    'auth/user-not-found':'لا يوجد حساب بهذا البريد',
    'auth/wrong-password':'كلمة المرور غير صحيحة',
    'auth/invalid-credential':'البريد أو كلمة المرور غير صحيحة',
    'auth/too-many-requests':'محاولات كثيرة، حاول لاحقاً',
    'auth/network-request-failed':'خطأ في الاتصال',
    'auth/popup-closed-by-user':'تم إغلاق النافذة'
  };
  return m[code] || 'حدث خطأ، حاول مجدداً';
}

/* ── PROPERTIES ── */
function fbAddProperty(data, images) {
  return loadFirebase().then(function() {
    var user = getCurrentUser();
    return firebase.firestore().collection('properties').add(Object.assign({}, data, {
      images:     images || [],
      ownerUID:   user ? user.uid  : '',
      ownerName:  user ? (user.name || 'مستخدم') : 'مستخدم',
      ownerPhone: data.phone || '',
      active:     true,
      views:      0,
      featured:   !!(images && images.length > 0),
      createdAt:  firebase.firestore.FieldValue.serverTimestamp()
    }));
  }).then(function(ref) {
    return { success: true, id: ref.id };
  }).catch(function(e) {
    return { success: false, error: e.message };
  });
}

function fbLoadProperties(callback) {
  return loadFirebase().then(function() {
    if (_unsubscribe) _unsubscribe();
    _unsubscribe = firebase.firestore()
      .collection('properties')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .onSnapshot(function(snap) {
        var props = [];
        snap.forEach(function(doc) { props.push(docToprop(doc)); });
        callback(props);
      }, function(err) {
        console.error('[FB]', err.code, err.message);
      });
    return _unsubscribe;
  });
}

function fbLoadMyProperties(cb) {
  var user = getCurrentUser();
  if (!user) { cb([]); return Promise.resolve(); }
  return loadFirebase().then(function() {
    return firebase.firestore().collection('properties')
      .where('ownerUID', '==', user.uid).orderBy('createdAt', 'desc')
      .onSnapshot(function(snap) {
        var props = [];
        snap.forEach(function(doc) { props.push(Object.assign({ id: doc.id, firestoreId: doc.id }, doc.data())); });
        cb(props);
      });
  });
}

function fbIncrementView(id) {
  if (!id) return;
  loadFirebase().then(function() {
    firebase.firestore().collection('properties').doc(id)
      .update({ views: firebase.firestore.FieldValue.increment(1) }).catch(function(){});
  });
}

function fbToggleFavorite(id, add) {
  var user = getCurrentUser(); if (!user) return;
  loadFirebase().then(function() {
    var ref = firebase.firestore().collection('users').doc(user.uid);
    var op = add ? firebase.firestore.FieldValue.arrayUnion(id) : firebase.firestore.FieldValue.arrayRemove(id);
    ref.update({ favorites: op }).catch(function() { ref.set({ favorites: add ? [id] : [] }, { merge: true }); });
  });
}

function fbLoadFavorites(cb) {
  var user = getCurrentUser(); if (!user) { cb([]); return; }
  loadFirebase().then(function() {
    firebase.firestore().collection('users').doc(user.uid).get().then(function(doc) {
      var ids = doc.exists ? (doc.data().favorites || []) : [];
      if (!ids.length) { cb([]); return; }
      Promise.all(ids.map(function(id) { return firebase.firestore().collection('properties').doc(id).get(); }))
        .then(function(docs) {
          cb(docs.filter(function(d){ return d.exists; }).map(function(d){ return Object.assign({ id: d.id, firestoreId: d.id }, d.data()); }));
        });
    });
  });
}

function fbSendMessage(toUID, propId, propTitle, text) {
  var user = getCurrentUser(); if (!user) return Promise.resolve({ success: false });
  return loadFirebase().then(function() {
    var chatId = [user.uid, toUID].sort().join('_') + '_' + propId;
    return firebase.firestore().collection('chats').doc(chatId).collection('messages').add({
      text: text, fromUID: user.uid, fromName: user.name, toUID: toUID,
      propId: propId, propTitle: propTitle,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), read: false
    }).then(function() {
      var upd = { participants: [user.uid, toUID], propId: propId, propTitle: propTitle,
        lastMsg: text, lastTime: firebase.firestore.FieldValue.serverTimestamp() };
      upd['unread_'+toUID] = firebase.firestore.FieldValue.increment(1);
      return firebase.firestore().collection('chats').doc(chatId).set(upd, { merge: true });
    }).then(function() { return { success: true, chatId: chatId }; });
  }).catch(function() { return { success: false }; });
}

function fbLoadMessages(chatId, cb) {
  return loadFirebase().then(function() {
    return firebase.firestore().collection('chats').doc(chatId)
      .collection('messages').orderBy('createdAt','asc')
      .onSnapshot(function(snap) {
        var msgs = []; snap.forEach(function(doc){ msgs.push(Object.assign({ id: doc.id }, doc.data())); }); cb(msgs);
      });
  });
}

function fbLoadChats(cb) {
  var user = getCurrentUser(); if (!user) return;
  return loadFirebase().then(function() {
    return firebase.firestore().collection('chats')
      .where('participants','array-contains',user.uid).orderBy('lastTime','desc')
      .onSnapshot(function(snap) {
        var chats = []; snap.forEach(function(doc){ chats.push(Object.assign({ chatId: doc.id }, doc.data())); }); cb(chats);
      });
  });
}

/* ══════════════════════════════════════════════════════
   MAIN LISTENER — يبدأ فوراً عند تحميل الصفحة
══════════════════════════════════════════════════════ */
(function() {
  var page = (location.pathname.split('/').pop() || 'index').replace('.html','');
  if (!['index','map','details','favorites'].includes(page)) return;

  /* انتظر حتى يكون DOM جاهزاً ثم ابدأ */
  function startListener() {
    loadFirebase().then(function() {
      firebase.firestore()
        .collection('properties')
        .where('active', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .onSnapshot(function(snapshot) {
          var props = [];
          snapshot.forEach(function(doc) { props.push(docToTop(doc)); });
          applyProps(props, page);
          console.log('[عقاري] ✅ Realtime update:', props.length, 'properties');
        }, function(err) {
          console.error('[عقاري] ❌ Snapshot error:', err.code, err.message);
        });
    });
  }

  function docToTop(doc) {
    var d = doc.data();
    return {
      id: doc.id, firestoreId: doc.id, isFirebase: true,
      title: d.title||'عقار', price: d.price||0,
      type: d.type||'sale', category: d.category||'apartment',
      city: d.city||'دمشق', location: d.location||d.city||'دمشق',
      area: d.area||0, rooms: d.rooms||0, bathrooms: d.bathrooms||0,
      floor: d.floor||0, description: d.description||'',
      features: d.features||[], phone: d.ownerPhone||d.phone||'',
      ownerName: d.ownerName||'مستخدم', ownerUID: d.ownerUID||'',
      lat: d.lat||null, lng: d.lng||null, images: d.images||[],
      featured: !!(d.featured||(d.images&&d.images.length>0)),
      views: d.views||0
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(startListener, 100);
    });
  } else {
    setTimeout(startListener, 100);
  }
})();

/* ── EXPORTS ── */
window.loadFirebase        = loadFirebase;
window.fbRegister          = fbRegister;
window.fbLogin             = fbLogin;
window.fbLoginGoogle       = fbLoginGoogle;
window.fbLogout            = fbLogout;
window.getCurrentUser      = getCurrentUser;
window.saveUserLocal       = saveUserLocal;
window.fbAddProperty       = fbAddProperty;
window.fbLoadProperties    = fbLoadProperties;
window.fbLoadMyProperties  = fbLoadMyProperties;
window.fbIncrementView     = fbIncrementView;
window.fbToggleFavorite    = fbToggleFavorite;
window.fbLoadFavorites     = fbLoadFavorites;
window.fbSendMessage       = fbSendMessage;
window.fbLoadMessages      = fbLoadMessages;
window.fbLoadChats         = fbLoadChats;
