"""Sahte Muhtasar ve Prim Hizmet Beyannamesi (1003A) PDF'i — GİB çıktısının bölüm düzeninde, uydurma kişi / tutarlarla.
Gerçek beyanname kişisel veri içerdiği için testler bununla yapılır (reportlab + DejaVu yazı tipi)."""
from pathlib import Path

FONTLAR = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
           "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf", "C:/Windows/Fonts/arial.ttf"]   # Türkçe harfli yazı tipi

SATIRLAR = [
    ("MUHTASAR VE PRİM HİZMET BEYANNAMESİ", "1003A"),
    ("Vergi Dairesi", "ANTALYA KURUMLAR VERGİ DAİRESİ"),
    ("DÖNEM TİPİ Aylık", "Yıl 2026    Ay Eylül"),
    ("Onay Zamanı", "12.10.2026 - 14:22:05"),
    ("VERGİ SORUMLUSUNUN", ""),
    ("Vergi Kimlik Numarası", "3810463613"),
    ("E-Posta Adresi", "ornek@ornek.com.tr"),
    ("Soyadı (Unvanı)", "DENETİM İNŞAAT SANAYİ"),
    ("Adı (Unvanın Devamı)", "VE TİCARET LİMİTED ŞİRKETİ"),
    ("MATRAH VE VERGİ BİLDİRİMİ", ""),
    ("Ödemelerin Türü", "Gayrisafi Tutar    Vergi Kesinti Tutarı"),
    ("011 Ücret Ödemeleri", "51.747,00    4.123,45"),
    ("022 Serbest Meslek Kazancı Ödemeleri", "2.500,00    500,00"),
    ("041 GMSİ Kira Ödemeleri (Bina)", "10.000,00    2.000,00"),
    ("302 Diğer Kesintiler", "1.000,00    150,00"),
    ("Toplam", "65.247,00    6.773,45"),
    ("Terkin Edilecek Vergi Tutarı", "0,00"),
    ("Terkin Sonrası Kalan Vergi Tutarı", "6.773,45"),
    ("Tevkifata İlişkin Damga Vergisi", "392,77"),
    ("VERGİ BİLDİRİMİ", ""),
    ("Toplam Çalışan Sayısı", "7"),
    ("Gelir Vergisi Matrahı Toplamı", "51.747,00"),
    ("Gelir Vergisi Kesintisi", "4.123,45"),
    ("TAHAKKUKA ESAS İCMAL CETVELİ", ""),
    ("Vergi Türü", "Matrah   Tahakkuk Eden   Mahsup Edilen   Tecil Edilecek   Ödenecek   İade"),
    ("Gelir Vergisi Stopajı", "65.247,00   6.773,45   0,00   0,00   6.773,45   0,00"),
    ("Damga Vergisi", "0,00   392,77   0,00   0,00   392,77   0,00"),
    ("Damga Vergisi Ödenecek", "392,77"),
    ("TEVKİFATA TABİ ÖDEMELERE AİT BİLDİRİM (ÜCRET HARİÇ)", ""),
    ("12345678901 AHMET YILMAZ", "022 S.M. Makbuz 15.09.2026 A-125"),
    ("KONYAALTI ANTALYA", "Gayrisafi 2.500,00"),
    ("", "Kesilen Vergi 500,00"),
    ("23456789012 AYŞE KAYA", "041 Yok 01.09.2026"),
    ("MURATPAŞA ANTALYA", "Gayrisafi 10.000,00"),
    ("", "Kesilen Vergi 2.000,00"),
    ("GAYRİSAFİ TUTAR TOPLAMI", "12.500,00"),
    ("KESİLEN VERGİ TUTARI TOPLAMI", "2.500,00"),
    ("Sigortalı Çalışan Bilgileri", ""),
    ("34567890123 MEHMET DEMİR", "30 33030.00 9999.01 33030.00 2.477,25"),
]


# Gerçek GİB çıktısına yakın düzen (yöneticinin gerçek PDF'te gördükleri): vergi dairesi iki satıra bölünmüş ve aynı
# satırlarda dönem sütunları; "Onay Zamanı :"; tür kodu satırında açıklama yok; icmal alt alta "etiket tutar";
# "Damga Vergisi" başlığı altında "Ödenecek"; kişi satırları çok satırlı, belge türü "S.M." / alt satırda "Makbuz".
# Her satır: [(x, metin), …]
GERCEK = [
    [(30, "MUHTASAR VE PRİM HİZMET BEYANNAMESİ"), (450, "1003A")],
    [(130, "ANTALYA KURUMLAR VERGİ DAİRESİ"), (330, "DÖNEM TİPİ"), (420, "Yıl"), (460, "2026")],
    [(30, "Vergi Dairesi"), (130, "MÜDÜRLÜĞÜ"), (330, "Aylık"), (420, "Ay"), (460, "Eylül")],
    [(30, "Onay Zamanı :"), (130, "23.10.2026 - 12:18:17")],
    [(30, "VERGİ SORUMLUSUNUN")],
    [(30, "Vergi Kimlik Numarası"), (200, "3810463613"), (330, "E-Posta"), (400, "ornek@ornek.com.tr")],
    [(30, "Soyadı (Unvanı)"), (200, "DENETİM İNŞAAT SANAYİ")],
    [(30, "Adı (Unvanın Devamı)"), (200, "VE TİCARET LİMİTED ŞİRKETİ")],
    [(30, "MATRAH VE VERGİ BİLDİRİMİ")],
    [(30, "Ödemelerin Türü"), (300, "Gayrisafi Tutar"), (430, "Vergi Kesinti Tutarı")],
    [(30, "Ücret Ödemeleri")],
    [(30, "011"), (300, "51.747,00"), (430, "4.123,45")],
    [(30, "Serbest Meslek Kazançları")],
    [(30, "022"), (300, "6.000,00"), (430, "1.200,00")],
    [(30, "GMSİ Kira (Bina)")],
    [(30, "041"), (300, "90.625,00"), (430, "18.125,00")],
    [(30, "302"), (300, "0,00"), (430, "0,00")],
    [(30, "Toplam"), (300, "148.372,00"), (430, "23.448,45")],
    [(30, "Terkin Sonrası Kalan Vergi Tutarı"), (430, "23.448,45")],
    [(30, "Tevkifata İlişkin Damga Vergisi"), (430, "0,00")],
    [(30, "VERGİ BİLDİRİMİ")],
    [(30, "Toplam Çalışan Sayısı"), (300, "7")],
    [(30, "TAHAKKUKA ESAS İCMAL CETVELİ")],
    [(30, "Matrah"), (300, "148.372,00")],
    [(30, "Tahakkuk Eden"), (300, "23.448,45")],
    [(30, "Mahsup Edilen"), (300, "0,00")],
    [(30, "Tecil Edilecek Tutar"), (300, "0,00")],
    [(30, "Ödenecek"), (300, "23.448,45")],
    [(30, "İade Edilecek"), (300, "0,00")],
    [(30, "Damga Vergisi")],
    [(30, "Ödenecek"), (300, "0,00")],
    [(30, "TEVKİFATA TABİ ÖDEMELERE AİT BİLDİRİM (ÜCRET HARİÇ)")],
    [(30, "12345678901"), (110, "AHMET"), (200, "KONYAALTI"), (300, "022"), (340, "S.M."), (390, "15.09.2026"), (450, "SMM2026000000022")],
    [(110, "YILMAZ"), (200, "ANTALYA"), (340, "Makbuz"), (470, "6.000,00")],
    [(470, "1.200,00")],
    [(30, "23456789012"), (110, "AYŞE"), (200, "MURATPAŞA"), (300, "041"), (340, "Yok"), (390, "01.09.2026")],
    [(110, "KAYA"), (200, "ANTALYA"), (470, "90.625,00")],
    [(470, "18.125,00")],
    [(30, "GAYRİSAFİ TUTAR TOPLAMI"), (470, "96.625,00")],
    [(30, "KESİLEN VERGİ TUTARI TOPLAMI"), (470, "19.325,00")],
    [(30, "Sigortalı Çalışan Bilgileri")],
    [(30, "34567890123"), (110, "MEHMET DEMİR"), (300, "30 33030.00 2.477,25")],
]


def muhtasar_yaz(yol: Path, satirlar=None):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas
    font = next((f for f in FONTLAR if Path(f).exists()), None)
    if not font:
        import pytest
        pytest.skip("Türkçe harfli yazı tipi yok (DejaVu / Liberation)")
    pdfmetrics.registerFont(TTFont("DejaVu", font))
    c = canvas.Canvas(str(yol), pagesize=A4)
    y = 810
    for satir in satirlar or SATIRLAR:
        if y < 40:
            c.showPage(); y = 810
        c.setFont("DejaVu", 8)
        for x, metin in (satir if isinstance(satir, list) else [(30, satir[0]), (280, satir[1])]):
            c.drawString(x, y, metin)
        y -= 14
    c.save()
