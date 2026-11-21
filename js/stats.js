/* Private, invisible visit beacon + visit-context helper for the chat widget.
   Nothing is shown on the page. Hamid can exclude himself with ?owner=1 once. */
(function () {
  var WORKER = 'https://hamid-site-assistant.ha-ahmadiasl.workers.dev';
  var ANON_KEY = 'ha-anon-visit';
  var TRAIL_KEY = 'ha-page-trail';
  var START_KEY = 'ha-visit-start';
  var COUNTED_KEY = 'ha-visit-counted';
  var DAY_KEY_PREFIX = 'ha-stats-id-';

  try {
    var q = new URLSearchParams(location.search);
    if (q.get('owner') === '1') localStorage.setItem('hamid-owner', '1');
    if (q.get('owner') === '0') localStorage.removeItem('hamid-owner');
    if (localStorage.getItem('hamid-owner') === '1') {
      window.haVisitContext = function () { return null; };
      return;
    }
  } catch (e) { /* ignore */ }

  function romeDate(d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d || new Date());
  }

  function parseUA(ua) {
    ua = ua || '';
    var os = 'Unknown OS';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPad/i.test(ua)) os = 'iPadOS';
    else if (/iPhone|iPod/i.test(ua)) os = 'iOS';
    else if (/Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/CrOS/i.test(ua)) os = 'Chrome OS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    var browser = 'Unknown browser';
    var m;
    if (/Edg\//i.test(ua)) browser = 'Edge' + ((m = ua.match(/Edg\/(\d+)/)) ? ' ' + m[1] : '');
    else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome' + ((m = ua.match(/Chrome\/(\d+)/)) ? ' ' + m[1] : '');
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox' + ((m = ua.match(/Firefox\/(\d+)/)) ? ' ' + m[1] : '');
    var device = /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : (/iPad|Tablet/i.test(ua) ? 'tablet' : 'desktop');
    return { browser: browser, os: os, device: device };
  }

  function getAnon() {
    var rec = { id: '', visits: 0 };
    try {
      rec = JSON.parse(localStorage.getItem(ANON_KEY) || 'null') || rec;
    } catch (e) { rec = { id: '', visits: 0 }; }
    if (!rec.id || !/^[a-f0-9]{16,64}$/.test(rec.id)) {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      rec.id = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      rec.visits = 0;
    }
    try {
      if (!sessionStorage.getItem(COUNTED_KEY)) {
        rec.visits = (Number(rec.visits) || 0) + 1;
        sessionStorage.setItem(COUNTED_KEY, '1');
        localStorage.setItem(ANON_KEY, JSON.stringify({ id: rec.id, visits: rec.visits }));
      } else {
        localStorage.setItem(ANON_KEY, JSON.stringify({ id: rec.id, visits: rec.visits }));
      }
    } catch (e) { /* ignore */ }
    return rec;
  }

  function trailAndStart() {
    var now = Date.now();
    var start = now;
    var trail = [];
    try {
      start = Number(sessionStorage.getItem(START_KEY)) || now;
      if (!sessionStorage.getItem(START_KEY)) sessionStorage.setItem(START_KEY, String(start));
      trail = JSON.parse(sessionStorage.getItem(TRAIL_KEY) || '[]');
      if (!Array.isArray(trail)) trail = [];
      var path = location.pathname || '/';
      var last = trail[trail.length - 1];
      if (!last || last.path !== path) {
        trail.push({ path: path, t: now });
        if (trail.length > 20) trail = trail.slice(-20);
        sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail));
      }
    } catch (e) { trail = [{ path: location.pathname || '/', t: now }]; }
    return { start: start, trail: trail, landing: (trail[0] && trail[0].path) || (location.pathname || '/') };
  }

  function referrerHost() {
    try {
      if (!document.referrer) return '';
      var host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host === location.hostname) return '';
      return host;
    } catch (e) { return ''; }
  }

  function dailyHash() {
    var day = romeDate();
    var key = DAY_KEY_PREFIX + day;
    try {
      var id = localStorage.getItem(key);
      if (!id || !/^[a-f0-9]{16,64}$/.test(id)) {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        id = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        localStorage.setItem(key, id);
      }
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(DAY_KEY_PREFIX) === 0 && k !== key) localStorage.removeItem(k);
      });
      return id;
    } catch (e) { return ''; }
  }

  function collectContext() {
    var uaInfo = parseUA(navigator.userAgent || '');
    var anon = getAnon();
    var nav = trailAndStart();
    var screenSize = '';
    try {
      if (window.screen && screen.width && screen.height) screenSize = screen.width + '×' + screen.height;
    } catch (e) { /* ignore */ }
    return {
      browser: uaInfo.browser,
      os: uaInfo.os,
      device: uaInfo.device,
      screen: screenSize,
      language: navigator.language || '',
      referrer: referrerHost(),
      landing: nav.landing,
      trail: nav.trail,
      timeOnSite: Math.max(0, Math.round((Date.now() - nav.start) / 1000)),
      returning: anon.visits > 1,
      visits: anon.visits,
      anonId: anon.id,
    };
  }

  window.haVisitContext = collectContext;

  var ua = navigator.userAgent || '';
  if (navigator.webdriver) return;
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse|headless|wget|curl|python-requests/i.test(ua)) return;

  var ctx = collectContext();
  var payload = JSON.stringify({
    p: location.pathname || '/',
    r: ctx.referrer || '',
    v: dailyHash(),
    c: ctx,
  });
  var url = WORKER + '/hit';
  try {
    var blob = new Blob([payload], { type: 'text/plain' });
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
  } catch (e) { /* fall through */ }
  try {
    fetch(url, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    });
  } catch (e) { /* ignore */ }
})();
