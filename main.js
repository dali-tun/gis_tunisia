/*********************************************************************
 *  main.js – carte sombre, densité 0-200/201-1000/1001-6000/6001-15000/>15000,
 *            filtres, tableau foncé, histogrammes avec labels
 *********************************************************************/

/* anti double-init (utile en dev) */
if (L.DomUtil.get('map')?._leaflet_id)
  L.DomUtil.get('map')._leaflet_id = null;

/* ---------------------- 1. Utilitaires --------------------------- */
const ageMid = t => t === '80+' ? 82.5
  : (parseInt(t) + parseInt(t.split('-')[1])) / 2;

const sumMas = v => Number(v?.Masculin        ?? 0);
const sumFem = v => Number(v?.['F\u00e9minin'] ?? 0);

/* classification densité */
const palette = ['#ffffff', '#ffeb3b', '#4caf50', '#2196f3', '#f44336'];
const getColor = d =>
      d > 15000 ? palette[4] :
      d >  6000 ? palette[3] :
      d >  1000 ? palette[2] :
      d >   200 ? palette[1] : palette[0];

const classLabels = [
  {max:  200,    txt:'0 – 200',        col:palette[0]},
  {max: 1000,    txt:'201 – 1 000',    col:palette[1]},
  {max: 6000,    txt:'1 001 – 6 000',  col:palette[2]},
  {max: 15000,   txt:'6 001 – 15 000', col:palette[3]},
  {max: Infinity,txt:'> 15 000',       col:palette[4]},
];

/* ---------------------- 2. Chargement ---------------------------- */
fetch('recensement_secteur_2024.geojson')
  .then(r => r.json())
  .then(data => {

  /* -------- 2.1 Carte sombre ------------------------------------ */
  const map = L.map('map').setView([34, 9], 7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
              { attribution: '© OpenStreetMap / Carto' }).addTo(map);

  /* -------- 2.2 Légende densité --------------------------------- */
  const legend = L.control({ position: 'bottomleft' });

  legend.onAdd = () => {
    const d = L.DomUtil.create('div', 'info legend');
    d.style = 'background:#000a;color:#fff;padding:6px';
    d.innerHTML = '<b>Densité (hab./km²)</b><br>';
    classLabels.forEach(c => {
      d.innerHTML += `<span style="display:inline-block;width:14px;height:14px;
                       background:${c.col};border:1px solid #fff;margin-right:4px"></span>${c.txt}<br>`;
    });
    return d;
  };

  legend.addTo(map);

  /* -------- 2.3 Panneau info + résumé --------------------------- */
  const info = L.control();
  info.onAdd = () => (info._div = L.DomUtil.create('div','info'), info.update(), info._div);

  const summary = document.getElementById('summary');
  let densLine  = document.getElementById('densLine');
  if (!densLine) {
    densLine = document.createElement('strong'); densLine.id = 'densLine';
    summary.appendChild(document.createElement('br')); summary.appendChild(densLine);
  }

  const makeTable = pop => {
    let hT=0, fT=0, maxH=['',0], maxF=['',0];
    for (const tr in pop){
      const h=sumMas(pop[tr]), f=sumFem(pop[tr]);
      hT+=h; fT+=f;
      if (h>maxH[1]) maxH=[tr,h];
      if (f>maxF[1]) maxF=[tr,f];
    }
    const tot = hT + fT;
    let html  = '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html     += '<tr style="background:#006ce0;color:#fff"><th>Âge</th><th>👨</th><th>👩</th><th>%</th></tr>';
    for (const tr of Object.keys(pop).sort((a,b)=>+a-+b)){
      const h=sumMas(pop[tr]), f=sumFem(pop[tr]), pct=((h+f)/tot*100).toFixed(1)+'%';
      const stH = tr===maxH[0] ? 'background:#125e87;color:#fff' : '';
      const stF = tr===maxF[0] ? 'background:#a61f44;color:#fff' : '';
      html += `<tr style="background:#1e1e1e;color:#e0e0e0">
                <td>${tr}</td><td style="${stH}">${h}</td><td style="${stF}">${f}</td><td>${pct}</td></tr>`;
    }
    html += `<tr style="font-weight:bold;background:#333;color:#fff">
              <td>Total</td><td>${hT}</td><td>${fT}</td><td>100%</td></tr></table>`;
    return html;
  };

  info.update = p => {
    if (!p || !p.population) {
      info._div.innerHTML =
        '<h4 style="color:#fff">Secteur Information</h4><p style="color:#ccc">Survolez ou cliquez…</p>';
      densLine.textContent = 'Densité : —';
      return;
    }
    info._div.innerHTML = `
      <h4 style="color:#fff">${p.name_fr || p.NOM}</h4>
      <small style="color:#ccc">Délégation&nbsp;: ${p.NomDelegat || '—'}</small><br/>
      <small style="color:#ccc">Superficie&nbsp;: ${p.superficie} km²</small><br/>
      <small style="color:#ccc">Densité&nbsp;&nbsp;: ${p.densite} hab./km²</small><br/><br/>
      ${makeTable(p.population)}`;
    densLine.textContent = `Densité : ${p.densite} hab./km²`;
  };
  info.addTo(map);

  /* -------- 2.4 Histogrammes Chart.js --------------------------- */
  const ctxMale   = document.getElementById('maleChart'  ).getContext('2d');
  const ctxFemale = document.getElementById('femaleChart').getContext('2d');
  let maleChart=null, femaleChart=null;

  function drawCharts(props){
    const pop   = props.population,
          titre = props.name_fr || props.NOM,
          labels  = Object.keys(pop).sort((a,b)=>+a-+b),
          dataH   = labels.map(t=>sumMas(pop[t])),
          dataF   = labels.map(t=>sumFem(pop[t]));

    /* détruire anciens graphiques */
    if (maleChart)   maleChart.destroy();
    if (femaleChart) femaleChart.destroy();

    /* options génériques */
    const mkOptions = (lab,color,data,ctx) => new Chart(ctx,{
      type:'bar',
      data:{ labels, datasets:[{ label: lab, data, backgroundColor: color }] },
      plugins:[ChartDataLabels],
      options:{
        plugins:{
          title:{display:true,text:`${titre} – ${lab}`,color:'#fff',font:{size:16}},
          datalabels:{anchor:'end',align:'end',color:'#ccc',font:{size:10}},
          legend:{labels:{color:'#ccc'}}
        },
        scales:{
          x:{ticks:{color:'#ccc'},grid:{display:false}},
          y:{beginAtZero:true,ticks:{color:'#ccc'},grid:{color:'rgba(255,255,255,.1)'}}
        }
      }
    });

    maleChart   = mkOptions('Hommes', '#64b5f6', dataH, ctxMale);
    femaleChart = mkOptions('Femmes', '#f06292', dataF, ctxFemale);

    /* résumé chiffres */
    const totH = dataH.reduce((a,b)=>a+b,0),
          totF = dataF.reduce((a,b)=>a+b,0),
          total= totH + totF,
          ratio= (totH / totF).toFixed(2),
          avg  = (labels.reduce((s,t,i)=>s+ageMid(t)*(dataH[i]+dataF[i]),0)/total).toFixed(1);

    let cum=0, medB=labels[0];
    for (let i=0;i<labels.length;i++){ cum+=dataH[i]+dataF[i];
      if (cum>=total/2){ medB=labels[i]; break; } }
    const med = ageMid(medB).toFixed(1);

    document.getElementById('totalPop').textContent = `Population totale : ${total}`;
    document.getElementById('ratioHF' ).textContent = `Ratio H/F : ${ratio}`;
    document.getElementById('avgAge' ).textContent  = `Âge moyen : ${avg}`;
    document.getElementById('medAge' ).textContent  = `Âge médian : ${med}`;
  }

  /* -------- 2.5 GeoJSON densité -------------------------------- */
  const geo=L.geoJson(data,{
    style:f=>({fillColor:getColor(f.properties.densite),fillOpacity:.8,color:'#000',weight:1}),
    onEachFeature:(f,l)=>{
      l.options.inFilter=true;
      l.on({
        mouseover:()=>{if(l.options.inFilter) l.setStyle({weight:2});},
        mouseout :()=>{if(l.options.inFilter) l.setStyle({weight:1});},
        click    :()=>{info.update(f.properties); drawCharts(f.properties);}
      });
      l.bindTooltip(f.properties.name_fr||f.properties.NOM,
        {direction:'top',offset:[0,-15],className:'leaflet-tooltip-dark'});
    }
  }).addTo(map);

  /* -------- 2.6 Recherche -------------------------------------- */
  if (L.Control?.Search)
    new L.Control.Search({layer:geo,propertyName:'name_fr',
                          moveToLocation:ll=>map.setView(ll,12)}).addTo(map);

  /* -------- 2.7 Filtres exclusifs ------------------------------ */
  const sel=document.getElementById('ageFilter');
  const reset=document.getElementById('resetFilter');

  reset.onclick = () => {
    sel.value='';
    geo.eachLayer(l=>{l.options.inFilter=true; l.setStyle({fillOpacity:.8,opacity:1});});
  };

  sel.onchange = () => {
    const crit = sel.value;
    geo.eachLayer(l=>{
      const pop=l.feature.properties.population;
      const total=Object.values(pop).reduce((s,b)=>s+sumMas(b)+sumFem(b),0);
      const jeunes=['00-04','05-09','10-14','15-19','20-24','25-29','30-34','35-39']
        .reduce((s,t)=>s+sumMas(pop[t])+sumFem(pop[t]),0);
      const vieux  = total - jeunes;
      const femTot = Object.values(pop).reduce((s,b)=>s+sumFem(b),0);
      const homTot = total - femTot;

      let keep=true;
      switch(crit){
        case 'jeunes': keep = jeunes / total > 0.5; break;
        case 'vieux' : keep = vieux  / total > 0.5; break;
        case 'femmes': keep = femTot / total > 0.5; break;
        case 'hommes': keep = homTot / total > 0.5; break;
      }
      l.options.inFilter = keep;
      l.setStyle({fillOpacity: keep ? 0.8 : 0, opacity: keep ? 1 : 0});
    });
  };

});
