/*
 * Hooray HQ — Google Analytics 4.
 * Loads GA4 on every page for all visitors (NZ-only traffic; no consent banner).
 * GA4 does not log or store IP addresses, and usage data is aggregated/anonymous.
 * This is disclosed in privacy.html.
 *
 * Note: if a Meta/advertising pixel or remarketing is ever added, revisit whether
 * a consent banner is needed — advertising cookies are more sensitive than analytics.
 */
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
