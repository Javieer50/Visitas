// Visitas AGROLEON – funcionamiento sin conexión
const C='agroleon-v62';
const BASE=new URL('./',self.location).href;
const ARCH=['','index.html','manifest.json','icon-192.png','icon-512.png','apple-touch-icon.png'].map(f=>BASE+f);

// Instalar: guardar todos los archivos de la app en el teléfono
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>Promise.all(ARCH.map(u=>
    fetch(new Request(u,{cache:'reload'})).then(r=>{if(r.ok)return c.put(u,limpia(r))}).catch(()=>{})
  ))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==C).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
// iOS no acepta respuestas "redirigidas" para abrir la app: se copian limpias
function limpia(r){if(!r.redirected)return r;return new Response(r.body,{status:r.status,statusText:r.statusText,headers:r.headers})}
function conTiempo(p,ms){return new Promise((ok,no)=>{const t=setTimeout(()=>no(new Error('lento')),ms);p.then(v=>{clearTimeout(t);ok(v)},x=>{clearTimeout(t);no(x)})})}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  const esPagina=req.mode==='navigate'||(req.headers.get('accept')||'').includes('text/html');
  if(esPagina){
    // Página: intenta internet (máx. 7 s) para tener la última versión; si no hay señal, usa la guardada
    e.respondWith((async()=>{
      const c=await caches.open(C);
      const red=fetch(new Request(BASE+'index.html',{cache:'no-store'})).then(r=>{if(r.ok){c.put(BASE+'index.html',limpia(r.clone()));c.put(BASE,limpia(r.clone()))}return r});
      try{const r=await conTiempo(red,7000);if(r.ok)return limpia(r)}catch(x){}
      const g=await c.match(BASE+'index.html')||await c.match(BASE);
      if(g)return g;
      return red.catch(()=>new Response('<h1 style="font-family:sans-serif">Sin conexión</h1><p style="font-family:sans-serif">Abra la app una vez con internet para guardarla en el teléfono.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}}));
    })());
    return;
  }
  // Iconos y demás archivos: primero lo guardado, y se actualiza en segundo plano
  e.respondWith(caches.open(C).then(async c=>{
    const g=await c.match(req,{ignoreSearch:true});
    const red=fetch(req).then(r=>{if(r.ok)c.put(req,limpia(r.clone()));return r}).catch(()=>null);
    return g||await red||new Response('',{status:504});
  }));
});
