/* SOMON FOOD — UI kit: state, router, i18n helpers, icons, food art, map view, toasts, modals. */
var SF = (function () {
  var SF = { routes: [], actions: {}, forms: {}, inputs: {}, after: [], state: {}, live: false };
  var root = typeof window !== "undefined" ? window : {};

  /* ---------- storage ---------- */
  SF.ls = {
    get: function (k, d) { try { var v = root.localStorage.getItem("somon." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { root.localStorage.setItem("somon." + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- text ---------- */
  SF.esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  SF.t = function (key, p) {
    var row = SF.I18N[key], s = row ? (row[SF.state.lang] || row.tg) : "⟦" + key + "⟧";
    if (p) s = s.replace(/\{(\w+)\}/g, function (_, k) { var v = p[k]; return v == null ? "" : typeof v === "object" ? SF.tx(v) : v; });
    return s;
  };
  SF.tx = function (obj) { if (obj == null) return ""; if (typeof obj === "string") return obj; return obj[SF.state.lang] || obj.tg || obj.ru || ""; };
  SF.money = function (n) { n = Math.round(n || 0); var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); return SF.state.lang === "en" ? s + " TJS" : s + " " + SF.t("cur"); };
  SF.time = function (ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  SF.date = function (ms) { var d = new Date(ms); return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0"); };
  SF.dt = function (ms) { return SF.date(ms) + " · " + SF.time(ms); };
  SF.phone = function (p) { return SomonRules.fmtPhone(p); };
  SF.err = function (e) { var code = e && e.code || "SERVER_ERROR", k = "e." + code; return SF.I18N[k] ? SF.t(k, e.data) : SF.t("e.SERVER_ERROR") + " (" + code + ")"; };

  /* ---------- icons (24px line set) ---------- */
  var P = {
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>', link: '<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>', navarrow: '<path d="M3 11l18-8-8 18-2-8z"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a1 1 0 001 .8h9.7a1 1 0 001-.8L21 7H6"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    pin: '<path d="M12 21s-7-6.4-7-12a7 7 0 0114 0c0 5.6-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', plus: '<path d="M12 5v14M5 12h14"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', chat: '<path d="M4 19.5l1.4-4A8 8 0 1 1 8.5 19l-4.5.5z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>', sms: '<rect x="3" y="5" width="18" height="13" rx="3"/><path d="M8 21l3-3M7 10h10M7 13h6"/>', minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', chevL: '<path d="M15 5l-7 7 7 7"/>', chevR: '<path d="M9 5l7 7-7 7"/>', chevD: '<path d="M6 9l6 6 6-6"/>', check: '<path d="M5 12l5 5 9-10"/>',
    bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', logout: '<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>', scooter: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h5l3 8M13 9V6h-3"/>',
    store: '<path d="M4 9l1-5h14l1 5M4 9h16v11H4zM4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M10 20v-5h4v5"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.4 3.4-5 7-5s6.2 1.6 7 5M16 4.5a3.5 3.5 0 010 7M18 15c2 .6 3.4 2.3 4 5"/>', list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    tag: '<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>', gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
    city: '<path d="M3 21h18M5 21V8l5-3v16M10 21V10h9v11M13 13h3M13 17h3"/>', cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>', cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    fire: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', wallet: '<path d="M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14h.01"/>',
    map: '<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4z"/><path d="M9 4v13.5M15 6.5V20"/>', route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 000-7H8a3.5 3.5 0 010-7h7.5"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>', percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20z"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    ticket: '<path d="M3 8a2 2 0 002-2h14a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H5a2 2 0 00-2-2v-2a2 2 0 000-4z"/><path d="M10 6v12" stroke-dasharray="2 2"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .6-1.5 1.2-1.5 2.3M12 17h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'
  };
  SF.icon = function (n, s) { return '<svg class="ic" width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>"; };

  /* ---------- brand ---------- */
  /* brand: Тезкор ("fast"). Mark: a forward-leaning T with speed lines on an orange tile. Change in one place (or SOMON_CONFIG.brand). */
  var BC = (root.SOMON_CONFIG || {}).brand || {};
  SF.BRAND = { tg: BC.tg || "Тезкор", ru: BC.ru || "Тезкор", en: BC.en || "Tezkor" };
  SF.brand = function () { return SF.BRAND[SF.state.lang] || SF.BRAND.tg; };
  /* mark: a map pin with a T cut out of it and a dot for the door, on a deep-green tile (logo «Манзил-Т») */
  SF.markInner = '<path d="M60 12C37 12 22 29 22 50C22 75 60 104 60 104C60 104 98 75 98 50C98 29 83 12 60 12Z" fill="#E8590C"/><rect x="40" y="35" width="40" height="11" rx="3" fill="#fff"/><rect x="54.5" y="35" width="11" height="34" rx="3" fill="#fff"/><circle cx="60" cy="110" r="4.5" fill="#E8590C"/>';
  SF.mark = function (s) { s = s || 36; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" rx="28" fill="#0B5D3B"/><g transform="translate(60 60) scale(.78) translate(-60 -60)">' + SF.markInner + "</g></svg>"; };
  SF.logo = function () { return '<span class="logo">' + SF.mark(34) + '<span class="wm"><b>' + SF.esc(SF.brand()) + "</b><i>" + SF.esc(SF.t("brand.sub")) + "</i></span></span>"; };

  /* ---------- food art (original illustrations) ---------- */
  var A = {
    plov: '<ellipse cx="50" cy="66" rx="42" ry="15" fill="#fff"/><ellipse cx="50" cy="64" rx="36" ry="11" fill="#EDE6DA"/><path d="M18 63Q22 34 50 29Q78 34 82 63Q50 72 18 63Z" fill="#F0C467"/><path d="M32 50l7 4M45 41l5 7M58 44l6 5M38 58l6 2M56 57l7 1M66 52l5 3" stroke="#E8590C" stroke-width="3.2" stroke-linecap="round"/><circle cx="50" cy="35" r="5.5" fill="#8A4B2A"/><circle cx="63" cy="51" r="4.5" fill="#8A4B2A"/><circle cx="40" cy="47" r="4.5" fill="#8A4B2A"/><circle cx="50" cy="56" r="3.5" fill="#FFF7E0"/>',
    qurutob: '<ellipse cx="50" cy="64" rx="44" ry="18" fill="#C8A37A"/><ellipse cx="50" cy="61" rx="38" ry="13" fill="#EADBC4"/><path d="M22 60q6-8 14-2t14-2 14 2 14-2" fill="#F6EEDC"/><circle cx="34" cy="55" r="4" fill="#E03131"/><circle cx="58" cy="53" r="4" fill="#E03131"/><circle cx="46" cy="62" r="3.5" fill="#E03131"/><path d="M28 62l6-3M40 52l5 3M62 60l6-2M52 58l5-4" stroke="#2F9E44" stroke-width="3" stroke-linecap="round"/><path d="M38 66q4-3 8 0M56 64q4-3 8 0" stroke="#F1E2FF" stroke-width="2.5" fill="none"/>',
    lagman: '<path d="M12 46H88Q86 80 50 82Q14 80 12 46Z" fill="#1F5FA8"/><path d="M20 62Q50 72 80 62" stroke="#fff" stroke-width="2.5" fill="none" opacity=".55"/><ellipse cx="50" cy="46" rx="38" ry="10" fill="#D9822B"/><path d="M20 47q6-6 12 0t12 0 12 0 12 0 12 0" stroke="#F7DA8E" stroke-width="3.2" fill="none"/><path d="M27 42q6-5 12 0t12 0 12 0 10 0" stroke="#F7DA8E" stroke-width="3.2" fill="none"/><circle cx="40" cy="39" r="3.2" fill="#2F9E44"/><circle cx="61" cy="41" r="3.2" fill="#E03131"/>',
    mantu: '<ellipse cx="50" cy="68" rx="42" ry="13" fill="#fff"/><g fill="#F6EBD5" stroke="#E2CFAE" stroke-width="1.5"><path d="M18 62q4-18 14-18t14 18z"/><path d="M42 60q4-20 14-20t14 20z"/><path d="M30 68q4-16 12-16t12 16z"/><path d="M56 68q4-16 12-16t12 16z"/></g><path d="M26 48q3 4 6 0M50 44q3 4 6 0" stroke="#E2CFAE" stroke-width="1.5" fill="none"/><circle cx="74" cy="44" r="6" fill="#FFF" stroke="#E2CFAE"/><path d="M71 44h6" stroke="#2F9E44" stroke-width="2"/>',
    soup: '<path d="M12 44H88Q86 80 50 82Q14 80 12 44Z" fill="#fff" stroke="#D5DAE2" stroke-width="1.5"/><ellipse cx="50" cy="44" rx="38" ry="10" fill="#E9A23B"/><circle cx="38" cy="43" r="5" fill="#F4D58D"/><circle cx="58" cy="45" r="5" fill="#F4D58D"/><circle cx="48" cy="40" r="4" fill="#8A4B2A"/><path d="M30 46l5-2M62 41l5 2" stroke="#2F9E44" stroke-width="2.5" stroke-linecap="round"/><path d="M42 30q-4-6 0-12M54 30q-4-6 0-12" stroke="#B9C3CF" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
    tea: '<ellipse cx="50" cy="79" rx="30" ry="6" fill="#000" opacity=".08"/><path d="M18 44H82Q80 76 50 78Q20 76 18 44Z" fill="#fff" stroke="#C9D2DE" stroke-width="1.5"/><path d="M21 56H79" stroke="#1F5FA8" stroke-width="5"/><ellipse cx="50" cy="44" rx="32" ry="7" fill="#A2913C"/><path d="M40 32q-4-6 0-12M52 32q-4-6 0-12M64 32q-4-6 0-12" stroke="#AEB8C4" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
    burger: '<path d="M18 46q0-24 32-24t32 24z" fill="#E9A23B"/><g fill="#FFF3D1"><circle cx="38" cy="32" r="1.6"/><circle cx="50" cy="28" r="1.6"/><circle cx="62" cy="32" r="1.6"/><circle cx="44" cy="38" r="1.6"/><circle cx="58" cy="38" r="1.6"/></g><path d="M16 50q8-6 16 0t16 0 16 0 18 0" stroke="#5DAE3F" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M18 52h64l-4 8H22z" fill="#F5C542"/><rect x="16" y="58" width="68" height="10" rx="5" fill="#7A3B1E"/><path d="M18 70h64q0 10-10 10H28q-10 0-10-10z" fill="#E9A23B"/>',
    fries: '<g fill="#F5C542" stroke="#E0A81E" stroke-width="1"><rect x="30" y="18" width="7" height="40" rx="2" transform="rotate(-8 33 38)"/><rect x="40" y="14" width="7" height="44" rx="2"/><rect x="50" y="16" width="7" height="42" rx="2" transform="rotate(6 53 37)"/><rect x="60" y="20" width="7" height="38" rx="2" transform="rotate(12 63 39)"/></g><path d="M24 44h52l-6 38H30z" fill="#D62839"/><path d="M38 60q12 8 24 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
    drink: '<path d="M30 26h40l-5 56H35z" fill="#E7F5EE" stroke="#BFD9CC" stroke-width="1.5"/><path d="M32 40h36l-4 40H36z" fill="#F7E36B"/><circle cx="44" cy="54" r="4" fill="#fff" opacity=".7"/><circle cx="56" cy="66" r="3" fill="#fff" opacity=".7"/><path d="M60 12l-6 30" stroke="#E8590C" stroke-width="3" stroke-linecap="round"/><path d="M40 44q5-4 10 0" stroke="#2F9E44" stroke-width="3" fill="none"/>',
    juice: '<path d="M32 22h36l-4 60H36z" fill="#FBE5E8" stroke="#E7B9C0" stroke-width="1.5"/><path d="M34 36h32l-3 44H37z" fill="#B3122B"/><circle cx="70" cy="30" r="10" fill="#C2203A"/><path d="M66 22l4-4 4 4" stroke="#2F9E44" stroke-width="2.5" fill="none"/><g fill="#FFD0D8"><circle cx="46" cy="52" r="2"/><circle cx="54" cy="60" r="2"/><circle cx="48" cy="68" r="2"/></g>',
    pizza: '<circle cx="50" cy="52" r="38" fill="#E9A23B"/><circle cx="50" cy="52" r="32" fill="#F5D07A"/><g fill="#D62839"><circle cx="38" cy="40" r="6"/><circle cx="62" cy="44" r="6"/><circle cx="46" cy="64" r="6"/><circle cx="66" cy="64" r="5"/><circle cx="32" cy="58" r="5"/></g><g fill="#2F9E44"><ellipse cx="52" cy="34" rx="4" ry="2.4"/><ellipse cx="56" cy="56" rx="4" ry="2.4"/><ellipse cx="40" cy="52" rx="4" ry="2.4"/></g><path d="M50 52L50 14M50 52L84 66M50 52L22 74" stroke="#E0A030" stroke-width="1.5"/>',
    salad: '<path d="M14 48H86Q84 78 50 80Q16 78 14 48Z" fill="#fff" stroke="#C9D2DE" stroke-width="1.5"/><circle cx="35" cy="44" r="9" fill="#E03131"/><circle cx="58" cy="42" r="10" fill="#E03131"/><circle cx="48" cy="49" r="7" fill="#74B816"/><circle cx="71" cy="48" r="7" fill="#74B816"/><circle cx="27" cy="50" r="6" fill="#74B816"/><path d="M36 39q8-6 16 0M56 36q6-5 12 0" stroke="#fff" stroke-width="2.6" fill="none"/>',
    shashlik: '<g transform="rotate(-24 50 50)"><path d="M6 42H94M6 62H94" stroke="#9AA3AE" stroke-width="3" stroke-linecap="round"/><g fill="#8A4B2A"><rect x="20" y="34" width="13" height="16" rx="4.5"/><rect x="54" y="34" width="13" height="16" rx="4.5"/><rect x="41" y="54" width="13" height="16" rx="4.5"/><rect x="75" y="54" width="9" height="16" rx="4"/></g><g fill="#A0582F"><rect x="37" y="34" width="13" height="16" rx="4.5"/><rect x="71" y="34" width="11" height="16" rx="4.5"/><rect x="24" y="54" width="13" height="16" rx="4.5"/><rect x="58" y="54" width="13" height="16" rx="4.5"/></g></g><path d="M22 80q8-6 16 0M46 82q8-6 16 0" stroke="#C2255C" stroke-width="3" fill="none" stroke-linecap="round"/>',
    kebab: '<ellipse cx="50" cy="62" rx="44" ry="18" fill="#fff"/><ellipse cx="50" cy="61" rx="36" ry="12" fill="#EDE6DA"/><rect x="18" y="47" width="64" height="11" rx="5.5" fill="#8A4B2A"/><rect x="22" y="60" width="58" height="11" rx="5.5" fill="#A0582F"/><path d="M28 45q6-4 12 0M52 44q6-4 12 0" stroke="#C2255C" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="74" cy="45" r="3.4" fill="#2F9E44"/><circle cx="28" cy="74" r="3.4" fill="#2F9E44"/>',
    bread: '<ellipse cx="50" cy="56" rx="41" ry="35" fill="#C9772D"/><ellipse cx="50" cy="56" rx="27" ry="22" fill="#E6A65A"/><ellipse cx="50" cy="56" rx="27" ry="22" fill="none" stroke="#B5651F" stroke-width="3"/><g fill="#A85E1F"><circle cx="42" cy="48" r="1.8"/><circle cx="50" cy="46" r="1.8"/><circle cx="58" cy="48" r="1.8"/><circle cx="40" cy="57" r="1.8"/><circle cx="50" cy="56" r="1.8"/><circle cx="60" cy="57" r="1.8"/><circle cx="44" cy="65" r="1.8"/><circle cx="56" cy="65" r="1.8"/></g>',
    samsa: '<ellipse cx="50" cy="79" rx="34" ry="6" fill="#000" opacity=".08"/><path d="M14 74L50 18L86 74Q50 83 14 74Z" fill="#C97A2C"/><path d="M25 70L50 31L75 70Q50 77 25 70Z" fill="#E7A24C"/><g fill="#FFF4D6"><circle cx="45" cy="50" r="1.8"/><circle cx="53" cy="56" r="1.8"/><circle cx="48" cy="62" r="1.8"/><circle cx="57" cy="45" r="1.8"/><circle cx="40" cy="64" r="1.8"/><circle cx="60" cy="64" r="1.8"/></g>',
    dessert: '<path d="M14 70h72l-8 10H22z" fill="#D9C4A0"/><g fill="#E9B44C" stroke="#B9822A" stroke-width="1.5"><path d="M18 70l14-26 14 26z"/><path d="M42 70l14-26 14 26z"/><path d="M30 46l12 24h-24z" transform="translate(28 0)"/></g><g fill="#5C8A2E"><circle cx="32" cy="58" r="2.5"/><circle cx="56" cy="58" r="2.5"/><circle cx="70" cy="60" r="2.5"/></g><path d="M20 66h60" stroke="#B9822A" stroke-width="1.2" stroke-dasharray="3 3"/>',
    cake: '<path d="M20 50h60v28H20z" fill="#F4E1C1"/><path d="M20 58h60M20 68h60" stroke="#C99E62" stroke-width="3"/><path d="M20 50l30-22 30 22z" fill="#FCEFD9" stroke="#C99E62" stroke-width="1.5"/><circle cx="50" cy="26" r="5" fill="#D62839"/><path d="M50 21q2-6 6-6" stroke="#2F9E44" stroke-width="2" fill="none"/>',
    icecream: '<path d="M34 50l16 36 16-36z" fill="#E6A65A"/><path d="M36 54l28 0M40 62l20 0M44 70l12 0" stroke="#C9772D" stroke-width="1.5"/><circle cx="40" cy="44" r="12" fill="#B8E0A8"/><circle cx="60" cy="44" r="12" fill="#B8E0A8"/><circle cx="50" cy="30" r="13" fill="#CDEBC0"/><g fill="#5C8A2E"><circle cx="46" cy="28" r="1.8"/><circle cx="56" cy="34" r="1.8"/><circle cx="40" cy="42" r="1.8"/></g>',
    coffee: '<path d="M22 40h48v14a22 22 0 01-44 0" fill="#fff" stroke="#C9D2DE" stroke-width="1.5"/><path d="M70 44h6a8 8 0 010 16h-8" stroke="#C9D2DE" stroke-width="4" fill="none"/><ellipse cx="46" cy="40" rx="24" ry="5" fill="#8A5A3B"/><path d="M40 40q6-4 12 0" stroke="#F3E1C9" stroke-width="2.5" fill="none"/><ellipse cx="46" cy="80" rx="30" ry="5" fill="#E7EAF0"/>',
    shawarma: '<g transform="rotate(-30 50 50)"><path d="M34 14h32l-4 70H38z" fill="#EBD3A6"/><path d="M34 14q16-10 32 0l-2 10H36z" fill="#8A4B2A"/><path d="M36 20q6 4 10 0t10 0 8 0" stroke="#74B816" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="44" cy="22" r="3" fill="#E03131"/><path d="M38 40h24M37 54h26M38 68h24" stroke="#D2B37C" stroke-width="1.5"/><path d="M36 84h28l-1 6H37z" fill="#D62839"/></g>',
    ayran: '<path d="M32 22h36l-4 60H36z" fill="#F7F8FA" stroke="#C9D2DE" stroke-width="1.5"/><path d="M34 34h32l-3 46H37z" fill="#fff"/><path d="M34 34q8 4 16 0t16 0" stroke="#DCE3EC" stroke-width="2" fill="none"/><path d="M44 46l4 6M54 58l-3 5" stroke="#2F9E44" stroke-width="2.5" stroke-linecap="round"/>',
    sushi: '<ellipse cx="50" cy="80" rx="40" ry="6" fill="#000" opacity=".08"/><rect x="10" y="62" width="80" height="14" rx="4" fill="#3B3F45"/><g><ellipse cx="30" cy="52" rx="16" ry="12" fill="#1F2A24"/><ellipse cx="30" cy="50" rx="12" ry="8" fill="#F7F4EE"/><ellipse cx="30" cy="49" rx="6" ry="4" fill="#F28B5B"/></g><g><ellipse cx="70" cy="52" rx="16" ry="12" fill="#1F2A24"/><ellipse cx="70" cy="50" rx="12" ry="8" fill="#F7F4EE"/><ellipse cx="70" cy="49" rx="6" ry="4" fill="#7CC58C"/></g><path d="M38 40q12-12 26-4l-2 6q-12-6-22 2z" fill="#F28B5B"/><path d="M40 38q10-6 20-2" stroke="#fff" stroke-width="1.5" fill="none" opacity=".7"/>',
    grocery: '<ellipse cx="50" cy="84" rx="34" ry="5" fill="#000" opacity=".08"/><path d="M18 42h64l-6 38H24z" fill="#E9B97A"/><path d="M18 42h64l-2 8H20z" fill="#D49A55"/><circle cx="34" cy="34" r="12" fill="#E8463A"/><path d="M34 22q4-6 9-5" stroke="#3A7D44" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M52 20l4 22h-12z" fill="#F2A33A"/><path d="M50 20q2-6 8-4" stroke="#3A7D44" stroke-width="3" fill="none"/><rect x="62" y="22" width="12" height="22" rx="3" fill="#E7F5EE" stroke="#9CC9B2" stroke-width="1.5"/><rect x="62" y="28" width="12" height="6" fill="#2E8B57"/>',
    box: '<ellipse cx="50" cy="84" rx="34" ry="5" fill="#000" opacity=".08"/><path d="M16 34l34-14 34 14v40L50 88 16 74z" fill="#D9A15E"/><path d="M16 34l34 14 34-14" stroke="#B57C3C" stroke-width="2.5" fill="none"/><path d="M50 48v40" stroke="#B57C3C" stroke-width="2.5"/><path d="M33 27l34 14v12l-8-3V44L25 30z" fill="#F2D9B4"/>',
    plate: '<ellipse cx="50" cy="60" rx="42" ry="20" fill="#fff"/><ellipse cx="50" cy="58" rx="28" ry="12" fill="#EDE6DA"/><path d="M84 30v34M80 30v12q4 4 8 0V30" stroke="#9AA3AE" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    scooter: '<rect x="18" y="30" width="26" height="22" rx="4" fill="#fff"/><path d="M24 36h14M24 42h10" stroke="#E8590C" stroke-width="3" stroke-linecap="round"/><path d="M20 60h40l10-18h6l-8 22q-2 5-7 5H20z" fill="#F7C948"/><path d="M68 42l4-10" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="28" cy="72" r="9" fill="#15171C"/><circle cx="70" cy="72" r="9" fill="#15171C"/><circle cx="28" cy="72" r="3.5" fill="#fff"/><circle cx="70" cy="72" r="3.5" fill="#fff"/>'
  };
  SF.KINDS = Object.keys(A).filter(function (k) { return k !== "scooter"; });
  SF.art = function (k, s) { return '<svg class="art" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" aria-hidden="true">' + (A[k] || A.plate) + "</svg>"; };
  /* password field with a show/hide eye — typing a password blind is the main reason people "forget" it */
  SF.pwInput = function (name, ac, extra) { return '<span class="pwin"><input type="password" name="' + name + '" autocomplete="' + ac + '" autocapitalize="off" autocorrect="off" spellcheck="false"' + (extra || "") + '><button type="button" class="pweye" data-act="pweye" aria-label="' + SF.t("pw.show") + '" aria-pressed="false">' + SF.icon("eye", 18) + "</button></span>"; };
  SF.actions = SF.actions || {};
  SF.actions.pweye = function (el) { var i = el.parentNode.querySelector("input"), show = i.type === "password"; i.type = show ? "text" : "password"; el.setAttribute("aria-pressed", show); el.classList.toggle("on", show); el.setAttribute("aria-label", SF.t(show ? "pw.hide" : "pw.show")); i.focus(); };
  /* a dish: its real photo when the restaurant uploaded one, otherwise the drawn picture */
  SF.pic = function (p, s) { return p && p.photo ? '<img class="ph" src="' + SF.esc(p.photo) + '" alt="" loading="lazy" decoding="async">' : SF.art(p && p.kind, s); };
  SF.sale = function (p) { return p && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0; };
  /* shrink a picked photo in the phone before upload: long side `max` px, JPEG */
  SF.shrinkImage = function (file, max, q) { return new Promise(function (ok, no) {
    if (!file || !/^image\//.test(file.type)) return no(new Error("NOT_IMAGE"));
    var rd = new FileReader(); rd.onload = function () { var img = new Image(); img.onload = function () {
      var k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); ok(cv.toDataURL("image/jpeg", q || 0.78)); };
      img.onerror = function () { no(new Error("NOT_IMAGE")); }; img.src = rd.result; }; rd.onerror = no; rd.readAsDataURL(file); }); };

  /* ---------- schematic map (MapProvider "schematic"; swap for Leaflet / Yandex / 2GIS in production) ---------- */
  var MW = 400, MH = 280, DLAT = 0.035, DLNG = 0.045;
  SF.map = {
    proj: function (c, lat, lng) { return { x: (lng - (c.lng - DLNG)) / (2 * DLNG) * MW, y: ((c.lat + DLAT) - lat) / (2 * DLAT) * MH }; },
    unproj: function (c, x, y) { return { lat: (c.lat + DLAT) - y / MH * 2 * DLAT, lng: (c.lng - DLNG) + x / MW * 2 * DLNG }; },
    view: function (o) {
      var c = o.center, g = '<rect width="400" height="280" class="m-land"/>';
      g += '<path class="m-river" d="M-10 205 C 60 180, 120 230, 190 200 S 320 150, 410 175"/>';
      g += '<rect class="m-park" x="40" y="30" width="70" height="46" rx="10"/><rect class="m-park" x="290" y="200" width="80" height="50" rx="10"/>';
      var blocks = [[130, 20, 60, 40], [210, 20, 70, 40], [300, 20, 80, 50], [20, 100, 80, 50], [130, 90, 60, 50], [210, 90, 70, 60], [300, 100, 80, 40], [20, 230, 70, 40], [130, 150, 60, 30], [210, 225, 60, 45]];
      blocks.forEach(function (b) { g += '<rect class="m-blk" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="6"/>'; });
      g += '<path class="m-rd m-main" d="M0 82 H400"/><path class="m-rd m-main" d="M200 0 V280"/><path class="m-rd" d="M0 160 H400"/><path class="m-rd" d="M115 0 V280"/><path class="m-rd" d="M292 0 V280"/><path class="m-rd" d="M0 0 L400 280" opacity=".55"/>';
      g += '<text class="m-lbl" x="206" y="76">' + SF.esc(SF.t("map.center")) + '</text><text class="m-lbl" x="8" y="272">' + SF.esc(SF.t("map.schematic")) + "</text>";
      if (o.route) { var a = SF.map.proj(c, o.route[0].lat, o.route[0].lng), b = SF.map.proj(c, o.route[1].lat, o.route[1].lng), mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 30;
        g += '<path class="m-route" d="M' + a.x.toFixed(1) + " " + a.y.toFixed(1) + " Q " + mx.toFixed(1) + " " + my.toFixed(1) + " " + b.x.toFixed(1) + " " + b.y.toFixed(1) + '"/>'; }
      (o.markers || []).forEach(function (m) { if (m.lat == null) return; var p = SF.map.proj(c, m.lat, m.lng);
        var tgt = m.to ? SF.map.proj(c, m.to.lat, m.to.lng) : null, anim = tgt && m.ms > 0 && !SF.reduced ? '<animateTransform attributeName="transform" type="translate" from="' + p.x.toFixed(1) + " " + p.y.toFixed(1) + '" to="' + tgt.x.toFixed(1) + " " + tgt.y.toFixed(1) + '" dur="' + Math.round(m.ms / 1000) + 's" fill="freeze"/>' : "";
        var inner = m.type === "courier" ? '<circle r="15" class="m-cour"/><path d="M-7-3h7l3 6M-6 4a2.5 2.5 0 100 .1M6 4a2.5 2.5 0 100 .1" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle r="15" class="m-pulse"/>'
          : '<path class="m-pin m-' + m.type + '" d="M0 0C-4-8-12-12-12-21A12 12 0 1 1 12-21C12-12 4-8 0 0Z"/><text class="m-pt" y="-17">' + SF.esc(m.label || "") + "</text>";
        g += '<g transform="translate(' + p.x.toFixed(1) + "," + p.y.toFixed(1) + ')"' + (m.id ? ' data-act="' + (m.action || "mapsel") + '" data-id="' + m.id + '" class="m-click"' : "") + ">" + anim + inner + "</g>"; });
      return '<svg class="map' + (o.picker ? " picker" : "") + '" viewBox="0 0 400 280" role="img" aria-label="' + SF.esc(o.label || SF.t("map.title")) + '"' + (o.picker ? ' data-act="mappick" data-lat="' + c.lat + '" data-lng="' + c.lng + '"' : "") + ">" + g + "</svg>";
    }
  };

  /* ---------- toast / modal ---------- */
  SF.toast = function (msg, kind) {
    var el = document.createElement("div"); el.className = "toast " + (kind || "ok"); el.setAttribute("role", "status");
    el.innerHTML = '<span class="ti">' + SF.icon(kind === "err" ? "info" : kind === "info" ? "bell" : "check", 16) + "</span><span>" + SF.esc(msg) + "</span>";
    var box = document.getElementById("toasts"); if (!box) return; box.appendChild(el); setTimeout(function () { el.classList.add("out"); setTimeout(function () { el.remove(); }, 400); }, 3600);
  };
  SF.modal = function (html, cls) { var m = document.getElementById("modal"); m.innerHTML = '<div class="mbg" data-act="closemodal"></div><div class="sheet ' + (cls || "") + '" role="dialog" aria-modal="true">' + html + "</div>"; m.hidden = false;
    /* on phones do not jump to the first field: the keyboard would cover the form and scroll its top away */
    var touch = root.matchMedia && root.matchMedia("(pointer: coarse)").matches;
    var f = !touch && m.querySelector("input,button:not(.mx)"); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60); };
  SF.closeModal = function () { var m = document.getElementById("modal"); if (m) { m.hidden = true; m.innerHTML = ""; } };
  SF.actions.closemodal = SF.closeModal;

  SF.beep = function () { try { SF._ac = SF._ac || new (root.AudioContext || root.webkitAudioContext)(); var ac = SF._ac;
    [0, 0.16].forEach(function (d) { var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = d ? 1175 : 880; o.connect(g); g.connect(ac.destination);
      var t = ac.currentTime + d; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.start(t); o.stop(t + 0.16); }); } catch (e) {} };

  /* ---------- router ---------- */
  SF.route = function (pattern, opts) { var keys = [], re = new RegExp("^" + pattern.replace(/:(\w+)/g, function (_, k) { keys.push(k); return "([^/]+)"; }) + "$"); SF.routes.push(Object.assign({ re: re, keys: keys, pattern: pattern }, opts)); };
  SF.go = function (path) { if (root.location) { if (root.location.hash === "#" + path) SF.render(); else root.location.hash = path; } else { SF._path = path; return SF.render(); } };
  SF.path = function () { return root.location ? (root.location.hash.slice(1) || "/") : (SF._path || "/"); };
  SF.homeOf = function (u) { return !u ? "/" : u.role === "restaurant" ? "/rest" : u.role === "courier" ? "/courier" : u.role === "admin" ? "/admin" : "/"; };
  SF.match = function (path) { var p = path.split("?")[0];
    for (var i = 0; i < SF.routes.length; i++) { var r = SF.routes[i], m = p.match(r.re); if (m) { var params = {}; r.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); }); var q = {}; (path.split("?")[1] || "").split("&").forEach(function (kv) { if (kv) { var a = kv.split("="); q[a[0]] = decodeURIComponent(a[1] || ""); } }); return { route: r, params: params, query: q }; } }
    return null; };
  SF.renderSeq = 0;
  SF.render = function (opts) {
    opts = opts || {}; var path = SF.path(), m = SF.match(path), u = SF.state.user, seq = ++SF.renderSeq;
    if (!m) { SF.go(SF.homeOf(u)); return Promise.resolve(); }
    var r = m.route;
    if (r.roles) { if (!u) { SF.state.after = path; SF.go("/login"); return Promise.resolve(); } if (r.roles.indexOf(u.role) < 0) { SF.go(SF.homeOf(u)); return Promise.resolve(); } }
    if (r.guest && u) { SF.go(SF.homeOf(u)); return Promise.resolve(); }
    var app = document.getElementById("app");
    if (!opts.quiet && app && !app.firstChild) app.innerHTML = '<div class="boot">' + SF.mark(56) + "</div>";
    return Promise.resolve(r.render(m.params, m.query)).then(function (html) {
      if (seq !== SF.renderSeq) return;
      var shell = (r.shell || SF.shells.customer)(html, r, m);
      var scroller = document.scrollingElement, y = scroller ? scroller.scrollTop : 0;
      app.innerHTML = shell; app.setAttribute("data-role", u ? u.role : "guest");
      /* the restaurant panel is always light (easier to read in the kitchen), whatever the phone's dark mode */
      if (u && u.role === "restaurant") document.documentElement.setAttribute("data-theme", "light"); else document.documentElement.removeAttribute("data-theme"); app.classList.toggle("noanim", !!opts.quiet);
      if (opts.quiet && scroller) scroller.scrollTop = y; else if (scroller && SF._lastPath !== path) scroller.scrollTop = 0;
      SF._lastPath = path; SF.live = !!r.live;
      document.title = (r.title ? SF.t(r.title) + " · " : "") + SF.brand();
      SF.after.forEach(function (f) { try { f(m); } catch (e) {} });
    }).catch(function (e) { if (e && e.status === 401) { SF.logout(true); return; } if (app) app.innerHTML = SF.shells.bare('<div class="page center"><div class="empty">' + SF.icon("info", 40) + "<b>" + SF.esc(SF.err(e)) + '</b><button class="btn" data-go="' + SF.homeOf(u) + '">' + SF.t("btn.home") + "</button></div></div>"); if (typeof console !== "undefined") console.error(e); });
  };
  SF.shells = {};

  /* ---------- cart ---------- */
  SF.cart = {
    get: function () { return SF.state.cart || { restaurantId: null, items: {} }; },
    save: function () { SF.ls.set("cart", SF.state.cart); },
    count: function () { var c = SF.cart.get(); return Object.keys(c.items).reduce(function (s, k) { return s + c.items[k]; }, 0); },
    qty: function (pid) { return SF.cart.get().items[pid] || 0; },
    add: function (p, n) { var c = SF.cart.get(); if (c.restaurantId && c.restaurantId !== p.restaurantId && SF.cart.count()) return false;
      c.restaurantId = p.restaurantId; c.items[p.id] = Math.min(50, (c.items[p.id] || 0) + (n || 1)); SF.state.cart = c; SF.cart.save(); return true; },
    dec: function (pid) { var c = SF.cart.get(); if (!c.items[pid]) return; c.items[pid]--; if (!c.items[pid]) delete c.items[pid]; if (!SF.cart.count()) c.restaurantId = null; SF.state.cart = c; SF.cart.save(); },
    remove: function (pid) { var c = SF.cart.get(); delete c.items[pid]; if (!SF.cart.count()) c.restaurantId = null; SF.state.cart = c; SF.cart.save(); },
    clear: function () { SF.state.cart = { restaurantId: null, items: {} }; SF.cart.save(); }
  };

  /* ---------- small view helpers ---------- */
  SF.stars = function (r) { return r == null ? '<span class="rate new">' + SF.t("rest.new") + "</span>" : '<span class="rate">' + SF.icon("star", 14) + "<b>" + Number(r).toFixed(1) + "</b></span>"; };
  SF.statusPill = function (s) { var c = { awaiting_payment: "warn", pending: "brand", cooking: "warn", ready: "ok", picked_up: "info", delivered: "ok", rejected: "bad", cancelled: "mut" }[s] || "mut"; return '<span class="pill p-' + c + '">' + SF.t("st." + s) + "</span>"; };
  SF.empty = function (icon, title, sub, btn) { return '<div class="empty">' + (icon.indexOf("<") === 0 ? icon : SF.icon(icon, 36)) + "<b>" + title + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + (btn || "") + "</div>"; };
  SF.reduced = false; try { SF.reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  return SF;
})();
