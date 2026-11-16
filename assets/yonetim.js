/* Yönetim paneli: giriş, randevu listesi, süzme ve durum değiştirme. */
(function () {
  "use strict";

  var BT = window.BT, A = window.BTApp, Store = window.BTStore;
  var ANY = "Fark Etmez";
  var VIEWS = [["bugun", "BUGÜN"], ["yarin", "YARIN"], ["yaklasan", "YAKLAŞAN"], ["gecmis", "GEÇMİŞ"], ["tum", "TÜMÜ"]];
  var STATUS = { yeni: "BEKLİYOR", tamam: "TAMAMLANDI", iptal: "İPTAL" };
  var state = { branch: "all", view: "yaklasan", q: "", list: [] };

  function $(i) { return document.getElementById(i); }
  function lower(s) { return String(s || "").toLocaleLowerCase("tr"); }
  function digitsOf(s) { return String(s || "").replace(/\D/g, ""); }

  function dayKey(offset) {
    var n = new Date();
    return A.ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() + (offset || 0)));
  }

  function inBranch(a) { return state.branch === "all" || a.branch === state.branch; }

  function filtered() {
    var t = dayKey(0), y = dayKey(1);
    var q = lower(state.q).trim(), qd = digitsOf(state.q);
    return state.list.filter(function (a) {
      if (!inBranch(a)) return false;
      if (state.view === "bugun" && a.date !== t) return false;
      if (state.view === "yarin" && a.date !== y) return false;
      if (state.view === "yaklasan" && a.date < t) return false;
      if (state.view === "gecmis" && a.date >= t) return false;
      if (!q) return true;
      return lower(a.name).indexOf(q) >= 0 || (qd.length > 0 && digitsOf(a.phone).indexOf(qd) >= 0);
    }).sort(function (a, b) {
      var k1 = a.date + " " + a.time, k2 = b.date + " " + b.time;
      var c = k1 < k2 ? -1 : (k1 > k2 ? 1 : 0);
      return state.view === "gecmis" ? -c : c;
    });
  }

  function renderTiles() {
    var t = dayKey(0), y = dayKey(1);
    var live = state.list.filter(function (a) { return inBranch(a) && a.status !== "iptal"; });
    function count(fn) { return live.filter(fn).length; }
    var tiles = [
      [count(function (a) { return a.date === t; }), "BUGÜN"],
      [count(function (a) { return a.date === y; }), "YARIN"],
      [count(function (a) { return a.date >= t; }), "YAKLAŞAN"]
    ];
    $("tiles").innerHTML = tiles.map(function (x) {
      return '<div class="tile"><span class="v">' + x[0] + '</span><span class="k">' + x[1] + "</span></div>";
    }).join("");
  }

  function renderFilters() {
    var opts = [["all", "TÜMÜ"]].concat(Object.keys(BT.branches).map(function (k) {
      return [k, BT.branches[k].title.toLocaleUpperCase("tr")];
    }));
    $("branches").innerHTML = opts.map(function (o) {
      return '<button type="button" data-b="' + o[0] + '" aria-pressed="' + (o[0] === state.branch) + '">' + A.esc(o[1]) + "</button>";
    }).join("");
    $("views").innerHTML = VIEWS.map(function (v) {
      return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (v[0] === state.view) + '">' + v[1] + "</button>";
    }).join("");
  }

  function dayTitle(key) {
    var prefix = key === dayKey(0) ? "Bugün, " : (key === dayKey(1) ? "Yarın, " : "");
    return prefix + A.longDate(A.fromYmd(key));
  }

  function act(name, id, label, danger) {
    return '<button type="button" class="mini' + (danger ? " danger" : "") + '" data-act="' + name + '" data-id="' + A.esc(id) + '">' + label + "</button>";
  }

  function card(a) {
    var br = BT.branches[a.branch] || { title: a.branch, genders: [] };
    var st = STATUS[a.status] ? a.status : "yeni";
    var names = (a.services || []).map(function (s) { return s.name; }).join(", ");
    var staff = a.staff === ANY ? "Personel atanmadı" : a.staff + (a.anyStaff ? " (fark etmez)" : "");
    var where = br.title + (br.genders.length > 1 && a.gender ? " · " + (a.gender === "KADIN" ? "Kadın" : "Erkek") : "");
    var acts = "";
    if (st !== "tamam") acts += act("tamam", a.id, "TAMAMLANDI");
    if (st !== "iptal") acts += act("iptal", a.id, "İPTAL ET");
    if (st !== "yeni") acts += act("yeni", a.id, "GERİ AL");
    acts += act("sil", a.id, "SİL", true);

    return '<article class="appt ' + st + '">' +
      '<div class="time">' + A.esc(a.time) + "</div>" +
      '<div class="body">' +
        '<div class="top"><span class="who">' + A.esc(a.name) + '</span><span class="pill ' + st + '">' + STATUS[st] + "</span></div>" +
        '<a class="tel" href="tel:' + A.esc(String(a.phone || "").replace(/[^\d+]/g, "")) + '">' + A.ICON.phone + A.esc(a.phone) + "</a>" +
        '<p class="meta">' + A.esc(names) + (a.total ? " · " + A.esc(a.total) : "") + "</p>" +
        '<p class="meta">' + A.esc(staff) + " · " + A.esc(where) + "</p>" +
        '<div class="acts">' + acts + "</div>" +
      "</div></article>";
  }

  function renderList() {
    var items = filtered();
    if (!items.length) {
      $("list").innerHTML = '<div class="empty"><p>Bu görünümde randevu yok.</p><a class="btn outline" href="index.html">SİTEYİ AÇ</a></div>';
      return;
    }
    var counts = {};
    items.forEach(function (a) { counts[a.date] = (counts[a.date] || 0) + 1; });
    var html = "", last = "";
    items.forEach(function (a) {
      if (a.date !== last) {
        last = a.date;
        html += '<div class="day-head"><h2>' + A.esc(dayTitle(a.date)) + "</h2><span>" + counts[a.date] + " randevu</span></div>";
      }
      html += card(a);
    });
    $("list").innerHTML = html;
  }

  function render() {
    renderTiles();
    renderFilters();
    renderList();
  }

  function say(text) {
    var box = $("msg");
    box.hidden = !text;
    box.textContent = text || "";
  }

  function explain(err) {
    if (err && err.code === "permission-denied") return "Bu hesabın yönetici yetkisi yok.";
    if (err && err.code === "dolu") return "Bu saat artık başka bir randevuya verilmiş; iptal geri alınamadı.";
    return "İşlem yapılamadı. Bağlantınızı kontrol edip yeniden deneyin.";
  }

  function load() {
    return Store.list().then(function (l) {
      state.list = l;
      say("");
      render();
    }, function (err) {
      say(err && err.code === "permission-denied" ? "Bu hesabın yönetici yetkisi yok." : "Randevular yüklenemedi. Bağlantınızı kontrol edip YENİLE'ye basın.");
      render();
    });
  }

  /* ---- Giriş ---- */
  function showPanel(user) {
    $("login").hidden = true;
    $("panel").hidden = false;
    if (Store.needsLogin) {
      $("account").hidden = false;
      $("who").textContent = user && user.email ? user.email : "";
    }
    render();
    load();
  }

  function showLogin(text, info) {
    $("panel").hidden = true;
    $("login").hidden = false;
    var box = $("login-err");
    box.hidden = !text;
    box.textContent = text || "";
    var note = $("login-info");
    note.hidden = !info;
    note.textContent = info || "";
  }

  function loginText(err) {
    var c = err && err.code ? String(err.code) : "";
    if (c === "auth/too-many-requests") return "Çok fazla deneme yapıldı. Biraz bekleyip yeniden deneyin.";
    if (c === "auth/network-request-failed") return "Bağlantı kurulamadı. İnternetinizi kontrol edin.";
    if (c.indexOf("auth/") === 0) return "E-posta ya da şifre hatalı.";
    return "Giriş yapılamadı. Sayfayı yenileyip yeniden deneyin.";
  }

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("email").value.trim(), pass = $("pass").value;
    if (!email || !pass) { showLogin("E-posta ve şifrenizi yazın."); return; }
    var btn = $("login-go");
    btn.disabled = true;
    Store.signIn(email, pass).then(function (u) {
      btn.disabled = false;
      $("pass").value = "";
      showPanel(u);
    }, function (err) {
      btn.disabled = false;
      showLogin(loginText(err));
    });
  });

  // Şifre unutulduysa: yazılan e-postaya sıfırlama bağlantısı gönderilir.
  $("forgot").addEventListener("click", function () {
    var email = $("email").value.trim();
    if (!email) { showLogin("Önce e-posta adresinizi yazın, sonra \"Şifremi unuttum\"a basın."); return; }
    var btn = $("forgot");
    btn.disabled = true;
    Store.resetPassword(email).then(function () {
      btn.disabled = false;
      showLogin("", "Bu adres yönetici olarak kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.");
    }, function (err) {
      btn.disabled = false;
      showLogin(loginText(err));
    });
  });

  $("out").addEventListener("click", function () {
    Store.signOut().then(function () {
      state.list = [];
      showLogin("");
    });
  });

  $("refresh").addEventListener("click", load);

  /* ---- Süzgeçler ve işlemler ---- */
  $("branches").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    state.branch = t.getAttribute("data-b");
    render();
  });

  $("views").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    state.view = t.getAttribute("data-v");
    render();
  });

  $("q").addEventListener("input", function (e) {
    state.q = e.target.value;
    renderList();
  });

  $("list").addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]");
    if (!t) return;
    var name = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    var job;
    if (name === "sil") {
      if (!window.confirm("Bu randevu kalıcı olarak silinsin mi?")) return;
      job = Store.remove(id);
    } else {
      job = Store.update(id, { status: name });
    }
    job.then(load, function (err) {
      say(explain(err));
      load().then(function () { say(explain(err)); });
    });
  });

  // Başka sekmede randevu alınırsa ya da sekmeye geri dönülürse listeyi yenile
  window.addEventListener("storage", function () { if (!$("panel").hidden) load(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !$("panel").hidden) load(); });

  /* ---- Başlangıç ---- */
  if (!Store.needsLogin) {
    $("demo").hidden = false;
    showPanel(null);
  } else {
    Store.user().then(function (u) {
      if (u) showPanel(u); else showLogin("");
    }, function () {
      showLogin("Bağlantı kurulamadı. İnternetinizi kontrol edip sayfayı yenileyin.");
    });
  }
})();
