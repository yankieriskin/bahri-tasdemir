/* Yönetim paneli: giriş, randevu listesi, usta usta görünüm, müşteri kayıtları, süzme ve durum değiştirme.
   Adresin sonu hangi görünümün açılacağını belirler:
     yonetim.html                              -> tüm randevular
     yonetim.html#ustalar                      -> usta listesi
     yonetim.html#usta/club/Bilal%20Karadeniz  -> o ustanın randevuları
     yonetim.html#musteriler                   -> müşteri listesi
     yonetim.html#musteri/5321234567           -> o müşterinin bilgileri ve randevuları
   Her usta kendi adresini telefonuna kısayol olarak kaydedebilir. */
(function () {
  "use strict";

  var BT = window.BT, A = window.BTApp, Store = window.BTStore;
  var ANY = "Fark Etmez";
  var VIEWS = [["bugun", "BUGÜN"], ["yarin", "YARIN"], ["yaklasan", "YAKLAŞAN"], ["gecmis", "GEÇMİŞ"], ["tum", "TÜMÜ"]];
  var STATUS = { yeni: "BEKLİYOR", tamam: "TAMAMLANDI", iptal: "İPTAL" };
  var TITLES = { all: "Randevular", staff: "Ustalar", cust: "Müşteriler" };
  var PAST_DAYS = 120;
  var CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

  /* mode: "all" tüm randevular, "staff" ustalar, "cust" müşteriler.
     person: seçili usta {branch, name}; cust: seçili müşterinin numarası.
     list: yüklü randevular (from tarihinden sonrası). custs: numara -> müşteri kaydı (silinmişse null).
     custAll: müşterilerin tamamı yüklendi mi. custAppts: seçili müşterinin randevuları (custFor numarası için). */
  var state = {
    mode: "all", person: null, cust: "", branch: "all", view: "yaklasan", q: "", cq: "",
    list: [], from: "", listAt: 0, custs: {}, custAll: false, custAppts: [], custFor: "", busy: false
  };

  function $(i) { return document.getElementById(i); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function lower(s) { return String(s || "").toLocaleLowerCase("tr"); }
  function digitsOf(s) { return String(s || "").replace(/\D/g, ""); }
  // Aramada yazılan numara: kayıtlar baştaki 0 olmadan saklandığı için o atılır.
  function digitsQuery(s) { var d = digitsOf(s); return d.charAt(0) === "0" ? d.slice(1) : d; }

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
    state.cust = "";
    if (p[0] === "ustalar") {
      state.mode = "staff";
    } else if (p[0] === "usta") {
      state.mode = "staff";
      var name = "";
      try { name = decodeURIComponent(p.slice(2).join("/")); } catch (e) { name = ""; }
      if (has(BT.branches, p[1]) && (name === ANY || BT.branches[p[1]].staff.indexOf(name) >= 0)) {
        state.person = { branch: p[1], name: name };
      }
    } else if (p[0] === "musteriler") {
      state.mode = "cust";
    } else if (p[0] === "musteri") {
      state.mode = "cust";
      if (/^\d{10,15}$/.test(p[1] || "")) state.cust = p[1];
    }
  }

  function staffLabel(name) { return name === ANY ? "Personel atanmamış" : name; }

  function initials(name) {
    if (!name || name === ANY) return "?";
    return String(name).split(" ").filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0); }).join("").toLocaleUpperCase("tr");
  }

  /* ---- Müşteri bilgileri ---- */
  function custOf(phone) { return has(state.custs, phone) ? state.custs[phone] : undefined; }

  // Randevuda ad tutulmaz; ad, müşteri kaydından gelir.
  // Müşteri kaydı eklenmeden önce alınmış eski randevularda ad randevunun içindedir.
  function nameOf(a) {
    var c = custOf(a.phone);
    if (c) return c.name;
    if (a.name) return a.name;
    return c === null ? "Kaydı silinmiş müşteri" : "…";
  }

  // Tek biçime inmiş numara düzenli yazılır; eski randevulardaki serbest yazılmış numara olduğu gibi gösterilir.
  function isKey(p) { return /^\d{10,15}$/.test(String(p || "")); }
  function phoneLabel(p) { return isKey(p) ? A.phoneText(p) : String(p || ""); }
  function phoneLink(p) { return isKey(p) ? A.phoneHref(p) : "tel:" + String(p || "").replace(/[^\d+]/g, ""); }

  function genderText(g) { return g === "K" ? "Kadın" : (g === "E" ? "Erkek" : ""); }

  // Yaş kayıt sırasında yazılır; aradan geçen yıllar eklenir.
  function ageNow(c) {
    if (typeof c.age !== "number") return "";
    var years = 0;
    if (c.created) {
      var d = new Date(c.created), n = new Date();
      years = n.getFullYear() - d.getFullYear();
      if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) years--;
    }
    return c.age + Math.max(0, years);
  }

  function shortDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.getDate() + " " + A.MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  // Seçili ustanın, yoksa seçili şubenin randevuları
  function inScope(a) {
    if (state.person) return a.branch === state.person.branch && a.staff === state.person.name;
    return state.branch === "all" || a.branch === state.branch;
  }

  function byTime(a, b) {
    var k1 = a.date + " " + a.time, k2 = b.date + " " + b.time;
    return k1 < k2 ? -1 : (k1 > k2 ? 1 : 0);
  }

  function filtered() {
    var t = dayKey(0), y = dayKey(1);
    var text = state.person ? "" : state.q;
    var q = lower(text).trim(), qd = digitsQuery(text);
    return state.list.filter(function (a) {
      if (!inScope(a)) return false;
      if (state.view === "bugun" && a.date !== t) return false;
      if (state.view === "yarin" && a.date !== y) return false;
      if (state.view === "yaklasan" && a.date < t) return false;
      if (state.view === "gecmis" && a.date >= t) return false;
      if (!q) return true;
      return lower(nameOf(a)).indexOf(q) >= 0 || (qd.length > 0 && digitsOf(a.phone).indexOf(qd) >= 0);
    }).sort(function (a, b) {
      return state.view === "gecmis" ? -byTime(a, b) : byTime(a, b);
    });
  }

  function renderModes() {
    Array.prototype.forEach.call($("modes").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-m") === state.mode));
    });
    $("title").textContent = TITLES[state.mode];
  }

  function headHtml(backHref, backText, avatar, kicker, title) {
    return '<a class="backlink" href="' + backHref + '">' + BACK + backText + "</a>" +
      '<div class="ph"><span class="av" aria-hidden="true">' + A.esc(avatar) + "</span>" +
      '<div class="t"><div class="eyebrow">' + A.esc(kicker) + "</div>" +
      "<h2>" + A.esc(title) + "</h2></div></div>";
  }

  function renderHead() {
    var box = $("who-head");
    if (state.person) {
      var br = BT.branches[state.person.branch], n = state.person.name;
      box.innerHTML = headHtml("#ustalar", "TÜM USTALAR", initials(n), br.title.toLocaleUpperCase("tr"), staffLabel(n));
    } else if (state.cust) {
      var c = custOf(state.cust);
      box.innerHTML = headHtml("#musteriler", "TÜM MÜŞTERİLER", c ? initials(c.name) : "?", "MÜŞTERİ", c ? c.name : A.phoneText(state.cust));
    } else {
      box.innerHTML = "";
    }
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

  function emptyHtml(text, withSiteLink) {
    return '<div class="empty"><p>' + A.esc(text) + "</p>" + (withSiteLink ? '<a class="btn outline" href="index.html">SİTEYİ AÇ</a>' : "") + "</div>";
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

  // Müşteri listesi: ada göre sıralı, ad ya da telefonla aranabilir
  function renderCustomers() {
    if (!state.custAll) {
      $("people").innerHTML = emptyHtml(state.busy ? "Yükleniyor…" : "Müşteriler yüklenemedi. Sağ üstteki yenile düğmesine basın.");
      return;
    }
    var all = Object.keys(state.custs).map(function (k) { return state.custs[k]; }).filter(Boolean);
    var q = lower(state.cq).trim(), qd = digitsQuery(state.cq);
    var items = all.filter(function (c) {
      return !q || lower(c.name).indexOf(q) >= 0 || (qd.length > 0 && String(c.phone).indexOf(qd) >= 0);
    }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), "tr"); });
    var head = '<p class="count">' + (q ? items.length + " / " : "") + all.length + " müşteri</p>";
    if (!items.length) {
      $("people").innerHTML = head + emptyHtml(all.length ? "Aramaya uyan müşteri yok." : "Henüz kayıtlı müşteri yok. İlk randevusunu alan her müşteri buraya eklenir.");
      return;
    }
    $("people").innerHTML = head + '<div class="people">' + items.map(function (c) {
      var bits = [A.phoneText(c.phone)];
      if (ageNow(c) !== "") bits.push(ageNow(c) + " yaş");
      if (genderText(c.gender)) bits.push(genderText(c.gender));
      return '<a class="person" href="#musteri/' + A.esc(c.phone) + '">' +
        '<span class="av" aria-hidden="true">' + A.esc(initials(c.name)) + "</span>" +
        '<span class="txt"><span class="nm">' + A.esc(c.name) + "</span>" +
        '<span class="sub">' + A.esc(bits.join(" · ")) + "</span></span>" +
        CHEVRON + "</a>";
    }).join("") + "</div>";
  }

  // Seçili müşterinin bilgileri
  function renderInfo() {
    var c = custOf(state.cust);
    if (!c) {
      $("info").innerHTML = state.busy && c === undefined ? "" : '<p class="note">Bu numaraya ait müşteri kaydı yok; kayıt silinmiş olabilir. Numarayla alınmış randevular aşağıda görünür.</p>';
      return;
    }
    function fact(k, v) { return '<div class="r"><span>' + k + "</span><span>" + v + "</span></div>"; }
    $("info").innerHTML = '<div class="facts">' +
      fact("Telefon", '<a href="' + A.esc(A.phoneHref(c.phone)) + '">' + A.esc(A.phoneText(c.phone)) + "</a>") +
      fact("Yaş", ageNow(c) === "" ? "—" : A.esc(ageNow(c))) +
      fact("Cinsiyet", A.esc(genderText(c.gender) || "—")) +
      fact("Kayıt tarihi", A.esc(shortDate(c.created) || "—")) +
      "</div>" +
      '<button type="button" class="mini danger" data-del="' + A.esc(c.phone) + '">MÜŞTERİ KAYDINI SİL</button>';
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
    var c = custOf(a.phone);
    if (c && c.first === a.id) place += " · ilk randevusu";
    var who = A.esc(nameOf(a));
    // Müşterinin kendi sayfası dışında ad, o sayfaya bağlantıdır (kaydı olan müşteriler için).
    if (!state.cust && c) who = '<a href="#musteri/' + A.esc(a.phone) + '">' + who + "</a>";
    var acts = "";
    if (st !== "tamam") acts += act("tamam", a.id, "TAMAMLANDI", st === "yeni" ? "ok" : "");
    if (st !== "iptal") acts += act("iptal", a.id, "İPTAL ET");
    if (st !== "yeni") acts += act("yeni", a.id, "GERİ AL");
    acts += act("sil", a.id, "SİL", "danger");

    return '<article class="appt ' + st + '">' +
      '<div class="time">' + A.esc(a.time) + "</div>" +
      '<div class="body">' +
        '<div class="top"><span class="who">' + who + '</span><span class="pill ' + st + '">' + STATUS[st] + "</span></div>" +
        '<a class="tel" href="' + A.esc(phoneLink(a.phone)) + '">' + A.ICON.phone + A.esc(phoneLabel(a.phone)) + "</a>" +
        '<p class="meta">' + A.esc(names) + (a.total ? " · " + A.esc(a.total) : "") + "</p>" +
        '<p class="meta">' + A.esc(place) + "</p>" +
      "</div>" +
      '<div class="acts">' + acts + "</div>" +
      "</article>";
  }

  function renderList() {
    var mine = !!state.cust;
    var ready = mine ? state.custFor === state.cust : true;
    var items = mine ? (ready ? state.custAppts.slice().sort(function (a, b) { return -byTime(a, b); }) : []) : filtered();
    var head = mine ? '<h2 class="group">RANDEVULARI' + (items.length ? " · " + items.length : "") + "</h2>" : "";
    if (!items.length) {
      var text = state.busy || !ready ? "Yükleniyor…" : (mine ? "Bu müşterinin randevusu yok." : "Bu görünümde randevu yok.");
      $("list").innerHTML = head + emptyHtml(text, !mine && !state.person && !state.busy);
      return;
    }
    var counts = {};
    items.forEach(function (a) { counts[a.date] = (counts[a.date] || 0) + 1; });
    var html = head, last = "";
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
    var custList = state.mode === "cust" && !state.cust;
    var custPage = state.mode === "cust" && !!state.cust;
    $("who-head").hidden = !(detail || custPage);
    $("tiles").hidden = people || state.mode === "cust";
    $("branches").hidden = detail || state.mode === "cust";
    $("views").hidden = people || state.mode === "cust";
    $("search").hidden = state.mode !== "all";
    $("csearch").hidden = !custList;
    $("info").hidden = !custPage;
    $("people").hidden = !(people || custList);
    $("list").hidden = people || custList;
    renderModes();
    renderHead();
    renderTiles();
    renderFilters();
    if (people) renderPeople();
    else if (custList) renderCustomers();
    else {
      if (custPage) renderInfo();
      renderList();
    }
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

  /* ---- Veri yükleme ----
     Okuma sayısını düşük tutmak için yalnızca gereken yüklenir: önce bugünden sonraki randevular;
     geçmiş, GEÇMİŞ ya da TÜMÜ açılınca; müşteriler, Müşteriler bölümü açılınca. */
  function wantsPast() { return state.view === "gecmis" || state.view === "tum"; }

  // Randevularda geçen numaraların müşteri kayıtlarını (adlarını) getirir.
  function resolveNames(list) {
    var need = {};
    list.forEach(function (a) { if (isKey(a.phone) && !has(state.custs, a.phone)) need[a.phone] = 1; });
    var keys = Object.keys(need);
    if (!keys.length) return Promise.resolve();
    return Store.customersByKeys(keys).then(function (map) {
      keys.forEach(function (k) { state.custs[k] = map[k] || null; });
    });
  }

  function fetchList() {
    var from = wantsPast() ? dayKey(-PAST_DAYS) : dayKey(0);
    return Store.list(from).then(function (l) {
      return resolveNames(l).then(function () {
        state.list = l;
        state.from = from;
        state.listAt = Date.now();
      });
    });
  }

  function fetchCustomers() {
    return Store.customers().then(function (l) {
      var map = {};
      l.forEach(function (c) { map[c.key] = c; });
      state.custs = map;
      state.custAll = true;
    });
  }

  function fetchCustomer(key) {
    return Promise.all([Store.customersByKeys([key]), Store.customerAppointments(key)]).then(function (r) {
      state.custs[key] = r[0][key] || null;
      state.custAppts = r[1];
      state.custFor = key;
    });
  }

  // Açık görünümün verisi eksik ya da bayat mı?
  function missing() {
    if (state.mode === "cust") return state.cust ? state.custFor !== state.cust : !state.custAll;
    if (!state.from || Date.now() - state.listAt > 60000) return true;
    return wantsPast() && state.from > dayKey(-PAST_DAYS);
  }

  function load() {
    var job = state.mode === "cust" ? (state.cust ? fetchCustomer(state.cust) : fetchCustomers()) : fetchList();
    state.busy = true;
    render();
    return job.then(function () {
      state.busy = false;
      say("");
      render();
    }, function (err) {
      state.busy = false;
      say(err && err.code === "permission-denied" ? "Bu hesabın yönetici yetkisi yok." : "Kayıtlar yüklenemedi. Bağlantınızı kontrol edip YENİLE'ye basın.");
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
      // Çıkışta ekranda ve bellekte kişisel bilgi kalmasın.
      state.list = [];
      state.from = "";
      state.custs = {};
      state.custAll = false;
      state.custAppts = [];
      state.custFor = "";
      render();
      showLogin("");
    });
  });

  $("refresh").addEventListener("click", load);
  $("refresh-top").addEventListener("click", load);

  /* ---- Görünüm, süzgeçler ve işlemler ---- */
  $("modes").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    var next = { staff: "#ustalar", cust: "#musteriler" }[t.getAttribute("data-m")] || "#";
    if (window.location.hash === next || (next === "#" && !window.location.hash)) return;
    window.location.hash = next;
  });

  window.addEventListener("hashchange", function () {
    if ($("panel").hidden) return;
    route();
    if (missing()) load(); else render();
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
    if (missing()) load(); else render();
  });

  $("q").addEventListener("input", function (e) {
    state.q = e.target.value;
    renderList();
  });

  $("cq").addEventListener("input", function (e) {
    state.cq = e.target.value;
    renderCustomers();
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
    state.listAt = 0; // müşteri sayfasından yapılan değişiklik randevu listesine de yansısın
    job.then(load, function (err) {
      load().then(function () { say(explain(err)); });
    });
  });

  // Müşteri kaydını sil
  $("info").addEventListener("click", function (e) {
    var t = e.target.closest("[data-del]");
    if (!t) return;
    var key = t.getAttribute("data-del");
    if (!window.confirm("Bu müşterinin kaydı kalıcı olarak silinsin mi?\n\nRandevuları silinmez. Müşteri yeniden randevu alırken baştan kayıt olur.")) return;
    Store.removeCustomer(key).then(function () {
      if (state.custAll) delete state.custs[key]; else state.custs[key] = null;
      window.location.hash = "#musteriler";
    }, function (err) {
      say(explain(err));
    });
  });

  // Başka sekmede randevu alınırsa ya da panele geri dönülürse kayıtları yenile (yarım dakikada en çok bir kez)
  var lastAuto = 0;
  function autoLoad() {
    if ($("panel").hidden || Date.now() - lastAuto < 30000) return;
    lastAuto = Date.now();
    load();
  }
  window.addEventListener("storage", autoLoad);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) autoLoad(); });

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
