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
    for sol, sag in satirlar or SATIRLAR:
        if y < 40:
            c.showPage(); y = 810
        c.setFont("DejaVu", 8)
        c.drawString(30, y, sol)
        c.drawString(280, y, sag)
        y -= 14
    c.save()
