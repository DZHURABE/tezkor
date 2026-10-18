/* SOMON FOOD — login / register, role-based entry */
(function () {
  var t = SF.t, esc = SF.esc, I = SF.icon;
  var DEMO = [["customer", "900000301", "user"], ["restaurant", "900000101", "store"], ["courier", "900000201", "scooter"], ["admin", "900000001", "shield"]];
  function demoBlock() {
    return '<div class="demo"><p class="lbl">' + t("auth.demo") + '</p><div class="demogrid">' + DEMO.map(function (d) {
      return '<button type="button" class="democard" data-act="demologin" data-phone="' + d[1] + '">' + I(d[2], 20) + "<b>" + t("role." + d[0]) + '</b><small class="num">' + SF.phone("+992" + d[1]) + "</small></button>"; }).join("") +
      '</div><p class="fine">' + t("auth.demoPass") + "</p></div>";
  }
  function layout(form) {
    /* sign-in: a real food photo slowly drifting under a dark shade, a soft warm light passing over it, and a clean glass card */
    return '<div class="auth4"><div class="a4bg" style="background-image:url(' + SF.PHOTO.hero + ')" aria-hidden="true"></div><div class="a4shade" aria-hidden="true"></div><i class="a4glow" aria-hidden="true"></i>' +
      '<div class="a4in"><section class="a4side"><div class="a4brand">' + SF.mark(52) + '<b class="a4word">' + esc(SF.brand().slice(0, 3)) + "<em>" + esc(SF.brand().slice(3)) + "</em></b></div>" +
        '<h1 class="a4t">' + t("a4.t1") + " <em>" + t("a4.t2") + '</em></h1><p class="a4s">' + t("auth.heroSub") + "</p>" +
        '<ul class="a4pts"><li>' + I("bolt", 16) + t("a4.p1") + "</li><li>" + I("shield", 16) + t("a4.p2") + "</li><li>" + I("users", 16) + t("a4.p3") + "</li></ul></section>" +
      '<div class="aglass a4card"><div class="authtop"><a href="#/" class="link">' + I("chevL", 16) + t("auth.toShop") + "</a>" + SF.langSel() + "</div>" + form + "</div></div></div>";
  }
  SF.route("/login", { guest: true, shell: SF.shells.bare, title: "auth.login", render: function () {
    return layout('<form class="stack" data-form="login"><h2 class="h1">' + t("auth.welcome") + '</h2><p class="muted">' + t("auth.loginSub") + "</p>" +
      '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" autocomplete="username" placeholder="93 123 45 67" value="' + esc(SF.ls.get("lastPhone", "") || "") + '" required></span></label>' +
      '<label class="f">' + t("auth.password") + SF.pwInput("password", "current-password", " required") + "</label>" +
      '<button type="button" class="link forgot" data-act="forgot">' + t("pw.forgot") + "</button>" +
      '<button class="btn primary block lg">' + t("auth.login") + '</button>' + (SF.state.pub.demo ? '<p class="fine demonote">' + I("info", 14) + t("auth.demoLocal") + "</p>" : "") + '<p class="center muted">' + t("auth.noAccount") + ' <a href="#/register" class="link">' + t("auth.register") + "</a></p></form>" + (SF.state.pub.demo ? demoBlock() : ""));
  } });
  SF.route("/register", { guest: true, shell: SF.shells.bare, title: "auth.register", render: function () {
    return layout('<form class="stack" data-form="register"><h2 class="h1">' + t("auth.register") + '</h2><p class="muted">' + t("auth.regSub") + "</p>" +
      '<label class="f">' + t("profile.name") + '<input name="name" autocomplete="name" required></label>' +
      '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" autocomplete="username" placeholder="93 123 45 67" required></span></label>' +
      '<label class="f">' + t("auth.password") + SF.pwInput("password", "new-password", ' minlength="' + (SF.state.pub.demo ? 4 : 6) + '" required') + '<small class="hint">' + t("pw.hint", { n: SF.state.pub.demo ? 4 : 6 }) + "</small></label>" +
      '<button class="btn primary block lg">' + t("auth.create") + '</button><p class="center muted">' + t("auth.haveAccount") + ' <a href="#/login" class="link">' + t("auth.login") + '</a></p><p class="fine">' + t("auth.partnerNote") + "</p></form>");
  } });
  function enter(res, typed) {
    SF.ls.set("lastPhone", String(res.user.phone || "").replace(/^\+992/, ""));
    SF.api.setToken(res.token); SF.ls.set("token", res.token); SF.state.user = res.user;
    if (res.user.lang && !SF.ls.get("lang")) SF.state.lang = res.user.lang;
    if (res.user.role === "customer" && res.user.cityId) { SF.state.cityId = res.user.cityId; SF.ls.set("city", res.user.cityId); }
    SF.state.notes = []; SF.state.seen = {}; SF.toast(t("auth.hello", { name: res.user.name.split(" ")[0] }));
    var after = SF.state.after; SF.state.after = null;
    SF.go(after && res.user.role === "customer" ? after : SF.homeOf(res.user)); SF.poll && SF.poll(true);
    if (res.user.mustChange && typed) setTimeout(function () { mustChange(typed); }, 400);
  }
  /* signed in with a one-time password from the admin: choose your own right away */
  function mustChange(old) { SF.state.oldPw = old;
    SF.modal('<form class="stack" data-form="newpw"><span class="cic">' + I("shield", 28) + '</span><h2 class="h2">' + t("pw.mustTitle") + '</h2><p class="muted">' + t("pw.mustSub") + "</p>" +
      '<label class="f">' + t("pw.new") + SF.pwInput("password", "new-password", ' minlength="6" required') + '<small class="hint">' + t("pw.hint", { n: 6 }) + "</small></label>" +
      '<button class="btn primary block lg">' + t("pw.save") + '</button><button type="button" class="link center" data-act="closemodal">' + t("pw.later") + "</button></form>"); }
  SF.forms.newpw = function (fd) { return SF.api.patch("/auth/me", { oldPassword: SF.state.oldPw, password: fd.password }).then(function (u) { SF.state.oldPw = null; SF.state.user = u; SF.closeModal(); SF.toast(t("pw.done")); }); };
  /* forgot password: no SMS yet — the request goes to the admin, who calls back with a one-time password */
  /* forgot password: with Telegram / WhatsApp / SMS on — the person resets it alone; otherwise a request to the admin */
  SF.actions.forgot = function () { var f = document.querySelector("[data-form=login] [name=phone]"), ph = f ? f.value : "";
    if (!SF.verifyInfo()) return SF.actions.forgotAdmin();
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="forgotself"><h2 class="h2">' + t("pw.forgotTitle") + '</h2><p class="muted">' + t("vf.forgotSub") + "</p>" +
      '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" autocomplete="username" value="' + esc(ph) + '" required></span></label>' +
      '<button class="btn primary block lg">' + I("shield", 18) + t("vf.next") + '</button><button type="button" class="link center" data-act="forgotAdmin">' + t("vf.askAdmin") + "</button></form>"); };
  SF.forms.forgotself = function (fd) { if (window.SomonRules && !SomonRules.normPhone(fd.phone)) return Promise.reject({ code: "BAD_PHONE" }); return SF.resetFlow(fd.phone, function (r) { enter(r); }); };
  SF.actions.forgotAdmin = function () { var f = document.querySelector("[data-form=login] [name=phone]") || document.querySelector("[data-form=forgotself] [name=phone]"), ph = f ? f.value : "", sp = SF.state.pub.supportPhone;
    SF.modal('<button class="mx" data-act="closemodal" aria-label="' + t("btn.close") + '">' + I("x", 20) + '</button><form class="stack" data-form="forgot"><h2 class="h2">' + t("pw.forgotTitle") + '</h2><p class="muted">' + t("pw.forgotSub") + "</p>" +
      '<label class="f">' + t("auth.phone") + '<span class="phonein"><i>+992</i><input name="phone" inputmode="tel" autocomplete="username" value="' + esc(ph) + '" required></span></label>' +
      '<button class="btn primary block lg">' + I("phone", 18) + t("pw.forgotSend") + "</button>" +
      (sp ? '<p class="fine center">' + t("pw.orCall") + ' <a class="link num" href="tel:' + esc(String(sp).replace(/\s/g, "")) + '">' + esc(sp) + "</a></p>" : "") + "</form>"); };
  SF.forms.forgot = function (fd) { return SF.api.post("/auth/forgot", fd).then(function () {
    SF.modal('<div class="confirm"><span class="cic ok">' + I("check", 28) + '</span><h2 class="h2">' + t("pw.sentTitle") + '</h2><p class="muted">' + t("pw.sentSub") + '</p><button class="btn primary block" data-act="closemodal">' + t("btn.close") + "</button></div>"); }); };
  SF.forms.login = function (fd) { return SF.api.post("/auth/login", fd).then(function (r) { enter(r, fd.password); }); };
  SF.forms.register = function (fd) { fd.lang = SF.state.lang; fd.cityId = SF.state.cityId; return SF.registerFlow(fd, function (r) { enter(r); }); };
  SF.actions.demologin = function (el) { return SF.api.post("/auth/login", { phone: el.dataset.phone, password: "1234" }).then(function (r) { SF.closeModal(); return enter(r); }); };
  SF.logout = function (silent) { var tok = SF.api.token(); if (tok && !silent) SF.api.post("/auth/logout").catch(function () {});
    SF.api.setToken(null); SF.ls.set("token", null); SF.state.user = null; SF.state.notes = []; SF.state.co = null; SF.go("/"); };
  SF.actions.logout = function () { SF.logout(); };
  SF.demoBlock = demoBlock;
})();
