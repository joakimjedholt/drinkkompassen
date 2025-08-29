// ES5-only, split-filer, väljer AUTOMATISKT den JSON som har flest recept.
// Laddar aldrig "fel" 55-recept om en större finns. Inga embedded-data.
var DATASET = {drinks:[], relations:[]};
var S = { grid:null, search:null, sort:null, sideStatus:null, relGraph:null };
var SELECTED = null;
var collator = (typeof Intl!=='undefined' && Intl.Collator) ? new Intl.Collator('sv') : null;
function cmp(a,b){ a=a||''; b=b||''; if(collator){ return collator.compare(a,b); } if(a<b) return -1; if(a>b) return 1; return 0; }
function diag(m){ var el=document.getElementById('diag'); if(el) el.textContent=m; }

// Bas-specifika defaults
var ENRICH_BASE = {
  "Rom": {
    sprit_alternativ: [
      "Appleton Estate Signature (Jamaica)",
      "El Dorado 8 Year (Guyana)",
      "Worthy Park 109 (Jamaica)",
      "Smith & Cross (Jamaica)"
    ],
    rom_blend: [
      "Husblend: 1 del Appleton Signature + 1 del El Dorado 8 + 1 del Worthy Park 109",
      "Mjuk tiki: 1 del Appleton Signature + 1 del El Dorado 8",
      "Kraftig tiki: 1 del Appleton Signature + 1 del Worthy Park 109"
    ]
  },
  "Vodka": { sprit_alternativ: ["Absolut","Ketel One","Smirnoff No.21"] },
  "Gin": {
    sprit_alternativ: ["Beefeater","Tanqueray","Bombay Dry"],
    sprit_blend: ["Rundare stil: 2 delar London Dry + 1 del Old Tom (valfritt)"]
  },
  "Sherry": { sprit_alternativ: ["Lustau Fino Jarana","Lustau Amontillado Los Arcos","Tio Pepe Fino"] },
  "Vermut söt": { sprit_alternativ: ["Carpano Antica Formula","Cocchi Vermouth di Torino","Martini Rosso"] },
  "Vermut torr": { sprit_alternativ: ["Noilly Prat Dry","Dolin Dry","Martini Extra Dry"] },
  "Blue Curaçao": { sprit_alternativ: ["Bols Blue Curaçao","Giffard Curaçao Bleu"] }
};

// Per-recept overrides inkl stilkrav (kan byggas ut vidare)
var ENRICH_OVERRIDE = {
  "Adonis": {
    sprit_alternativ: [
      "Sherry: Lustau Amontillado / Fino (torr, nötig)",
      "Söt vermouth: Carpano Antica / Cocchi Vermouth di Torino",
      "Orange bitters: Angostura Orange / Regans' #6"
    ],
    sprit_blend: ["Sherry blend: 1 del Fino + 1 del Amontillado (balans)"],
    krav: { bas:"Aperitif låg-ABV", stil:["Rörs","Serveras 'up'"], tillval:["Apelsinzest","Orange bitters"] }
  },
  "Blue Lagoon": {
    sprit_alternativ: [
      "Vodka: Absolut / Ketel One",
      "Blue Curaçao: Bols / Giffard",
      "Lemonade: Fentimans — eller 2 delar Sprite + 1 del färsk citron"
    ],
    krav: { bas:"Highball", stil:["Byggs i glas med is"], tillval:["Citronhjul","Toppa med sodavatten"] }
  },
  "Bronx": {
    sprit_alternativ: [
      "Gin: Beefeater / Tanqueray / Bombay Dry",
      "Söt vermouth: Carpano Antica / Cocchi",
      "Torr vermouth: Noilly Prat Dry / Dolin Dry"
    ],
    sprit_blend: ["Valfritt: 2 delar London Dry + 1 del Old Tom (rundar av)"],
    krav: { bas:"Martini-familj", stil:["Skakas","Serveras 'up'"], tillval:["Apelsinzest"] }
  }
};

// Stilkrav per kategori/teknik – används om recept saknar egna krav
var DEFAULT_KRAV = {
  "Martini": {bas:"Martini-familj", stil:["Rörs eller skakas","Serveras 'up'"], tillval:["Zest/oliv"]},
  "Sour": {bas:"Sour", stil:["Skakas hårt","Sila till kylt glas"], tillval:["Äggvita (valfritt)"]},
  "Highball": {bas:"Highball", stil:["Byggs i glas med is"], tillval:["Citrongarnityr"]},
  "Tiki": {bas:"Tiki", stil:["Skakas/rörs","Krossad is ibland"], tillval:["Myntakvist","Angostura på toppen"]}
};

document.addEventListener('DOMContentLoaded', function(){
  S.grid = document.getElementById('grid');
  S.search = document.getElementById('search');
  S.sort = document.getElementById('sortBy');
  S.sideStatus = document.getElementById('sideStatus');
  S.relGraph = document.getElementById('relGraph');
  bindUI();
  loadBestData();
});

function bindUI(){
  if(S.search) S.search.addEventListener('input', update);
  if(S.sort) S.sort.addEventListener('change', update);
  var radios = document.querySelectorAll('input[name="view"]');
  for(var i=0;i<radios.length;i++){
    radios[i].addEventListener('change', function(){
      var v = document.querySelector('input[name="view"]:checked').value;
      document.getElementById('cardsPane').style.display = v==='cards'?'':'none';
      document.getElementById('relPane').style.display = v==='relations'?'':'none';
      if(v==='relations') renderRelations();
    });
  }
  var t=document.getElementById('pantryActiveToggle'); if(t) t.addEventListener('change', update);
  var c=document.getElementById('pantryClear'); if(c) c.addEventListener('click', function(){
    var boxes = document.querySelectorAll('#pantryFilters input[type=checkbox]');
    for(var i=0;i<boxes.length;i++){ boxes[i].checked=false; }
    update();
  });
}

function loadBestData(){
  var files = ["drinkkompassen_full.json","drinkkompassen_v1.7.0.json"];
  var promises = files.map(function(f){
    return fetch(f+'?cb='+(Date.now()), {cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){ return normalizeDataset(j); })
      .then(function(ds){ return {file:f, ds:ds, count:(ds.drinks||[]).length}; })
      .catch(function(){ return {file:f, ds:{drinks:[],relations:[]}, count:0}; });
  });

  Promise.all(promises).then(function(results){
    results.sort(function(a,b){ return b.count - a.count; });
    var best = results[0] || {file:"(ingen)", ds:{drinks:[],relations:[]}, count:0};
    var ds = enrichDataset(best.ds);
    DATASET = ds;
    boot();
    diag('Boot: '+ (DATASET.drinks||[]).length +' drinkar (fil: '+best.file+'), relationer: '+ (DATASET.relations||[]).length);
    if((DATASET.drinks||[]).length < 100){
      console.warn('Varning: färre än 100 recept hittades. Kontrollera att full JSON finns i katalogen.');
    }
  });
}

function normalizeDataset(j){
  try{
    if (Object.prototype.toString.call(j)==='[object Array]') return {drinks:j, relations:[]};
    if (j && Object.prototype.toString.call(j.drinks)==='[object Array]') return j;
    if (j && Object.prototype.toString.call(j.recept)==='[object Array]') return {drinks:j.recept, relations:(j.relations||[])};
  }catch(e){}
  return {drinks:[], relations:[]};
}

function enrichDataset(ds){
  if(!ds || !ds.drinks) return ds;
  for(var i=0;i<ds.drinks.length;i++){
    var d = ds.drinks[i];
    var o = ENRICH_OVERRIDE[d.namn];
    if(o){
      if(!d.sprit_alternativ || !d.sprit_alternativ.length) d.sprit_alternativ = (o.sprit_alternativ||[]).slice();
      if(!d.rom_blend && !d.sprit_blend){
        if(o.rom_blend) d.rom_blend = (o.rom_blend||[]).slice();
        if(o.sprit_blend) d.sprit_blend = (o.sprit_blend||[]).slice();
      }
      if(o.krav && !d.krav) d.krav = JSON.parse(JSON.stringify(o.krav));
    }
    var base = d.sprit || "";
    var def = ENRICH_BASE[base];
    if(def){
      if(!d.sprit_alternativ || !d.sprit_alternativ.length) d.sprit_alternativ = (def.sprit_alternativ || []).slice();
      if(base==="Rom"){
        if(!d.rom_blend || !d.rom_blend.length) d.rom_blend = (def.rom_blend || []).slice();
      } else {
        if(!d.sprit_blend || !d.sprit_blend.length) d.sprit_blend = (def.sprit_blend || []).slice();
      }
    }
    // Generiska stilkrav om saknas, baserat på kategori/teknik
    if(!d.krav){
      var k = DEFAULT_KRAV[d.kategori] || null;
      if(k) d.krav = JSON.parse(JSON.stringify(k));
    }
  }
  return ds;
}

function boot(){
  buildFilters();
  update();
}

function unique(list){
  var seen = {}; var out=[];
  for(var i=0;i<list.length;i++){ var v=list[i]; if(v && !seen[v]){ seen[v]=1; out.push(v); } }
  return out;
}

function buildFilters(){
  var cats = unique((DATASET.drinks||[]).map(function(d){return d.kategori;}).filter(Boolean)).sort(cmp);
  var bases= unique((DATASET.drinks||[]).map(function(d){return d.sprit;}).filter(Boolean)).sort(cmp);

  var catBox = document.getElementById('catFilters'); if(catBox){ catBox.innerHTML='';
    for(var i=0;i<cats.length;i++){ var c=cats[i];
      var lab=document.createElement('label'); lab.className='chip';
      lab.innerHTML='<input type="checkbox" data-type="kategori" value="'+c+'"> '+c;
      lab.querySelector('input').addEventListener('change', update);
      catBox.appendChild(lab);
    }
  }

  var baseBox = document.getElementById('baseFilters'); if(baseBox){ baseBox.innerHTML='';
    for(var j=0;j<bases.length;j++){ var b=bases[j];
      var lab2=document.createElement('label'); lab2.className='chip';
      lab2.innerHTML='<input type="checkbox" data-type="sprit" value="'+b+'"> '+b;
      lab2.querySelector('input').addEventListener('change', update);
      baseBox.appendChild(lab2);
    }
  }

  var pantryBox = document.getElementById('pantryFilters'); if(pantryBox){ pantryBox.innerHTML='';
    for(var k=0;k<bases.length;k++){ var p=bases[k];
      var lab3=document.createElement('label'); lab3.className='chip';
      lab3.innerHTML='<input type="checkbox" data-type="pantry" value="'+p+'"> '+p;
      lab3.querySelector('input').addEventListener('change', update);
      pantryBox.appendChild(lab3);
    }
  }
}

function currentFilters(){
  var q = (S.search && S.search.value || '').toLowerCase();
  var cats = Array.prototype.map.call(document.querySelectorAll('#catFilters input:checked'), function(i){return i.value;});
  var bases = Array.prototype.map.call(document.querySelectorAll('#baseFilters input:checked'), function(i){return i.value;});
  var t=document.getElementById('pantryActiveToggle'); var pantryOn = t && t.checked;
  var pantry = Array.prototype.map.call(document.querySelectorAll('#pantryFilters input:checked'), function(i){return i.value;});
  return {q:q,cats:cats,bases:bases,pantryOn:pantryOn,pantry:pantry};
}

function applyFilters(list){
  var f = currentFilters();
  var out = [];
  for(var i=0;i<list.length;i++){
    var d = list[i];
    if(f.q && String(d.namn||'').toLowerCase().indexOf(f.q)===-1) continue;
    if(f.cats.length && f.cats.indexOf(d.kategori)===-1) continue;
    if(f.bases.length && f.bases.indexOf(d.sprit)===-1) continue;
    if(f.pantryOn && f.pantry && f.pantry.length && f.pantry.indexOf(d.sprit)===-1) continue;
    out.push(d);
  }
  var sort = S.sort ? S.sort.value : 'namn';
  if(sort==='sprit'){
    out.sort(function(a,b){ var r = cmp(a.sprit||'', b.sprit||''); return r!==0 ? r : cmp(a.namn||'', b.namn||''); });
  }else if(sort==='kategori'){
    out.sort(function(a,b){ var r = cmp(a.kategori||'', b.kategori||''); return r!==0 ? r : cmp(a.namn||'', b.namn||''); });
  }else{
    out.sort(function(a,b){ return cmp(a.namn||'', b.namn||''); });
  }
  return out;
}

function update(){
  var list = applyFilters(DATASET.drinks);
  renderCards(list);
  if(S.sideStatus) S.sideStatus.textContent = 'Visar ' + list.length + ' drinkar';
}

function renderCards(list){
  if(!list) list = DATASET.drinks;
  var g=S.grid; if(!g) return; g.innerHTML='';
  var empty = document.getElementById('emptyMsg');
  if(!list.length){ if(empty) empty.style.display=''; return; }
  if(empty) empty.style.display='none';
  for(var i=0;i<list.length;i++){
    var d=list[i];
    var card=document.createElement('div'); card.className='card';
    card.innerHTML = '<h4>'+ (d.namn||'?') +'</h4><div class="muted">'+ [d.sprit,d.kategori].filter(Boolean).join(' • ') +'</div>';
    card.addEventListener('click', (function(dr){ return function(){ SELECTED=dr; showDetail(dr); document.getElementById('detail').scrollTop=0; }; })(d));
    g.appendChild(card);
  }
}

function showDetail(dr){
  document.getElementById('d_title').textContent = dr.namn || '(okänt namn)';
  document.getElementById('d_meta').textContent = [dr.sprit, dr.kategori, dr.teknik, dr.glas].filter(Boolean).join(' • ');
  var ul=document.getElementById('d_ing'); ul.innerHTML='';
  var ing = dr.ingredienser||[];
  for(var i=0;i<ing.length;i++){ var li=document.createElement('li'); li.textContent=ing[i]; ul.appendChild(li); }
  document.getElementById('d_instr').textContent = dr.instruktion || '';

  var alts=document.getElementById('d_alts'),
      blends=document.getElementById('d_blends'),
      req=document.getElementById('d_req'),
      rels=document.getElementById('d_rels'),
      extra=document.getElementById('extra');
  var blendHdr=document.getElementById('blend_hdr'),
      relHdr=document.getElementById('rel_hdr'),
      reqHdr=document.getElementById('req_hdr');
  if(!alts||!blends||!req||!rels||!extra) return;
  alts.innerHTML=''; blends.innerHTML=''; req.innerHTML=''; rels.innerHTML='';
  var has=false;

  if(dr.sprit_alternativ && dr.sprit_alternativ.length){
    for(var a=0;a<dr.sprit_alternativ.length;a++){ var li2=document.createElement('li'); li2.textContent=dr.sprit_alternativ[a]; alts.appendChild(li2); }
    has=true;
  } else {
    var li2=document.createElement('li'); li2.className='muted'; li2.textContent='(inga förslag ännu)'; alts.appendChild(li2);
  }

  var bl = [].concat(dr.rom_blend||[]).concat(dr.sprit_blend||[]);
  if(bl.length){
    for(var b=0;b<bl.length;b++){ var li3=document.createElement('li'); li3.textContent=bl[b]; blends.appendChild(li3); }
    if(blendHdr) blendHdr.style.display='';
    has=true;
  } else {
    if(blendHdr) blendHdr.style.display='';
    var li3=document.createElement('li'); li3.className='muted'; li3.textContent='(inga blend-förslag ännu)'; blends.appendChild(li3);
  }

  var rows=[];
  if(dr.krav){
    var k=dr.krav, must=(k.stil||[]), opt=(k.tillval||[]);
    if(k.bas) rows.push('Bas: '+k.bas);
    if(must.length) rows.push('Måste: '+must.join(', '));
    if(opt.length) rows.push('Tillval: '+opt.join(', '));
  }
  if(rows.length){
    for(var r=0;r<rows.length;r++){ var lr=document.createElement('li'); lr.textContent=rows[r]; req.appendChild(lr); }
    if(reqHdr) reqHdr.style.display='';
    has=true;
  } else {
    if(!dr.krav && DEFAULT_KRAV[dr.kategori]){
      var dk = DEFAULT_KRAV[dr.kategori];
      var tmp = [];
      if(dk.bas) tmp.push('Bas: '+dk.bas);
      if(dk.stil && dk.stil.length) tmp.push('Måste: '+dk.stil.join(', '));
      if(dk.tillval && dk.tillval.length) tmp.push('Tillval: '+dk.tillval.join(', '));
      for(var r2=0;r2<tmp.length;r2++){ var l2=document.createElement('li'); l2.textContent=tmp[r2]; req.appendChild(l2); }
      if(reqHdr) reqHdr.style.display='';
      has=true;
    }else{
      if(reqHdr) reqHdr.style.display='';
      var lr=document.createElement('li'); lr.className='muted'; lr.textContent='(inga stilkrav angivna)'; req.appendChild(lr);
    }
  }

  var relList = [];
  var relsAll = DATASET.relations||[];
  for(var i2=0;i2<relsAll.length;i2++){
    var rr = relsAll[i2];
    if(rr.from===dr.namn || rr.to===dr.namn){
      relList.push({ other: rr.from===dr.namn? rr.to : rr.from, text: (rr.label||rr.text||'') });
    }
  }
  if(relList.length){
    if(relHdr) relHdr.style.display='';
    for(var j=0;j<relList.length;j++){
      (function(o){
        var match = null;
        for(var m=0;m<(DATASET.drinks||[]).length;m++){ if(DATASET.drinks[m].namn===o.other){ match = DATASET.drinks[m]; break; } }
        var wrap = document.createElement('div'); wrap.className = 'related-card'; wrap.style.cursor='pointer';
        var h = document.createElement('div'); h.className = 'related-head';
        h.innerHTML = '<strong>'+ (match? match.namn : o.other) +'</strong>' + (o.text? ' <span class="rel-note">– '+o.text+'</span>' : '');
        wrap.appendChild(h);
        if(match){
          var ingHdr = document.createElement('div'); ingHdr.className='related-sub'; ingHdr.textContent='Ingredienser'; wrap.appendChild(ingHdr);
          var ing2 = document.createElement('ul'); ing2.className='related-ul';
          for(var ii=0; ii<(match.ingredienser||[]).length; ii++){ var li=document.createElement('li'); li.textContent=match.ingredienser[ii]; ing2.appendChild(li); }
          wrap.appendChild(ing2);
          var instrHdr = document.createElement('div'); instrHdr.className='related-sub'; instrHdr.textContent='Instruktion'; wrap.appendChild(instrHdr);
          var instr = document.createElement('div'); instr.className='related-instr'; instr.textContent = match.instruktion || ''; wrap.appendChild(instr);
          wrap.addEventListener('click', function(){ SELECTED=match; showDetail(match); document.getElementById('detail').scrollTop=0; });
        } else {
          var miss = document.createElement('div'); miss.className='related-miss'; miss.textContent='(Recept saknas i datan)';
          wrap.appendChild(miss);
        }
        rels.appendChild(wrap);
      })(relList[j]);
    }
    has=true;
  } else {
    if(relHdr) relHdr.style.display='none';
  }

  var extra=document.getElementById('extra');
  extra.style.display = has? '' : 'none';
}

function renderRelations(){
  var cont = S.relGraph; if(!cont) return;
  var width = cont.clientWidth || 900;
  var height = cont.clientHeight || 700;
  cont.innerHTML='';
  if (typeof d3==='undefined'){
    cont.innerHTML='<div style="padding:10px;color:#9fb3d9">Relationsvyn kräver D3 — kunde inte laddas. Kortvyn funkar.</div>';
    return;
  }
  var nodesMap = {};
  var ds = DATASET.drinks||[];
  for(var i=0;i<ds.length;i++){ var d=ds[i]; if(d && d.namn) nodesMap[d.namn]={id:d.namn}; }
  var rels = DATASET.relations||[];
  var links = [];
  for(var r=0;r<rels.length;r++){ var l=rels[r]; if(nodesMap[l.from] && nodesMap[l.to]) links.push({source:l.from,target:l.to,label:(l.label||l.text||'')}); }
  var nodes = Object.keys(nodesMap).map(function(k){return nodesMap[k];});

  var svg = d3.select(cont).append('svg').attr('width',width).attr('height',height);
  var g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.4,2.5]).on('zoom',function(ev){ g.attr('transform', ev.transform); }));

  var simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(function(d){return d.id;}).distance(140).strength(0.7))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(width/2,height/2))
    .force('collide', d3.forceCollide().radius(function(d){ return 10+Math.min(30,(String(d.id||'')).length*0.4); }).iterations(2))
    .alpha(0.9).alphaDecay(0.04).velocityDecay(0.25);

  var link = g.append('g').attr('stroke','#6b7280').attr('stroke-opacity',0.7)
    .selectAll('line').data(links).enter().append('line').attr('stroke-width',1.2);

  var linkLabel = g.append('g').selectAll('text').data(links).enter()
    .append('text').attr('class','link-label').text(function(d){return d.label||'';});

  var node = g.append('g').selectAll('g').data(nodes).enter().append('g').attr('class','node')
    .call(d3.drag().on('start',dragstarted).on('drag',dragged).on('end',dragended));

  node.append('circle').attr('r',10).attr('fill','#3b82f6');
  node.append('text').attr('x',12).attr('y',4).text(function(d){return d.id;}).attr('fill','#e6edf7').attr('font-size','12px');

  node.on('click',function(e, d){
    var drink=null; for(var i=0;i<(DATASET.drinks||[]).length;i++){ if(DATASET.drinks[i].namn===d.id){ drink=DATASET.drinks[i]; break; } }
    if(drink){
      document.querySelector('input[name="view"][value="cards"]').checked=true;
      document.getElementById('cardsPane').style.display='';
      document.getElementById('relPane').style.display='none';
      SELECTED=drink; renderCards(applyFilters(DATASET.drinks)); showDetail(drink);
    }
  });

  simulation.on('tick',function(){
    link.attr('x1',function(d){return d.source.x;}).attr('y1',function(d){return d.source.y;})
        .attr('x2',function(d){return d.target.x;}).attr('y2',function(d){return d.target.y;});
    linkLabel.attr('x',function(d){return (d.source.x+d.target.x)/2+6;}).attr('y',function(d){return (d.source.y+d.target.y)/2-6;});
    node.attr('transform',function(d){return 'translate('+d.x+','+d.y+')';});
  });

  function dragstarted(ev,d){ if(!ev.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }
  function dragged(ev,d){ d.fx=ev.x; d.fy=ev.y; }
  function dragended(ev,d){ if(!ev.active) simulation.alphaTarget(0); }
}
