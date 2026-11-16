/* Şube sayfası: fiyat listesi, saatler, adres bağlantıları ve Kadın bölümünde toz pembe tema. */
(function () {
  "use strict";

  var BT = window.BT, A = window.BTApp;
  var id = document.body.getAttribute("data-sube");
  var b = BT.branches[id];
  var state = { g: 0, c: 0 };

  function $(i) { return document.getElementById(i); }

  function applyTheme() {
    var rose = id === "luxury" && b.genders[state.g].key === "kadin";
    document.documentElement.setAttribute("data-theme", rose ? "rose" : "copper");
  }

  function renderGenders() {
    var box = $("genders");
    if (b.genders.length < 2) { box.hidden = true; return; }
    box.innerHTML = b.genders.map(function (g, i) {
      return '<button type="button" data-g="' + i + '" aria-pressed="' + (i === state.g) + '">' + A.esc(g.label) + "</button>";
    }).join("");
  }

  function renderCats() {
    $("cats").innerHTML = b.genders[state.g].cats.map(function (c, i) {
      return '<button type="button" data-c="' + i + '" aria-pressed="' + (i === state.c) + '">' + A.esc(c[0].toLocaleUpperCase("tr")) + "</button>";
    }).join("");
  }

  function renderRows() {
    $("rows").innerHTML = b.genders[state.g].cats[state.c][1].map(function (r) {
      var href = "randevu.html?sube=" + id + "&g=" + state.g + "&h=" + encodeURIComponent(r[0]);
      return '<a class="row" href="' + A.esc(href) + '"><span class="name">' + A.esc(r[0]) + '</span><span class="dots" aria-hidden="true"></span><span class="price' + (r[1] ? "" : " ask") + '">' + A.esc(r[1] || "Fiyat sorunuz") + "</span></a>";
    }).join("");
    $("cta").href = "randevu.html?sube=" + id + "&g=" + state.g;
  }

  function renderHours() {
    var today = new Date().getDay();
    $("hours").innerHTML = [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var closed = d === b.closedDay;
      return "<div" + (d === today ? ' class="today"' : "") + "><span>" + A.DAYS[d] + (d === today ? '<span class="badge">BUGÜN</span>' : "") + '</span><span class="num-t' + (closed ? " off" : "") + '">' + (closed ? "Kapalı" : A.hourText(BT.open) + " – " + A.hourText(BT.close)) + "</span></div>";
    }).join("");
  }

  function renderPlace() {
    var q = encodeURIComponent(b.address);
    var dir = "https://www.google.com/maps/dir/?api=1&destination=" + q;
    $("addr").textContent = b.address;
    $("map").href = "https://www.google.com/maps/search/?api=1&query=" + q;
    $("dir").href = dir;
    $("dir2").href = dir;
  }

  $("genders").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    state.g = +t.getAttribute("data-g");
    state.c = 0;
    applyTheme();
    renderGenders();
    renderCats();
    renderRows();
  });

  $("cats").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    state.c = +t.getAttribute("data-c");
    renderCats();
    renderRows();
  });

  applyTheme();
  A.paintStatus($("status"), b);
  renderGenders();
  renderCats();
  renderRows();
  renderHours();
  renderPlace();
})();
