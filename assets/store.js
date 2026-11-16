/* Randevu kaydı.
   assets/config.js doluysa randevular çevrimiçi veritabanında (Firebase) saklanır;
   boşsa DEMO modunda yalnızca bu tarayıcıda kalır. İki modun sunduğu işlevler aynıdır:
     taken(branch, date)  -> o günün dolu saatleri [{time, staff}] (kişisel bilgi içermez)
     create(appt, cap)    -> yeni randevu; saat doluysa "dolu" hatası verir
     list()               -> randevular (yalnız yönetici)
     update(id, {status}), remove(id)
     user(), signIn(email, pass), signOut(), resetPassword(email) -> yönetici girişi */
(function () {
  "use strict";

  var ANY = "Fark Etmez";
  var cfg = window.BT_FIREBASE || {};

  function fail(code) {
    var e = new Error(code);
    e.code = code;
    return Promise.reject(e);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function dayKey(offset) {
    var n = new Date();
    var d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + offset);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  /* ------------------------------------------------------------------ */
  /* DEMO: yalnızca bu tarayıcı                                           */
  /* ------------------------------------------------------------------ */
  function demoStore() {
    var KEY = "bt_randevular_v1";

    function read() {
      try {
        var v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    }

    function write(list) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(list));
        return true;
      } catch (e) {
        return false;
      }
    }

    function active(list, branch, date) {
      return list.filter(function (a) { return a.branch === branch && a.date === date && a.status !== "iptal"; });
    }

    return {
      mode: "demo",
      needsLogin: false,

      taken: function (branch, date) {
        return Promise.resolve(active(read(), branch, date).map(function (a) { return { time: a.time, staff: a.staff }; }));
      },

      create: function (appt, cap) {
        var list = read();
        var same = active(list, appt.branch, appt.date).filter(function (a) { return a.time === appt.time; });
        var staffBusy = appt.staff !== ANY && same.some(function (a) { return a.staff === appt.staff; });
        if (staffBusy || same.length >= cap) return fail("dolu");
        list.push(appt);
        return write(list) ? Promise.resolve(appt) : fail("kayit");
      },

      list: function () { return Promise.resolve(read()); },

      update: function (id, patch) {
        var list = read();
        list.forEach(function (a) {
          if (a.id === id) Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
        });
        return write(list) ? Promise.resolve() : fail("kayit");
      },

      remove: function (id) {
        return write(read().filter(function (a) { return a.id !== id; })) ? Promise.resolve() : fail("kayit");
      },

      user: function () { return Promise.resolve({ email: "" }); },
      signIn: function () { return Promise.resolve({ email: "" }); },
      signOut: function () { return Promise.resolve(); },
      resetPassword: function () { return Promise.resolve(); }
    };
  }

  /* ------------------------------------------------------------------ */
  /* ÇEVRİMİÇİ: Firebase (Firestore + Authentication)                     */
  /*   dolu/{şube_tarih_saat_personel}  -> dolu saatler, herkese açık     */
  /*   randevular/{id}                  -> ad ve telefon, yalnız yönetici */
  /* ------------------------------------------------------------------ */
  function onlineStore() {
    var BASE = "https://www.gstatic.com/firebasejs/10.12.2/";

    // Yükleme başarısız olursa (bağlantı yok vb.) bir sonraki çağrıda yeniden dener.
    function once(fn) {
      var p = null;
      return function () {
        if (!p) {
          p = fn();
          p.catch(function () { p = null; });
        }
        return p;
      };
    }

    var app = once(function () {
      return import(BASE + "firebase-app.js").then(function (m) { return m.initializeApp(cfg); });
    });

    var auth = once(function () {
      return Promise.all([app(), import(BASE + "firebase-auth.js")]).then(function (r) {
        var a = r[1], au = a.getAuth(r[0]);
        au.languageCode = "tr"; // şifre sıfırlama e-postası Türkçe gelsin
        return au.authStateReady().then(function () { return { a: a, auth: au }; });
      });
    });

    var db = once(function () {
      return Promise.all([app(), import(BASE + "firebase-firestore-lite.js")]).then(function (r) {
        return { f: r[1], db: r[1].getFirestore(r[0]) };
      });
    });

    // Yönetici işlemleri: önce giriş bilgisi hazır olsun, sonra veritabanı.
    function adminDb() { return auth().then(function () { return db(); }); }

    function toDoc(a, slot, stamp) {
      return {
        branch: a.branch,
        gender: a.gender,
        services: a.services.map(function (s) { return s.name + (s.price ? " | " + s.price : ""); }).join("; "),
        total: a.total,
        staff: a.staff,
        anyStaff: !!a.anyStaff,
        date: a.date,
        time: a.time,
        name: a.name,
        phone: a.phone,
        status: "yeni",
        created: stamp,
        slot: slot
      };
    }

    function fromDoc(id, d) {
      return {
        id: id,
        branch: d.branch,
        gender: d.gender,
        services: String(d.services || "").split("; ").filter(Boolean).map(function (t) {
          var p = t.split(" | ");
          return { name: p[0], price: p[1] || "" };
        }),
        total: d.total,
        staff: d.staff,
        anyStaff: !!d.anyStaff,
        date: d.date,
        time: d.time,
        name: d.name,
        phone: d.phone,
        status: d.status,
        slot: d.slot,
        created: d.created && d.created.toDate ? d.created.toDate().toISOString() : ""
      };
    }

    function slotStaff(slot) { return String(slot).split("_").slice(3).join("_"); }

    return {
      mode: "online",
      needsLogin: true,

      taken: function (branch, date) {
        return db().then(function (x) {
          var f = x.f;
          return f.getDocs(f.query(f.collection(x.db, "dolu"), f.where("branch", "==", branch), f.where("date", "==", date)));
        }).then(function (snap) {
          return snap.docs.map(function (d) {
            var v = d.data();
            return { time: v.time, staff: String(v.staff).replace(/ #\d+$/, "") };
          });
        });
      },

      create: function (appt, cap) {
        return db().then(function (x) {
          var f = x.f;
          // Personel belliyse tek kilit; "Fark Etmez" ise o saatte boş kalan ilk sıra.
          var keys = [];
          if (appt.staff === ANY) {
            for (var k = 1; k <= cap; k++) keys.push(ANY + " #" + k);
          } else {
            keys.push(appt.staff);
          }

          function attempt(i) {
            if (i >= keys.length) return fail("dolu");
            var slot = [appt.branch, appt.date, appt.time, keys[i]].join("_");
            var batch = f.writeBatch(x.db);
            batch.set(f.doc(x.db, "dolu", slot), { branch: appt.branch, date: appt.date, time: appt.time, staff: keys[i], rid: appt.id });
            batch.set(f.doc(x.db, "randevular", appt.id), toDoc(appt, slot, f.serverTimestamp()));
            return batch.commit().then(function () { return appt; }, function (err) {
              if (!err || err.code !== "permission-denied") throw err;
              // Reddedildi: o saat gerçekten dolu mu, yoksa başka bir sorun mu?
              return f.getDoc(f.doc(x.db, "dolu", slot)).then(function (s) {
                if (s.exists()) return attempt(i + 1);
                throw err;
              });
            });
          }

          return attempt(0);
        });
      },

      list: function () {
        return adminDb().then(function (x) {
          var f = x.f;
          return f.getDocs(f.query(f.collection(x.db, "randevular"), f.where("date", ">=", dayKey(-120))));
        }).then(function (snap) {
          return snap.docs.map(function (d) { return fromDoc(d.id, d.data()); });
        });
      },

      update: function (id, patch) {
        return adminDb().then(function (x) {
          var f = x.f, ref = f.doc(x.db, "randevular", id);
          return f.getDoc(ref).then(function (s) {
            if (!s.exists()) return fail("yok");
            var d = s.data();
            var cancel = patch.status === "iptal" && d.status !== "iptal";
            var restore = patch.status !== "iptal" && d.status === "iptal";
            var slotRef = f.doc(x.db, "dolu", d.slot);
            var batch = f.writeBatch(x.db);
            batch.update(ref, { status: patch.status });
            if (cancel) batch.delete(slotRef); // saat yeniden alınabilir olur
            if (restore) batch.set(slotRef, { branch: d.branch, date: d.date, time: d.time, staff: slotStaff(d.slot), rid: id });
            return batch.commit().catch(function (err) {
              // İptal geri alınırken saat başkasına verilmişse kurallar reddeder.
              if (restore && err && err.code === "permission-denied") return fail("dolu");
              throw err;
            });
          });
        });
      },

      remove: function (id) {
        return adminDb().then(function (x) {
          var f = x.f, ref = f.doc(x.db, "randevular", id);
          return f.getDoc(ref).then(function (s) {
            var batch = f.writeBatch(x.db);
            batch.delete(ref);
            // İptal edilmiş randevunun saati zaten boşaltılmıştır; başkasının kilidine dokunma.
            if (s.exists() && s.data().slot && s.data().status !== "iptal") batch.delete(f.doc(x.db, "dolu", s.data().slot));
            return batch.commit();
          });
        });
      },

      user: function () {
        return auth().then(function (x) {
          var u = x.auth.currentUser;
          return u ? { email: u.email } : null;
        });
      },

      signIn: function (email, pass) {
        return auth().then(function (x) {
          return x.a.signInWithEmailAndPassword(x.auth, email, pass);
        }).then(function (r) {
          return { email: r.user.email };
        });
      },

      signOut: function () {
        return auth().then(function (x) { return x.a.signOut(x.auth); });
      },

      // Şifre unutulursa: o adrese sıfırlama bağlantısı gönderir.
      resetPassword: function (email) {
        return auth().then(function (x) { return x.a.sendPasswordResetEmail(x.auth, email); });
      }
    };
  }

  window.BTStore = cfg.apiKey && cfg.projectId ? onlineStore() : demoStore();
})();
