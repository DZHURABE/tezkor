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
  /* inside the app the page cannot download files: the APK opens in the phone's browser (Chrome), which downloads it */
  SF.apkExternal = function () { return "intent://" + location.host + "/tezkor.apk#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=" + encodeURIComponent(location.origin + "/tezkor.apk") + ";end"; };
  /* the browser install (no «dangerous file» warning) always wins; the APK is only the fallback when the browser cannot install */
  function apkOn() { return !!(SF.state.pub && SF.state.pub.apk) && !ios && !enabled; }
  /* the card is shown on the home screen and in profiles; hidden inside the installed app */
  SF.installCard = function () {
    if (inApk || standalone || (!enabled && !apkOn())) return "";
    var apk = apkOn();
    return '<section class="installcard"><span class="iic">' + SF.mark(44) + '</span><div class="grow"><b>' + t("pwa.title") + "</b><small>" + t(apk ? "apk.sub" : "pwa.sub") + "</small>" +
      (apk && enabled ? '<button type="button" class="link sm pwalink" data-act="install">' + t("apk.orWeb") + "</button>" : "") + "</div>" +
      (apk ? '<a class="btn primary sm apklink" href="/tezkor.apk" download="tezkor.apk">' + I("download", 16) + t("apk.btn") + "</a>"
        : '<button type="button" class="btn primary sm" data-act="install">' + I("plus", 16) + t("pwa.btn") + "</button>") + "</section>";
  };
  /* a slim bar on the home screen: «put Тезкор on your phone» — one tap; closed for a week when dismissed */
  SF.installBar = function () {
    if (inApk || standalone) return "";
    if (SF.ls.get("instx", 0) > Date.now()) return "";
    return '<div class="instbar"><span class="iic">' + SF.mark(34) + '</span><div class="grow"><b>' + t("ib.t") + "</b><small>" + t("ib.s") + '</small></div><button type="button" class="btn primary sm" data-act="appgo">' + I("download", 15) + t("ib.btn") + '</button><button type="button" class="iconbtn instx" data-act="instx" aria-label="' + t("btn.close") + '">' + I("x", 16) + "</button></div>"; };
  SF.actions.appgo = function () { var e = SF.state.installEvt; if (e) return SF.actions.install(); SF.go("/app"); };
  SF.actions.instx = function (el) { SF.ls.set("instx", Date.now() + 2 * 864e5); var b = el.closest(".instbar"); if (b) b.remove(); };
  SF.actions.apkgo = function () { var a = document.createElement("a"); a.href = "/tezkor.apk"; a.download = "tezkor.apk"; a.className = "apklink"; document.body.appendChild(a); a.click(); a.remove(); };
  /* send the app to a friend: system share sheet, or copy the link */
  SF.actions.shareapp = function () { var u = location.origin + "/", d = { title: SF.brand(), text: t("ib.share"), url: u };
    if (navigator.share) return navigator.share(d).catch(function () {});
    var done = function () { SF.toast(t("ib.copied")); };
    if (navigator.clipboard) return navigator.clipboard.writeText(u).then(done, done); done(); };
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

  /* «Скачать приложение»: one page that always works — install from the browser, or the Android file (loud alarms for shops and couriers) */
  var android = /android/i.test(navigator.userAgent), yandex = /YaBrowser|YaApp/i.test(navigator.userAgent);
  SF.appBtn = function (cls) { if (inApk || standalone) return ""; return '<a class="' + (cls || "hm-app") + '" href="#/app" aria-label="' + t("app.get") + '">' + I("download", 18) + "<span>" + t("app.short") + "</span></a>"; };
  SF.route("/app", { title: "app.get", render: function () {
    if (inApk || standalone) return '<section class="card stack center"><span class="okmark">' + I("check", 30) + '</span><h2 class="h2">' + t("app.have") + "</h2></section>";
    var ev = SF.state.installEvt;
    return '<div class="apppage stack"><section class="card apphero"><span class="iic">' + SF.mark(64) + '</span><div><h1 class="h2">' + t("app.title") + '</h1><p class="muted">' + t("app.sub") + "</p></div></section>" +
      /* 1. from the browser — no file, no warnings */
      '<section class="card stack"><h3>' + I("phone", 18) + " " + t("app.web") + '</h3><p class="muted">' + t("app.webSub") + "</p>" +
        (ev ? '<button type="button" class="btn primary block lg" data-act="install">' + I("plus", 18) + t("pwa.btn") + "</button>" :
          '<ol class="howto">' + (ios ? "<li>" + t("pwa.ios1") + "</li><li>" + t("pwa.ios2") + "</li>" : yandex ? "<li>" + t("app.ya1") + "</li><li>" + t("app.ya2") + "</li>" : "<li>" + t("pwa.and1") + "</li><li>" + t("pwa.and2") + "</li>") + "<li>" + t("pwa.step3") + "</li></ol>" +
          (!ios && !yandex ? '<p class="fine">' + I("info", 14) + " " + t("app.chrome") + "</p>" : "")) + "</section>" +
      /* 2. the Android file */
      (ios ? "" : '<section class="card stack"><h3>' + I("bell", 18) + " " + t("app.apk") + '</h3><p class="muted">' + t("app.apkSub") + '</p><a class="btn ok block lg apklink" href="/tezkor.apk" download="tezkor.apk">' + I("download", 18) + t("app.apkBtn") + "</a>" +
        '<p class="fine">' + t("apk.safe") + "</p></section>") +
      '<section class="card stack"><b>' + t("app.share") + '</b><small class="muted">' + t("ib.share") + '</small><button type="button" class="btn ghost block" data-act="shareapp">' + I("send", 16) + t("app.shareBtn") + "</button></section></div>";
  } });
})();
