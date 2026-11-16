/* Randevu ve müşteri kaydı.
   assets/config.js doluysa kayıtlar çevrimiçi veritabanında (Firebase) saklanır;
   boşsa DEMO modunda yalnızca bu tarayıcıda kalır. İki modun sunduğu işlevler aynıdır.

   Müşteri, telefon numarasıyla tanınır (numara BTApp.phoneKey ile tek biçime indirilir).
   İlk randevuda ad, yaş ve cinsiyetle kayıt açılır; sonraki randevularda numara yeter.

     member(phone)        -> bu numara kayıtlı mı (true / false). Ad ya da başka bilgi döndürmez.
     taken(branch, date)  -> o günün dolu saatleri [{time, staff}] (kişisel bilgi içermez)
     create(appt, cap, reg) -> yeni randevu; {appt, registered} döner (registered: müşteri kaydı da açıldı mı).
                             reg = {name, age, gender} verilirse ve numara kayıtlı değilse müşteri kaydı da açılır.
                             Hatalar: "dolu" (saat dolu), "kayit-gerekli" (numara kayıtlı değil)
     list(from)           -> from (YYYY-AA-GG) tarihinden sonraki randevular (yalnız yönetici)
     update(id, {status}), remove(id)
     customers()          -> tüm müşteriler (yalnız yönetici)
     customersByKeys(keys)-> {numara: müşteri ya da null} (yalnız yönetici)
     customerAppointments(phone) -> o müşterinin tüm randevuları (yalnız yönetici)
     removeCustomer(phone)
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

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
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
    var KEY = "bt_randevular_v2";
    var CKEY = "bt_musteriler_v1";

    function read() {
      try {
        var v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    }

    function readC() {
      try {
        var v = JSON.parse(window.localStorage.getItem(CKEY) || "{}");
        return v && typeof v === "object" && !Array.isArray(v) ? v : {};
      } catch (e) {
        return {};
      }
    }

    function save(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
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

      member: function (phone) { return Promise.resolve(has(readC(), phone)); },

      taken: function (branch, date) {
        return Promise.resolve(active(read(), branch, date).map(function (a) { return { time: a.time, staff: a.staff }; }));
      },

      create: function (appt, cap, reg) {
        var list = read();
        var same = active(list, appt.branch, appt.date).filter(function (a) { return a.time === appt.time; });
        var staffBusy = appt.staff !== ANY && same.some(function (a) { return a.staff === appt.staff; });
        if (staffBusy || same.length >= cap) return fail("dolu");
        var cs = readC();
        var registered = false;
        if (!has(cs, appt.phone)) {
          if (!reg) return fail("kayit-gerekli");
          cs[appt.phone] = { key: appt.phone, phone: appt.phone, name: reg.name, age: reg.age, gender: reg.gender, created: new Date().toISOString(), first: appt.id };
          if (!save(CKEY, cs)) return fail("kayit");
          registered = true;
        }
        list.push(appt);
        return save(KEY, list) ? Promise.resolve({ appt: appt, registered: registered }) : fail("kayit");
      },

      list: function (from) {
        return Promise.resolve(read().filter(function (a) { return !from || a.date >= from; }));
      },

      update: function (id, patch) {
        var list = read();
        list.forEach(function (a) {
          if (a.id === id) Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
        });
        return save(KEY, list) ? Promise.resolve() : fail("kayit");
      },

      remove: function (id) {
        return save(KEY, read().filter(function (a) { return a.id !== id; })) ? Promise.resolve() : fail("kayit");
      },

      customers: function () {
        var cs = readC();
        return Promise.resolve(Object.keys(cs).map(function (k) { return cs[k]; }));
      },

      customersByKeys: function (keys) {
        var cs = readC(), out = {};
        keys.forEach(function (k) { out[k] = has(cs, k) ? cs[k] : null; });
        return Promise.resolve(out);
      },

      customerAppointments: function (phone) {
        return Promise.resolve(read().filter(function (a) { return a.phone === phone; }));
      },

      removeCustomer: function (phone) {
        var cs = readC();
        delete cs[phone];
        return save(CKEY, cs) ? Promise.resolve() : fail("kayit");
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
  /*   randevular/{id}                  -> randevu ve telefon, yalnız yönetici */
  /*   musteriler/{telefon}             -> ad, yaş, cinsiyet; yalnız yönetici  */
  /*   kayitli/{telefon}                -> "bu numara kayıtlı" işareti; içinde */
  /*                                       kişisel bilgi yoktur, tek tek sorulabilir */
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

    function stamp(v) { return v && v.toDate ? v.toDate().toISOString() : ""; }

    // Müşteri kaydı eklenmeden önce alınan randevularda telefon yazıldığı gibi durur ("+90 532 ...").
    // Tek biçime indirilebiliyorsa indirilir; indirilemiyorsa olduğu gibi bırakılır.
    function phoneOf(v) {
      var t = String(v || "");
      if (/^\d{10,15}$/.test(t)) return t;
      var A = window.BTApp;
      return (A && A.phoneKey ? A.phoneKey(t) : "") || t;
    }

    function toDoc(a, slot, now) {
      return {
        branch: a.branch,
        gender: a.gender,
        services: a.services.map(function (s) { return s.name + (s.price ? " | " + s.price : ""); }).join("; "),
        total: a.total,
        staff: a.staff,
        anyStaff: !!a.anyStaff,
        date: a.date,
        time: a.time,
        phone: a.phone,
        status: "yeni",
        created: now,
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
        phone: phoneOf(d.phone),
        name: d.name || "", // yalnız eski randevularda dolu; yenilerde ad müşteri kaydındadır
        status: d.status,
        slot: d.slot,
        created: stamp(d.created)
      };
    }

    function custFromDoc(id, d) {
      return { key: id, phone: d.phone || id, name: d.name, age: d.age, gender: d.gender, first: d.first || "", created: stamp(d.created) };
    }

    function slotStaff(slot) { return String(slot).split("_").slice(3).join("_"); }

    return {
      mode: "online",
      needsLogin: true,

      member: function (phone) {
        return db().then(function (x) {
          return x.f.getDoc(x.f.doc(x.db, "kayitli", phone));
        }).then(function (s) { return s.exists(); });
      },

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

      create: function (appt, cap, reg) {
        return db().then(function (x) {
          var f = x.f;
          // Personel belliyse tek kilit; "Fark Etmez" ise o saatte boş kalan ilk sıra.
          var keys = [];
          if (appt.staff === ANY) {
            for (var k = 1; k <= cap; k++) keys.push(ANY + " #" + k);
          } else {
            keys.push(appt.staff);
          }

          // Saat kilidi ve randevu tek işlemde yazılır; ilk randevuda müşteri kaydı da aynı işleme girer.
          function commit(slot, staffKey, withReg) {
            var batch = f.writeBatch(x.db);
            batch.set(f.doc(x.db, "dolu", slot), { branch: appt.branch, date: appt.date, time: appt.time, staff: staffKey, rid: appt.id });
            batch.set(f.doc(x.db, "randevular", appt.id), toDoc(appt, slot, f.serverTimestamp()));
            if (withReg) {
              batch.set(f.doc(x.db, "musteriler", appt.phone), { name: reg.name, phone: appt.phone, age: reg.age, gender: reg.gender, created: f.serverTimestamp(), first: appt.id });
              batch.set(f.doc(x.db, "kayitli", appt.phone), { v: 1 });
            }
            return batch.commit();
          }

          function attempt(i, withReg) {
            if (i >= keys.length) return fail("dolu");
            var slot = [appt.branch, appt.date, appt.time, keys[i]].join("_");
            return commit(slot, keys[i], withReg).then(function () { return { appt: appt, registered: withReg }; }, function (err) {
              if (!err || err.code !== "permission-denied") throw err;
              // Reddedildi: o saat gerçekten dolu mu, yoksa sorun müşteri kaydında mı?
              return f.getDoc(f.doc(x.db, "dolu", slot)).then(function (s) {
                if (s.exists()) return attempt(i + 1, withReg);
                // Kayıt bilgisi gönderilmediyse numara kayıtlı değildir.
                if (!withReg) return fail("kayit-gerekli");
                // Kayıt bilgisiyle reddedildiyse numara zaten kayıtlı olabilir: kayıtsız yeniden dene.
                return attempt(i, false).catch(function (e2) {
                  if (e2 && e2.code === "kayit-gerekli") throw err;
                  throw e2;
                });
              });
            });
          }

          return attempt(0, !!reg);
        });
      },

      list: function (from) {
        return adminDb().then(function (x) {
          var f = x.f;
          return f.getDocs(f.query(f.collection(x.db, "randevular"), f.where("date", ">=", from || dayKey(-120))));
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

      customers: function () {
        return adminDb().then(function (x) {
          return x.f.getDocs(x.f.collection(x.db, "musteriler"));
        }).then(function (snap) {
          return snap.docs.map(function (d) { return custFromDoc(d.id, d.data()); });
        });
      },

      // Yalnız istenen numaraların kayıtları; tek sorguda en fazla 30 numara sorulabildiği için parçalara bölünür.
      customersByKeys: function (keys) {
        var out = {};
        keys.forEach(function (k) { out[k] = null; });
        if (!keys.length) return Promise.resolve(out);
        return adminDb().then(function (x) {
          var f = x.f, jobs = [];
          for (var i = 0; i < keys.length; i += 30) {
            jobs.push(f.getDocs(f.query(f.collection(x.db, "musteriler"), f.where(f.documentId(), "in", keys.slice(i, i + 30)))));
          }
          return Promise.all(jobs);
        }).then(function (snaps) {
          snaps.forEach(function (snap) {
            snap.docs.forEach(function (d) { out[d.id] = custFromDoc(d.id, d.data()); });
          });
          return out;
        });
      },

      customerAppointments: function (phone) {
        return adminDb().then(function (x) {
          var f = x.f;
          return f.getDocs(f.query(f.collection(x.db, "randevular"), f.where("phone", "==", phone)));
        }).then(function (snap) {
          return snap.docs.map(function (d) { return fromDoc(d.id, d.data()); });
        });
      },

      // Müşteri kaydını ve "kayıtlı" işaretini siler; randevularına dokunmaz.
      removeCustomer: function (phone) {
        return adminDb().then(function (x) {
          var f = x.f, batch = f.writeBatch(x.db);
          batch.delete(f.doc(x.db, "musteriler", phone));
          batch.delete(f.doc(x.db, "kayitli", phone));
          return batch.commit();
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
