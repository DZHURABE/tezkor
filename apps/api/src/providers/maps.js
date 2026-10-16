/* Maps provider interface:
     geocode(text, cityId) → [{ text, lat, lng }]
     reverse({lat,lng})    → { text }
     route(from, to)       → { km, minutes, polyline:[{lat,lng}] }
   "schematic" = straight-line estimate used by the prototype (no external calls).
   Production options: OpenStreetMap (Leaflet + OSRM/Nominatim), 2GIS, Google Maps — key in .env (MAPS_KEY). */
const R = 6371;
function km(a, b) { const d = x => x * Math.PI / 180, s = Math.sin(d(b.lat - a.lat) / 2) ** 2 + Math.cos(d(a.lat)) * Math.cos(d(b.lat)) * Math.sin(d(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); }
const schematic = {
  name: "schematic",
  async geocode() { return []; },
  async reverse() { return { text: "" }; },
  async route(from, to) { const k = Math.round(km(from, to) * 1.3 * 10) / 10; return { km: k, minutes: Math.round(k / 25 * 60) + 3, polyline: [from, to] }; },
};
const registry = { schematic };
module.exports = { get: n => registry[n || process.env.MAPS_PROVIDER || "schematic"] || schematic };
