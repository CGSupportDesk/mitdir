const CACHE='mitdir-shell-v1'
const SHELL=['/','/offline.html','/manifest.webmanifest','/favicon.svg']
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{
  const request=event.request
  if(request.method!=='GET'||new URL(request.url).pathname.startsWith('/api/'))return
  if(request.mode==='navigate')event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')))
  else event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&new URL(request.url).origin===location.origin){const clone=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,clone))}return response})))
})
