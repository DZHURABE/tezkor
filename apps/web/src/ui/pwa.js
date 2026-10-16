/* Тезкор — installable app (PWA): home-screen icon, full-screen, updates arrive by themselves */
(function () {
  var t = SF.t, I = SF.icon;
  var enabled = !!document.querySelector('link[rel="manifest"]') && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  SF.state.installEvt = null;

  if (enabled) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("/sw.js").then(function (reg) {
      var check = function () { reg.update().catch(function () {}); };
      setInterval(check, 10 * 60 * 1000);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
    }).catch(function () {});
    /* a new version took over: reload when it will not interrupt anyone (no open form, not in checkout) */
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController) { hadController = true; return; }
      var busy = function () { var a = document.activeElement; return /^\/(checkout|pay)/.test(SF.path()) || !document.getElementById("modal").hidden || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)); };
      (function tryReload() { if (busy()) setTimeout(tryReload, 5000); else location.reload(); })();
    });
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); SF.state.installEvt = e; });
  window.addEventListener("appinstalled", function () { SF.state.installEvt = null; document.querySelectorAll(".installcard").forEach(function (c) { c.remove(); }); SF.toast(t("pwa.done")); });

  /* inside the Android app (APK) there is nothing to install */
  var inApk = /TezkorApp\//.test(navigator.userAgent);
  SF.inApk = inApk;
  function apkOn() { return !!(SF.state.pub && SF.state.pub.apk) && !ios; }
  /* the card is shown on the home screen and in profiles; hidden inside the installed app */
  SF.installCard = function () {
    if (inApk || standalone || (!enabled && !apkOn())) return "";
    var apk = apkOn();
    return '<section class="installcard"><span class="iic">' + SF.mark(44) + '</span><div class="grow"><b>' + t("pwa.title") + "</b><small>" + t(apk ? "apk.sub" : "pwa.sub") + "</small>" +
      (apk && enabled ? '<button type="button" class="link sm pwalink" data-act="install">' + t("apk.orWeb") + "</button>" : "") + "</div>" +
      (apk ? '<a class="btn primary sm apklink" href="/tezkor.apk" download="tezkor.apk">' + I("download", 16) + t("apk.btn") + "</a>"
        : '<button type="button" class="btn primary sm" data-act="install">' + I("plus", 16) + t("pwa.btn") + "</button>") + "</section>";
  };
  /* after the download starts: how to open an APK that is not from Play Market */
  document.addEventListener("click", function (e) { if (!e.target.closest(".apklink")) return;
    setTimeout(function () { SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + t("apk.howTitle") + "</h2>" +
      '<ol class="howto"><li>' + t("apk.how1") + "</li><li>" + t("apk.how2") + "</li><li>" + t("apk.how3") + "</li><li>" + t("apk.how4") + '</li></ol><p class="fine">' + t("apk.safe") + "</p></div>"); }, 400); });
  SF.actions.install = function () {
    var e = SF.state.installEvt;
    if (e) { e.prompt(); return e.userChoice.then(function () { SF.state.installEvt = null; }); }
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><div class="stack"><h2 class="h2">' + t("pwa.title") + "</h2>" +
      '<ol class="howto"><li>' + t(ios ? "pwa.ios1" : "pwa.and1") + "</li><li>" + t(ios ? "pwa.ios2" : "pwa.and2") + "</li><li>" + t("pwa.step3") + "</li></ol></div>");
  };
})();
