const DATA_URL="drinkkompassen_v1.7.0.json";
let DATA={drinks:[],relations:[]};
let filters={sprit:new Set(),kategori:new Set(),query:"",pantry:new Set(JSON.parse(localStorage.getItem("pantry")||"[]"))};
let selected=null;

/* Utils */
const uniq=arr=>Array.from(new Set(arr.filter(Boolean)));
const byName=(a,b)=> (a||"").localeCompare(b||"");

/* Sidebar as drawer on mobile */
const sidebar=document.getElementById("sidebar");
const overlay=document.getElementById("drawerOverlay");
const filterToggle=document.getElementById("filterToggle");
function useDrawerIfMobile(){
  if(window.matchMedia("(max-width:900px)").matches){
    sidebar.classList.add("drawer");
  }else{
    sidebar.classList.remove("drawer","open");
    overlay.classList.remove("show");
  }
}
function openDrawer(){sidebar.classList.add("open");overlay.classList.add("show");filterToggle?.setAttribute("aria-expanded","true");}
function closeDrawer(){sidebar.classList.remove("open");overlay.classList.remove("show");filterToggle?.setAttribute("aria-expanded","false");}
filterToggle?.addEventListener("click",()=>{ sidebar.classList.contains("open") ? closeDrawer() : openDrawer(); });
overlay.addEventListener("click",closeDrawer);
window.addEventListener("resize",useDrawerIfMobile);

/* Filters + pantry + status */
function renderFilters(){
  const bases=uniq(DATA.drinks.map(d=>d.sprit)).sort(byName);
  const cats=uniq(DATA.drinks.map(d=>d.kategori)).sort(byName);

  const baseBox=document.getElementById("baseFilters");
  const catBox=document.getElementById("catFilters");
  const pantryBox=document.getElementById("pantryFilters");
  baseBox.innerHTML="";catBox.innerHTML="";pantryBox.innerHTML="";
  filters.sprit.clear();filters.kategori.clear();

  bases.forEach(b=>{
    const id="b_"+b.replace(/\W+/g,"_");
    const wrap=document.createElement("label");
    wrap.className="chip";
    wrap.innerHTML=`<input type="checkbox" id="${id}" checked/> <span>${b}</span>`;
    baseBox.appendChild(wrap);
    filters.sprit.add(b);
    wrap.querySelector("input").addEventListener("change",e=>{
      if(e.target.checked) filters.sprit.add(b); else filters.sprit.delete(b);
      update();
    });
  });

  cats.forEach(c=>{
    const id="c_"+c.replace(/\W+/g,"_");
    const wrap=document.createElement("label");
    wrap.className="chip";
    wrap.innerHTML=`<input type="checkbox" id="${id}" checked/> <span>${c}</span>`;
    catBox.appendChild(wrap);
    filters.kategori.add(c);
    wrap.querySelector("input").addEventListener("change",e=>{
      if(e.target.checked) filters.kategori.add(c); else filters.kategori.delete(c);
      update();
    });
  });

  const persisted=new Set(filters.pantry);
  bases.forEach(b=>{
    const id="p_"+b.replace(/\W+/g,"_");
    const wrap=document.createElement("label");
    wrap.className="chip";
    const checked=persisted.has(b)?"checked":"";
    wrap.innerHTML=`<input type="checkbox" id="${id}" ${checked}/> <span>${b}</span>`;
    pantryBox.appendChild(wrap);
    wrap.querySelector("input").addEventListener("change",e=>{
      if(e.target.checked) filters.pantry.add(b); else filters.pantry.delete(b);
      localStorage.setItem("pantry", JSON.stringify(Array.from(filters.pantry)));
      update();
    });
  });

  document.getElementById("search").addEventListener("input",e=>{ filters.query=e.target.value; update(); });
}

/* Filter + status */
function filterList(list){
  const q=(filters.query||"").trim().toLowerCase();
  const out=list.filter(d=>{
    if(!filters.sprit.has(d.sprit)) return false;
    if(!filters.kategori.has(d.kategori)) return false;
    if(filters.pantry.size>0 && !filters.pantry.has(d.sprit)) return false;
    if(!q) return true;
    const hay=[d.namn,d.sprit,d.kategori,d.teknik||"",d.glas||""].join(" ").toLowerCase();
    return hay.includes(q);
  });
  const status=document.getElementById("statusLine");
  if(status) status.textContent=`${out.length} recept aktiva av ${DATA.drinks.length}`;
  return out;
}

/* Group + sort */
function groupAndSort(list, sortBy){
  const sorted=list.sort((a,b)=>byName(a[sortBy],b[sortBy]));
  const groups=[];
  const headerKey=(d)=> sortBy==="namn" ? ((d.namn||"").trim().charAt(0).toUpperCase()||"•") : (d[sortBy]||"—");
  let current=null;
  sorted.forEach(d=>{
    const key=headerKey(d);
    if(key!==current){ current=key; groups.push({header:key, items:[]}); }
    groups[groups.length-1].items.push(d);
  });
  return groups;
}

/* Cards */
function renderCards(){
  const sortBy=document.getElementById("sortBy").value;
  const grid=document.getElementById("grid");
  grid.innerHTML="";
  const list=filterList(DATA.drinks.slice());
  const groups=groupAndSort(list, sortBy);

  groups.forEach(g=>{
    const h=document.createElement("div"); h.className="groupHeader"; h.textContent=g.header; grid.appendChild(h);
    g.items.forEach(d=>{
      const card=document.createElement("div");
      card.className="card"; card.tabIndex=0;
      card.innerHTML=`<h4>${d.namn}</h4>
        <div class="tags">
          <span class="tag">${d.sprit||""}</span>
          <span class="tag">${d.kategori||""}</span>
          <span class="tag">${d.teknik||""}</span>
          <span class="tag">${d.glas||""}</span>
        </div>`;
      card.addEventListener("click",()=>{
        selected=d; renderDetail(); document.getElementById("detailPane").scrollTop=0;
        if(window.matchMedia("(max-width:900px)").matches){
          closeDrawer();
          document.getElementById("detailPane").scrollIntoView({behavior:"smooth", block:"start"});
        }
      });
      grid.appendChild(card);
    });
  });
}

/* Detail */
function renderDetail(){
  const box=document.getElementById("detailContent");
  const relBox=document.getElementById("relatedBox");
  if(!selected){ box.innerHTML='<span class="muted">Välj en drink i listan för att se receptet här.</span>'; relBox.innerHTML=""; return; }
  const d=selected;
  const tags=[`<span class="tag">${d.sprit||""}</span>`,`<span class="tag">${d.kategori||""}</span>`,`<span class="tag">${d.teknik||""}</span>`,`<span class="tag">${d.glas||""}</span>`].join(" ");
  const ing=(d.ingredienser||[]).map(x=>`<li>${x}</li>`).join("");
  box.innerHTML=`<div class="recipeBoxPrimary">
    <div class="recipeMeta">${tags}</div>
    <h4>${d.namn}</h4>
    <ul class="ing">${ing}</ul>
    <p class="instr">${d.instruktion||""}</p>
  </div>`;

  const rels=(DATA.relations||[]).filter(r=>r.from===d.namn||r.to===d.namn);
  const relNames=rels.map(r=>r.from===d.namn ? r.to : r.from);
  let relDrinks=DATA.drinks.filter(x=>relNames.includes(x.namn));
  if(filters.pantry.size>0) relDrinks = relDrinks.filter(x=>filters.pantry.has(x.sprit));

  relBox.innerHTML="";
  if(relDrinks.length===0){ relBox.innerHTML='<div class="muted">Inga relaterade drinkar matchar dina filter.</div>'; }
  relDrinks.forEach(rd=>{
    const rtags=[`<span class="tag">${rd.sprit||""}</span>`,`<span class="tag">${rd.kategori||""}</span>`,`<span class="tag">${rd.teknik||""}</span>`,`<span class="tag">${rd.glas||""}</span>`].join(" ");
    const ring=(rd.ingredienser||[]).map(x=>`<li>${x}</li>`).join("");
    const div=document.createElement("div");
    div.className="recipeBoxSecondary";
    div.innerHTML=`<h4>${rd.namn}</h4><div class="recipeMeta">${rtags}</div><ul class="ing">${ring}</ul><p class="instr">${rd.instruktion||""}</p>`;
    div.addEventListener("click",()=>{ selected=rd; renderDetail(); document.getElementById("detailPane").scrollTop=0; });
    relBox.appendChild(div);
  });
}

/* Relations graph */
function renderRelGraph(){
  const svg=d3.select("#graph"); svg.selectAll("*").remove();
  const width=svg.node().clientWidth, height=svg.node().clientHeight;
  const visNodes=filterList(DATA.drinks).map(d=>({id:d.namn,group:d.kategori,sprit:d.sprit}));
  const idMap=new Map(visNodes.map(n=>[n.id,n]));
  const visLinks=(DATA.relations||[]).map(l=>({source:idMap.get(l.from),target:idMap.get(l.to),label:l.label||""})).filter(l=>l.source&&l.target);
  const g=svg.append("g");
  const link=g.append("g").selectAll("line").data(visLinks).enter().append("line").attr("class","link").attr("stroke-width",1.2);
  const labelLayer=g.append("g").selectAll("text").data(visLinks).enter().append("text").attr("class","edge-label").text(d=>d.label);
  const node=g.append("g").selectAll(".node").data(visNodes).enter().append("g").attr("class","node")
    .call(d3.drag().on("start",dragstarted).on("drag",dragged).on("end",dragended));
  node.append("circle").attr("r",10);
  node.append("text").attr("x",12).attr("y",3).text(d=>d.id);
  const zoom=d3.zoom().on("zoom",(event)=>g.attr("transform",event.transform)); svg.call(zoom);
  const simulation=d3.forceSimulation(visNodes)
    .force("link", d3.forceLink(visLinks).distance(60).strength(0.3))
    .force("charge", d3.forceManyBody().strength(-90))
    .force("center", d3.forceCenter(width/2, height/2))
    .force("collision", d3.forceCollide().radius(18));
  simulation.tick(200);
  simulation.on("tick", ()=>{
    link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
    node.attr("transform", d=>`translate(${d.x},${d.y})`);
    labelLayer.attr("x", d=>(d.source.x+d.target.x)/2).attr("y", d=>(d.source.y+d.target.y)/2);
  });
  function dragstarted(event,d){ if(!event.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }
  function dragged(event,d){ d.fx=event.x; d.fy=event.y; }
  function dragended(event,d){ d.fx=event.x; d.fy=event.y; if(!event.active) simulation.alphaTarget(0); }
}

/* View switch & updates */
function update(){
  const inCards = document.getElementById("tabCards").classList.contains("active");
  if(inCards){ document.getElementById("cardsPane").style.display=""; document.getElementById("relPane").style.display="none"; renderCards(); renderDetail(); }
  else{ document.getElementById("cardsPane").style.display="none"; document.getElementById("relPane").style.display=""; renderRelGraph(); }
}

document.getElementById("sortBy").addEventListener("change", update);
document.getElementById("tabCards").addEventListener("click",()=>{
  document.getElementById("tabCards").classList.add("active");
  document.getElementById("tabRel").classList.remove("active");
  update();
});
document.getElementById("tabRel").addEventListener("click",()=>{
  document.getElementById("tabRel").classList.add("active");
  document.getElementById("tabCards").classList.remove("active");
  update();
});

/* Init */
function init(){ useDrawerIfMobile(); renderFilters(); update(); }
fetch(DATA_URL,{cache:"no-store"}).then(r=>r.json()).then(json=>{ DATA=json; init(); })
.catch(err=>{ console.error(err); const s=document.getElementById("statusLine"); if(s) s.textContent="Fel vid laddning av data."; });
