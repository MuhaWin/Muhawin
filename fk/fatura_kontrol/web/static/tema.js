// Tema seçimi: tarayıcıda (bu bilgisayarda) saklanır; tüm sayfalarda geçerlidir.
(function () {
  const TEMALAR = {
    muhawin: {ad: "MuhaWin", ust: "#16325C", zemin: "#f2f5f9", vurgu: "#12B5A0"},
    lacivert: {ad: "Lacivert", ust: "#24457a", zemin: "#f3f5f9", vurgu: "#2f5bb7"},
    gece: {ad: "Gece (koyu)", ust: "#141e31", zemin: "#0e131d", vurgu: "#5b8cff"},
    orman: {ad: "Orman", ust: "#235a43", zemin: "#f2f6f3", vurgu: "#2c7a57"},
    bordo: {ad: "Bordo", ust: "#6e2635", zemin: "#f7f3f4", vurgu: "#9b2f45"},
    kirmizi: {ad: "Kırmızı", ust: "#b0102a", zemin: "#fcf1f2", vurgu: "#d7263d"},
    grafit: {ad: "Grafit", ust: "#34343a", zemin: "#f4f4f5", vurgu: "#3d63a8"},
  };
  // MuhaWin (Electron) içinde varsayılan tema MuhaWin'in yeşil tonuna yakın "Orman"
  const VARSAYILAN = /Electron\//.test(navigator.userAgent) ? "muhawin" : "lacivert";
  function oku() { try { return localStorage.getItem("fk_tema") || VARSAYILAN; } catch (e) { return VARSAYILAN; } }
  function uygula(t) { document.documentElement.setAttribute("data-tema", TEMALAR[t] ? t : "lacivert"); }
  uygula(oku());
  // Görev 54: Kapat düğmeleri turuncu-kırmızı, Yenile düğmeleri yeşil (tema.css › .kapat / .yenile); sınıf metinden verilir
  function dugmeTur(b) {
    const t = (b.textContent || "").replace(/\s+/g, " ").trim(), al = b.getAttribute("aria-label") || "";
    if (/^[✕×]?\s*kapat$/i.test(t) || (/^[✕×]$/.test(t) && /^kapat$/i.test(al))) return "kapat";
    if (/(^|[\s'’])yenile$|^[⟳↻]/i.test(t)) return "yenile";
    return "";
  }
  function dugmeRenk(b) {
    const tur = dugmeTur(b), eski = b.dataset.renk || "";
    if (tur === eski) return;
    if (eski) b.classList.remove(eski);
    if (tur) { b.classList.add(tur); b.dataset.renk = tur; } else delete b.dataset.renk;
  }
  const tara = k => { if (!k || k.nodeType !== 1) return; if (k.matches("button,.btn")) dugmeRenk(k); k.querySelectorAll("button,.btn").forEach(dugmeRenk); };
  new MutationObserver(L => { for (const m of L) {
    const el = m.type === "characterData" ? m.target.parentElement : m.target;
    const b = el && el.closest && el.closest("button,.btn"); if (b) { dugmeRenk(b); continue; }
    m.addedNodes.forEach(tara);
  } }).observe(document.documentElement, {childList: true, subtree: true, characterData: true});
  document.addEventListener("DOMContentLoaded", () => tara(document.body));
  // MuhaWin içinde (çerçevede) açıldıysa üst bant MuhaWin'in sekmeleri gibi açık renkli olur
  if (window.parent !== window) document.documentElement.classList.add("mw");
  // MuhaWin içinde sayfalar arası geçiş MuhaWin'in üstündeki Muhasebe İşlemleri sekmelerinden yapılır
  // MuhaWin içinde Esc = geri (açık pencere / iletişim kutusu yoksa MuhaWin bir önceki ekrana döner)
  if (window.parent !== window) document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
    // metin kutusunda yazarken Esc önce yalnız kutudan çıkarır; ikinci Esc geri götürür
    const t = e.target;
    if (t && (t.isContentEditable || t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset|file|range|color|image)$/i.test(t.type || "")))) { t.blur(); return; }
    // görünür mü: getClientRects (offsetParent sabit konumlu pencerelerde hep null; Görev 49)
    const acik = [...document.querySelectorAll(".modal,.pencere,.kaplama,[role=dialog]")].some(x => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== "hidden");
    if (!acik) window.parent.postMessage({fk: true, tip: "esc"}, "*");
  });
  // MuhaWin içinde Ctrl+K / Ctrl+F: MuhaWin'in komut paleti (bu sayfalarda tarayıcının kendi araması yok)
  // Ctrl+F: bu sayfada yazı arama (eşleşmeler vurgulanır; Enter sonraki, Shift+Enter önceki). MuhaWin içinde Ctrl+K: MuhaWin'in komut paleti
  if (window.parent !== window) document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && /^k$/i.test(e.key)) { e.preventDefault(); window.parent.postMessage({fk: true, tip: "ctrlF"}, "*"); }
  });
  (() => {
    let bar = null, es = [], i = -1, son = "";
    const trk = t => String(t || "").toLocaleLowerCase("tr-TR");
    const temizle = () => { try { CSS.highlights.delete("fkara"); CSS.highlights.delete("fkaraaktif"); } catch (e) {} document.querySelectorAll(".fkara-kutu").forEach(x => x.classList.remove("fkara-kutu")); es = []; i = -1; };
    function kur() {
      if (bar) return;
      const st = document.createElement("style");
      st.textContent = "#fkAra{position:fixed;top:8px;right:14px;z-index:9999;display:flex;gap:6px;align-items:center;padding:6px 8px;background:#fff;color:#111;border:1px solid #ccc;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);font:13px system-ui}#fkAra[hidden]{display:none}#fkAra input{width:230px;padding:5px 8px}#fkAra button{border:1px solid #ccc;background:#f6f6f6;border-radius:6px;padding:3px 8px;cursor:pointer}::highlight(fkara){background:#fde68a}::highlight(fkaraaktif){background:#f59e0b;color:#111}.fkara-kutu{outline:2px solid #fbbf24!important}";
      document.head.appendChild(st);
      bar = document.createElement("div"); bar.id = "fkAra"; bar.hidden = true;
      bar.innerHTML = '<input type="search" placeholder="Bu sayfada ara…" aria-label="Bu sayfada ara"><span class="n" style="min-width:52px;text-align:center"></span><button type="button" data-y="-1" title="Önceki">▲</button><button type="button" data-y="1" title="Sonraki">▼</button><button type="button" data-x="1" title="Kapat (Esc)">✕</button>';
      document.body.appendChild(bar);
      const q = bar.querySelector("input"); let t = null;
      q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => ara(q.value), 120); });
      q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (q.value !== son) ara(q.value); else git(e.shiftKey ? -1 : 1); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); kapat(); } });
      bar.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.x) kapat(); else git(+b.dataset.y); });
    }
    function ara(v) {
      temizle(); son = v; const n = bar.querySelector(".n"); if (!v.trim()) { n.textContent = ""; return; }
      const a = trk(v.trim()); const sonuc = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: x => { const p = x.parentElement; if (!p || p.closest("#fkAra,script,style,option,select") || !p.getClientRects().length) return NodeFilter.FILTER_REJECT; return x.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }});
      let x; while ((x = w.nextNode()) && sonuc.length < 2000) { const tx = trk(x.nodeValue); let j = tx.indexOf(a);
        while (j >= 0 && sonuc.length < 2000) { const r = new Range(); r.setStart(x, j); r.setEnd(x, Math.min(x.nodeValue.length, j + a.length)); sonuc.push({r, el: x.parentElement}); j = tx.indexOf(a, j + a.length); } }
      for (const inp of document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]),textarea")) if (!inp.closest("#fkAra") && trk(inp.value).includes(a) && inp.getClientRects().length) { inp.classList.add("fkara-kutu"); sonuc.push({el: inp}); }
      sonuc.sort((p, q2) => { const c = p.el.compareDocumentPosition(q2.el); return c & 4 ? -1 : c & 2 ? 1 : 0; });
      es = sonuc; try { CSS.highlights.set("fkara", new Highlight(...es.filter(e => e.r).map(e => e.r))); } catch (e) {}
      n.textContent = es.length ? "" : "Yok"; if (es.length) git(1);
    }
    function git(d) { if (!es.length) return; i = (i + d + es.length) % es.length; const e = es[i];
      try { CSS.highlights.set("fkaraaktif", e.r ? new Highlight(e.r) : new Highlight()); } catch (x) {}
      (e.el.closest("tr") || e.el).scrollIntoView({block: "center", inline: "nearest"}); bar.querySelector(".n").textContent = (i + 1) + " / " + es.length; }
    function kapat() { if (bar) { bar.hidden = true; temizle(); son = ""; } }
    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && /^f$/i.test(e.key)) { e.preventDefault(); const ac = () => { kur(); bar.hidden = false; const q = bar.querySelector("input"); q.focus(); q.select(); if (q.value) ara(q.value); };
        if (document.body) ac(); else document.addEventListener("DOMContentLoaded", ac, {once: true}); }
    });
  })();
  if (window.parent !== window) { const st = document.createElement("style"); st.textContent = "html.mw header nav{display:none!important}"; document.head.appendChild(st); }
  window.FKTema = {
    TEMALAR, oku,
    sec(t) { try { localStorage.setItem("fk_tema", t); } catch (e) {} uygula(t); },
    secici(kap) {        // kap: tema düğmelerinin konacağı öğe
      const ciz = () => {
        const aktif = oku();
        kap.innerHTML = Object.entries(TEMALAR).map(([k, v]) =>
          `<button type="button" data-t="${k}" class="${k === aktif ? "secili" : ""}" title="${v.ad}">
             <span class="ornek" style="background:${v.zemin}"><i style="background:${v.ust}"></i>
               <i style="margin:6px 10px;border-radius:3px;background:${v.vurgu};width:28px;height:8px"></i></span>${v.ad}</button>`).join("");
        kap.querySelectorAll("button").forEach(b => b.onclick = () => { FKTema.sec(b.dataset.t); ciz(); });
      };
      ciz();
    },
  };
  // başka pencerede (ör. rapor çerçevesi) tema değişirse anında uygula
  window.addEventListener("storage", e => { if (e.key === "fk_tema") uygula(e.newValue); });
})();

/* ---------- Başlık Biçimi: buton, sekme, tablo başlığı ve etiketlerde her kelime büyük harfle başlar (açıklamalar hariç) ---------- */
(()=>{
  const KUCUK=new Set(['ve','ile','veya','ya','da','de','ki','mi']);
  const SEC='button, th, h1, h2, h3, h4, label, option, nav a, .sekmeler button, summary, legend, a.btn, .kutu .ad';
  const HARIC='p, .note, td, .ipucu, small, input, textarea, .aciklama';
  const kelime=(w,i)=>{if(!w)return w;const c=w[0];
    if(!/[a-zçğıöşü]/.test(c))return w;                       // zaten büyük, sayı ya da simge
    if(/[A-ZÇĞİÖŞÜ]/.test(w.slice(1)))return w;               // e-Fatura, iPhone gibi
    if(i>0&&KUCUK.has(w))return w;
    if(/^(https?:|www\.)/.test(w))return w;
    return c.toLocaleUpperCase('tr-TR')+w.slice(1);};
  const cevir=t=>{let i=0;return t.replace(/[^\s/()·–—-]+/g,w=>kelime(w,i++));};
  function uygula(kok){
    const els=kok.nodeType===1?[...(kok.matches&&kok.matches(SEC)?[kok]:[]),...kok.querySelectorAll(SEC)]:[];
    for(const el of els){
      if(el.closest('[data-notc]'))continue;
      const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;return p&&p.closest(HARIC)&&p.closest(HARIC)!==el&&el.contains(p.closest(HARIC))?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
      let n;while((n=w.nextNode())){const y=cevir(n.nodeValue);if(y!==n.nodeValue)n.nodeValue=y;}
    }
  }
  let bek=new Set(),zam=0;
  const isle=()=>{zam=0;const k=[...bek];bek.clear();for(const x of k)if(x.isConnected)uygula(x);};
  const bas=()=>{new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData'){const p=m.target.parentElement;if(p)bek.add(p.closest(SEC)||p);}else for(const n of m.addedNodes){if(n.nodeType===1)bek.add(n);else if(n.parentElement)bek.add(n.parentElement.closest(SEC)||n.parentElement);}}
    if(!zam)zam=requestAnimationFrame(isle);}).observe(document.body,{childList:true,subtree:true,characterData:true});
  uygula(document.body);};
  if(document.body)bas();else document.addEventListener('DOMContentLoaded',bas);
  window.__baslikBicimi=cevir;
})();

/* ---------- Tüm tablolar: başlığa tıklayarak sıralama, başlık altında filtre, tümünü seç (kendi sıralaması olmayan tablolara) ---------- */
(()=>{
  const T=s=>String(s==null?'':s).toLocaleUpperCase('tr-TR').replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C').replace(/\s+/g,' ').trim();
  const durum=new Map();let sayac=0;
  const anahtar=t=>{if(!t.dataset.tgk)t.dataset.tgk=t.id||('tg'+(++sayac));return t.dataset.tgk;};
  const uygunMu=t=>{if(!t.tHead||!t.tBodies.length||t.closest('.tg-yok')||t.classList.contains('mini')||t.classList.contains('tg-yok'))return false;
    const h=t.tHead;if(h.querySelector('.sirala,[data-cks],[data-sort],[data-fksort],[data-mmsort],.sorth,tr.filtre:not(.tg-filtre)'))return false;const r=h.rows[0];return !!r&&r.cells.length>1;};
  const deger=td=>{if(!td)return '';const i=td.querySelector('input:not([type=checkbox]),select');return (i?(i.value||''):'')+' '+(td.innerText||td.textContent||'');};
  function sayi(s){s=String(s).trim();let m=s.match(/^(\d{2})[./](\d{2})[./](\d{4})/);if(m)return +(m[3]+m[2]+m[1]);
    m=s.replace(/[₺TL\s*%]/g,'').match(/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/);if(m)return parseFloat(s.replace(/[₺TL\s*%]/g,'').replace(/\./g,'').replace(',','.'));return null;}
  function gruplar(tb){const g=[];for(const tr of tb.rows){const ek=tr.classList.contains('fisdetay')||tr.classList.contains('detay')||tr.dataset.tgek!=null;if(ek&&g.length)g[g.length-1].push(tr);else g.push([tr]);}return g;}
  function kur(t){
    const k=anahtar(t);const st=durum.get(k)||{sort:null,f:{}};durum.set(k,st);
    const hr=t.tHead.rows[t.tHead.rows.length-1];if(hr.classList.contains('tg-filtre'))return;
    const n=hr.cells.length;const ilk=t.tBodies[0].rows[0];
    const cbKol=ilk&&ilk.cells[0]&&ilk.cells[0].querySelector('input[type=checkbox]')?0:-1;
    [...hr.cells].forEach((th,i)=>{if(i===cbKol||!(th.textContent||'').trim()||th.dataset.tg)return;th.dataset.tg=i;th.style.cursor='pointer';th.title=th.title||'Sıralamak için tıklayın';
      const ok=document.createElement('span');ok.className='tg-ok';ok.style.cssText='margin-left:4px;opacity:.5;font-size:10px';th.appendChild(ok);
      th.addEventListener('click',e=>{if(e.target.closest('input,select,button'))return;const o=st.sort;st.sort=o&&o.i===i?(o.d>0?{i,d:-1}:null):{i,d:1};uygula(t);});});
    if(cbKol===0&&!hr.cells[0].querySelector('input[type=checkbox]')){const c=document.createElement('input');c.type='checkbox';c.title='Görünenlerin tümünü seç / kaldır';c.className='tg-hepsi';hr.cells[0].appendChild(c);
      c.addEventListener('change',()=>{const hedef=c.checked;for(const tr of t.tBodies[0].rows){if(tr.style.display==='none')continue;const b=tr.cells[0]&&tr.cells[0].querySelector('input[type=checkbox]');if(b&&!b.disabled&&b.checked!==hedef)b.click();}});}
    const fr=document.createElement('tr');fr.className='filtre tg-filtre';
    for(let i=0;i<n;i++){const th=document.createElement('th');th.style.cssText='padding:3px 5px';
      if(i!==cbKol&&(hr.cells[i].textContent||'').trim()){const inp=document.createElement('input');inp.placeholder='filtre…';inp.value=st.f[i]||'';inp.setAttribute('aria-label',(hr.cells[i].textContent||'').trim()+' filtresi');
        inp.style.cssText='width:100%;min-width:50px;padding:3px 6px;font-size:12px;box-sizing:border-box';inp.addEventListener('focus',()=>{st.odak=i;});inp.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement===document.body||!document.activeElement)return;if(st.odak===i&&document.activeElement!==inp)st.odak=null;},0);});let z;inp.addEventListener('input',()=>{st.f[i]=inp.value;clearTimeout(z);z=setTimeout(()=>uygula(t),150);});th.appendChild(inp);}
      fr.appendChild(th);}
    t.tHead.appendChild(fr);uygula(t);
    if(st.odak!=null&&(!document.activeElement||document.activeElement===document.body)){const x=fr.cells[st.odak]&&fr.cells[st.odak].querySelector('input');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length);}}
  }
  function uygula(t){
    const st=durum.get(anahtar(t));if(!st)return;const tb=t.tBodies[0];if(!tb)return;t.__tgMesgul=true;
    const g=gruplar(tb);const fs=Object.entries(st.f).filter(([,v])=>v&&v.trim());
    for(const grp of g){const tr=grp[0];if(tr.cells.length===1&&tr.cells[0].colSpan>1){continue;}
      const ok=fs.every(([i,v])=>{const d=deger(tr.cells[+i]);const q=v.trim();const x=sayi(String(d).trim().split(/\s{2,}|\n/)[0]);
        const mm=q.match(/^(>=|<=|>|<|=)\s*(.+)$/);if(mm&&x!=null){const y=sayi(mm[2]);if(y==null)return false;return mm[1]==='>'?x>y:mm[1]==='<'?x<y:mm[1]==='>='?x>=y:mm[1]==='<='?x<=y:Math.abs(x-y)<0.005;}
        return T(d).includes(T(q));});
      for(const r of grp)r.style.display=ok?'':'none';}
    if(st.sort){const {i,d}=st.sort;const val=grp=>{const s=deger(grp[0].cells[i]).trim();return s;};
      const veri=g.filter(grp=>!(grp[0].cells.length===1&&grp[0].cells[0].colSpan>1));
      veri.sort((a,b)=>{const x=val(a),y=val(b);const nx=sayi(x),ny=sayi(y);if(nx!=null&&ny!=null)return d*(nx-ny);if(!x)return 1;if(!y)return -1;return d*x.localeCompare(y,'tr',{numeric:true,sensitivity:'base'});});
      for(const grp of veri)for(const r of grp)tb.appendChild(r);}
    t.tHead.querySelectorAll('th[data-tg] .tg-ok').forEach(s=>{const i=+s.parentElement.dataset.tg;s.textContent=st.sort&&st.sort.i===i?(st.sort.d>0?'▲':'▼'):'↕';});
    const hc=t.tHead.querySelector('.tg-hepsi');if(hc){const bs=[...tb.rows].filter(r=>r.style.display!=='none').map(r=>r.cells[0]&&r.cells[0].querySelector('input[type=checkbox]:not([disabled])')).filter(Boolean);hc.checked=bs.length>0&&bs.every(b=>b.checked);hc.indeterminate=!hc.checked&&bs.some(b=>b.checked);}
    setTimeout(()=>{t.__tgMesgul=false;},0);
  }
  function tara(kok){const ts=kok.tagName==='TABLE'?[kok]:kok.querySelectorAll?kok.querySelectorAll('table'):[];for(const t of ts){if(!uygunMu(t))continue;kur(t);}}
  let bek=new Set(),zam=0;
  const isle=()=>{zam=0;const k=[...bek];bek.clear();const tablolar=new Set();
    for(const n of k){if(!n.isConnected)continue;const t=n.closest?n.closest('table'):null;if(t)tablolar.add(t);if(n.querySelectorAll)n.querySelectorAll('table').forEach(x=>tablolar.add(x));}
    for(const t of tablolar){if(t.__tgMesgul)continue;if(!uygunMu(t))continue;if(!t.tHead.querySelector('.tg-filtre'))kur(t);else uygula(t);}};
  const bas=()=>{new MutationObserver(ms=>{for(const m of ms){if(m.target&&m.target.closest&&m.target.closest('.tg-filtre'))continue;const t=m.target.closest&&m.target.closest('table');if(t&&t.__tgMesgul)continue;bek.add(m.target.nodeType===1?m.target:m.target.parentElement);}if(!zam)zam=requestAnimationFrame(isle);})
    .observe(document.body,{childList:true,subtree:true});tara(document.body);};
  if(document.body)bas();else document.addEventListener('DOMContentLoaded',bas);
  window.__tablo={tara,durum};
})();
