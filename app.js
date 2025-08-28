// Drinkkompassen app (split, v6.4.1)
window.set = window.set || function(){}; // safety noop if any legacy code tries to use set()

let DATASET = {drinks: [], relations: []};
let SELECTED = null;
const STATE = { pantry: new Set(JSON.parse(localStorage.getItem('pantry')||'[]')), pantryActive: (localStorage.getItem('pantry_active')==='1') };

// Elements
const S = {
  search: document.getElementById('search'),
  sort: document.getElementById('sortBy'),
  grid: document.getElementById('grid'),
  sideStatus: document.getElementById('sideStatus'),
  relGraph: document.getElementById('relGraph')
};

function uniq(a){ return Array.from(new Set(a.filter(Boolean))); }

function buildCats(){
  const cats = uniq((DATASET.drinks||[]).map(d=>d.kategori)).sort((a,b)=>a.localeCompare(b,'sv'));
  const el = document.getElementById('catFilters'); if(!el) return; el.innerHTML='';
  cats.forEach(c=>{
    const lab=document.createElement('label'); lab.className='chip';
    const chk=document.createElement('input'); chk.type='checkbox'; chk.checked = true; chk.dataset.cat=c;
    chk.addEventListener('change', update);
    lab.append(chk, document.createTextNode(' '+c));
    el.appendChild(lab);
  });
}

function buildBases(){
  const bases = uniq((DATASET.drinks||[]).map(d=>d.sprit)).sort((a,b)=>a.localeCompare(b,'sv'));
  const el = document.getElementById('baseFilters'); if(!el) return; el.innerHTML='';
  bases.forEach(b=>{
    const lab=document.createElement('label'); lab.className='chip';
    const chk=document.createElement('input'); chk.type='checkbox'; chk.checked = true; chk.dataset.base=b;
    chk.addEventListener('change', update);
    lab.append(chk, document.createTextNode(' '+b));
    el.appendChild(lab);
  });
}

function buildPantry(){
  const bases = uniq((DATASET.drinks||[]).map(d=>d.sprit)).sort((a,b)=>a.localeCompare(b,'sv'));
  const el = document.getElementById('pantryFilters'); if(!el) return; el.innerHTML='';
  bases.forEach(b=>{
    const lab=document.createElement('label'); lab.className='chip';
    const chk=document.createElement('input'); chk.type='checkbox'; chk.checked = STATE.pantry.has(b);
    chk.addEventListener('change',()=>{ if(chk.checked) STATE.pantry.add(b); else STATE.pantry.delete(b); localStorage.setItem('pantry', JSON.stringify([...STATE.pantry])); update(); });
    lab.append(chk, document.createTextNode(' '+b));
    el.appendChild(lab);
  });
}

function filterList(list){
  const q = (S.search && S.search.value || '').toLowerCase();
  const enabledCats = new Set(Array.from(document.querySelectorAll('#catFilters input[type="checkbox"]')).filter(x=>x.checked).map(x=>x.dataset.cat));
  const enabledBases = new Set(Array.from(document.querySelectorAll('#baseFilters input[type="checkbox"]')).filter(x=>x.checked).map(x=>x.dataset.base));
  const pantryActive = STATE.pantryActive && STATE.pantry.size > 0;

  return list.filter(d=>{
    if (enabledCats.size && d.kategori && !enabledCats.has(d.kategori)) return false;
    if (enabledBases.size && d.sprit && !enabledBases.has(d.sprit)) return false;
    if (pantryActive && !STATE.pantry.has(d.sprit)) return false;
    const hay = [d.namn,d.sprit,d.kategori,d.teknik,d.glas].filter(Boolean).join(' ').toLowerCase();
    if (q && !hay.includes(q)) return false;
    return true;
  });
}

function groupAndSort(list, mode){
  const groupsMap = new Map();
  function add(k,d){ if(!groupsMap.has(k)) groupsMap.set(k,[]); groupsMap.get(k).push(d); }
  if (mode==='sprit'){
    list.sort((a,b)=> (a.sprit||'').localeCompare((b.sprit||''),'sv') || (a.namn||'').localeCompare((b.namn||''),'sv'));
    list.forEach(d=> add(d.sprit||'Annat', d));
  } else if (mode==='kategori'){
    list.sort((a,b)=> (a.kategori||'').localeCompare((b.kategori||''),'sv') || (a.namn||'').localeCompare((b.namn||''),'sv'));
    list.forEach(d=> add(d.kategori||'Övrigt', d));
  } else {
    list.sort((a,b)=> (a.namn||'').localeCompare((b.namn||''),'sv'));
    list.forEach(d=> add(((d.namn||'?')+'').trim().charAt(0).toUpperCase(), d));
  }
  return Array.from(groupsMap.entries()).map(([header,items])=>({header,items}));
}

function showDetail(dr){
  document.getElementById('d_title').textContent = dr.namn || '(okänt namn)';
  document.getElementById('d_meta').textContent = [dr.sprit, dr.kategori, dr.teknik, dr.glas].filter(Boolean).join(' • ');
  const ul=document.getElementById('d_ing'); ul.innerHTML='';
  (dr.ingredienser||[]).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.appendChild(li); });
  document.getElementById('d_instr').textContent = dr.instruktion || '';

  const alts=document.getElementById('d_alts'), blends=document.getElementById('d_blends'), req=document.getElementById('d_req');
  const rels=document.getElementById('d_rels'); const extra=document.getElementById('extra');
  const blendHdr=document.getElementById('blend_hdr'); const relHdr=document.getElementById('rel_hdr'); const reqHdr=document.getElementById('req_hdr');
  if(!alts||!blends||!req||!rels||!extra) return;
  alts.innerHTML=''; blends.innerHTML=''; req.innerHTML=''; rels.innerHTML='';
  let has=false;

  if(Array.isArray(dr.sprit_alternativ) && dr.sprit_alternativ.length){
    dr.sprit_alternativ.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; alts.appendChild(li); });
    has=true;
  }
  const bl=[].concat(dr.rom_blend||[]).concat(dr.sprit_blend||[]);
  if(bl.length){ bl.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; blends.appendChild(li); }); if(blendHdr) blendHdr.style.display=''; has=true; }
  else if(blendHdr) blendHdr.style.display='none';

  if(dr.krav){ const k=dr.krav, must=(k.stil||[]), opt=(k.tillval||[]);
    const rows=[]; if(k.bas) rows.push('Bas: '+k.bas); if(must.length) rows.push('Måste: '+must.join(', ')); if(opt.length) rows.push('Tillval: '+opt.join(', '));
    rows.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; req.appendChild(li); });
    if(reqHdr) reqHdr.style.display = rows.length? '' : 'none'; has = has || rows.length>0;
  } else if(reqHdr) reqHdr.style.display='none';

  const rel = (DATASET.relations||[]).filter(r=>r.from===dr.namn || r.to===dr.namn).map(r=>({other: r.from===dr.namn? r.to : r.from, text: (r.label||r.text||'')}));
  if(rel.length){ rel.forEach(o=>{ const li=document.createElement('li'); li.textContent = o.other + ' – ' + o.text; rels.appendChild(li); }); if(relHdr) relHdr.style.display=''; has=true; }
  else if(relHdr) relHdr.style.display='none';

  extra.style.display = has? '' : 'none';
}

function renderCards(){
  const grid=S.grid; if(!grid) return; grid.innerHTML='';
  const list=filterList((DATASET.drinks||[]).slice());
  const groups=groupAndSort(list, document.getElementById('sortBy').value);
  groups.forEach(g=>{
    const h=document.createElement('div'); h.className='groupHeader'; h.textContent=g.header; grid.appendChild(h);
    g.items.forEach(d=>{
      const card=document.createElement('div'); card.className='card'; card.tabIndex=0;
      card.innerHTML = '<h4>'+ (d.namn||'(okänt)') +'</h4>' +
        '<div class="tags">' +
          '<span class="tag">'+(d.sprit||'')+'</span>' +
          '<span class="tag">'+(d.kategori||'')+'</span>' +
          '<span class="tag">'+(d.teknik||'')+'</span>' +
          '<span class="tag">'+(d.glas||'')+'</span>' +
        '</div>';
      card.addEventListener('click', ()=>{ SELECTED=d; showDetail(d); document.getElementById('detail').scrollTop=0; });
      grid.appendChild(card);
    });
  });
  if(SELECTED){ showDetail(SELECTED); }
  const count = list.length;
  if(S.sideStatus) S.sideStatus.textContent = 'Visar '+count+' drinkar';
  const empty=document.getElementById('emptyMsg'); if(empty) empty.style.display = count? 'none':'block';
}

function renderRelations(){
  const cont = S.relGraph; if(!cont) return;
  const width = cont.clientWidth || 900;
  const height = cont.clientHeight || 700;
  cont.innerHTML='';

  if (typeof d3==='undefined'){
    cont.innerHTML='<div style="padding:10px;color:#9fb3d9">D3 kunde inte laddas.</div>';
    return;
  }

  const nodesMap = new Map();
  (DATASET.drinks||[]).forEach(d => { if(d && d.namn) nodesMap.set(d.namn,{id:d.namn}); });
  const links = (DATASET.relations||[]).map(l=>({source:l.from,target:l.to,label:(l.label||l.text||'')}))
    .filter(l=> nodesMap.has(l.source) && nodesMap.has(l.target));
  const nodes = Array.from(nodesMap.values());

  const STORE_KEY = 'rel_positions_v641';
  const saved = JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
  nodes.forEach(n=>{ if(saved[n.id]){ n.fx=saved[n.id].x; n.fy=saved[n.id].y; } });

  const svg = d3.select(cont).append('svg').attr('width',width).attr('height',height);
  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.4,2.5]).on('zoom',ev=>{ g.attr('transform',ev.transform); }));

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d=>d.id).distance(140).strength(0.7))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(width/2,height/2))
    .force('collide', d3.forceCollide().radius(d=>10+Math.min(30,(d.id||'').length*0.4)).iterations(2))
    .alpha(0.9).alphaDecay(0.04).velocityDecay(0.25);

  const link = g.append('g').attr('stroke','#6b7280').attr('stroke-opacity',0.7)
    .selectAll('line').data(links).enter().append('line').attr('stroke-width',1.2);

  const linkLabel = g.append('g').selectAll('text').data(links).enter()
    .append('text').attr('class','link-label').text(d=>d.label||'');

  const node = g.append('g').selectAll('g').data(nodes).enter().append('g').attr('class','node')
    .call(d3.drag().on('start',dragstarted).on('drag',dragged).on('end',dragended));

  node.append('circle').attr('r',10).attr('fill','#3b82f6');
  node.append('text').attr('x',12).attr('y',4).text(d=>d.id).attr('fill','#e6edf7').attr('font-size','12px');

  node.on('click',(e,d)=>{
    const drink=(DATASET.drinks||[]).find(x=>x.namn===d.id);
    if(drink){
      document.querySelector('input[name="view"][value="cards"]').checked=true;
      document.getElementById('cardsPane').style.display='';
      document.getElementById('relPane').style.display='none';
      SELECTED=drink; renderCards();
    }
  });

  simulation.on('tick',()=>{
    link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y)
        .attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    linkLabel.attr('x',d=>(d.source.x+d.target.x)/2+6)
             .attr('y',d=>(d.source.y+d.target.y)/2-6);
    node.attr('transform',d=>`translate(${d.x},${d.y})`);
  });

  function dragstarted(ev,d){ if(!ev.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }
  function dragged(ev,d){ d.fx=ev.x; d.fy=ev.y; }
  function dragended(ev,d){ if(!ev.active) simulation.alphaTarget(0);
    const s=JSON.parse(localStorage.getItem(STORE_KEY)||'{}'); s[d.id]={x:d.fx,y:d.fy}; localStorage.setItem(STORE_KEY,JSON.stringify(s)); }
}

function update(){ try{ renderCards(); }catch(e){ console.error('Render error:', e); const empty=document.getElementById('emptyMsg'); if(empty) empty.textContent='Fel vid rendering: '+e.message; if(empty) empty.style.display='block'; } }

function wireUI(){
  const sortSel = document.getElementById('sortBy');
  if(sortSel) sortSel.addEventListener('change', update);
  if(S.search) S.search.addEventListener('input', update);
  const toggle = document.getElementById('pantryActiveToggle');
  const clearBtn = document.getElementById('pantryClear');
  if (toggle){
    toggle.checked = !!STATE.pantryActive;
    toggle.addEventListener('change', ()=>{ STATE.pantryActive = toggle.checked; localStorage.setItem('pantry_active', STATE.pantryActive ? '1' : '0'); update(); });
  }
  if (clearBtn){
    clearBtn.addEventListener('click', ()=>{ STATE.pantry.clear(); localStorage.removeItem('pantry'); buildPantry(); update(); });
  }
  document.querySelectorAll('input[name="view"]').forEach(r=>{
    r.addEventListener('change', e=>{
      const v=e.target.value;
      if(v==='cards'){ document.getElementById('cardsPane').style.display=''; document.getElementById('relPane').style.display='none'; }
      else { document.getElementById('cardsPane').style.display='none'; document.getElementById('relPane').style.display=''; renderRelations(); }
    });
  });
}

function boot(){
  buildCats(); buildBases(); buildPantry(); wireUI(); update();
}

// Robust loader: fetch JSON, normalize, boot
(function(){
  function normalizeDataset(j){
    try{
      if (Array.isArray(j)) return {drinks: j, relations: []};
      if (j && Array.isArray(j.drinks)) return j;
      if (j && Array.isArray(j.recept)) return {drinks: j.recept, relations: (j.relations||[])};
      if (j && Array.isArray(j.list)) return {drinks: j.list, relations: []};
    }catch(e){}
    return {drinks: [], relations: []};
  }
  const DATA_URL = "drinkkompassen_v1.7.0.json";
  fetch(DATA_URL, {cache:'no-store'})
    .then(r => r.json())
    .then(json => { DATASET = normalizeDataset(json); boot(); })
    .catch(err => { console.warn('Fetch JSON misslyckades:', err); boot(); });
})();
