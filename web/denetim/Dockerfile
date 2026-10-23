# Mikro Denetim web sürümü (fk/fatura_kontrol, FK_WEB=1). Yapı bağlamı: depodaki fk klasörü (docker-compose.yml).
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    FK_WEB=1 FK_VERI=/veri FK_BILDIRIM_URL= FK_TARAYICI_ACMA=1
WORKDIR /uygulama
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY fatura_kontrol ./fatura_kontrol
RUN useradd --uid 1000 --create-home denetim && mkdir -p /veri && chown denetim /veri
USER denetim
VOLUME /veri
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "fatura_kontrol.web.app:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
