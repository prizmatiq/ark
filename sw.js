'use strict';
// Increment this version whenever the app shell changes.
const CACHE='ark-shell-v3-20261115-1';
const ROOT=new URL('./',self.location.href).href;
const SHELL=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/ark.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'].map(p=>new URL(p,ROOT).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ark-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||!url.href.startsWith(ROOT))return;
 if(event.request.mode==='navigate'){
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(ROOT))||fetch(event.request)));
 }else if(SHELL.includes(url.href)){
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
 }
});
