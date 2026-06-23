/*
 * Hooray HQ — consent-gated analytics.
 * Loads Google Analytics 4 + Meta (Facebook) Pixel ONLY after the visitor accepts
 * cookies. Uses Google Consent Mode v2 with all storage denied by default, so
 * nothing tracking-related fires until consent is granted.
 *
 * >>> CONFIG: paste your real IDs below. Until then, tracking stays off. <<<
 */
(function () {
  // ============ FILL THESE IN ============
  var GA4_ID = 'G-8JETMPRH4F';          // Google Analytics 4 Measurement ID
  var META_PIXEL_ID = 'XXXXXXXXXXXXXXX'; // Meta (Facebook) Pixel ID (15 digits)
  // =======================================

  var STORAGE_KEY = 'hooray-consent';
  var choice = null;
  try { choice = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  // --- Google Consent Mode v2: deny everything by default ---
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });

  function configured(id) { return id && id.indexOf('XXXX') === -1; }

  function loadGA4() {
    if (!configured(GA4_ID)) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA4_ID, { anonymize_ip: true });
  }

  function loadPixel() {
    if (!configured(META_PIXEL_ID)) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function grant() {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
    loadGA4();
    loadPixel();
  }

  function setChoice(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
    var el = document.getElementById('hooray-cookie-banner');
    if (el) el.parentNode.removeChild(el);
    if (v === 'granted') grant();
  }

  function showBanner() {
    if (document.getElementById('hooray-cookie-banner')) return;
    var wrap = document.createElement('div');
    wrap.id = 'hooray-cookie-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Cookie consent');
    wrap.innerHTML =
      '<div class="hcb-inner">' +
        '<p class="hcb-text">We use cookies to understand how our site is used and to improve your experience (Google Analytics &amp; Meta). ' +
        'You can accept or decline — see our <a href="' + privacyHref() + '">Privacy Policy</a>.</p>' +
        '<div class="hcb-actions">' +
          '<button type="button" class="hcb-btn hcb-decline" id="hcb-decline">Decline</button>' +
          '<button type="button" class="hcb-btn hcb-accept" id="hcb-accept">Accept</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    document.getElementById('hcb-accept').addEventListener('click', function () { setChoice('granted'); });
    document.getElementById('hcb-decline').addEventListener('click', function () { setChoice('denied'); });
  }

  // privacy.html lives at root and in /blog/ as ../privacy.html
  function privacyHref() {
    return location.pathname.indexOf('/blog/') !== -1 ? '../privacy.html' : 'privacy.html';
  }

  // Public: reopen the banner from a "Cookie settings" footer link.
  window.hoorayOpenCookieSettings = function () {
    var el = document.getElementById('hooray-cookie-banner');
    if (el) el.parentNode.removeChild(el);
    showBanner();
  };

  // Inject minimal styles once.
  var style = document.createElement('style');
  style.textContent =
    '#hooray-cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1c1412;color:#faf7f2;' +
    'box-shadow:0 -8px 24px rgba(28,20,18,0.25);font-family:Nunito,system-ui,sans-serif;}' +
    '#hooray-cookie-banner .hcb-inner{max-width:1100px;margin:0 auto;padding:1rem 1.25rem;display:flex;gap:1rem;' +
    'align-items:center;justify-content:space-between;flex-wrap:wrap;}' +
    '#hooray-cookie-banner .hcb-text{margin:0;font-size:0.85rem;line-height:1.6;flex:1 1 320px;}' +
    '#hooray-cookie-banner .hcb-text a{color:#fc3a3c;text-decoration:underline;}' +
    '#hooray-cookie-banner .hcb-actions{display:flex;gap:0.6rem;flex-shrink:0;}' +
    '#hooray-cookie-banner .hcb-btn{cursor:pointer;border-radius:999px;padding:0.55rem 1.4rem;font-weight:600;' +
    'font-size:0.85rem;border:none;transition:transform .15s ease,opacity .15s ease;}' +
    '#hooray-cookie-banner .hcb-btn:hover{transform:translateY(-1px);}' +
    '#hooray-cookie-banner .hcb-btn:active{transform:translateY(0);}' +
    '#hooray-cookie-banner .hcb-accept{background:#fc3a3c;color:#fff;}' +
    '#hooray-cookie-banner .hcb-decline{background:transparent;color:#faf7f2;border:1px solid rgba(250,247,242,0.4);}' +
    '#hooray-cookie-banner .hcb-btn:focus-visible{outline:2px solid #fff;outline-offset:2px;}';
  (document.head || document.documentElement).appendChild(style);

  // Decide what to do based on prior choice.
  if (choice === 'granted') {
    grant();
  } else if (choice === 'denied') {
    /* stay denied; load nothing */
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
