/* SOMON FOOD — API client.
   transport "local": talks to the in-browser server (prototype, data kept in this browser).
   transport "http":  talks to apps/api over fetch — set SOMON_CONFIG = { api: "https://api.example.tj" }. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SomonClient = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function ApiError(status, error) { this.status = status; this.code = error && error.code || "SERVER_ERROR"; this.data = error || {}; this.message = this.code; }
  ApiError.prototype = Object.create(Error.prototype);

  function createClient(opts) {
    var token = opts.token || null;
    function send(method, url, body) {
      if (opts.transport === "http") {
        return fetch(opts.baseUrl + url, { method: method, headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}), body: body ? JSON.stringify(body) : undefined })
          .then(function (r) { return r.json().then(function (j) { if (!j.ok) throw new ApiError(r.status, j.error); return j.data; }); });
      }
      return new Promise(function (resolve, reject) {
        var r = opts.server.handle(method, url, body ? JSON.parse(JSON.stringify(body)) : null, token);
        if (r.body.ok) resolve(r.body.data); else reject(new ApiError(r.status, r.body.error));
      });
    }
    return {
      get: function (u) { return send("GET", u); }, post: function (u, b) { return send("POST", u, b || {}); },
      patch: function (u, b) { return send("PATCH", u, b || {}); }, del: function (u) { return send("DELETE", u); },
      setToken: function (t) { token = t; }, token: function () { return token; }
    };
  }
  return { createClient: createClient, ApiError: ApiError };
});
