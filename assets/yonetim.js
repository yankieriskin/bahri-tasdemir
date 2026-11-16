/* Yönetim paneli: giriş, randevu listesi, usta usta görünüm, süzme ve durum değiştirme.
   Adresin sonu hangi görünümün açılacağını belirler:
     yonetim.html                              -> tüm randevular
     yonetim.html#ustalar                      -> usta listesi
     yonetim.html#usta/club/Bilal%20Karadeniz  -> o ustanın randevuları
   Her usta kendi adresini telefonuna kısayol olarak kaydedebilir. */
(function () {
  "use strict";

  var BT = window.BT, A = window.BTApp, Store = window.BTStore;
  var ANY = "Fark Etmez";
  var VIEWS = [["bugun", "BUGÜN"], ["yarin", "YARIN"], ["yaklasan", "YAKLAŞAN"], ["gecmis", "GEÇMİŞ"], ["tum", "TÜMÜ"]];
  var STATUS = { yeni: "BEKLİYOR", tamam: "TAMAMLANDI", iptal: "İPTAL" };
  var CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

  // mode: "all" tüm randevular, "staff" ustalar. person: seçili usta {branch, name}; seçili değilse null.
  var state = { mode: "all", person: null, branch: "all", view: "yaklasan", q: "", list: [] };

  function $(i) { return document.getElementById(i); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function lower(s) { return String(s || "").toLocaleLowerCase("tr"); }
  function digitsOf(s) { return String(s || "").replace(/\D/g, ""); }

  function dayKey(offset) {
    var n = new Date();
    return A.ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() + (offset || 0)));
  }

  /* ---- Adres: hangi görünüm açık ---- */
  function personHash(branch, name) { return "#usta/" + branch + "/" + encodeURIComponent(name); }

  function route() {
    var p = window.location.hash.replace(/^#/, "").split("/");
    state.mode = "all";
    state.person = null;
    if (p[0] === "ustalar") {
      state.mode = "staff";
    } else if (p[0] === "usta") {
      state.mode = "staff";
      var name = "";
      try { name = decodeURIComponent(p.slice(2).join("/")); } catch (e) { name = ""; }
      if (has(BT.branches, p[1]) && (name === ANY || BT.branches[p[1]].staff.indexOf(name) >= 0)) {
        state.person = { branch: p[1], name: name };
      }
    }
  }

  function staffLabel(name) { return name === ANY ? "Personel atanmamış" : name; }

  function initials(name) {
    if (name === ANY) return "?";
    return name.split(" ").slice(0, 2).map(function (p) { return p.charAt(0); }).join("");
  }

  // Seçili ustanın, yoksa seçili şubenin randevuları
  function inScope(a) {
    if (state.person) return a.branch === state.person.branch && a.staff === state.person.name;
    return state.branch === "all" || a.branch === state.branch;
  }

  function filtered() {
    var t = dayKey(0), y = dayKey(1);
    var text = state.person ? "" : state.q;
    var q = lower(text).trim(), qd = digitsOf(text);
    return state.list.filter(function (a) {
      if (!inScope(a)) return false;
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

  function renderModes() {
    Array.prototype.forEach.call($("modes").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-m") === state.mode));
    });
  }

  function renderHead() {
    var box = $("who-head");
    if (!state.person) { box.innerHTML = ""; return; }
    var br = BT.branches[state.person.branch], n = state.person.name;
    box.innerHTML =
      '<a class="backlink" href="#ustalar">' + BACK + "TÜM USTALAR</a>" +
      '<div class="ph"><span class="av" aria-hidden="true">' + A.esc(initials(n)) + "</span>" +
      '<div class="t"><div class="eyebrow">' + A.esc(br.title.toLocaleUpperCase("tr")) + "</div>" +
      "<h2>" + A.esc(staffLabel(n)) + "</h2></div></div>";
  }

  function renderTiles() {
    var t = dayKey(0), y = dayKey(1);
    var live = state.list.filter(function (a) { return inScope(a) && a.status !== "iptal"; });
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

  // Usta listesi: her ustanın bugünkü ve yaklaşan randevu sayısı
  function renderPeople() {
    var t = dayKey(0);
    var live = state.list.filter(function (a) { return a.status !== "iptal" && a.date >= t; });
    var html = "";
    Object.keys(BT.branches).forEach(function (k) {
      if (state.branch !== "all" && state.branch !== k) return;
      var br = BT.branches[k];
      var here = live.filter(function (a) { return a.branch === k; });
      var names = br.staff.slice();
      // Personeli salonun planlayacağı randevu varsa ayrı bir satırda gösterilir.
      if (here.some(function (a) { return a.staff === ANY; })) names.push(ANY);
      html += '<h2 class="group">' + A.esc(br.title.toLocaleUpperCase("tr")) + '</h2><div class="people">';
      names.forEach(function (n) {
        var own = here.filter(function (a) { return a.staff === n; });
        var today = own.filter(function (a) { return a.date === t; }).length;
        html += '<a class="person" href="' + A.esc(personHash(k, n)) + '">' +
          '<span class="av" aria-hidden="true">' + A.esc(initials(n)) + "</span>" +
          '<span class="txt"><span class="nm">' + A.esc(staffLabel(n)) + "</span>" +
          '<span class="sub">' + (own.length ? own.length + " yaklaşan randevu" : "Yaklaşan randevu yok") + "</span></span>" +
          (today ? '<span class="cnt">BUGÜN ' + today + "</span>" : "") +
          CHEVRON + "</a>";
      });
      html += "</div>";
    });
    $("people").innerHTML = html;
  }

  function dayTitle(key) {
    var prefix = key === dayKey(0) ? "Bugün, " : (key === dayKey(1) ? "Yarın, " : "");
    return prefix + A.longDate(A.fromYmd(key));
  }

  function act(name, id, label, cls) {
    return '<button type="button" class="mini' + (cls ? " " + cls : "") + '" data-act="' + name + '" data-id="' + A.esc(id) + '">' + label + "</button>";
  }

  function card(a) {
    var br = BT.branches[a.branch] || { title: a.branch, genders: [] };
    var st = STATUS[a.status] ? a.status : "yeni";
    var names = (a.services || []).map(function (s) { return s.name; }).join(", ");
    var where = br.title + (br.genders.length > 1 && a.gender ? " · " + (a.gender === "KADIN" ? "Kadın" : "Erkek") : "");
    var staff = a.staff === ANY ? "Personel atanmadı" : a.staff + (a.anyStaff ? " (fark etmez)" : "");
    // Ustanın kendi sayfasında adı zaten başlıkta yazar; satırda yalnız şube kalır.
    var place = state.person ? where + (a.anyStaff && a.staff !== ANY ? " · müşteri usta seçmedi" : "") : staff + " · " + where;
    var acts = "";
    if (st !== "tamam") acts += act("tamam", a.id, "TAMAMLANDI", st === "yeni" ? "ok" : "");
    if (st !== "iptal") acts += act("iptal", a.id, "İPTAL ET");
    if (st !== "yeni") acts += act("yeni", a.id, "GERİ AL");
    acts += act("sil", a.id, "SİL", "danger");

    return '<article class="appt ' + st + '">' +
      '<div class="time">' + A.esc(a.time) + "</div>" +
      '<div class="body">' +
        '<div class="top"><span class="who">' + A.esc(a.name) + '</span><span class="pill ' + st + '">' + STATUS[st] + "</span></div>" +
        '<a class="tel" href="tel:' + A.esc(String(a.phone || "").replace(/[^\d+]/g, "")) + '">' + A.ICON.phone + A.esc(a.phone) + "</a>" +
        '<p class="meta">' + A.esc(names) + (a.total ? " · " + A.esc(a.total) : "") + "</p>" +
        '<p class="meta">' + A.esc(place) + "</p>" +
      "</div>" +
      '<div class="acts">' + acts + "</div>" +
      "</article>";
  }

  function renderList() {
    var items = filtered();
    if (!items.length) {
      $("list").innerHTML = '<div class="empty"><p>Bu görünümde randevu yok.</p>' +
        (state.person ? "" : '<a class="btn outline" href="index.html">SİTEYİ AÇ</a>') + "</div>";
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
    var detail = !!state.person;
    var people = state.mode === "staff" && !detail;
    $("who-head").hidden = !detail;
    $("tiles").hidden = people;
    $("branches").hidden = detail;
    $("views").hidden = people;
    $("search").hidden = state.mode !== "all";
    $("people").hidden = !people;
    $("list").hidden = people;
    renderModes();
    renderHead();
    renderTiles();
    renderFilters();
    if (people) renderPeople(); else renderList();
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
    $("refresh-top").style.visibility = "visible";
    if (Store.needsLogin) {
      $("account").hidden = false;
      $("who").textContent = user && user.email ? user.email : "";
    }
    route();
    render();
    load();
  }

  function showLogin(text, info) {
    $("panel").hidden = true;
    $("login").hidden = false;
    $("refresh-top").style.visibility = "hidden";
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
  $("refresh-top").addEventListener("click", load);

  /* ---- Görünüm, süzgeçler ve işlemler ---- */
  $("modes").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    var next = t.getAttribute("data-m") === "staff" ? "#ustalar" : "#";
    if (window.location.hash === next || (next === "#" && !window.location.hash)) return;
    window.location.hash = next;
  });

  window.addEventListener("hashchange", function () {
    if ($("panel").hidden) return;
    route();
    render();
    window.scrollTo(0, 0);
  });

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
