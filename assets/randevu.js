/* Randevu sayfası: hizmet, personel, tarih ve saat seçimi; ardından kayıt.
   Adres örneği: randevu.html?sube=luxury&g=0&h=Saç%20Kesimi */
(function () {
  "use strict";

  var BT = window.BT, A = window.BTApp, Store = window.BTStore;
  var q = new URLSearchParams(window.location.search);
  var id = BT.branches[q.get("sube")] ? q.get("sube") : "club";
  var b = BT.branches[id];
  var ANY = "Fark Etmez";

  function $(i) { return document.getElementById(i); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // Bugünden başlayarak seçilebilecek günler
  var start = new Date();
  var days = [];
  for (var k = 0; k < BT.daysAhead; k++) {
    var dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
    days.push({ date: dt, key: A.ymd(dt), closed: dt.getDay() === b.closedDay });
  }

  function firstOpenDay() {
    for (var i = 0; i < days.length; i++) {
      if (days[i].closed) continue;
      if (i === 0 && new Date().getHours() >= BT.close - 1) continue;
      return i;
    }
    return 0;
  }

  var g0 = parseInt(q.get("g"), 10);
  var state = {
    g: g0 >= 0 && g0 < b.genders.length ? g0 : 0,
    c: 0,
    sel: [],
    staff: ANY,
    day: firstOpenDay(),
    time: null,
    taken: []
  };

  var prices = {};
  function indexPrices() {
    prices = {};
    b.genders[state.g].cats.forEach(function (c) {
      c[1].forEach(function (r) { if (!has(prices, r[0])) prices[r[0]] = r[1]; });
    });
  }
  indexPrices();
  q.getAll("h").forEach(function (n) {
    if (has(prices, n) && state.sel.indexOf(n) < 0) state.sel.push(n);
  });

  function gender() { return b.genders[state.g]; }
  function eligible() { return A.staffFor(b, gender().key, state.sel); }
  function services() { return state.sel.map(function (n) { return { name: n, price: prices[n] || "" }; }); }

  function isOff(hour) {
    if (state.day === 0 && hour <= new Date().getHours()) return true;
    return A.slotOff(b, state.taken, A.hourText(hour), state.staff, eligible());
  }

  function applyTheme() {
    var rose = id === "luxury" && gender().key === "kadin";
    document.documentElement.setAttribute("data-theme", rose ? "rose" : "copper");
  }

  function renderGenders() {
    var box = $("genders");
    if (b.genders.length < 2) { box.hidden = true; return; }
    box.innerHTML = b.genders.map(function (g, i) {
      return '<button type="button" data-g="' + i + '" aria-pressed="' + (i === state.g) + '">' + A.esc(g.label) + "</button>";
    }).join("");
  }

  function renderChips() {
    var box = $("chips");
    box.hidden = !state.sel.length;
    box.innerHTML = state.sel.map(function (n) {
      return '<button type="button" class="chip" data-rm="' + A.esc(n) + '" aria-label="' + A.esc(n) + ' hizmetini çıkar">' + A.esc(n) + A.ICON.x + "</button>";
    }).join("");
  }

  function renderCats() {
    $("cats").innerHTML = gender().cats.map(function (c, i) {
      return '<button type="button" data-c="' + i + '" aria-pressed="' + (i === state.c) + '">' + A.esc(c[0].toLocaleUpperCase("tr")) + "</button>";
    }).join("");
  }

  function renderRows() {
    $("rows").innerHTML = gender().cats[state.c][1].map(function (r) {
      var on = state.sel.indexOf(r[0]) >= 0;
      return '<button type="button" class="row" data-s="' + A.esc(r[0]) + '" aria-pressed="' + on + '"><span class="box" aria-hidden="true">' + A.ICON.check + '</span><span class="name">' + A.esc(r[0]) + '</span><span class="dots" aria-hidden="true"></span><span class="price' + (r[1] ? "" : " ask") + '">' + A.esc(r[1] || "Fiyat sorunuz") + "</span></button>";
    }).join("");
  }

  function renderStaff() {
    var e = eligible();
    var names = [ANY].concat(e.known ? e.list : []);
    if (names.indexOf(state.staff) < 0) state.staff = ANY;
    $("staff").innerHTML = names.map(function (n) {
      var ini = n === ANY ? "•" : n.split(" ").slice(0, 2).map(function (p) { return p.charAt(0); }).join("");
      return '<button type="button" data-p="' + A.esc(n) + '" aria-pressed="' + (n === state.staff) + '"><span class="av" aria-hidden="true">' + A.esc(ini) + "</span><span>" + A.esc(n) + "</span></button>";
    }).join("");
    var note = $("staff-note");
    if (!state.sel.length) {
      note.hidden = false;
      note.textContent = "Önce hizmet seçin; o hizmeti yapan personel burada listelenir.";
    } else if (!e.known) {
      note.hidden = false;
      note.textContent = "Seçtiğiniz hizmetler için personeli salon planlar.";
    } else {
      note.hidden = true;
    }
  }

  function renderDays() {
    $("days").innerHTML = days.map(function (d, i) {
      return '<button type="button" data-d="' + i + '" aria-pressed="' + (i === state.day) + '"' + (d.closed ? " disabled" : "") +
        ' aria-label="' + A.esc(A.longDate(d.date) + (d.closed ? ", kapalı" : "")) + '">' +
        '<span class="dow">' + (i === 0 ? "BUGÜN" : A.DOW[d.date.getDay()]) + '</span>' +
        '<span class="num">' + d.date.getDate() + '</span>' +
        '<span class="mon">' + (d.closed ? "Kapalı" : A.MON[d.date.getMonth()]) + "</span></button>";
    }).join("");
    $("day-note").textContent = A.longDate(days[state.day].date) + " · " + A.DAYS[b.closedDay] + " günleri kapalıyız.";
  }

  function renderSlots() {
    var html = "";
    for (var h = BT.open; h < BT.close; h++) {
      var t = A.hourText(h);
      var off = isOff(h);
      if (off && state.time === t) state.time = null;
      html += '<button type="button" data-t="' + t + '" aria-pressed="' + (state.time === t) + '"' + (off ? " disabled" : "") + ">" + t + "</button>";
    }
    $("slots").innerHTML = html;
  }

  function row(k, v) { return '<div class="r"><span>' + A.esc(k) + "</span><span>" + A.esc(v) + "</span></div>"; }

  function totalHtml(t) {
    return '<div class="tot"><span class="eyebrow muted">TOPLAM</span><span class="v">' + A.esc(t.amount) + (t.note ? "<small>" + A.esc(t.note) + "</small>" : "") + "</span></div>";
  }

  function renderSum() {
    var d = days[state.day];
    $("sum").innerHTML =
      '<div class="eyebrow">RANDEVU ÖZETİ</div>' +
      row("Şube", b.title) +
      row("Hizmet", state.sel.length ? state.sel.join(", ") : "Hizmet seçin") +
      row("Personel", state.staff) +
      row("Tarih", A.longDate(d.date) + (state.time ? ", " + state.time : ", saat seçin")) +
      totalHtml(A.totalText(services()));
  }

  function renderPicks() {
    renderChips();
    renderRows();
    renderStaff();
    renderSlots();
    renderSum();
  }

  function loadTaken() {
    var key = days[state.day].key;
    return Store.taken(id, key).then(function (list) {
      if (days[state.day].key !== key) return;
      state.taken = list;
      renderSlots();
      renderSum();
    }, function () {
      showError("Dolu saatler yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin ya da salonu arayın: " + b.phone);
    });
  }

  function showError(msg) {
    var box = $("err");
    box.textContent = msg;
    box.hidden = false;
    if (box.scrollIntoView) box.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function clearError() { $("err").hidden = true; }

  function toggleService(name) {
    var i = state.sel.indexOf(name);
    if (i >= 0) state.sel.splice(i, 1);
    else if (has(prices, name)) state.sel.push(name);
    clearError();
    renderPicks();
  }

  /* ---- Müşteri: bu numara kayıtlı mı? ----
     Kayıtlıysa yalnızca telefon yeter; değilse (ilk randevu) ad, yaş ve cinsiyet istenir.
     durum: "none" numara yazılmadı, "wait" soruluyor, "known" kayıtlı, "new" kayıtlı değil, "error" sorulamadı */
  var member = { key: "", state: "none" };
  var memberTimer = null;
  var sex = { value: "", touched: false };

  function paintSex() {
    Array.prototype.forEach.call($("cins").querySelectorAll("button"), function (bt) {
      bt.setAttribute("aria-pressed", String(bt.getAttribute("data-x") === sex.value));
    });
  }

  function paintMember() {
    var s = member.state;
    var note = $("tel-note");
    note.hidden = s === "known" || s === "new";
    note.textContent = s === "wait" ? "Numaranız kontrol ediliyor…"
      : (s === "error" ? "Numaranız şu an kontrol edilemedi; onaylarken yeniden denenecek."
        : "Daha önce randevu aldıysanız yalnızca telefon numaranızı yazmanız yeterli.");
    $("known").hidden = s !== "known";
    $("signup").hidden = s !== "new";
    // Cinsiyet, elle değiştirilmediyse seçilen bölüme göre gelir.
    if (!sex.touched) sex.value = gender().key === "kadin" ? "K" : "E";
    paintSex();
  }

  function checkMember(key) {
    member = { key: key, state: "wait" };
    paintMember();
    return Store.member(key).then(function (known) {
      if (member.key === key) {
        member.state = known ? "known" : "new";
        paintMember();
      }
      return known;
    }, function (err) {
      if (member.key === key) {
        member.state = "error";
        paintMember();
      }
      throw err;
    });
  }

  function formError(msg) {
    var e = new Error(msg);
    e.code = "form";
    return e;
  }

  // İlk randevu: kayıt bilgilerini okur; eksik varsa açıklamasıyla hata verir.
  function readSignup() {
    var name = $("ad").value.replace(/\s+/g, " ").trim();
    var ageText = $("yas").value.trim();
    var age = /^\d{1,3}$/.test(ageText) ? parseInt(ageText, 10) : 0;
    if (!name && !ageText) throw formError("İlk randevunuz için kayıt gerekiyor: lütfen adınızı, yaşınızı ve cinsiyetinizi yazın.");
    if (name.length < 3) throw formError("Lütfen adınızı ve soyadınızı yazın.");
    if (age < 1 || age > 110) throw formError("Lütfen yaşınızı rakamla yazın.");
    if (sex.value !== "K" && sex.value !== "E") throw formError("Lütfen cinsiyet seçin.");
    return { name: name, age: age, gender: sex.value };
  }

  function showDone(res, reg) {
    var a = res.appt;
    var fresh = res.registered && reg;
    $("form").hidden = true;
    $("form").style.display = "none";
    $("done").hidden = false;
    $("done-sum").innerHTML =
      row("Şube", b.title) +
      row("Hizmet", a.services.map(function (s) { return s.name; }).join(", ")) +
      row("Personel", a.staff === ANY ? "Salon planlayacak" : a.staff) +
      row("Tarih", A.longDate(A.fromYmd(a.date)) + ", " + a.time) +
      (fresh ? row("Ad Soyad", reg.name) : "") +
      row("Telefon", A.phoneText(a.phone)) +
      totalHtml(A.totalText(a.services));
    $("done-note").textContent =
      (fresh ? "Kaydınız oluşturuldu; sonraki randevularınızda yalnızca telefon numaranızı yazmanız yeterli. " : "") +
      (Store.mode === "demo"
        ? "Demo: bu randevu yalnızca bu cihazda kaydedildi, salona ulaşmadı."
        : "Değişiklik ya da iptal için " + b.phone + " numarasını arayabilirsiniz.");
    window.scrollTo(0, 0);
  }

  function submit() {
    var key = A.phoneKey($("tel").value);
    var msg = "";
    if (!state.sel.length) msg = "Lütfen en az bir hizmet seçin.";
    else if (!state.time) msg = "Lütfen bir saat seçin.";
    else if (!key) msg = "Lütfen cep telefonunuzu yazın. Örnek: 0532 123 45 67";
    if (msg) { showError(msg); return; }

    clearError();
    var btn = $("go");
    btn.disabled = true;
    var d = days[state.day];
    var time = state.time;
    var reg = null;

    // Numara az önce sorulduysa yanıtı kullan; sorulmadıysa şimdi sor.
    window.clearTimeout(memberTimer);
    var settled = member.key === key && (member.state === "known" || member.state === "new");
    (settled ? Promise.resolve(member.state === "known") : checkMember(key)).then(function (known) {
      if (!known) reg = readSignup();
      return Store.taken(id, d.key);
    }).then(function (list) {
      state.taken = list;
      if (isOff(parseInt(time, 10))) {
        var full = new Error("dolu");
        full.code = "dolu";
        throw full;
      }
      var staff = A.assign(list, time, state.staff, eligible());
      var svc = services();
      return Store.create({
        id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        created: new Date().toISOString(),
        branch: id,
        gender: gender().label,
        services: svc,
        total: A.totalText(svc).full,
        staff: staff,
        anyStaff: state.staff === ANY,
        date: d.key,
        time: time,
        phone: key,
        status: "yeni"
      }, b.staff.length, reg);
    }).then(function (res) { showDone(res, reg); }, function (err) {
      btn.disabled = false;
      if (err && err.code === "form") {
        showError(err.message);
      } else if (err && err.code === "dolu") {
        state.time = null;
        renderSlots();
        renderSum();
        showError("Bu saat az önce doldu. Lütfen başka bir saat seçin.");
      } else if (err && err.code === "kayit-gerekli") {
        member = { key: key, state: "new" };
        paintMember();
        showError("Bu numara için kayıt bulunamadı. Lütfen bilgilerinizi yazıp yeniden onaylayın.");
      } else {
        showError("Randevu kaydedilemedi. Lütfen tekrar deneyin ya da salonu arayın: " + b.phone);
      }
    });
  }

  // Olaylar
  $("genders").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    var g = +t.getAttribute("data-g");
    if (g === state.g) return;
    state.g = g;
    state.c = 0;
    state.sel = [];
    state.staff = ANY;
    indexPrices();
    applyTheme();
    clearError();
    renderGenders();
    renderCats();
    renderPicks();
    paintMember();
  });

  $("cats").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    state.c = +t.getAttribute("data-c");
    renderCats();
    renderRows();
  });

  $("rows").addEventListener("click", function (e) {
    var t = e.target.closest("[data-s]");
    if (t) toggleService(t.getAttribute("data-s"));
  });

  $("chips").addEventListener("click", function (e) {
    var t = e.target.closest("[data-rm]");
    if (t) toggleService(t.getAttribute("data-rm"));
  });

  $("staff").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    state.staff = t.getAttribute("data-p");
    clearError();
    renderStaff();
    renderSlots();
    renderSum();
  });

  $("days").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t || t.disabled) return;
    state.day = +t.getAttribute("data-d");
    state.time = null;
    state.taken = [];
    clearError();
    renderDays();
    renderSlots();
    renderSum();
    loadTaken();
  });

  $("slots").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t || t.disabled) return;
    state.time = t.getAttribute("data-t");
    clearError();
    renderSlots();
    renderSum();
  });

  // Telefon yazıldıkça: geçerli bir numara olunca kayıtlı mı diye sorulur.
  $("tel").addEventListener("input", function () {
    var key = A.phoneKey($("tel").value);
    if (key === member.key) return;
    window.clearTimeout(memberTimer);
    member = { key: "", state: "none" };
    paintMember();
    clearError();
    if (key) memberTimer = window.setTimeout(function () { checkMember(key).catch(function () {}); }, 350);
  });

  $("cins").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    sex = { value: t.getAttribute("data-x"), touched: true };
    clearError();
    paintSex();
  });

  ["ad", "yas"].forEach(function (i) { $(i).addEventListener("input", clearError); });

  $("go").addEventListener("click", submit);

  // İlk çizim
  applyTheme();
  // Geri oku: şube sayfasından gelindiyse oraya, ana sayfadan gelindiyse ana sayfaya döner.
  var fromBranch = (document.referrer || "").indexOf("/" + b.page) >= 0;
  $("back").href = fromBranch ? b.page : "index.html";
  $("back").setAttribute("aria-label", fromBranch ? "Şube sayfasına dön" : "Ana sayfaya dön");
  $("branch-name").textContent = b.title.toLocaleUpperCase("tr");
  $("foot-note").textContent = "Fiyatlar bilgi amaçlıdır. Değişiklik için " + b.phone;
  if (Store.mode === "demo") $("demo").hidden = false;
  renderGenders();
  renderCats();
  renderDays();
  renderPicks();
  paintMember();
  loadTaken();
})();
