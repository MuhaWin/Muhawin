import os
import threading
import webbrowser

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("FK_PORT", "8000"))
    if not os.environ.get("FK_TARAYICI_ACMA"):
        threading.Timer(1.5, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()
    # Yalnız bu bilgisayardan erişilir (127.0.0.1)
    uvicorn.run("fatura_kontrol.web.app:app", host="127.0.0.1", port=port)
