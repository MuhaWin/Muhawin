const {chromium}=require('playwright');
const src=require('fs').readFileSync(''+require('path').join(__dirname,'..','..','luca.js')+'','utf8');const JS=eval(src.match(/const YENI_PENCERE_JS = (`[\s\S]*?`);/)[1]);
const sayfalar={
 a:`<select id=SirketCombo><option>INNOCAP</option></select><select><option>01/01/2026 - 31/12/2026</option></select><div class="bar" style="background:#333;color:#fff"><span id="b" style="display:inline-block;width:30px;height:14px;background:#fff"></span><b>INNOCAP 2026</b></div><div>Menü</div>`,
 b:`<select id=SirketCombo><option>INNOCAP</option></select><div class="hdr"><a href="#" onclick="window.open(location.href,'_blank');return false;" id="b"><img src="data:," width="20" height="12"></a> <span>INNOCAP 2026</span></div>`,
 d:`<ul><li><a id=b href=# onclick="window.open('/yardim')">Yardım</a></li></ul><div><span>INNOCAP 2026</span><img src='data:,' width=10 height=10></div>`,
 c:`<div><button id="b" title="Yeni Pencere"><i class="fa fa-window-maximize"></i></button><span>INNOCAP 2026</span></div><button id="x">Kaydet</button>`,
};
(async()=>{const b=await chromium.launch();
for(const [k,h] of Object.entries(sayfalar)){const p=await b.newPage();await p.setContent(h);
 await p.evaluate(()=>{window.__tik=null;document.addEventListener('click',e=>{window.__tik=e.target.id||e.target.closest('[id]')&&e.target.closest('[id]').id;},true);});
 const r=await p.evaluate(JS);console.log(k,JSON.stringify(r).slice(0,80),'->',await p.evaluate(()=>window.__tik));await p.close();}
await b.close();})();
