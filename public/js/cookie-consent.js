// Default-deny GA4 gate: Google Analytics never loads until the visitor clicks Accept on the
// banner below. window.gtag is only ever defined once consent is given, so any inline
// `if (typeof gtag === 'function') gtag('event', ...)` call elsewhere on a page (e.g.
// sarang.html's download-funnel events) correctly stays silent until then too.
(function () {
  var GA_ID = 'G-QXB4ECJFTP';
  var STORAGE_KEY = 'aszurex_cookie_consent';

  function loadGA() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function getConsent() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function setConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* private browsing, etc. */ }
  }

  var consent = getConsent();
  if (consent === 'accepted') { loadGA(); return; }
  if (consent === 'declined') { return; }

  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.createElement('div');
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#111827;' +
      'color:#f9fafb;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;' +
      'justify-content:center;gap:12px;font-size:14px;box-shadow:0 -2px 10px rgba(0,0,0,.15);';
    banner.innerHTML =
      '<span style="max-width:640px;">We use basic analytics cookies to understand how visitors use this site. ' +
      '<a href="/privacy.html" style="color:#93c5fd;text-decoration:underline;">Learn more</a></span>' +
      '<span style="display:flex;gap:8px;flex-shrink:0;">' +
      '<button type="button" id="cookie-decline" style="padding:8px 16px;border-radius:8px;border:1px solid #4b5563;background:transparent;color:#f9fafb;cursor:pointer;">Decline</button>' +
      '<button type="button" id="cookie-accept" style="padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-weight:600;">Accept</button>' +
      '</span>';
    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', function () {
      setConsent('accepted');
      loadGA();
      banner.remove();
    });
    document.getElementById('cookie-decline').addEventListener('click', function () {
      setConsent('declined');
      banner.remove();
    });
  });
})();
