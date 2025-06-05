/*********************************************************************
 * main.js — coloration double : densité OU âge médian
 * densité : 0-200 / 201-1000 / 1001-6000 / 6001-15000 / >15000
 * âge médian : <30 (vert) / 30-45 (bleu) / >45 (rouge)
 * secteurs sans données : gris
 *********************************************************************/

/* éviter double-init en dev */
if (L.DomUtil.get('map')?._leaflet_id)
  L.DomUtil.get('map')._leaflet_id = null;

/* ─── 1.  helpers démographiques ──────────────────────────────── */
const ageMid = t => t === '80+' ? 82.5
  : (parseInt(t) + parseInt(t.split('-')[1])) / 2;

const sumMas = v => Number(v?.Masculin        ?? 0);
const sumFem = v => Number(v?.['F\u00e9minin'] ?? 0);

/* ─── 2.  palettes & classes couleur ──────────────────────────── */
const pal = { white:'#ffffff', yellow:'#ffeb3b', green:'#4caf50',
              blue :'#2196f3', red:'#f44336',   grey:'#888888' };

const densityClasses = [
  { max:   200,   col: pal.white,  lab:'0 – 200'       },
  { max:  1000,   col: pal.yellow, lab:'201 – 1 000'   },
  { max:  6000,   col: pal.green,  lab:'1 001 – 6 000' },
  { max: 15000,   col: pal.blue,   lab:'6 001 – 15 000'},
  { max: Infinity,col: pal.red,    lab:'> 15 000'      }
];

const ageClasses = [
  { max: 29.999,  col: '#00c0ff',  lab:'< 35'   },
  { max: 45,      col: '#fdb72a',   lab:'35 – 45'},
  { max: Infinity,col: '#de425b',    lab:'> 45'   }
];


const colorBy = (v, classes) => classes.find(c => v <= c.max).col;

/* ─── 3.  chargement des données ───────────────────────────────── */
fetch('recensement_secteur_2024.geojson')
  .then(r => r.json())
  .then(data => {

  /* 3.1  calcule l’âge médian pour chaque secteur */
  data.features.forEach(f => {
    const pop = f.properties?.population;
    if (!pop) { f.properties.medAge = null; return; }

    const bands  = Object.keys(pop).sort((a,b)=>+a-+b);
    const counts = bands.map(b=>sumMas(pop[b])+sumFem(pop[b]));
    const total  = counts.reduce((a,b)=>a+b,0);
    if (!total) { f.properties.medAge = null; return; }

    let cum=0, medBand=bands[0];
    for (let i=0;i<bands.length;i++){
      cum += counts[i];
      if (cum >= total/2){ medBand=bands[i]; break; }
    }
    f.properties.medAge = +ageMid(medBand).toFixed(1);
  });

  let currentMode = 'density';   /* densité (par défaut) ou medAge */

  /* ─── 4.  carte sombre ───────────────────────────────────────── */
  const map=L.map('map').setView([34,9],7);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {attribution:'© OpenStreetMap / Carto'}
  ).addTo(map);

  /* ─── 5.  légende dynamique ─────────────────────────────────── */
  const legend=L.control({position:'bottomleft'});
  legend.onAdd=()=>L.DomUtil.create('div','info legend');
  legend.addTo(map);

  const updateLegend = () => {
    const box  = legend.getContainer();
    const cls  = currentMode==='density' ? densityClasses : ageClasses;
    const head = currentMode==='density' ? 'Densité (hab./km²)' : 'Âge médian';
    box.style='background:#000a;color:#fff;padding:6px';
    box.innerHTML=`<b>${head}</b><br>`;
    cls.forEach(c=>{
      box.innerHTML += `<span style="display:inline-block;width:14px;height:14px;
                       background:${c.col};border:1px solid #fff;margin-right:4px"></span>${c.lab}<br>`;
    });
  };

  /* ─── 6.  style des polygones ───────────────────────────────── */
  const styleFeature = f => {
    if (currentMode==='density'){
      const dens=f.properties.densite ?? 0;
      return {fillColor:colorBy(dens,densityClasses),
              fillOpacity:.8,color:'#000',weight:1};
    }
    const med=f.properties.medAge;
    return {fillColor: med==null ? pal.grey : colorBy(med,ageClasses),
            fillOpacity:.8,color:'#000',weight:1};
  };

  /* ─── 7.  panneau info ─────────────────────────────────────── */
  const info=L.control();
  info.onAdd=()=> (info._div=L.DomUtil.create('div','info'),info.update(),info._div);

  const summary=document.getElementById('summary');
  const densLine=document.getElementById('densLine');

  const buildTable = pop => {
    let hT=0,fT=0,maxH=['',0],maxF=['',0];
    for(const band in pop){
      const h=sumMas(pop[band]), f=sumFem(pop[band]);
      hT+=h; fT+=f;
      if(h>maxH[1]) maxH=[band,h];
      if(f>maxF[1]) maxF=[band,f];
    }
    const tot=hT+fT;
    let html='<table style="width:100%;border-collapse:collapse;font-size:12px">'
            +'<tr style="background:#006ce0;color:#fff"><th>Âge</th><th>👨</th><th>👩</th><th>%</th></tr>';
    for(const band of Object.keys(pop).sort((a,b)=>+a-+b)){
      const h=sumMas(pop[band]), f=sumFem(pop[band]),
            pct=((h+f)/tot*100).toFixed(1)+'%',
            stH=band===maxH[0]?'background:#125e87;color:#fff':'',
            stF=band===maxF[0]?'background:#a61f44;color:#fff':'';
      html+=`<tr style="background:#1e1e1e;color:#e0e0e0">
               <td>${band}</td><td style="${stH}">${h}</td><td style="${stF}">${f}</td><td>${pct}</td></tr>`;
    }
    html+=`<tr style="font-weight:bold;background:#333;color:#fff"><td>Total</td><td>${hT}</td><td>${fT}</td><td>100%</td></tr></table>`;
    return html;
  };

  info.update = p => {
    if(!p||!p.population){
      info._div.innerHTML='<h4 style="color:#fff">Secteur</h4><p style="color:#ccc">Survolez ou cliquez…</p>';
      densLine.textContent='Densité : —'; return;
    }
    info._div.innerHTML=`
      <h4 style="color:#fff">${p.name_fr||p.NOM}</h4>
      <small style="color:#ccc">Délégation : ${p.NomDelegat||'—'}</small><br/>
      <small style="color:#ccc">Superficie : ${p.superficie} km²</small><br/>
      <small style="color:#ccc">Densité   : ${p.densite} hab./km²</small><br/>
      <small style="color:#ccc">Âge médian : ${p.medAge??'—'}</small><br/><br/>
      ${buildTable(p.population)}`;
    densLine.textContent=`Densité : ${p.densite} hab./km²`;
  };
  info.addTo(map);

  /* ─── 8.  graphiques Chart.js (identiques à avant) ──────────── */
  const ctxM=document.getElementById('maleChart').getContext('2d');
  const ctxF=document.getElementById('femaleChart').getContext('2d');
  let chartM=null,chartF=null;

  const mkChart=(lab,col,data,labels,ctx,titre)=>new Chart(ctx,{
    type:'bar',
    data:{labels,datasets:[{label:lab,data,backgroundColor:col}]},
    plugins:[ChartDataLabels],
    options:{
      plugins:{title:{display:true,text:`${titre} – ${lab}`,color:'#fff',font:{size:16}},
               datalabels:{anchor:'end',align:'end',color:'#ccc',font:{size:10}},
               legend:{labels:{color:'#ccc'}}},
      scales:{x:{ticks:{color:'#ccc'},grid:{display:false}},
              y:{beginAtZero:true,ticks:{color:'#ccc'},grid:{color:'rgba(255,255,255,.1)'}}}
    }
  });

  function drawCharts(props){
    const pop=props.population, bands=Object.keys(pop).sort((a,b)=>+a-+b);
    const dH=bands.map(b=>sumMas(pop[b])), dF=bands.map(b=>sumFem(pop[b]));
    if(chartM){chartM.destroy(); chartF.destroy();}
    chartM=mkChart('Hommes','#64b5f6',dH,bands,ctxM,props.name_fr||props.NOM);
    chartF=mkChart('Femmes','#f06292',dF,bands,ctxF,props.name_fr||props.NOM);

    /* résumé */
    const totH=dH.reduce((a,b)=>a+b,0), totF=dF.reduce((a,b)=>a+b,0), tot=totH+totF;
    document.getElementById('totalPop').textContent=`Population totale : ${tot}`;
    document.getElementById('ratioHF' ).textContent=`Ratio H/F : ${(totH/totF).toFixed(2)}`;
    const avg=(bands.reduce((s,b,i)=>s+ageMid(b)*(dH[i]+dF[i]),0)/tot).toFixed(1);
    document.getElementById('avgAge').textContent=`Âge moyen : ${avg}`;
    let cum=0, medBand=bands[0];
    for(let i=0;i<bands.length;i++){cum+=dH[i]+dF[i]; if(cum>=tot/2){medBand=bands[i];break;}}
    document.getElementById('medAge').textContent=`Âge médian : ${ageMid(medBand).toFixed(1)}`;
  }

  /* ─── 9.  GeoJSON densité/âge médian ───────────────────────── */
  const geo=L.geoJson(data,{
    style:styleFeature,
    onEachFeature:(f,l)=>{
      l.options.inFilter=true;
      l.on({
        mouseover:()=>{if(l.options.inFilter)l.setStyle({weight:2});},
        mouseout :()=>{if(l.options.inFilter)l.setStyle({weight:1});},
        click    :()=>{info.update(f.properties);drawCharts(f.properties);}
      });
      l.bindTooltip(f.properties.name_fr||f.properties.NOM,
                   {direction:'top',offset:[0,-15],className:'leaflet-tooltip-dark'});
    }
  }).addTo(map);

  /* recherche */
  if(L.Control?.Search)
    new L.Control.Search({layer:geo,propertyName:'name_fr',
                          moveToLocation:ll=>map.setView(ll,12)}).addTo(map);

  /* filtres exclusifs (inchangé) -------------------------------- */
  const sel=document.getElementById('ageFilter'),
        reset=document.getElementById('resetFilter');
  reset.onclick=()=>{sel.value='';geo.eachLayer(l=>{l.options.inFilter=true;l.setStyle({fillOpacity:.8,opacity:1});});};
  sel.onchange=()=>{
    const crit=sel.value;
    geo.eachLayer(l=>{
      const pop=l.feature.properties.population;
      const total=Object.values(pop).reduce((s,b)=>s+sumMas(b)+sumFem(b),0);
      const jeunes=['00-04','05-09','10-14','15-19','20-24','25-29','30-34','35-39']
        .reduce((s,b)=>s+sumMas(pop[b])+sumFem(pop[b]),0);
      const vieux=total-jeunes;
      const femTot=Object.values(pop).reduce((s,b)=>s+sumFem(b),0);
      const homTot=total-femTot;
      let keep=true;
      switch(crit){
        case'jeunes':keep=jeunes/total>0.5;break;
        case'vieux' :keep=vieux /total>0.5;break;
        case'femmes':keep=femTot/total>0.5;break;
        case'hommes':keep=homTot/total>0.5;break;
      }
      l.options.inFilter=keep;
      l.setStyle({fillOpacity:keep?0.8:0,opacity:keep?1:0});
    });
  };

  /* ─── 10. menu coul. densité / âge médian ───────────────────── */
  document.getElementById('colorMode').onchange = e => {
    currentMode = e.target.value;      // 'density' ou 'avgAge'
    updateLegend();
    geo.eachLayer(l=>l.setStyle(styleFeature(l.feature)));
  };
  updateLegend();   // première génération
});
