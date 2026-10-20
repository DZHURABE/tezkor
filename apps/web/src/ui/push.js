/* Phone alerts (Web Push): new orders reach the phone even when the app is closed and the screen is off.
   A slim bar asks once; when the permission is already given the phone is (re)subscribed silently after every sign-in. */
(function () {
  var SF = window.SF, t = SF.t, I = SF.icon || function () { return ""; };
  var sup = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  var busy = false, keyP = null, lastUser = null;
  function u8(b64) { var p = "=".repeat((4 - b64.length % 4) % 4), s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function key() { return keyP || (keyP = SF.api.get("/push/key").then(function (r) { return r && r.key; }, function () { keyP = null; return null; })); }
  function subscribe() {
    return key().then(function (k) { if (!k) return false;
      return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k) }); }); })
        .then(function (s) { return SF.api.post("/push/subscribe", JSON.parse(JSON.stringify(s))).then(function () { SF.ls.set("push." + SF.state.user.id, 1); return true; }); }); });
  }
  function bar(html) { var b = document.getElementById("pushbar"); if (!html) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.id = "pushbar"; b.className = "pushbar"; document.body.appendChild(b); } b.innerHTML = html; }
  function check() {
    var me = SF.state.user; if (!me) { lastUser = null; bar(""); return; }
    if (!sup) { if (ios && !standalone && (me.role === "restaurant" || me.role === "courier") && !SF.ls.get("pushx", 0)) bar('<div class="grow"><b>' + t("push.t") + "</b><small>" + t("push.ios") + '</small></div><button type="button" class="btn ghost sm" data-act="pushx">' + t("btn.close") + "</button>"); return; }
    if (lastUser === me.id) return; lastUser = me.id;
    key().then(function (k) { if (!k) return;
      if (Notification.permission === "granted") { subscribe().catch(function () {}); bar(""); }
      else if (Notification.permission === "default" && (SF.ls.get("pushx", 0) || 0) < Date.now())
        bar('<div class="grow"><b>' + t("push.t") + "</b><small>" + t(me.role === "customer" ? "push.s.c" : "push.s") + '</small></div><button type="button" class="btn primary sm" data-act="pushon">' + t("push.on") + '</button><button type="button" class="btn ghost sm" data-act="pushx">' + t("push.later") + "</button>"); });
  }
  SF.actions.pushon = function () { if (busy) return; busy = true;
    Notification.requestPermission().then(function (p) { bar(""); if (p === "granted") return subscribe().then(function () { SF.toast(t("push.done")); }); if (p === "denied") SF.toast(t("push.denied")); })
      .catch(function () {}).then(function () { busy = false; }); };
  SF.actions.pushx = function () { SF.ls.set("pushx", Date.now() + 3 * 864e5); bar(""); };
  /* sign-out: the phone stops getting this person's alerts */
  var out = SF.logout; if (out) SF.logout = function () { var me = SF.state.user; lastUser = null; bar("");
    try { if (sup && me) navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) { if (s) SF.api.post("/push/unsubscribe", { endpoint: s.endpoint }).catch(function () {}); }); } catch (e) {}
    return out.apply(this, arguments); };
  setInterval(check, 2500); setTimeout(check, 800);
})();
