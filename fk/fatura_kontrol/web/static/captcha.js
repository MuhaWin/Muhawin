/* Luca doğrulama kodu (captcha) programda: Luca tarayıcısı arka planda çalışırken kodun resmi burada gösterilir;
   kullanıcı kodu yazar, program Luca'ya yazıp girişi tamamlar. Toplu kontrol, Tek firma ve Mikro Denetim sayfalarında. */
(() => {
  if (window.__mwCaptcha) return; window.__mwCaptcha = true;
  let kutu = null, son = 0, gonderiliyor = false;
  function kur() {
    if (kutu) return kutu;
    const st = document.createElement("style");
    st.textContent = `#mwCap{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(10,20,40,.45)}#mwCap[hidden]{display:none}
#mwCap .k{background:#fff;color:#122;border-radius:14px;padding:18px 20px;width:min(380px,92vw);box-shadow:0 18px 50px rgba(0,0,0,.35);font:14px system-ui,Segoe UI,Arial}
#mwCap h3{margin:0 0 6px;font-size:16px}#mwCap p{margin:0 0 10px;color:#556;font-size:13px}#mwCap img{display:block;max-width:100%;margin:6px auto 10px;border:1px solid #ccd;border-radius:6px;background:#fff;image-rendering:pixelated;min-height:40px}
#mwCap input{width:100%;box-sizing:border-box;font:600 20px monospace;letter-spacing:3px;padding:8px 10px;border:1px solid #99a;border-radius:8px;text-align:center}
#mwCap .d{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}#mwCap button{font:600 13px system-ui;padding:8px 14px;border-radius:8px;border:1px solid #1f4aa8;cursor:pointer}
#mwCap .g{background:#1f4aa8;color:#fff}#mwCap .v{background:#fff;color:#1f4aa8}#mwCap .h{color:#a3262c;font-size:12.5px;min-height:16px;margin-top:6px}`;
    document.head.appendChild(st);
    kutu = document.createElement("div"); kutu.id = "mwCap"; kutu.hidden = true;
    kutu.innerHTML = `<div class="k" role="dialog" aria-modal="true" aria-labelledby="mwCapB"><h3 id="mwCapB">Luca doğrulama kodu</h3>
<p id="mwCapM">Luca girişi için resimdeki kodu yazın. Luca arka planda açılır; giriş program tarafından tamamlanır.</p>
<img id="mwCapR" alt="Doğrulama kodu resmi"><input id="mwCapI" autocomplete="off" spellcheck="false" maxlength="20" aria-label="Doğrulama kodu" placeholder="Kodu yazın">
<div class="h" id="mwCapH"></div><div class="d"><button type="button" class="v" id="mwCapX">Sonra</button><button type="button" class="g" id="mwCapG">Giriş</button></div></div>`;
    document.body.appendChild(kutu);
    const gonder = async () => {
      const kod = kutu.querySelector("#mwCapI").value.trim(); if (!kod || gonderiliyor) return;
      gonderiliyor = true; kutu.querySelector("#mwCapG").disabled = true; kutu.querySelector("#mwCapH").textContent = "";
      try { const r = await fetch("/api/toplu/captcha", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({kod})});
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || "Kod gönderilemedi");
        kutu.querySelector("#mwCapM").textContent = "Kod Luca'ya yazıldı, giriş yapılıyor…"; kutu.querySelector("#mwCapI").value = "";
        setTimeout(() => { if (kutu) kutu.hidden = true; }, 1200);
      } catch (e) { kutu.querySelector("#mwCapH").textContent = e.message; }
      finally { gonderiliyor = false; kutu.querySelector("#mwCapG").disabled = false; }
    };
    kutu.querySelector("#mwCapG").onclick = gonder;
    kutu.querySelector("#mwCapI").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); gonder(); } });
    kutu.querySelector("#mwCapX").onclick = () => { kutu.hidden = true; kutu.dataset.sonra = String(son); };
    return kutu;
  }
  async function bak() {
    try {
      const d = await (await fetch("/api/toplu/durum", {cache: "no-store"})).json();
      const t = d && d.calisiyor ? d.captcha || 0 : 0;
      if (!t) { if (kutu && !kutu.hidden && !gonderiliyor) kutu.hidden = true; return; }
      const k = kur();
      if (t !== son) {
        son = t; k.querySelector("#mwCapR").src = "/api/toplu/captcha?t=" + t;
        const m = (d.ilerleme && d.ilerleme.mesaj) || "";
        k.querySelector("#mwCapM").textContent = /kabul edilmedi/i.test(m) ? "Kod kabul edilmedi; yeni resimdeki kodu yazın." : "Luca girişi için resimdeki kodu yazın. Luca arka planda açılır; giriş program tarafından tamamlanır.";
        if (k.dataset.sonra !== String(t)) { k.hidden = false; setTimeout(() => k.querySelector("#mwCapI").focus(), 50); }
      }
    } catch (e) {}
  }
  setInterval(bak, 1500); setTimeout(bak, 300);
})();
