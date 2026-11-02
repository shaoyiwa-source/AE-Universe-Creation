/* AE site version label — the ONLY place the visible version is set.
   Each build changes AE_SITE_VERSION here and nothing else.
   Only a clean "v<major>.<minor>" label is ever shown; anything else (build/preview/date/test words) is refused. */
(function () {
  var AE_SITE_VERSION = 'v2476.64';
  if (!/^v\d+\.\d+$/.test(AE_SITE_VERSION)) return;
  function put() {
    var fs = document.querySelectorAll('footer');
    var f = fs[fs.length - 1];
    if (!f || f.querySelector('.ae-site-version')) return;
    var p = document.createElement('p');
    p.className = 'ae-site-version';
    p.setAttribute('translate', 'no');
    p.textContent = AE_SITE_VERSION;
    p.style.cssText = 'display:block;margin:10px 0 0;padding:0;font:400 10px/1.4 system-ui,-apple-system,sans-serif;letter-spacing:.08em;text-transform:none;color:inherit;opacity:.5;background:none';
    (f.querySelector(':scope > .wrap') || f).appendChild(p);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put();
})();
