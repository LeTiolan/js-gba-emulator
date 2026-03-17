/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */
if (typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", function (event) {
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
      return;
    }
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response.status === 0) {
            return response;
          }
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
          });
        })
        .catch(function (e) { console.error(e); })
    );
  });
} else {
  (() => {
    const coi = {
      shouldRegister: () => true,
      shouldDeregister: () => false,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi
    };

    let n = navigator;
    if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return;
    if (!window.isSecureContext) return;

    if (n.serviceWorker) {
      n.serviceWorker.register(window.document.currentScript.src).then(
        (registration) => {
          registration.addEventListener("updatefound", () => {
            coi.doReload();
          });
          if (registration.active && !n.serviceWorker.controller) {
            coi.doReload();
          }
        },
        (err) => { console.error("COOP/COEP Service Worker failed to register:", err); }
      );
    }
  })();
}
