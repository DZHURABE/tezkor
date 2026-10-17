/* Тезкор — phone verification on the screen: pick Telegram / WhatsApp / SMS, confirm, continue.
   Used when signing up and when a password is forgotten (self-service reset). */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon;
  var CH = {
    telegram: { icon: "send", cls: "tg", name: "Telegram" },
    whatsapp: { icon: "chat", cls: "wa", name: "WhatsApp" },
    sms: { icon: "sms", cls: "sm", name: "SMS" },
    demo: { icon: "shield", cls: "dm", name: "" },
  };
  var F = null;            // the flow in progress: { purpose, phone, onDone, v, timer, resendAt }

  SF.verifyInfo = function () { var v = SF.state.pub && SF.state.pub.verify; return v && v.channels && v.channels.length ? v : null; };

  function stop() { if (F && F.timer) clearInterval(F.timer); if (F && F.tick) clearInterval(F.tick); }
  function close() { stop(); F = null; SF.closeModal(); }
  SF.actions.vclose = close;

  function head(title, sub) {
    return '<button class="mx" data-act="vclose" aria-label="' + t("btn.close") + '">' + I("x", 20) + "</button>" +
      '<div class="vhead"><span class="cic">' + I("shield", 26) + '</span><h2 class="h2">' + title + '</h2><p class="muted">' + sub + "</p></div>";
  }

  /* step 1: choose how to confirm */
  function choose() {
    var info = SF.verifyInfo(), opt = F.purpose === "register" && !info.required, ph = { phone: '<b class="num">' + esc(SF.phone(F.phone)) + "</b>" };
    SF.modal('<div class="stack vflow">' + head(t(opt ? "vf.regTitle" : F.purpose === "reset" ? "vf.resetTitle" : "vf.title"), t(opt ? "vf.regSub" : "vf.sub", ph)) +
      '<div class="vch">' + info.channels.map(function (c, i) { var m = CH[c.id] || CH.demo;
        return '<button type="button" class="vbtn ' + m.cls + '" data-act="vstart" data-ch="' + c.id + '">' + '<span class="vic">' + I(m.icon, 22) + '</span><span class="grow"><b>' + (m.name || t("vf.demo")) + (opt && i === 0 ? ' <i class="vtag">' + t("vf.best") + "</i>" : "") + "</b><small>" + t("vf.how." + c.id + "." + c.kind) + "</small></span>" + I("chevR", 18) + "</button>"; }).join("") + "</div>" +
      (F.purpose === "register" && !info.required ? '<div class="vor"><span>' + t("vf.or") + '</span></div><button type="button" class="vbtn skip" data-act="vskip"><span class="vic">' + I("phone", 22) + '</span><span class="grow"><b>' + t("vf.skip") + "</b><small>" + t("vf.skipSub") + "</small></span>" + I("chevR", 18) + "</button>" : "") +
      '<p class="fine center">' + t("vf.wrongNum") + ' <button type="button" class="link" data-act="vclose">' + t("vf.change") + "</button></p></div>");
  }

  SF.actions.vstart = function (el) {
    var ch = el.dataset.ch;
    return SF.api.post("/auth/verify/start", { phone: F.phone, purpose: F.purpose, channel: ch }).then(function (v) {
      F.v = v; F.resendAt = Date.now() + 60000;
      if (v.kind === "link") waitLink(); else enterCode();
    }).catch(function (e) { if (/PHONE_TAKEN|STAFF_PHONE|PHONE_UNKNOWN|USER_BLOCKED|ADMIN_RESET_ENV/.test(e.code)) close(); throw e; });
  };

  /* step 2a: Telegram / WhatsApp — open the app, we wait for the confirmation */
  function waitLink() {
    var v = F.v, m = CH[v.channel];
    SF.modal('<div class="stack vflow">' + head(t("vf.open." + v.channel), t("vf.steps." + v.channel)) +
      '<a class="btn block lg vopen ' + m.cls + '" href="' + esc(v.link) + '" target="_blank" rel="noopener">' + I(m.icon, 20) + t("vf.openBtn", { name: m.name }) + "</a>" +
      '<div class="vwait"><span class="spin" aria-hidden="true"></span><span>' + t("vf.waiting") + "</span></div>" +
      '<button type="button" class="link center" data-act="vback">' + t("vf.other") + "</button></div>");
    poll();
  }
  /* step 2b: SMS / Telegram code / demo — type the 6 digits */
  function enterCode(err) {
    var v = F.v;
    SF.modal('<div class="stack vflow">' + head(t("vf.codeTitle"), t("vf.codeSub." + v.channel, { phone: '<b class="num">' + esc(SF.phone(F.phone)) + "</b>" })) +
      (v.demoCode ? '<div class="msg info">' + I("info", 16) + t("vf.demoCode", { code: '<b class="num">' + esc(v.demoCode) + "</b>" }) + "</div>" : "") +
      '<form class="stack" data-form="vcode"><input class="vcode num" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="••••••" aria-label="' + t("vf.codeTitle") + '" required>' +
      (err ? '<p class="verr">' + esc(err) + "</p>" : "") +
      '<button class="btn primary block lg">' + t("vf.confirm") + '</button></form>' +
      '<div class="vrow"><button type="button" class="link" data-act="vresend" id="vresend" disabled>' + t("vf.resend") + '</button><button type="button" class="link" data-act="vback">' + t("vf.other") + "</button></div></div>");
    setTimeout(function () { var i = document.querySelector(".vcode"); if (i) i.focus(); }, 50);
    resendTimer();
  }
  function resendTimer() {
    if (F.tick) clearInterval(F.tick);
    var paint = function () { var b = document.getElementById("vresend"); if (!b || !F) return; var s = Math.ceil((F.resendAt - Date.now()) / 1000);
      b.disabled = s > 0; b.textContent = s > 0 ? t("vf.resendIn", { s: s }) : t("vf.resend"); };
    paint(); F.tick = setInterval(paint, 1000);
  }
  SF.forms.vcode = function (fd) {
    return SF.api.post("/auth/verify/" + F.v.id + "/code", { code: fd.code }).then(function (r) { if (r.status === "verified") done(); })
      .catch(function (e) { if (e.code === "VERIFY_BAD_CODE") { enterCode(t("vf.badCode", { n: e.data && e.data.left != null ? e.data.left : "" })); return; } throw e; });
  };
  SF.actions.vresend = function () { return SF.api.post("/auth/verify/start", { phone: F.phone, purpose: F.purpose, channel: F.v.channel }).then(function (v) { F.v = v; F.resendAt = Date.now() + 60000; enterCode(); SF.toast(t("vf.sent")); }); };
  SF.actions.vback = function () { stop(); choose(); };

  function poll() {
    stop();
    var check = function () { if (!F || !F.v) return; SF.api.get("/auth/verify/" + F.v.id).then(function (r) {
      if (!F) return; if (r.status === "verified") done(); else if (r.status !== "pending") { stop(); SF.toast(t("vf.expired"), "err"); choose(); } }).catch(function () {}); };
    F.timer = setInterval(check, 2000);
    F.check = check;
  }
  /* coming back from Telegram / WhatsApp: check at once */
  document.addEventListener("visibilitychange", function () { if (!document.hidden && F && F.check && F.v && F.v.kind === "link") F.check(); });

  function done() { stop(); var f = F; F = null; SF.toast(t("vf.ok")); f.onDone(f.v); }

  /* entry point */
  SF.verifyPhone = function (purpose, phone, onDone, onSkip) { stop(); F = { purpose: purpose, phone: phone, onDone: onDone, onSkip: onSkip }; choose(); };
  SF.actions.vskip = function () { var f = F; stop(); F = null; if (f && f.onSkip) return f.onSkip(); SF.closeModal(); };

  /* ---------- sign up with a verified number ---------- */
  SF.registerFlow = function (fd, enter) {
    var info = SF.verifyInfo(), R = window.SomonRules;
    /* catch the simple mistakes before sending anyone to Telegram */
    if (String(fd.name || "").trim().length < 2) return Promise.reject({ code: "BAD_NAME" });
    if (R && !R.normPhone(fd.phone)) return Promise.reject({ code: "BAD_PHONE" });
    if (String(fd.password || "").length < (SF.state.pub.demo ? 4 : 6)) return Promise.reject({ code: SF.state.pub.demo ? "BAD_PASSWORD" : "BAD_PASSWORD_6" });
    var plain = function () { return SF.api.post("/auth/register", fd).then(function (r) { SF.closeModal(); enter(r); }).catch(function (e) { SF.toast(SF.err(e), "err"); }); };
    if (!info) return SF.api.post("/auth/register", fd).then(function (r) { enter(r); }, function (e) { if (e.code === "PHONE_TAKEN") return known(fd.phone); throw e; });
    /* check the number first so nobody verifies a number that is already taken.
       Telegram is offered first; without it (verification not required) — just the phone and the password */
    return SF.api.post("/auth/verify/check", { phone: fd.phone, purpose: "register" }).then(function () { return true; }, function (e) { if (e.code === "PHONE_TAKEN") { known(fd.phone); return false; } throw e; }).then(function (go) { if (!go) return;
      SF.verifyPhone("register", fd.phone, function (v) {
        fd.verifyId = v.id;
        SF.api.post("/auth/register", fd).then(function (r) { SF.closeModal(); enter(r); }).catch(function (e) { SF.toast(SF.err(e), "err"); });
      }, info.required ? null : plain);
    });
  };

  /* the number is already registered: recognise it and offer to log in */
  function known(phone) { var d = String(window.SomonRules ? SomonRules.normPhone(phone) : phone).replace(/^\+992/, "");
    SF.ls.set("lastPhone", d);
    SF.modal('<div class="confirm"><span class="cic ok">' + I("user", 28) + '</span><h2 class="h2">' + t("vf.taken") + '</h2><p class="muted">' + t("vf.takenSub", { phone: '<b class="num">' + esc(SF.phone(phone)) + "</b>" }) + "</p>" +
      '<button type="button" class="btn primary block lg" data-act="toLogin">' + t("auth.login") + '</button><button type="button" class="link center" data-act="toForgot">' + t("pw.forgot") + "</button></div>"); }

  SF.actions.toLogin = function () { SF.closeModal(); SF.go("/login"); };
  SF.actions.toForgot = function () { SF.closeModal(); SF.go("/login"); setTimeout(function () { SF.actions.forgot(); }, 300); };

  /* ---------- signed up without confirming: confirm the number later from the profile ---------- */
  SF.actions.vconfirm = function () { var u = SF.state.user; if (!u) return;
    SF.verifyPhone("confirm", u.phone, function (v) { SF.api.post("/auth/me/verify", { verifyId: v.id }).then(function (nu) { SF.state.user = nu; SF.closeModal(); SF.render({ quiet: true }); }).catch(function (e) { SF.toast(SF.err(e), "err"); }); }); };

  /* ---------- forgot password: verify the number, choose a new password, logged in ---------- */
  SF.resetFlow = function (phone, enter) {
    return SF.api.post("/auth/verify/check", { phone: phone, purpose: "reset" }).then(function () { SF.verifyPhone("reset", phone, function (v) {
      F = null; SF.state.resetV = v.id;
      SF.modal('<div class="stack vflow">' + head(t("vf.newPwTitle"), t("vf.newPwSub")) +
        '<form class="stack" data-form="vreset"><label class="f">' + t("pw.new") + SF.pwInput("password", "new-password", ' minlength="6" required') + '<small class="hint">' + t("pw.hint", { n: 6 }) + "</small></label>" +
        '<button class="btn primary block lg">' + t("vf.saveLogin") + "</button></form></div>");
      SF.state.resetEnter = enter;
    }); });
  };
  SF.forms.vreset = function (fd) { return SF.api.post("/auth/reset", { verifyId: SF.state.resetV, password: fd.password }).then(function (r) { SF.closeModal(); SF.toast(t("pw.done")); SF.state.resetEnter(r); }); };
})();
