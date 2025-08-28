// State
let DATASET = {drinks:[], relations:[]};
const S = { grid:null, search:null, sort:null, sideStatus:null, relGraph:null };
let SELECTED = null;
const collator = new Intl.Collator('sv');
const diag = (m)=>{ const el=document.getElementById('diag'); if(el) el.textContent=m; };

document.addEventListener('DOMContentLoaded', ()=>{
  S.grid = document.getElementById('grid');
  S.search = document.getElementById('search');
  S.sort = document.getElementById('sortBy');
  S.sideStatus = document.getElementById('sideStatus');
  S.relGraph = document.getElementById('relGraph');
  bindUI();
  bootFromEmbeddedThenRefresh();
});

function bindUI(){
  S.search.addEventListener('input', update);
  S.sort.addEventListener('change', update);
  document.querySelectorAll('input[name="view"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      const v = document.querySelector('input[name="view"]:checked').value;
      document.getElementById('cardsPane').style.display = v==='cards'?'':'none';
      document.getElementById('relPane').style.display = v==='relations'?'':'none';
      if(v==='relations') renderRelations();
    });
  });
  const t=document.getElementById('pantryActiveToggle'); if(t) t.addEventListener('change', update);
  const c=document.getElementById('pantryClear'); if(c) c.addEventListener('click', ()=>{
    document.querySelectorAll('#pantryFilters input[type=checkbox]').forEach(cb=>cb.checked=false);
    update();
  });
}

function normalizeDataset(j){
  try{
    if (Array.isArray(j)) return {drinks:j, relations:[]};
    if (j && Array.isArray(j.drinks)) return j;
    if (j && Array.isArray(j.recept)) return {drinks:j.recept, relations:(j.relations||[])};
  }catch(e){}
  return {drinks:[], relations:[]};
}

function bootFromEmbedded(){
  try{
    const tag = document.getElementById('EMBED_JSON');
    const obj = JSON.parse(tag.textContent || '[]');
    DATASET = normalizeDataset(obj);
    boot();
    diag('Boot (offline): '+(DATASET.drinks||[]).length+' drinkar');
  }catch(e){ console.error('Embedded parse fail', e); diag('Embedded parse fail'); }
}

function bootFromEmbeddedThenRefresh(){
  bootFromEmbedded();
  fetch('drinkkompassen_v1.7.0.json?cb='+Date.now(), {cache:'no-store'})
    .then(r=>{ diag('Fetch '+r.status); return r.json(); })
    .then(json=>{
      const fresh = normalizeDataset(json);
      if((fresh.drinks||[]).length){
        DATASET = fresh; update();
        diag('Uppdaterad från fil: '+(DATASET.drinks||[]).length);
      }
    })
    .catch(e=>{ console.warn('Fetch misslyckades', e); diag('Fetch misslyckades – kör embedded'); });
}

function boot(){
  buildFilters();
  update();
}

function unique(list){ return Array.from(new Set(list)); }

function buildFilters(){
  const cats = unique(DATASET.drinks.map(d=>d.kategori).filter(Boolean)).sort(collator.compare);
  const bases= unique(DATASET.drinks.map(d=>d.sprit).filter(Boolean)).sort(collator.compare);

  const catBox = document.getElementById('catFilters'); if(catBox){ catBox.innerHTML='';
    cats.forEach(c=>{
      const lab=document.createElement('label'); lab.className='chip';
      lab.innerHTML=`<input type="checkbox" data-type="kategori" value="${c}"> ${c}`;
      lab.querySelector('input').addEventListener('change', update);
      catBox.appendChild(lab);
    });
  }
  const baseBox = document.getElementById('baseFilters'); if(baseBox){ baseBox.innerHTML='';
    bases.forEach(b=>{
      const lab=document.createElement('label'); lab.className='chip';
      lab.innerHTML=`<input type="checkbox" data-type="sprit" value="${b}"> ${b}`;
      lab.querySelector('input').addEventListener('change', update);
      baseBox.appendChild(lab);
    });
  }

  const pantryBox = document.getElementById('pantryFilters'); if(pantryBox){ pantryBox.innerHTML='';
    bases.forEach(b=>{
      const lab=document.createElement('label'); lab.className='chip';
      lab.innerHTML=`<input type="checkbox" data-type="pantry" value="${b}"> ${b}`;
      lab.querySelector('input').addEventListener('change', update);
      pantryBox.appendChild(lab);
    });
  }
}

function currentFilters(){
  const q = (S.search && S.search.value || '').toLowerCase();
  const cats = Array.from(document.querySelectorAll('#catFilters input:checked')).map(i=>i.value);
  const bases = Array.from(document.querySelectorAll('#baseFilters input:checked')).map(i=>i.value);
  const pantryOn = document.getElementById('pantryActiveToggle')?.checked;
  const pantry = Array.from(document.querySelectorAll('#pantryFilters input:checked')).map(i=>i.value);
  return {q,cats,bases,pantryOn,pantry};
}

function applyFilters(list){
  const {q,cats,bases,pantryOn,pantry} = currentFilters();
  let out = list.filter(d=>{
    if(q && !(d.namn||'').toLowerCase().includes(q)) return false;
    if(cats.length && !cats.includes(d.kategori)) return false;
    if(bases.length && !bases.includes(d.sprit)) return false;
    if(pantryOn && pantry && pantry.length && !pantry.includes(d.sprit)) return false;
    return true;
  });
  const sort = S.sort ? S.sort.value : 'namn';
  if(sort==='sprit'){
    out.sort((a,b)=>{
      const r = collator.compare(a.sprit||'', b.sprit||''); 
      return r!==0 ? r : collator.compare(a.namn||'', b.namn||'');
    });
  }else if(sort==='kategori'){
    out.sort((a,b)=>{
      const r = collator.compare(a.kategori||'', b.kategori||''); 
      return r!==0 ? r : collator.compare(a.namn||'', b.namn||'');
    });
  }else{
    out.sort((a,b)=> collator.compare(a.namn||'', b.namn||''));
  }
  return out;
}

function update(){
  const list = applyFilters(DATASET.drinks);
  renderCards(list);
  if(S.sideStatus) S.sideStatus.textContent = `Visar ${list.length} drinkar`;
}

function renderCards(list=DATASET.drinks){
  const g=S.grid; if(!g) return; g.innerHTML='';
  if(!list.length){ document.getElementById('emptyMsg').style.display=''; return; }
  document.getElementById('emptyMsg').style.display='none';
  list.forEach(d=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML = `<h4>${d.namn||'?'}</h4><div class="muted">${[d.sprit,d.kategori].filter(Boolean).join(' • ')}</div>`;
    card.addEventListener('click', ()=>{ SELECTED=d; showDetail(d); document.getElementById('detail').scrollTop=0; });
    g.appendChild(card);
  });
}

function showDetail(dr){
  document.getElementById('d_title').textContent = dr.namn || '(okänt namn)';
  document.getElementById('d_meta').textContent = [dr.sprit, dr.kategori, dr.teknik, dr.glas].filter(Boolean).join(' • ');
  const ul=document.getElementById('d_ing'); ul.innerHTML='';
  (dr.ingredienser||[]).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.appendChild(li); });
  document.getElementById('d_instr').textContent = dr.instruktion || '';

  const alts=document.getElementById('d_alts'),
        blends=document.getElementById('d_blends'),
        req=document.getElementById('d_req'),
        rels=document.getElementById('d_rels'),
        extra=document.getElementById('extra');
  const blendHdr=document.getElementById('blend_hdr'),
        relHdr=document.getElementById('rel_hdr'),
        reqHdr=document.getElementById('req_hdr');
  if(!alts||!blends||!req||!rels||!extra) return;
  alts.innerHTML=''; blends.innerHTML=''; req.innerHTML=''; rels.innerHTML='';
  let has=false;

  if(Array.isArray(dr.sprit_alternativ) && dr.sprit_alternativ.length){
    dr.sprit_alternativ.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; alts.appendChild(li); });
    has=true;
  }

  const bl=[].concat(dr.rom_blend||[]).concat(dr.sprit_blend||[]);
  if(bl.length){
    bl.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; blends.appendChild(li); });
    if(blendHdr) blendHdr.style.display='';
    has=true;
  } else if(blendHdr) blendHdr.style.display='none';

  if(dr.krav){
    const k=dr.krav, must=(k.stil||[]), opt=(k.tillval||[]);
    const rows=[]; if(k.bas) rows.push('Bas: '+k.bas); if(must.length) rows.push('Måste: '+must.join(', ')); if(opt.length) rows.push('Tillval: '+opt.join(', '));
    rows.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; req.appendChild(li); });
    if(reqHdr) reqHdr.style.display = rows.length? '' : 'none'; 
    has = has || rows.length>0;
  } else if(reqHdr) reqHdr.style.display='none';

  // Relaterade: endast ingredienser + instruktion, klickbart
  const relList = (DATASET.relations||[])
    .filter(r=>r.from===dr.namn || r.to===dr.namn)
    .map(r=>({ other: r.from===dr.namn? r.to : r.from, text: (r.label||r.text||'') }));

  if(relList.length){
    if(relHdr) relHdr.style.display='';
    relList.forEach(o=>{
      const match = (DATASET.drinks||[]).find(x=>x.namn===o.other);
      const wrap = document.createElement('div');
      wrap.className = 'related-card';
      wrap.style.cursor='pointer';

      const h = document.createElement('div');
      h.className = 'related-head';
      h.innerHTML = '<strong>'+ (match? match.namn : o.other) +'</strong>' + (o.text? ' <span class="rel-note">– '+o.text+'</span>' : '');
      wrap.appendChild(h);

      if(match){
        const ingHdr = document.createElement('div'); ingHdr.className='related-sub'; ingHdr.textContent='Ingredienser'; wrap.appendChild(ingHdr);
        const ing = document.createElement('ul'); ing.className='related-ul';
        (match.ingredienser||[]).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ing.appendChild(li); });
        wrap.appendChild(ing);

        const instrHdr = document.createElement('div'); instrHdr.className='related-sub'; instrHdr.textContent='Instruktion'; wrap.appendChild(instrHdr);
        const instr = document.createElement('div'); instr.className='related-instr'; instr.textContent = match.instruktion || ''; wrap.appendChild(instr);

        wrap.addEventListener('click',()=>{ SELECTED=match; showDetail(match); document.getElementById('detail').scrollTop=0; });
      } else {
        const miss = document.createElement('div'); miss.className='related-miss'; miss.textContent='(Recept saknas i datan)';
        wrap.appendChild(miss);
      }
      rels.appendChild(wrap);
    });
    has = true;
  } else {
    if(relHdr) relHdr.style.display='none';
  }

  extra.style.display = has? '' : 'none';
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
      SELECTED=drink; renderCards(applyFilters(DATASET.drinks)); showDetail(drink);
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
  function dragended(ev,d){ if(!ev.active) simulation.alphaTarget(0); }
}
