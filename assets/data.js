/* Bahri Taşdemir – site verisi.
   Fiyat, hizmet, personel ve saat değişiklikleri yalnızca bu dosyadan yapılır.
   Fiyat boş bırakılırsa sitede "Fiyat sorunuz" yazar. */
(function () {
  "use strict";

  var masaj = ["Masaj", [["El Ayak Masajı", ""], ["Klasik Masaj", ""], ["Bölgesel Masaj", ""]]];

  // Luxury Saloon personeli
  var A = "Ayşe Taşdemir", D = "Dilara Fenkli", O = "Oğuz Arınık", S = "Sefer Deliler", Y = "Yasemin Taşdemir";

  window.BT = {
    instagram: "https://www.instagram.com/bahritasdemirbarbersclub/",
    whatsapp: "https://wa.me/message/EVRYNRY2BHM4N1",
    open: 9,   // açılış saati
    close: 21, // kapanış saati
    daysAhead: 30, // kaç gün sonrasına kadar randevu alınabilir

    branches: {
      club: {
        id: "club",
        page: "barbers-club.html",
        title: "Barber's Club",
        phone: "(0850) 303 72 62",
        tel: "tel:08503037262",
        address: "Halkalı İstasyon Mahallesi 1. Yunus Emre Caddesi No:79 Küçükçekmece İstanbul",
        closedDay: 0, // 0 = Pazar
        staff: ["Bilal Karadeniz", "Cengiz Kaya", "Ekrem Bozat", "Mürsel Taşdemir", "Yusuf Memur"],
        genders: [{
          key: "erkek",
          label: "ERKEK",
          cats: [
            ["Sık kullanılan", [["Saç Kesimi", "800 TL"], ["Fön", "300 TL"], ["Saç Bakımı", "1000 TL"], ["Saç Boyama", "1000 TL"], ["Sakal Tıraşı", "400 TL"], ["Cilt Bakımı", "1000 TL"]]],
            ["Saç", [["Saç Yıkama", "200 TL"], ["Bıyık Boyama", "200 TL"], ["Makina İle Sırt Alma", "250 TL"], ["Makina İle Göğüs Alma", "250 TL"], ["Fön", "300 TL"], ["Yıkama Fön", "300 TL"], ["Sakal Tıraşı", "400 TL"], ["Çocuk Tıraşı", "500 TL"], ["Sakal Boyama", "500 TL"], ["Pigmentasyon Cila (Cover)", "500 TL"], ["Kaş Yanak Alma", "600 TL"], ["Saç Kesimi", "800 TL"], ["Modern Saç Kesimi", "800 TL"], ["Saç Sakal Kesimi", "900 TL"], ["Saç Bakımı", "1000 TL"], ["Saç Boyama", "1000 TL"], ["Keratin Bakımı", "1500~3000 TL"], ["Brezilya Fönü", "2000 TL"], ["Açma Boyama", "2000~4000 TL"], ["Röfle-Meç-Gölge Renklendirme", "2500~5000 TL"], ["Perma", "2500~5000 TL"], ["Damat Tıraşı", "3500~5000 TL"]]],
            ["Cilt bakımı", [["Cilt Bakımı", "1000 TL"]]]
          ]
        }]
      },

      luxury: {
        id: "luxury",
        page: "luxury-saloon.html",
        title: "Luxury Saloon",
        phone: "(0850) 303 72 85",
        tel: "tel:08503037285",
        address: "İstasyon Mahallesi 1440. Sokak Emlak Konut Bizim Mahalles 1. Etap 2. Kısım Konutları 11/F-E Blok No: 69 Küçükçekmece İstanbul",
        closedDay: 1, // 1 = Pazartesi
        staff: [A, D, O, S, Y],
        // Hangi hizmeti kim yapıyor. Listede olmayan hizmetlerde müşteri personel seçemez, salon planlar.
        staffBy: {
          kadin: {
            "Nail Art": [A],
            "Manikür": [A, D], "Pedikür": [A, D], "Ağda (Bölgesel)": [A, D], "Topuk Törpüsü": [A, D],
            "Kaş Alma": [A, D, Y], "Dudak Üstü": [A, D, Y],
            "Fön": [D, O, S], "Topuz": [D, O, S], "Gelin Başı": [D, O, S], "Saç Dip Boyama": [D, O, S], "Keratin Bakım": [D, O, S], "Komple Boya": [D, O, S], "Saç Renk Değişimi": [D, O, S], "Perma": [D, O, S], "Sombre": [D, O, S], "Ombre": [D, O, S], "Röfle ve Gölge": [D, O, S], "Saç Kaynağı": [D, O, S],
            "Maşa": [D, O, S, Y], "Nişan Saçı": [D, O, S, Y],
            "Profesyonel Makyaj": [D, Y], "Örgü": [D, Y],
            "Saç Kesimi": [O, S], "Saç Bakımı": [O, S], "Kırık Fön": [O, S], "Brezilya Fönü": [O, S], "Saç Açma Boyama": [O, S],
            "Saç Yıkama": [Y]
          },
          erkek: {}
        },
        genders: [{
          key: "kadin",
          label: "KADIN",
          cats: [
            ["Sık kullanılan", [["Saç Kesimi", "1500 TL"], ["Fön", "500 TL"], ["Manikür", "600 TL"], ["Pedikür", "800 TL"], ["Kaş Alma", "400 TL"], ["Dudak Üstü", "150 TL"], ["Saç Bakımı", "1000~1500 TL"], ["Ağda (Bölgesel)", "300~2000 TL"], ["Saç Boyama", "2500~5000 TL"], ["Topuz", "1000~2500 TL"], ["Profesyonel Makyaj", "2500~5000 TL"], ["Gelin Başı", "15000~20000 TL"]]],
            ["Saç", [["Saç Yıkama", "200 TL"], ["Fön", "500 TL"], ["Kırık Fön", "650 TL"], ["Maşa", "1000 TL"], ["Örgü", "1000 TL"], ["Saç Bakımı", "1000~1500 TL"], ["Topuz", "1000~2500 TL"], ["Saç Kesimi", "1500 TL"], ["Saç Dip Boyama", "2000 TL"], ["Keratin Bakım", "2500~3500 TL"], ["Komple Boya", "3000~4000 TL"], ["Saç Renk Değişimi", "3000~5000 TL"], ["Brezilya Fönü", "3500~5000 TL"], ["Perma", "5000~8000 TL"], ["Nişan Saçı", "5000~10000 TL"], ["Saç Açma Boyama", "5000~10000 TL"], ["Sombre", "5000~10000 TL"], ["Ombre", "5000~10000 TL"], ["Röfle ve Gölge", "6000~10000 TL"], ["Gelin Başı", "15000~20000 TL"], ["Saç Kaynağı", "15000~20000 TL"]]],
            ["Tırnak", [["Nail Art", "200~400 TL"], ["Topuk Törpüsü", "300 TL"], ["Protez Tırnak Çıkartma", "300 TL"], ["Kalıcı Oje Çıkarma", "300 TL"], ["Manikür", "600 TL"], ["Medikal Manikür (kuru)", "600 TL"], ["Protez Çıkarma + Manikür", "600 TL"], ["Bakım Manikürü", "650 TL"], ["Kalıcı Oje El", "700 TL"], ["Kalıcı Oje Ayak", "750 TL"], ["Pedikür", "800 TL"], ["Pedikür (kuru pedikür + kalıcı oje)", "800 TL"], ["Jel Güçlendirme", "900 TL"], ["Protez Tırnak", "1000 TL"], ["Batık Tırnak", ""]]],
            ["Makyaj", [["Dudak Üstü", "150 TL"], ["Oje Uygulama", "250 TL"], ["Kaş Alma", "400 TL"], ["Haftalık Kirpik", "800 TL"], ["Gündelik Makyaj", "1500 TL"], ["Gece Makyajı", "2500~3500 TL"], ["Profesyonel Makyaj", "2500~5000 TL"], ["Gelin Makyajı", "6000~10000 TL"], ["Kaş Boyama", ""], ["Altın Oran Kaş Tasarımı", ""]]],
            ["Ağda", [["Ağda (Bölgesel)", "300~2000 TL"], ["Ağda (Tüm Vücut)", "2000~3500 TL"]]],
            ["Cilt bakımı", [["Cilt Bakımı", "2000 TL"]]],
            masaj,
            ["Diğer", [["Pedikür (ıslak)", "800 TL"]]]
          ]
        }, {
          key: "erkek",
          label: "ERKEK",
          cats: [
            ["Sık kullanılan", [["Saç Kesimi", "800 TL"], ["Fön", "250 TL"], ["Manikür", "700 TL"], ["Pedikür", "1000 TL"], ["Kaş Alma", "500 TL"], ["Saç Bakımı", "500 TL"], ["Saç Boyama", "600~1000 TL"], ["Sakal Tıraşı", "500 TL"], ["Cilt Bakımı", "2000 TL"]]],
            ["Saç", [["Fön", "250 TL"], ["Saç Bakımı", "500 TL"], ["Sakal Tıraşı", "500 TL"], ["Saç Boyama", "600~1000 TL"], ["Çocuk Tıraşı", "700 TL"], ["Saç Kesimi", "800 TL"], ["Saç Sakal Kesimi", "1000 TL"], ["Keratin Bakım", "1000~2500 TL"], ["Brezilya Fönü", "1500~4000 TL"], ["Gölgelendirme Gri", "2500~5000 TL"], ["Perma", "5000~7000 TL"], ["Renklendirme (Açma Boyama)", "5000~10000 TL"], ["Damat Tıraşı", "5000~10000 TL"]]],
            ["Tırnak", [["Topuk Törpüsü", "300 TL"], ["Manikür", "700 TL"], ["Pedikür", "1000 TL"], ["Batık Tırnak", ""], ["Bakım Manikürü", ""]]],
            ["Makyaj", [["Kaş Alma", "500 TL"]]],
            ["Cilt bakımı", [["Kollajen Bakımı", "1500~3000 TL"], ["Cilt Bakımı", "2000 TL"]]],
            masaj,
            ["Diğer", [["Pedikür (ıslak)", "1000 TL"]]]
          ]
        }]
      }
    }
  };
})();
