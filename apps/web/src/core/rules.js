/* SOMON FOOD — shared business rules.
   The same file is used by the browser prototype and by the Node API (apps/api),
   so order statuses, permissions and prices behave identically everywhere. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SomonRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var ROLES = ["customer", "restaurant", "courier", "admin"];

  // status -> { nextStatus: [roles allowed] }
  var ORDER_FLOW = {
    awaiting_payment: { pending: ["system", "admin"], scheduled: ["system", "admin"], cancelled: ["customer", "admin", "system"] },
    /* ordered ahead for a chosen time: reaches the kitchen by itself shortly before that time */
    scheduled: { pending: ["system", "admin"], cancelled: ["customer", "admin", "system"] },
    pending: { cooking: ["restaurant", "admin"], rejected: ["restaurant", "admin"], cancelled: ["customer", "admin"] },
    cooking: { ready: ["restaurant", "admin"], cancelled: ["admin", "restaurant"] },
    ready: { picked_up: ["courier", "admin", "restaurant"], cancelled: ["admin", "restaurant"] },      // restaurant: only for its own delivery (checked by the route)
    picked_up: { delivered: ["courier", "admin", "restaurant"] },
    delivered: {}, rejected: {}, cancelled: {}
  };
  var ACTIVE = ["awaiting_payment", "scheduled", "pending", "cooking", "ready", "picked_up"];
  var FINAL = ["delivered", "rejected", "cancelled"];

  function canTransition(from, to, role) {
    var next = ORDER_FLOW[from];
    return !!(next && next[to] && next[to].indexOf(role) >= 0);
  }

  function distanceKm(a, b) {
    var R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // settings: { deliveryBase, deliveryPerKm, deliveryMin, courierPct }
  /* the owner's own price table: «up to 100 m — 1 с.», «up to 300 m — 3 с.», «up to 1 km — 5 с.» …,
     beyond the last row + deliveryExtraKm for each started km; on a bad-weather day + weatherFee.
     Without a table: the old formula base + per km (never below the minimum). */
  function tierFee(settings, km) { var tl = settings && settings.deliveryTiers; if (!tl || !tl.length) return null; var m = Math.max(0, km) * 1000;
    for (var i = 0; i < tl.length; i++) if (m <= tl[i].m) return tl[i].fee;
    var last = tl[tl.length - 1]; return last.fee + Math.ceil((m - last.m) / 1000) * (settings.deliveryExtraKm || 0); }
  function deliveryFee(settings, km) {
    var f = tierFee(settings, km); if (f == null) f = Math.max(settings.deliveryMin || 0, Math.round((settings.deliveryBase || 0) + (settings.deliveryPerKm || 0) * km));
    return f + (settings && settings.weatherOn ? settings.weatherFee || 0 : 0);
  }

  function promoDiscount(promo, subtotal, now) {
    if (!promo || !promo.active) return { ok: false, code: "PROMO_INVALID" };
    if (promo.expiresAt && now > promo.expiresAt) return { ok: false, code: "PROMO_EXPIRED" };
    if (promo.maxUses && promo.uses >= promo.maxUses) return { ok: false, code: "PROMO_USED_UP" };
    if (subtotal < (promo.minOrder || 0)) return { ok: false, code: "PROMO_MIN_ORDER", min: promo.minOrder };
    var d = promo.type === "percent" ? Math.round(subtotal * promo.value / 100) : promo.value;
    return { ok: true, discount: Math.min(d, subtotal) };
  }

  // money split for one delivered order
  function split(order, restaurant, settings) {
    var commission = Math.round(order.subtotal * (restaurant.commissionPct || 0) / 100);
    if (order.ownDelivery)   // the restaurant delivered with its own people: the delivery fee is the restaurant's, the platform keeps only the commission
      return { commission: commission, courierPay: 0, restaurantPayout: order.subtotal - commission - (order.discount || 0) + order.deliveryFee, platform: commission - (order.bonusUsed || 0) };
    var courierPay = Math.round(order.deliveryFee * settings.courierPct / 100);
    return {
      commission: commission,
      courierPay: courierPay,
      restaurantPayout: order.subtotal - commission - (order.discount || 0),
      platform: commission + (order.deliveryFee - courierPay) - (order.bonusUsed || 0)   // bonus points are paid by the platform, never by the restaurant
    };
  }

  // "09:00"-"23:00" (also handles overnight like "18:00"-"02:00")
  var TZ_MIN = 300;
  function isOpenAt(hours, date) {
    if (!hours) return true; if (hours.from === hours.to) return true;   // same start and end: open round the clock
    var m = (date.getUTCHours() * 60 + date.getUTCMinutes() + TZ_MIN) % 1440;   // opening hours are Tajikistan time (UTC+5) whatever the device clock zone
    var f = toMin(hours.from), t = toMin(hours.to);
    return f <= t ? (m >= f && m < t) : (m >= f || m < t);
  }
  function toMin(s) { var p = String(s).split(":"); return (+p[0]) * 60 + (+p[1] || 0); }

  function normPhone(p) {
    var d = String(p || "").replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("992") === 0) d = d.slice(3);
    if (d.length === 10 && d.charAt(0) === "0") d = d.slice(1);          // 0 93 555 66 77
    if (d.length === 14 && d.indexOf("00992") === 0) d = d.slice(5);     // 00992 93 555 66 77
    if (d.length !== 9) return null;
    return "+992" + d;
  }
  function fmtPhone(p) { var d = String(p || "").replace(/\D/g, "").slice(-9); return d.length === 9 ? "+992 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5, 7) + " " + d.slice(7) : p; }

  /* is the point inside the delivery area drawn by the admin? poly: [{lat,lng},…] (ray casting) */
  /* an area may have several separate parts (villages): a point with cut:1 starts a new part */
  function zoneParts(poly) { var out = [], cur = []; (poly || []).forEach(function (q) { if (q && q.cut && cur.length) { out.push(cur); cur = []; } cur.push(q); }); if (cur.length) out.push(cur); return out; }
  function inOne(p, poly) { var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j];
      if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lng < (b.lng - a.lng) * (p.lat - a.lat) / (b.lat - a.lat) + a.lng) inside = !inside; }
    return inside; }
  /* which part holds the point: { i, name, fee } or null; fee is the part's own delivery price (null = by distance) */
  function zonePartOf(p, poly) { var ps = zoneParts(poly); for (var i = 0; i < ps.length; i++) if (ps[i].length >= 3 && inOne(p, ps[i])) { var h = ps[i][0]; return { i: i, name: h.n || "", fee: typeof h.fee === "number" ? h.fee : null }; } return null; }
  function inPolygon(p, poly) { var parts = zoneParts(poly).filter(function (x) { return x.length >= 3; }); if (!parts.length) return true;
    return parts.some(function (x) { return inOne(p, x); }); }

  return { inPolygon: inPolygon, zoneParts: zoneParts, zonePartOf: zonePartOf, ROLES: ROLES, ORDER_FLOW: ORDER_FLOW, ACTIVE: ACTIVE, FINAL: FINAL, canTransition: canTransition,
    distanceKm: distanceKm, deliveryFee: deliveryFee, promoDiscount: promoDiscount, split: split,
    isOpenAt: isOpenAt, normPhone: normPhone, fmtPhone: fmtPhone };
});
