/* Service worker de Myriedesign: guarda la app en el celular para que abra sin internet.
   - La página (index.html): primero internet, así siempre llega la versión nueva;
     sin conexión se usa la última guardada.
   - Librerías de Firebase, fuentes e íconos: se usan de lo guardado (no cambian).
   - Los datos (Firestore, login, tasa BCV) no pasan por acá: Firebase tiene su propio
     modo sin conexión. */
const CACHE = 'myriedesign-v1';
const PRECARGA = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    // Si alguno falla (ej. sin red al instalar) igual se instala con lo que se pudo.
    return Promise.all(PRECARGA.map(function(u){ return c.add(u).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function esLibreria(url){
  return url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0 ||
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', function(e){
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // La página: internet primero, guardada si no hay conexión.
  if(req.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname))){
    e.respondWith(fetch(req).then(function(res){
      const copia = res.clone();
      caches.open(CACHE).then(function(c){ c.put('./index.html', copia); });
      return res;
    }).catch(function(){
      return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
    }));
    return;
  }

  // Librerías, fuentes y archivos propios (íconos, manifest): lo guardado primero.
  if(esLibreria(url) || url.origin === self.location.origin){
    e.respondWith(caches.match(req).then(function(guardado){
      if(guardado) return guardado;
      return fetch(req).then(function(res){
        if(res && (res.ok || res.type === 'opaque')){
          const copia = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copia); });
        }
        return res;
      });
    }));
  }
  // Todo lo demás (Firestore, login, tasa BCV, WhatsApp) va directo a internet.
});
