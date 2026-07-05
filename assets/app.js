/* 臨床病毒學大綱 — 前端渲染
   資料來源：data/virology.json（共編者只需編輯該檔）
   單軸模組：依病毒科（meta.groups，DNA→RNA→其他）分群，無跨模組互連。
   ** 文字 ** → 粗體；compare → 鑑別比較表 */
(function(){
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const md = s => esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
  let DATA=null;

  fetch('data/virology.json', {cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(d=>{ DATA=d; render(); })
    .catch(e=>{ $('#cards').innerHTML='<div class="err">無法載入 <b>data/virology.json</b>（'+esc(e.message)+'）。請用本機伺服器（<code>python -m http.server</code>）或 GitHub Pages 網址開啟，勿用 file://。</div>'; });

  function strField(title, s){
    if(typeof s!=='string'||!s.trim()) return '';
    return '<div class="field"><div class="k">'+title+'</div><div class="v">'+md(s)+'</div></div>';
  }
  function cmpTable(rows){
    if(!Array.isArray(rows)||rows.length<2) return '';
    const head='<tr>'+rows[0].map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr>';
    const body=rows.slice(1).map(r=>'<tr>'+r.map((c,ci)=>'<td>'+(ci===0?md(c):esc(c))+'</td>').join('')+'</tr>').join('');
    return '<div class="field"><div class="k">鑑別比較</div><div class="table-scroll"><table><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div></div>';
  }

  // 可及性：把可點的標題列變成可鍵盤操作的 button 語意，並同步 aria-expanded
  function wireToggle(head, container){
    head.setAttribute('role','button');
    head.setAttribute('tabindex','0');
    head.setAttribute('aria-expanded', String(!container.classList.contains('collapsed')));
    const toggle=()=>{ const collapsed=container.classList.toggle('collapsed'); head.setAttribute('aria-expanded', String(!collapsed)); };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } });
  }
  // 全部展開/收合後同步所有標題列的 aria-expanded（不依賴 enhance.js）
  function syncAllAria(){
    document.querySelectorAll('.card,.group').forEach(e=>{
      const h=e.querySelector('.card-head,.group-head');
      if(h) h.setAttribute('aria-expanded', String(!e.classList.contains('collapsed')));
    });
  }

  function virusCard(d){
    const card=document.createElement('article');
    card.className='card'; card.id=encodeURIComponent(d.name); card.dataset.stars=d.stars||0;
    const fields=
      strField('📖 原理／方法', d.principle)+
      strField('🧬 基因體／構造', d.genome)+
      strField('🦟 傳播途徑', d.transmission)+
      strField('🤒 致病與臨床', d.disease)+
      strField('🔬 實驗室診斷', d.lab)+
      strField('🧠 結果判讀', d.interpret)+
      strField('💊 治療與預防', d.treatment)+
      strField('⚠️ 陷阱／易混', d.pitfall)+
      cmpTable(d.compare);
    const hot=(d.hot||[]).map(h=>'<li>'+md(h)+'</li>').join('');
    const qa=(d.qa||[]).map(q=>'<tr><td class="yr">'+esc(q[0])+'</td><td>'+md(q[1])+'</td></tr>').join('');
    card.innerHTML=
      '<div class="card-head"><span class="abbr">'+esc(d.name)+'</span><span class="en">'+esc(d.en)+'</span>'+
      '<span class="zh">'+esc(d.zh)+'</span><span class="stars">'+'★'.repeat(d.stars||0)+'</span><span class="arrow">▼</span></div>'+
      '<div class="card-body">'+fields+
      '<div class="hot"><div class="k">⭐ 高頻考點</div><ol>'+hot+'</ol></div>'+
      '<div class="qa-sec"><div class="k">📖 歷屆考題回顧</div>'+
      '<table class="qa"><tbody>'+qa+'</tbody></table></div></div>';
    wireToggle(card.querySelector('.card-head'), card);
    return card;
  }

  // 依群名前綴判定基因體型色帶（cards.css 以 [data-band] 上色）
  function bandOf(h1){
    if(/^總論/.test(h1)) return 'general';
    if(/^DNA病毒/.test(h1)) return 'dna';
    if(/^肝炎病毒/.test(h1)) return 'hepatitis';
    if(/^RNA病毒/.test(h1)) return 'rna';
    return 'other';
  }

  function render(){
    $('#sub').textContent='科目：'+DATA.meta.subject+'｜共 '+DATA.virology.length+' 張病毒卡';
    const wrap=$('#cards'); wrap.innerHTML='';
    // 群組顯示順序依 meta.groups（DNA→RNA→其他）；不在清單者退回出現序附於後
    const seen=[...new Set(DATA.virology.map(c=>c.h1))];
    const groups=(DATA.meta&&DATA.meta.groups)||[];
    const h1order=[...groups.filter(g=>seen.includes(g)), ...seen.filter(g=>!groups.includes(g))];
    h1order.forEach(h1=>{
      const g=document.createElement('section');
      g.className='group'; g.dataset.group=h1; g.dataset.band=bandOf(h1);
      const flow=(DATA.flows&&DATA.flows[h1]||[]).map(l=>'<div class="ln">'+md(l)+'</div>').join('');
      g.innerHTML='<div class="group-head"><span class="arrow">▼</span><span>'+esc(h1)+'</span></div>'+
        '<div class="group-body">'+(flow?'<div class="flow"><h3>🧭 重點整理</h3>'+flow+'</div>':'')+'</div>';
      const body=g.querySelector('.group-body');
      wireToggle(g.querySelector('.group-head'), g);
      const cc=document.createElement('div'); cc.className='cards';
      DATA.virology.filter(c=>c.h1===h1).forEach(c=>cc.appendChild(virusCard(c)));
      body.appendChild(cc);
      wrap.appendChild(g);
    });
    $('#search').addEventListener('input',applyFilter);
    $('#expandAll').onclick=()=>{document.querySelectorAll('.card,.group').forEach(e=>e.classList.remove('collapsed'));syncAllAria();};
    $('#collapseAll').onclick=()=>{document.querySelectorAll('.card,.group').forEach(e=>e.classList.add('collapsed'));syncAllAria();};
    const q=new URLSearchParams(location.search).get('q');
    if(q){ $('#search').value=q; }
    applyFilter();
  }

  function applyFilter(){
    const q=$('#search').value.trim().toLowerCase();
    let any=false;
    document.querySelectorAll('.group').forEach(g=>{
      let gHas=false;
      g.querySelectorAll('.card').forEach(card=>{
        const show=!q||card.textContent.toLowerCase().includes(q);
        card.style.display=show?'':'none';
        if(show){gHas=true;any=true;}
      });
      g.style.display=gHas?'':'none';
    });
    $('#nohit').style.display=any||!q?'none':'block';
  }
})();
