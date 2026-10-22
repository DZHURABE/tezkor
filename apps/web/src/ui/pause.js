/* the daily break of the whole service: a bar for customers, the checkout is disabled meanwhile (the server refuses orders too) */
(function () {
  var t = SF.t;
  /* the break that is on right now (Tajik time), or null */
  SF.paused = function () { var p = SF.state.pub && SF.state.pub.pause, u = SF.state.user; if (!p || !p.on || (u && u.role !== "customer")) return null;
    return SomonRules.isOpenAt({ from: p.from, to: p.to }, new Date()) ? p : null; };
  SF.after.push(function () { var old = document.getElementById("pausebar"), p = SF.paused(), host = document.getElementById("app");
    if (!p || !host) { if (old) old.remove(); return; }
    var html = t("ps.bar", { to: p.to }); if (old) { old.textContent = html; return; }
    var b = document.createElement("div"); b.id = "pausebar"; b.className = "pausebar"; b.setAttribute("role", "status"); b.textContent = html; host.insertBefore(b, host.firstChild); });
})();
