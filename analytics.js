/*
 * Hooray HQ — site-wide tracking (Google Analytics 4 + Meta Pixel).
 * Loaded on every page for all visitors (NZ-only traffic; no consent banner).
 * GA4 is aggregated/anonymous and does not store IP addresses.
 * The Meta Pixel is an advertising cookie — both are disclosed in privacy.html (§4).
 */

// ---- Google Analytics 4 ----
(function () {
  var GA4_ID = 'G-8JETMPRH4F'; // Google Analytics 4 Measurement ID

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID);
})();

// ---- Meta (Facebook/Instagram) Pixel ----
// PASTE YOUR PIXEL ID BELOW. Find it in Meta Events Manager → Data sources →
// your dataset → Settings (it's a ~15-digit number). Until it's set, the pixel
// stays dormant and nothing is sent.
(function () {
  var PIXEL_ID = '1285412236732839'; // e.g. '1234567890123456'
  if (!PIXEL_ID || PIXEL_ID === 'YOUR_PIXEL_ID') return; // not configured yet

  // Standard Meta Pixel bootstrap (defines the fbq() queue synchronously).
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
})();

// Null-safe wrapper so page code can fire Pixel events without crashing when the
// pixel isn't configured (or is blocked). Optional eventId enables server-side
// (Conversions API) de-duplication later. Usage: hqFbq('AddToCart', {...}, id)
window.hqFbq = function (eventName, params, eventId) {
  if (!window.fbq) return;
  var opts = eventId ? { eventID: eventId } : undefined;
  window.fbq('track', eventName, params || {}, opts);
};
