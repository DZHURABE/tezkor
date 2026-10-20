/* SOMON FOOD — interactive map (no library).
   Web-Mercator slippy map: drag to move, buttons / wheel / pinch / double-tap to zoom.
   Tiles: set window.SOMON_CONFIG.tiles = "https://{s}.example/{z}/{x}/{y}.png" (OSM, MapTiler, self-hosted…).
   Without tiles (offline demo) it draws a street-grid background that moves with the map.
   Picker mode: a fixed pin in the middle — the customer moves the map until the pin is on their house. */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon, T = 256, ZMIN = 12, ZMAX = 18;
  var cfg = window.SOMON_CONFIG || {};
  SF.state.tmv = SF.state.tmv || {};
  var specs = {};

  function wx(lng, z) { return (lng + 180) / 360 * T * Math.pow(2, z); }
  function wy(lat, z) { var s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * T * Math.pow(2, z); }
  function lngOf(x, z) { return x / (T * Math.pow(2, z)) * 360 - 180; }
  function latOf(y, z) { var n = Math.PI - 2 * Math.PI * y / (T * Math.pow(2, z)); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }
  function mpp(lat, z) { return 156543.034 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z); }
  SF.geo = {
    km: function (a, b) { var d = Math.PI / 180, s = Math.pow(Math.sin((b.lat - a.lat) * d / 2), 2) + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.pow(Math.sin((b.lng - a.lng) * d / 2), 2); return 12742 * Math.asin(Math.sqrt(s)); },
    /* coordinates from text: "37.26, 68.13", Google (@lat,lng / q=lat,lng / ?ll=), Yandex (ll=lng,lat / pt=lng,lat / whatshere[point]=lng,lat), geo:lat,lng */
    parse: function (s) {
      s = decodeURIComponent(String(s || "")).replace(/\s+/g, " ");
      var m, num = "(-?\\d{1,3}\\.\\d{3,})";
      if ((m = s.match(new RegExp("(?:ll|pt|whatshere\\[point\\])=" + num + "," + num)))) return ok(+m[2], +m[1]);   // Yandex: lng,lat
      if ((m = s.match(new RegExp("@" + num + "," + num)))) return ok(+m[1], +m[2]);
      if ((m = s.match(new RegExp("(?:q|query|destination|daddr|center)=" + num + ",\\s?" + num)))) return ok(+m[1], +m[2]);
      if ((m = s.match(new RegExp("geo:" + num + "," + num)))) return ok(+m[1], +m[2]);
      if ((m = s.match(new RegExp(num + "[,; ]\\s*" + num)))) { var a = +m[1], b = +m[2]; return a > b ? ok(b, a) : ok(a, b); }   // in Tajikistan lng (67–75) > lat (36–41)
      return null;
      function ok(lat, lng) { return lat > -90 && lat < 90 && lng > -180 && lng < 180 ? { lat: lat, lng: lng } : null; }
    },
    nav: function (p) {
      var ll = p.lat.toFixed(6) + "," + p.lng.toFixed(6);
      return { google: "https://www.google.com/maps/dir/?api=1&destination=" + ll + "&travelmode=driving",
        yandex: "https://yandex.com/maps/?rtext=~" + encodeURIComponent(ll) + "&rtt=auto", text: p.lat.toFixed(6) + ", " + p.lng.toFixed(6) };
    }
  };

  /* street-grid background used when no tile server is configured */
  var GRID = "url(\"data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><g fill="none" stroke-linecap="round"><path d="M0 64H256M0 192H256M64 0V256M192 0V256" stroke="#fff" stroke-width="7" opacity=".9"/><path d="M0 128H256M128 0V256" stroke="#fff" stroke-width="12"/><path d="M0 0L256 256" stroke="#fff" stroke-width="4" opacity=".5"/></g><g fill="#000" opacity=".06"><rect x="12" y="12" width="40" height="40" rx="5"/><rect x="76" y="12" width="40" height="40" rx="5"/><rect x="140" y="76" width="40" height="40" rx="5"/><rect x="204" y="140" width="40" height="40" rx="5"/><rect x="12" y="140" width="40" height="40" rx="5"/><rect x="76" y="204" width="40" height="40" rx="5"/><rect x="204" y="12" width="40" height="40" rx="5"/></g></svg>') + "\")";

  /* o = { key, center:{lat,lng}, zoom, picker, zone:{lat,lng,km}, markers:[{lat,lng,type:"rest"|"home"|"courier",label}], route:[a,b], fit:[points], label } */
  SF.tmap = function (o) {
    specs[o.key] = o;
    return '<div class="tmap' + (o.picker ? " picker" : "") + '" data-tmap="' + esc(o.key) + '" role="application" aria-label="' + esc(o.label || t("map.title")) + '" tabindex="0">' +
      '<div class="tm-tiles"></div><svg class="tm-ov" aria-hidden="true"></svg>' +
      (o.picker ? '<div class="tm-pin" aria-hidden="true"><svg viewBox="-14 -40 28 42" width="34" height="50"><path d="M0 0C-4-9-13-14-13-24A13 13 0 1 1 13-24C13-14 4-9 0 0Z"/><circle cy="-24" r="5" fill="#fff"/></svg><i></i></div>' : "") +
      '<div class="tm-zoom"><button type="button" data-tz="1" aria-label="+">' + I("plus", 18) + '</button><button type="button" data-tz="-1" aria-label="−">' + I("minus", 18) + "</button></div>" +
      /* satellite view: houses and yards are visible even where street maps are empty */
      (cfg.tiles && satUrl() ? '<button type="button" class="tm-layer' + (sat() ? " on" : "") + '" data-tlayer="1" aria-pressed="' + sat() + '">' + I(sat() ? "map" : "image", 16) + "<span>" + t(sat() ? "map.street" : "map.sat") + "</span></button>" : "") +
      (cfg.tiles ? '<span class="tm-attr">' + esc(sat() ? cfg.satAttr || "© Esri, Maxar, Earthstar Geographics" : cfg.tilesAttr || "© OpenStreetMap") + "</span>" : '<span class="tm-attr">' + esc(t("map.schematic")) + "</span>") + "</div>";
  };

  function satUrl() { return cfg.satTiles === "" ? null : cfg.satTiles || "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"; }
  function sat() { if (SF.state.mapSat == null) SF.state.mapSat = !!SF.ls.get("mapSat", true); return SF.state.mapSat && !!satUrl(); }
  function viewFor(o, el) {
    var v = SF.state.tmv[o.key];
    if (v && !o.refit) return v;
    var pts = (o.fit || []).filter(function (p) { return p && p.lat != null; });
    if (o.picker || pts.length < 2) { var c = o.center; v = { lat: c.lat, lng: c.lng, z: o.zoom || 15 }; }
    else {
      var w = el.clientWidth || 360, h = el.clientHeight || 260, z = ZMAX;
      var la = pts.map(function (p) { return p.lat; }), ln = pts.map(function (p) { return p.lng; });
      var c2 = { lat: (Math.max.apply(0, la) + Math.min.apply(0, la)) / 2, lng: (Math.max.apply(0, ln) + Math.min.apply(0, ln)) / 2 };
      while (z > ZMIN && (wx(Math.max.apply(0, ln), z) - wx(Math.min.apply(0, ln), z) > w - 90 || wy(Math.min.apply(0, la), z) - wy(Math.max.apply(0, la), z) > h - 110)) z--;
      v = { lat: c2.lat, lng: c2.lng, z: z };
    }
    SF.state.tmv[o.key] = v; return v;
  }

  function draw(el) {
    var o = specs[el.dataset.tmap], v = SF.state.tmv[o.key]; if (!o || !v) return;
    var w = el.clientWidth, h = el.clientHeight, z = v.z, cx = wx(v.lng, z), cy = wy(v.lat, z), ox = cx - w / 2, oy = cy - h / 2;
    var tl = el.querySelector(".tm-tiles");
    if (cfg.tiles) {
      var need = {}, n = Math.pow(2, z);
      for (var tx = Math.floor(ox / T); tx <= Math.floor((ox + w) / T); tx++) for (var ty = Math.floor(oy / T); ty <= Math.floor((oy + h) / T); ty++) {
        if (ty < 0 || ty >= n) continue; var S = sat(), k = (S ? "s" : "m") + z + "/" + tx + "/" + ty; need[k] = 1;
        var img = el._tiles[k];
        if (!img) { img = el._tiles[k] = document.createElement("img"); img.alt = ""; img.draggable = false; img.decoding = "async";
          img.src = (S ? satUrl() : cfg.tiles).replace("{s}", "abc".charAt((tx + ty) % 3)).replace("{z}", z).replace("{x}", ((tx % n) + n) % n).replace("{y}", ty); tl.appendChild(img); }
        img.style.transform = "translate(" + Math.round(tx * T - ox) + "px," + Math.round(ty * T - oy) + "px)";
      }
      Object.keys(el._tiles).forEach(function (k) { if (!need[k]) { el._tiles[k].remove(); delete el._tiles[k]; } });
    } else {
      var sc = Math.pow(2, Math.max(-1, Math.min(1, z - 15))), size = T * sc;   // grid follows zoom a little so it feels like a map
      tl.style.backgroundImage = GRID; tl.style.backgroundSize = size + "px " + size + "px";
      tl.style.backgroundPosition = (-(ox % size)) + "px " + (-(oy % size)) + "px";
    }
    function P(p) { return { x: wx(p.lng, z) - ox, y: wy(p.lat, z) - oy }; }
    var g = "";
    var pd = function (pts, close) { return pts.map(function (p, i) { var q = P(p); return (i ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1); }).join("") + (close ? "Z" : ""); };
    if (o.edit) { var ep = o.edit(); if (ep.length) g += '<path class="tm-zone tm-edit" d="' + pd(ep, ep.length > 2) + '"/>' + ep.map(function (p, i) { var q = P(p); return '<circle class="tm-vx' + (i === ep.length - 1 ? " last" : "") + '" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="7"/>'; }).join(""); }
    if (o.zone) { var zc = P(o.zone), r = o.zone.km * 1000 / mpp(o.zone.lat, z);
      g += (o.zone.poly ? '<path class="tm-zone" d="' + pd(o.zone.poly, true) + '"/>' : '<circle class="tm-zone" cx="' + zc.x.toFixed(1) + '" cy="' + zc.y.toFixed(1) + '" r="' + r.toFixed(1) + '"/>') +
        '<g class="tm-center" transform="translate(' + zc.x.toFixed(1) + "," + zc.y.toFixed(1) + ')"><circle r="5"/><text y="20">' + esc(o.zone.name || "") + "</text></g>"; }
    if (o.route && o.route[0] && o.route[1] && o.route[1].lat != null) { var a = P(o.route[0]), b = P(o.route[1]), mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - Math.min(60, Math.abs(a.x - b.x) / 4 + 12);
      g += '<path class="m-route" d="M' + a.x.toFixed(1) + " " + a.y.toFixed(1) + " Q " + mx.toFixed(1) + " " + my.toFixed(1) + " " + b.x.toFixed(1) + " " + b.y.toFixed(1) + '"/>'; }
    (o.markers || []).forEach(function (m) { if (m.lat == null) return; var p = P(m);
      if (m.type === "me") { g += '<circle class="m-acc" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + Math.max(8, (m.acc || 0) / mpp(m.lat, z)).toFixed(1) + '"/><circle class="m-me" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="8"/>'; return; }
      g += '<g transform="translate(' + p.x.toFixed(1) + "," + p.y.toFixed(1) + ')">' + (m.type === "courier"
        ? '<circle r="15" class="m-cour"/><path d="M-7-3h7l3 6M-6 4a2.5 2.5 0 100 .1M6 4a2.5 2.5 0 100 .1" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle r="15" class="m-pulse"/>'
        : '<path class="m-pin m-' + m.type + '" d="M0 0C-4-8-12-12-12-21A12 12 0 1 1 12-21C12-12 4-8 0 0Z"/><text class="m-pt" y="-17">' + esc(m.label || "") + "</text>") + "</g>"; });
    var ov = el.querySelector(".tm-ov"); ov.setAttribute("viewBox", "0 0 " + w + " " + h); ov.setAttribute("width", w); ov.setAttribute("height", h); ov.innerHTML = g;
    if (o.picker && o.onMove) o.onMove({ lat: v.lat, lng: v.lng }, false);
  }

  function clampView(o, v) {
    if (o.free) return; var lim = o.zone || o.center; if (!lim) return;
    var maxKm = Math.max(8, (o.zone ? o.zone.km : 5) * 3), d = SF.geo.km(lim, v);
    if (d > maxKm) { var f = maxKm / d; v.lat = lim.lat + (v.lat - lim.lat) * f; v.lng = lim.lng + (v.lng - lim.lng) * f; }
  }
  function zoomBy(el, dz, ax, ay) {
    var o = specs[el.dataset.tmap], v = SF.state.tmv[o.key], nz = Math.max(ZMIN, Math.min(ZMAX, v.z + dz)); if (nz === v.z) return;
    if (ax != null) { var w = el.clientWidth, h = el.clientHeight, px = wx(v.lng, v.z) - w / 2 + ax, py = wy(v.lat, v.z) - h / 2 + ay, anchor = { lat: latOf(py, v.z), lng: lngOf(px, v.z) };
      var nx = wx(anchor.lng, nz) - ax + w / 2, ny = wy(anchor.lat, nz) - ay + h / 2; v.lng = lngOf(nx, nz); v.lat = latOf(ny, nz); }
    v.z = nz; clampView(o, v); draw(el); settle(el);
  }
  function settle(el) { var o = specs[el.dataset.tmap]; if (o.picker && o.onMove) { clearTimeout(el._st); el._st = setTimeout(function () { var v = SF.state.tmv[o.key]; o.onMove({ lat: v.lat, lng: v.lng }, true); }, 350); } }
  SF.tmapCenter = function (key, p, z) { var v = SF.state.tmv[key] || {}; v.lat = p.lat; v.lng = p.lng; if (z) v.z = z; SF.state.tmv[key] = v; var el = document.querySelector('[data-tmap="' + key + '"]'); if (el) { draw(el); settle(el); } };

  function mount(el) {
    var o = specs[el.dataset.tmap]; if (!o || el._m) return; el._m = 1; el._tiles = {};
    viewFor(o, el); draw(el);
    var ptrs = {}, start = null, pinch = null, moved = 0, lastTap = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".tm-zoom") || e.target.closest("[data-tlayer]")) return;
      el.setPointerCapture && el.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(ptrs), v = SF.state.tmv[o.key];
      if (ids.length === 1) { start = { x: e.clientX, y: e.clientY, cx: wx(v.lng, v.z), cy: wy(v.lat, v.z) }; moved = 0; el.classList.add("drag"); }
      else if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; }
    });
    el.addEventListener("pointermove", function (e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(ptrs), v = SF.state.tmv[o.key];
      if (pinch && ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]], r = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
        if (r > 1.45 || r < 0.69) { var rc = el.getBoundingClientRect(); zoomBy(el, r > 1 ? 1 : -1, (a.x + b.x) / 2 - rc.left, (a.y + b.y) / 2 - rc.top); pinch.d = Math.hypot(a.x - b.x, a.y - b.y); start = null; } return; }
      if (!start) return; var dx = e.clientX - start.x, dy = e.clientY - start.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      v.lng = lngOf(start.cx - dx, v.z); v.lat = latOf(start.cy - dy, v.z); clampView(o, v);
      if (!el._raf) el._raf = requestAnimationFrame(function () { el._raf = 0; draw(el); });
    });
    function up(e) {
      if (!ptrs[e.pointerId]) return; delete ptrs[e.pointerId]; el.classList.remove("drag");
      if (Object.keys(ptrs).length < 2) pinch = null;
      if (!Object.keys(ptrs).length) {
        if (moved > 4) settle(el);
        else if (start && e.type === "pointerup") { var now = Date.now(), rc = el.getBoundingClientRect();
          if (now - lastTap < 320) zoomBy(el, 1, e.clientX - rc.left, e.clientY - rc.top);
          else if (o.onTap) { var v0 = SF.state.tmv[o.key]; o.onTap({ lng: lngOf(wx(v0.lng, v0.z) - rc.width / 2 + e.clientX - rc.left, v0.z), lat: latOf(wy(v0.lat, v0.z) - rc.height / 2 + e.clientY - rc.top, v0.z) }); draw(el); }
          else if (o.picker) { // single tap: move the pin to the tapped spot
            var v = SF.state.tmv[o.key]; v.lng = lngOf(wx(v.lng, v.z) + (e.clientX - rc.left - rc.width / 2), v.z); v.lat = latOf(wy(v.lat, v.z) + (e.clientY - rc.top - rc.height / 2), v.z); clampView(o, v); draw(el); settle(el); }
          lastTap = now; }
        start = null;
      }
    }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", function (e) { e.preventDefault(); var rc = el.getBoundingClientRect(); clearTimeout(el._wh); var dz = e.deltaY < 0 ? 1 : -1; el._wh = setTimeout(function () { zoomBy(el, dz, e.clientX - rc.left, e.clientY - rc.top); }, 40); }, { passive: false });
    el.addEventListener("click", function (e) { var ly = e.target.closest("[data-tlayer]");
      if (ly) { e.preventDefault(); e.stopPropagation(); SF.state.mapSat = !sat(); SF.ls.set("mapSat", SF.state.mapSat);
        document.querySelectorAll("[data-tmap]").forEach(function (m) { if (!m._m) return; Object.keys(m._tiles).forEach(function (k) { m._tiles[k].remove(); }); m._tiles = {};
          var bt = m.querySelector("[data-tlayer]"); if (bt) { bt.classList.toggle("on", SF.state.mapSat); bt.setAttribute("aria-pressed", SF.state.mapSat); bt.innerHTML = I(SF.state.mapSat ? "map" : "image", 16) + "<span>" + t(SF.state.mapSat ? "map.street" : "map.sat") + "</span>"; }
          var at = m.querySelector(".tm-attr"); if (at) at.textContent = SF.state.mapSat ? cfg.satAttr || "© Esri, Maxar, Earthstar Geographics" : cfg.tilesAttr || "© OpenStreetMap"; draw(m); }); return; }
      var b = e.target.closest("[data-tz]"); if (b) { e.preventDefault(); e.stopPropagation(); zoomBy(el, +b.dataset.tz); } });
    el.addEventListener("keydown", function (e) { var v = SF.state.tmv[o.key], s = 60, k = e.key, cx = wx(v.lng, v.z), cy = wy(v.lat, v.z);
      if (k === "+" || k === "=") return zoomBy(el, 1); if (k === "-") return zoomBy(el, -1);
      var d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[k]; if (!d) return; e.preventDefault();
      v.lng = lngOf(cx + d[0], v.z); v.lat = latOf(cy + d[1], v.z); clampView(o, v); draw(el); settle(el); });
  }
  /* place search above a map: Nominatim (OpenStreetMap) finds towns, streets and houses; pick one and the map moves there */
  SF.mapFind = function (key) {
    /* a div, not a form: it also sits inside other forms */
    return '<div class="mfind" data-mf="' + esc(key) + '" role="search"><span class="mfi">' + I("search", 18) + '</span><input name="mq" autocomplete="off" enterkeyhint="search" placeholder="' + t("mf.ph") + '" aria-label="' + t("mf.ph") + '"><button type="button" class="btn primary sm" data-act="mfgo" data-key="' + esc(key) + '">' + t("mf.go") + '</button></div><div class="mfres" data-mfres="' + esc(key) + '" hidden></div>'; };
  document.addEventListener("keydown", function (e) { if (e.key !== "Enter") return; var i = e.target.closest && e.target.closest(".mfind input"); if (!i) return; e.preventDefault(); e.stopPropagation(); SF.actions.mfgo({ dataset: { key: i.closest(".mfind").dataset.mf } }); }, true);
  SF.actions.mfgo = function (el) { var inp = document.querySelector('[data-mf="' + el.dataset.key + '"] input'); return inp ? find(el.dataset.key, inp.value) : null; };
  function find(key, q0, auto) {
    var q = String(q0 || "").trim(), box = document.querySelector('[data-mfres="' + key + '"]'); if (q.length < (auto ? 3 : 2) || !box) return;
    var ll = SF.geo.parse(q); if (ll) { box.hidden = true; return pick(key, ll, q); }
    box.hidden = false; box.innerHTML = '<p class="mfmsg">' + t("mf.search") + "</p>";
    var url = (cfg.geocoder || "https://nominatim.openstreetmap.org/search") + "?format=jsonv2&limit=7&addressdetails=1&countrycodes=tj,uz,kg,kz" + biasQ() + "&accept-language=" + (SF.state.lang === "tg" ? "tg,ru" : SF.state.lang || "ru") + "&q=" + encodeURIComponent(q);
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (r) { return r.json(); }).then(function (l) {
      if (!l.length) { box.innerHTML = '<p class="mfmsg">' + t("mf.none") + "</p>"; return; }
      box.innerHTML = l.map(function (x) { var nm = String(x.display_name || "").split(",").slice(0, 3).join(","), big = /city|town|village|suburb|administrative/.test((x.type || "") + " " + (x.addresstype || ""));
        return '<button type="button" class="mfrow" data-act="mfpick" data-key="' + esc(key) + '" data-lat="' + x.lat + '" data-lng="' + x.lon + '" data-name="' + esc((x.name || nm.split(",")[0] || "").trim()) + '" data-big="' + (big ? 1 : 0) + '">' + I("pin", 16) + "<span><b>" + esc(nm.split(",")[0]) + "</b><small>" + esc(nm.split(",").slice(1).join(",").trim()) + "</small></span></button>"; }).join("");
      if (auto && l[0] && q === (box._q || q)) { var f = l[0]; pick(key, { lat: +f.lat, lng: +f.lon }, (f.name || "").trim()); }
    }).catch(function () { box.innerHTML = '<p class="mfmsg">' + t("mf.fail") + "</p>"; });
  };
  /* prefer results near the chosen town (not a hard limit: a village in another district still turns up) */
  function biasQ() { var z = SF.zone && SF.zone(SF.state.cityId); if (!z) return ""; return "&viewbox=" + (z.lng - 1.2).toFixed(3) + "," + (z.lat + 0.9).toFixed(3) + "," + (z.lng + 1.2).toFixed(3) + "," + (z.lat - 0.9).toFixed(3); }
  /* type an address anywhere (data-geo="mapKey"): after a short pause the place is searched and the map opens on it by itself */
  var geoT = {};
  document.addEventListener("input", function (e) { var i = e.target, key = i && i.dataset && i.dataset.geo; if (!key) return;
    clearTimeout(geoT[key]); var q = i.value; var box = document.querySelector('[data-mfres="' + key + '"]'); if (box) box._q = q.trim();
    if (q.trim().length < 3) { if (box) box.hidden = true; return; }
    geoT[key] = setTimeout(function () { if (document.body.contains(i)) find(key, i.value, true); }, 750); });
  /* a place picked from the list or found automatically: map there (a slot creates the map the first time) */
  function openOn(key, p) { var slot = document.querySelector('[data-mapslot="' + key + '"]');
    if (slot && !slot.querySelector("[data-tmap]") && SF.mapSlots && SF.mapSlots[key]) { SF.state.tmv[key] = { lat: p.lat, lng: p.lng, z: 17 }; slot.innerHTML = SF.tmap(SF.mapSlots[key](p)); SF.mountMaps(); }
    else SF.tmapCenter(key, p, 17); }
  function pick(key, p, name) { openOn(key, p); var h = SF.mapPick && SF.mapPick[key]; if (h) h(p, name); }
  SF.actions.mfpick = function (el) { var box = el.closest("[data-mfres]"); if (box) box.hidden = true; return pick(el.dataset.key, { lat: +el.dataset.lat, lng: +el.dataset.lng }, el.dataset.name); };
  SF.mapPick = SF.mapPick || {}; SF.mapSlots = SF.mapSlots || {};
  SF.zone = function (cityId) {
    var cs = SF.state.cities || [], c = cs.filter(function (x) { return x.id === cityId; })[0] || cs.filter(function (x) { return x.id === (SF.state.pub || {}).defaultCityId; })[0] || cs[0];
    if (!c) return null; var km = (SF.state.pub || {}).zoneKm || 5, poly = c.zone && c.zone.length > 2 ? c.zone : null;
    /* a drawn area: km = how far its farthest corner is (used to keep the map near the town) */
    if (poly) km = Math.max.apply(null, poly.map(function (p) { return SF.geo.km(c, p); }));
    return { lat: c.lat, lng: c.lng, km: Math.round(km * 10) / 10, name: SF.tx(c.name), poly: poly };
  };
  /* a restaurant with its own drawn area delivers only there; otherwise the town's area */
  SF.restZone = function (r) { if (!r || !r.zone || r.zone.length < 3) return SF.zone(r && r.cityId);
    return { lat: r.lat, lng: r.lng, km: Math.round(Math.max.apply(null, r.zone.map(function (p) { return SF.geo.km(r, p); })) * 10) / 10, name: SF.tx(r.name), poly: r.zone }; };
  SF.inZoneOf = function (p, z) { if (!z) return true; return z.poly ? SomonRules.inPolygon(p, z.poly) : SF.geo.km(z, p) <= z.km + 1e-9; };
  SF.inZone = function (p, cityId) { return SF.inZoneOf(p, SF.zone(cityId)); };
  SF.redrawMap = function (key) { var el = document.querySelector('[data-tmap="' + key + '"]'); if (el && el._m) draw(el); };
  SF.mountMaps = function () { document.querySelectorAll("[data-tmap]").forEach(mount); };
  SF.after.push(SF.mountMaps);
  window.addEventListener("resize", function () { document.querySelectorAll("[data-tmap]").forEach(function (el) { if (el._m) draw(el); }); });
})();
