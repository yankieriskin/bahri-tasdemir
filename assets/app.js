/* Ortak yardımcılar: tarih, açık/kapalı durumu, fiyat toplamı, personel ve saat uygunluğu. */
(function () {
  "use strict";

  var BT = window.BT;
  var DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  var DOW = ["PZR", "PTS", "SAL", "ÇAR", "PER", "CUM", "CTS"];
  var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromYmd(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longDate(d) { return d.getDate() + " " + MONTHS[d.getMonth()] + " " + DAYS[d.getDay()]; }
  function hourText(h) { return pad(h) + ":00"; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Telefonu tek biçime indirir; müşteri kaydının anahtarı budur.
  // "0532 123 45 67", "+90 532 123 45 67", "532 123 45 67" -> "5321234567".
  // Yurt dışı numarası başında + ile yazılır ve ülke koduyla saklanır. Geçersizse "" döner.
  function phoneKey(text) {
    var raw = String(text || "").trim();
    var d = raw.replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("90") === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    if (/^5\d{9}$/.test(d)) return d;
    return raw.charAt(0) === "+" && /^[1-9]\d{10,14}$/.test(d) ? d : "";
  }

  // "5321234567" -> "0532 123 45 67"
  function phoneText(key) {
    var k = String(key || "");
    if (/^5\d{9}$/.test(k)) return "0" + k.slice(0, 3) + " " + k.slice(3, 6) + " " + k.slice(6, 8) + " " + k.slice(8);
    return k ? "+" + k : "";
  }

  function phoneHref(key) {
    var k = String(key || "");
    return "tel:+" + (/^5\d{9}$/.test(k) ? "90" : "") + k;
  }

  function nextOpen(b, now) {
    for (var i = 1; i <= 7; i++) {
      var d = (now.getDay() + i) % 7;
      if (d !== b.closedDay) return (i === 1 ? "Yarın" : DAYS[d]) + " " + hourText(BT.open) + "'da açılır";
    }
    return "";
  }

  function status(b, now) {
    now = now || new Date();
    var h = now.getHours();
    if (now.getDay() === b.closedDay) return { open: false, text: "Bugün kapalı", detail: nextOpen(b, now) };
    if (h < BT.open) return { open: false, text: "Kapalı", detail: "Bugün " + hourText(BT.open) + "'da açılır" };
    if (h >= BT.close) return { open: false, text: "Kapalı", detail: nextOpen(b, now) };
    return { open: true, text: "Açık", detail: hourText(BT.close) + "'e kadar" };
  }

  function paintStatus(node, b) {
    var s = status(b);
    node.className = "status " + (s.open ? "open" : "closed");
    node.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="st">' + esc(s.text) + '</span><span class="detail">· ' + esc(s.detail) + '</span>';
  }

  // "800 TL" -> {min:800,max:800}, "1500~3000 TL" -> {min:1500,max:3000}, "" -> null
  function priceOf(text) {
    var m = String(text || "").match(/(\d+)(?:\s*~\s*(\d+))?/);
    if (!m) return null;
    var a = +m[1];
    return { min: a, max: m[2] ? +m[2] : a };
  }

  function totalText(list) {
    var min = 0, max = 0, known = 0, unknown = 0;
    list.forEach(function (s) {
      var p = priceOf(s.price);
      if (!p) { unknown++; return; }
      known++; min += p.min; max += p.max;
    });
    var amount = known ? (min === max ? String(min) : min + " – " + max) + " TL" : (unknown ? "Fiyat sorunuz" : "0 TL");
    var note = known && unknown ? "Fiyatı sorulacak hizmet hariç" : "";
    return { amount: amount, note: note, full: amount + (note ? " (" + note.toLocaleLowerCase("tr") + ")" : "") };
  }

  // Seçilen hizmetleri yapabilen personel. known=false ise personeli salon planlar.
  function staffFor(b, genderKey, names) {
    if (!names.length) return { list: [], known: false };
    if (!b.staffBy) return { list: b.staff.slice(), known: true };
    var by = b.staffBy[genderKey] || {};
    var res = null;
    for (var i = 0; i < names.length; i++) {
      var l = by[names[i]];
      if (!l) return { list: [], known: false };
      res = res ? res.filter(function (x) { return l.indexOf(x) >= 0; }) : l.slice();
    }
    return { list: res, known: res.length > 0 };
  }

  // O saat seçilemez mi?
  // taken: o günün dolu saatleri [{time, staff}], choice: seçilen personel ya da "Fark Etmez",
  // el: staffFor() sonucu. Şubedeki herkes doluysa ya da seçilen kişi doluysa saat kapanır.
  function slotOff(b, taken, time, choice, el) {
    var same = taken.filter(function (t) { return t.time === time; });
    function busy(n) { return same.some(function (t) { return t.staff === n; }); }
    if (same.length >= b.staff.length) return true;
    if (choice !== "Fark Etmez") return busy(choice);
    return el.known ? el.list.every(busy) : false;
  }

  // "Fark Etmez" seçildiyse o saatte boş olan ilk uygun personeli verir; yoksa "Fark Etmez" kalır.
  function assign(taken, time, choice, el) {
    if (choice !== "Fark Etmez" || !el.known) return choice;
    var same = taken.filter(function (t) { return t.time === time; });
    for (var i = 0; i < el.list.length; i++) {
      var n = el.list[i];
      if (!same.some(function (t) { return t.staff === n; })) return n;
    }
    return choice;
  }

  var ICON = {
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
  };

  window.BTApp = {
    DAYS: DAYS, DOW: DOW, MONTHS: MONTHS, MON: MON, ICON: ICON,
    pad: pad, ymd: ymd, fromYmd: fromYmd, longDate: longDate, hourText: hourText, esc: esc,
    phoneKey: phoneKey, phoneText: phoneText, phoneHref: phoneHref,
    status: status, paintStatus: paintStatus, priceOf: priceOf, totalText: totalText,
    staffFor: staffFor, slotOff: slotOff, assign: assign,

    // Ana sayfa: şube kutularındaki açık/kapalı satırları
    home: function () {
      Array.prototype.forEach.call(document.querySelectorAll("[data-status]"), function (n) {
        paintStatus(n, BT.branches[n.getAttribute("data-status")]);
      });
    }
  };
})();
