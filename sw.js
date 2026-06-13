/**
 * 赢单原型自动刷新 Service Worker。
 *
 * 这个文件解决 GitHub Pages 静态站点常见的缓存问题：
 * - 同事打开同一个链接时，浏览器可能继续使用旧的 index.html / app.js / styles.css。
 * - Service Worker 接管后，会对页面、JS、CSS、JSON 走“网络优先”。
 * - 这样每次 push 后，用户再次打开或刷新页面时会优先拿到最新代码。
 *
 * 注意：
 * - 首次部署 Service Worker 前已经被旧缓存卡住的浏览器，仍可能需要刷新一次。
 * - 一旦用户加载过带 Service Worker 的版本，后续再分享普通链接也会自动更新。
 */

const FRESH_RESOURCE_PATTERN = /\.(html|js|css|json)$/i;

/**
 * 判断请求是否属于需要强制保鲜的静态资源。
 *
 * @param {Request} request - 浏览器发出的网络请求。
 * @returns {boolean} true 表示这个请求应该走网络优先。
 */
function shouldFetchFresh(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  return request.mode === "navigate" ||
    request.destination === "document" ||
    request.destination === "script" ||
    request.destination === "style" ||
    FRESH_RESOURCE_PATTERN.test(url.pathname);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (!shouldFetchFresh(event.request)) {
    return;
  }

  event.respondWith(fetch(event.request, { cache: "no-store" }));
});
