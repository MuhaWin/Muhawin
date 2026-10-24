import os
import secrets
import threading
import webbrowser

import uvicorn


def acilis_adresi(port: int) -> str:
    """MuhaWin anahtarı vermediyse (bağımsız çalıştırma) rastgele anahtar üretilir; tarayıcı açılış adresindeki
    anahtarı çereze alır. Böylece aynı bilgisayardaki başka programlar ve web sayfaları sunucuya istek atamaz
    (rapor-02 D15)."""
    if os.environ.get("FK_ANAHTAR"):
        return f"http://127.0.0.1:{port}"
    os.environ["FK_ANAHTAR"] = anahtar = secrets.token_urlsafe(24)
    return f"http://127.0.0.1:{port}/?anahtar={anahtar}"


if __name__ == "__main__":
    port = int(os.environ.get("FK_PORT", "8000"))
    adres = acilis_adresi(port)
    if not os.environ.get("FK_TARAYICI_ACMA"):
        threading.Timer(1.5, lambda: webbrowser.open(adres)).start()
    print(f"Fatura Kontrol: {adres}", flush=True)
    # Yalnız bu bilgisayardan erişilir (127.0.0.1)
    uvicorn.run("fatura_kontrol.web.app:app", host="127.0.0.1", port=port)
