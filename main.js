/********************************************************************
 * main.js — v2025-06
 *  - Palette de couleurs améliorée avec détection des nuances
 *  - Classes de densité optimisées pour une meilleure répartition
 *  - Légendes plus explicatives avec informations supplémentaires
 *  - Histogrammes et tableaux ergonomiques
 *  - Design global amélioré
 ********************************************************************/

/* ═════ 0. utilitaires ═════ */
const female = v => Number(v?.['F\u00e9minin'] ?? v?.Feminin ?? v?.Female ?? v?.F ?? 0);
const male   = v => Number(v?.Masculin ?? v?.Male ?? v?.M ?? 0);
const safe   = (v,n=1)=>Number.isFinite(v)?(+v).toFixed(n):'n/a';
const lighten=(h,a=40)=>{const n=parseInt(h.slice(1),16),c=t=>Math.max(0,Math.min(255,t));
  const r=c((n>>16)+a),g=c(((n>>8)&255)+a),b=c((n&255)+a);
  return`#${(1<<24|r<<16|g<<8|b).toString(16).slice(1)}`;};
const ageMid=b=>!b?null:b.includes('+')?+b.replace('+',''):
 (+b.split(/[^0-9]/)[0] + +b.split(/[^0-9]/)[1]) / 2;

/* palettes améliorées avec nuances perceptibles */
const palAge=['#00c4ff','#5fcfff','#9edadf','#e1d9bf'];
const palDen=['#f7fbff','#c6dbef','#6baed6','#2171b5','#08306b'];
const grey='#8a8a8a';

/* ═════ 1. état ═════ */
let level='gov',mode='density',densCls=[],selected=null;
const colAge=v=>palAge[Math.min(3,Math.floor((v-20)/10))];
const colDen=v=>(densCls.find(c=>v<=c.max)||densCls.at(-1)).col;
const styleOf=(f,top)=>{const v=mode==='density'?f.properties.DENSITY:f.properties.MED_AGE;
  return{fillColor:Number.isFinite(v)?(mode==='density'?colDen(v):colAge(v)):grey,
         fillOpacity:top?0.85:0.9,color:top?'#000':'#fff',weight:top?1:0.5};};

/* ═════ 2. chargement ═════ */
const FILE={
  gov:'governorates.geojson',
  del:'delegation.geojson',
  sec:'secteurs.geojson'
};

// Stocker les données globalement
let globalGov, globalDel, globalSec;

Promise.all(Object.values(FILE).map(f=>fetch(f).then(r=>r.json())))
       .then(([gov,del,sec])=>{
         [gov,del,sec].forEach(norm);
         // Stocker les données dans des variables globales
         globalGov = gov;
         globalDel = del;
         globalSec = sec;
         densCls=mkDens(gov.features);
         buildUI(gov,del,sec);
       });

/* ═════ 3. parsing flexible (idem version précédente) ═════ */
function merge(out,band,sex,val){
  if(band&&Number.isFinite(+val))(out[band]=out[band]||{})[sex]=(out[band][sex]||0)+ +val;
}
function parseDist(src){
  const o={}; const blk=b=>{if(!b)return;Object.entries(b).forEach(([bd,x])=>{
    merge(o,bd,'Masculin',male(x));merge(o,bd,'F\u00e9minin',female(x));});};
  if(src.population_dict)try{blk(typeof src.population_dict==='string'?JSON.parse(src.population_dict):src.population_dict);}catch{}
  if(src.population)blk(src.population);
  for(const[k,v]of Object.entries(src)){if(!Number.isFinite(+v))continue;
    const g=k.match(/(male|female).*?(\\d{1,2}).*?(\\d{2})/i);if(g){merge(o,`${g[2].padStart(2,'0')}-${g[3]}`,/fem/i.test(g[1])?'F\u00e9minin':'Masculin',+v);continue;}
    const a=k.match(/age[._-](\\d{1,2})[._-](\\d{2})/i); if(a){merge(o,`${a[1].padStart(2,'0')}-${a[2]}`,'Masculin',+v);continue;}
    const b=k.match(/(\\d{1,2})[._-]?(\\d{2})?(\\+)?[._-]*(M|F)$/i);
    if(b){merge(o,b[3]?`${b[1]}+`:`${b[1].padStart(2,'0')}-${b[2]}`,/f/i.test(b[4])?'F\u00e9minin':'Masculin',+v);}
  }
  return Object.keys(o).length?o:null;
}
function norm(fc){
  const RX=/^name_|deleg_|gouv_|nom|libell/i,RX_A=/sup|surface|area|shape|km/i,RX_P=/pop.*tot/i,RX_D=/dens/i;
  fc.features.forEach(ft=>{
    const p=ft.properties;
    p.LABEL=p.NAME_EN||p.deleg_na_1||p.name_fr||(Object.keys(p).find(k=>RX.test(k))&&p[Object.keys(p).find(k=>RX.test(k))])||'—';
    p.AREA=+p.AREA||+Object.entries(p).find(([k,v])=>RX_A.test(k)&&Number.isFinite(+v))?.[1]||0;
    p.DIST=parseDist(p)||{};
    p.POPTOT=+p.POPTOT||+Object.entries(p).find(([k,v])=>RX_P.test(k)&&Number.isFinite(+v))?.[1]
            ||Object.values(p.DIST).reduce((s,b)=>s+male(b)+female(b),0);
    p.DENSITY=+p.DENSITY||+Object.entries(p).find(([k,v])=>RX_D.test(k)&&Number.isFinite(+v))?.[1]||(p.AREA?p.POPTOT/p.AREA:null);
    if(!Number.isFinite(p.MED_AGE)&&Object.keys(p.DIST).length){
      const ord=Object.keys(p.DIST).sort((a,b)=>+a.replace('+','')-+b.replace('+','')),
            cnt=ord.map(b=>male(p.DIST[b])+female(p.DIST[b])),tot=cnt.reduce((a,b)=>a+b,0);
      let cum=0,band=ord[0];for(let i=0;i<cnt.length;i++){cum+=cnt[i];if(cum>=tot/2){band=ord[i];break;}}
      p.MED_AGE=ageMid(band);
    }
  });
}

/* ===== densité classes améliorées ===== */
function mkDens(f){
  const values = f.map(x => x.properties.DENSITY).filter(n => n > 0).sort((a, b) => a - b);
  if(!values.length) return [{min:0, max:1e12, col:palDen[2], lab:'—', desc: 'Aucune donnée'}];
  
  // Calcul des breaks naturels avec l'algorithme de Jenks
  const jenksBreaks = (data, numClass) => {
    data = data.slice().sort((a, b) => a - b);
    const mat = Array.from({length: data.length + 1}, () => Array(numClass + 1).fill(0));
    const lowerClassLimits = Array.from({length: data.length + 1}, () => Array(numClass + 1).fill(0));
    
    for(let i = 1; i <= numClass; i++) {
      mat[1][i] = 1;
      mat[2][i] = 1;
      for(let j = 3; j <= data.length; j++) {
        mat[j][i] = Infinity;
      }
    }
    
    let variance = 0;
    for(let l = 2; l <= data.length; l++) {
      let s1 = 0, s2 = 0, w = 0;
      for(let m = 1; m <= l; m++) {
        const lower = l - m + 1;
        const val = data[lower - 1];
        s2 += val * val;
        s1 += val;
        w++;
        variance = s2 - (s1 * s1) / w;
        let i4;
        if(lower === 1) {
          mat[l][1] = variance;
        } else {
          for(let j = 2; j <= numClass; j++) {
            if(mat[l][j] >= (variance + mat[lower - 1][j - 1])) {
              mat[l][j] = variance + mat[lower - 1][j - 1];
              lowerClassLimits[l][j] = lower;
            }
          }
        }
      }
      mat[l][1] = variance;
    }
    
    const breaks = [];
    let k = data.length;
    for(let j = numClass; j >= 1; j--) {
      const id = lowerClassLimits[k][j] - 1;
      breaks.push(data[id]);
      k = lowerClassLimits[k][j] - 1;
      if(k < 0) break;
    }
    breaks.push(data[0]);
    breaks.sort((a, b) => a - b);
    return breaks;
  };
  
  const breaks = jenksBreaks(values, 5);
  return [
    {min: 0, max: breaks[1], col: palDen[0], lab: `Très faible (≤ ${Math.round(breaks[1])})`, desc: 'Zones peu denses'},
    {min: breaks[1], max: breaks[2], col: palDen[1], lab: `Faible (${Math.round(breaks[1])}-${Math.round(breaks[2])})`, desc: 'Densité inférieure à la moyenne'},
    {min: breaks[2], max: breaks[3], col: palDen[2], lab: `Moyenne (${Math.round(breaks[2])}-${Math.round(breaks[3])})`, desc: 'Densité moyenne'},
    {min: breaks[3], max: breaks[4], col: palDen[3], lab: `Élevée (${Math.round(breaks[3])}-${Math.round(breaks[4])})`, desc: 'Densité supérieure à la moyenne'},
    {min: breaks[4], max: 1e12, col: palDen[4], lab: `Très élevée (> ${Math.round(breaks[4])})`, desc: 'Zones très denses'}
  ];
}

/* ═════ 4. UI améliorée ═════ */
function buildUI(gov,del,sec){
  const map=L.map('map',{attributionControl:false}).setView([34,9],7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
              {attribution:'© OSM / Carto'}).addTo(map);

  /* légende améliorée */
  const legend=L.control({position:'bottomleft'});legend.onAdd=function(){
    const div = L.DomUtil.create('div','info legend');
    div.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    div.style.padding = '10px';
    div.style.borderRadius = '5px';
    div.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
    return div;
  };legend.addTo(map);
  
  const drawLegend = function() {
    const d = legend.getContainer();
    let html = `<div style="font-weight:bold;margin-bottom:8px">${mode === 'density' ? 'DENSITÉ (hab/km²)' : 'ÂGE MÉDIAN'}</div>`;
    
    if (mode === 'density') {
      densCls.forEach(c => {
        html += `<div style="display:flex;align-items:center;margin-bottom:5px">
          <div style="width:20px;height:20px;background:${c.col};border:1px solid #555;margin-right:8px"></div>
          <div>
            <div style="font-size:14px">${c.lab}</div>
            <div style="font-size:12px;color:#666">${c.desc}</div>
          </div>
        </div>`;
      });
    } else {
      const ageClasses = [
        { col: palAge[0], lab: '< 30 ans', desc: 'Population jeune' },
        { col: palAge[1], lab: '30-39 ans', desc: 'Population adulte' },
        { col: palAge[2], lab: '40-49 ans', desc: 'Population mature' },
        { col: palAge[3], lab: '≥ 50 ans', desc: 'Population âgée' }
      ];
      ageClasses.forEach(c => {
        html += `<div style="display:flex;align-items:center;margin-bottom:5px">
          <div style="width:20px;height:20px;background:${c.col};border:1px solid #555;margin-right:8px"></div>
          <div>
            <div style="font-size:14px">${c.lab}</div>
            <div style="font-size:12px;color:#666">${c.desc}</div>
          </div>
        </div>`;
      });
    }
    
    html += `<div style="margin-top:10px;font-size:12px;color:#777">
      Source: Données démographiques nationales<br>Projection: WGS84
    </div>`;
    
    d.innerHTML = html;
  };

  const tipOpt={offset:[0,80],opacity:.9,className:'leaflet-tooltip-dark',direction:'top'};
  const tip=p=>`<b>${p.LABEL}</b><br>Population: ${p.POPTOT.toLocaleString()}<br>
    Densité: ${safe(p.DENSITY)} hab/km²<br>Âge médian: ${safe(p.MED_AGE)} ans`;

  const mkLayer=(fc,top)=>L.geoJson(fc,{
    style:f=>{
      const base = styleOf(f, top);
      return {...base, _base: base};
    },
    onEachFeature:(f,l)=>{
      const base = styleOf(f, top);
      l.options._top = top;
      l.options._base = base;
      
      l.bindTooltip(tip(f.properties),tipOpt).on({
        mouseover:()=>{
          if(l!==selected){
            const hoverColor = lighten(l.options._base.fillColor, 30);
            l.setStyle({...l.options._base, fillColor: hoverColor, weight: l.options._base.weight + 1});
          }
        },
        mouseout:()=>{
          if(l!==selected) l.setStyle(l.options._base);
        },
        click:()=>{
          if(selected){
            selected.setStyle(selected.options._base);
            selected._path.classList.remove('selected');
          }
          selected=l;
          l._path.classList.add('selected');
          updatePanel(f.properties);
          
          // Centrer sur la sélection avec un zoom adapté
          const zoomLevel = level === 'gov' ? 8 : level === 'del' ? 10 : 12;
          map.setView(l.getBounds().getCenter(), zoomLevel);
        }
      });
    }
  });
  
  const lyrGov=mkLayer(gov.features,true).addTo(map),
        lyrDel=mkLayer(del.features,true),
        lyrSec=mkLayer(sec.features,false);

  const gLab=L.layerGroup();gov.features.forEach(f=>{const c=L.geoJSON(f).getBounds().getCenter();
    L.marker(c,{icon:L.divIcon({className:'gov-label',html:f.properties.LABEL})}).addTo(gLab);});map.addLayer(gLab);

  const box=document.getElementById('info');let chart=null;
  
  function updatePanel(p) {
    if(chart){chart.destroy();chart=null;}
    
    if(!p || !Object.keys(p.DIST).length){
      box.innerHTML=`<div style="text-align:center;padding:20px;color:#666">
        <h3 style="margin-top:0">${p.LABEL}</h3>
        <p>Population: <b>${p.POPTOT.toLocaleString()}</b></p>
        <p>Densité: <b>${safe(p.DENSITY)} hab/km²</b></p>
        <p>Âge médian: <b>${safe(p.MED_AGE)} ans</b></p>
        <div style="margin-top:20px;opacity:.7">Données d'âge indisponibles pour cette zone</div>
      </div>`;
      return;
    }
    
    box.innerHTML = `<div class="panel-header">
        <h3>${p.LABEL}</h3>
        <div class="indicators">
          <div class="indicator">
            <div class="indicator-value">${p.POPTOT.toLocaleString()}</div>
            <div class="indicator-label">Population</div>
          </div>
          <div class="indicator">
            <div class="indicator-value">${safe(p.DENSITY)}</div>
            <div class="indicator-label">Densité (hab/km²)</div>
          </div>
          <div class="indicator">
            <div class="indicator-value">${safe(p.MED_AGE)}</div>
            <div class="indicator-label">Âge médian</div>
          </div>
        </div>
      </div>
      <div class="chart-container" style="height:300px; position:relative">
        <canvas id="ageChart"></canvas>
      </div>
      <div id="table-container" class="panel-body"></div>`;
    
    const order = ['00-04','05-09','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+'];
    const bands = order.filter(b => p.DIST[b]).concat(order.filter(b => !p.DIST[b]));
    
    const hm = bands.map(b => male(p.DIST[b] || {})),
          fm = bands.map(b => female(p.DIST[b] || {})),
          tot = hm.reduce((s, v, i) => s + v + fm[i], 0) || 1;
    
    setTimeout(() => {
      const ctx = document.getElementById('ageChart').getContext('2d');
      
      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: bands,
          datasets: [
            {
              label: 'Hommes',
              data: hm,
              backgroundColor: 'rgba(54, 162, 235, 0.7)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1,
              barPercentage: 0.6
            },
            {
              label: 'Femmes',
              data: fm,
              backgroundColor: 'rgba(255, 99, 132, 0.7)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1,
              barPercentage: 0.6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Répartition par âge et sexe',
              font: { size: 16, weight: 'bold' }
            },
            legend: { position: 'top', labels: { boxWidth: 14, font: { size: 12 } } }
          },
          scales: {
            x: {
              title: { display: true, text: 'Tranche d\'âge', font: { weight: 'bold' } },
              grid: { display: false },
              ticks: { color: '#555', font: { size: 11 } }
            },
            y: {
              title: { display: true, text: 'Population', font: { weight: 'bold' } },
              grid: { color: '#f0f0f0' },
              ticks: { 
                color: '#555', 
                font: { size: 11 },
                callback: function(value) { return value >= 1000 ? (value/1000) + 'k' : value; }
              }
            }
          },
          animation: { duration: 500 }
        }
      });
      
      const tableContainer = document.getElementById('table-container');
      let rows = '', hTot = 0, fTot = 0;
      
      bands.forEach((b, i) => {
        const h = hm[i], f = fm[i], totalBand = h + f;
        const pct = ((totalBand) / tot * 100).toFixed(1);
        hTot += h;
        fTot += f;
        
        const ageRange = b === '80+' ? '80 ans et plus' : `${b.split('-')[0]} à ${b.split('-')[1]} ans`;
        rows += `<tr>
          <td>${ageRange}</td>
          <td>${h.toLocaleString()}</td>
          <td>${f.toLocaleString()}</td>
          <td>${totalBand.toLocaleString()}</td>
          <td><div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div></td>
          <td>${pct}%</td>
        </tr>`;
      });
      
      tableContainer.innerHTML = `<table>
        <thead>
          <tr>
            <th>Tranche d'âge</th>
            <th>Hommes</th>
            <th>Femmes</th>
            <th>Total</th>
            <th>Répartition</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td><strong>${hTot.toLocaleString()}</strong></td>
            <td><strong>${fTot.toLocaleString()}</strong></td>
            <td><strong>${(hTot + fTot).toLocaleString()}</strong></td>
            <td><div class="progress-bar">
              <div class="progress-fill" style="width:100%"></div>
            </div></td>
            <td><strong>100%</strong></td>
          </tr>
          <tr>
            <td colspan="6" style="text-align:center;padding-top:15px">
              <div class="gender-ratio">
                <div class="gender male">Hommes: ${(hTot/(hTot+fTot)*100).toFixed(1)}%</div>
                <div class="gender female">Femmes: ${(fTot/(hTot+fTot)*100).toFixed(1)}%</div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>`;
    }, 50);
  }

  /* filtres & sélecteurs */
  const selAge=document.getElementById('ageFil'),
        selLvl=document.getElementById('levelSel'),
        selCol=document.getElementById('colorSel'),
        btnR=document.getElementById('resetFil');
  const young=['00-04','05-09','10-14','15-19','20-24','25-29','30-34','35-39'];
  const match=(d,c)=>{if(!c)return true;if(!d)return false;const tot=Object.values(d).reduce((s,b)=>s+male(b)+female(b),0)||1;
    const j=young.reduce((s,b)=>s+male(d[b]||0)+female(d[b]||0),0),v=tot-j,fem=Object.values(d).reduce((s,b)=>s+female(b),0),hom=tot-fem;
    return c==='jeunes'?j/tot>0.5:c==='vieux'?v/tot>0.5:c==='femmes'?fem/tot>0.5:c==='hommes'?hom/tot>0.5:true;};
  const apply=()=>{
    const crit=selAge.value;
    const lyr=level==='gov'?lyrGov:level==='del'?lyrDel:lyrSec;
    const opa=level==='sec'?0.9:0.85;
    lyr.eachLayer(l=>{
      l.setStyle({
        fillOpacity: match(l.feature.properties.DIST,crit) ? opa : 0,
        opacity: match(l.feature.properties.DIST,crit) ? 1 : 0
      });
    });
  };
  selAge.onchange=apply;btnR.onclick=()=>{selAge.value='';apply();};

  selLvl.onchange=e=>{
    level=e.target.value;
    
    // Utiliser les données globales
    const features = level === 'gov' ? globalGov.features : 
                     level === 'del' ? globalDel.features : 
                     globalSec.features;
                     
    densCls = mkDens(features);
    
    if(selected){
      selected.setStyle(selected.options._base);
      if(selected._path) selected._path.classList.remove('selected');
      selected=null;
    }
    
    map.eachLayer(l=>{
      if(l !== map._layers[Object.keys(map._layers)[0]] && l !== legend) {
        map.removeLayer(l);
      }
    });
    
    if(level==='gov'){
      map.addLayer(lyrGov);
      map.addLayer(gLab);
    }else{
      map.addLayer(level==='del'?lyrDel:lyrSec);
      map.removeLayer(gLab);
    }
    
    drawLegend();
    apply();
    setTimeout(autoSelect, 50);
  };
  
  selCol.onchange=e=>{
    mode=e.target.value==='age'?'age':'density';
    [lyrGov, lyrDel, lyrSec].forEach(layerGroup => {
      layerGroup.eachLayer(layer => {
        layer.options._base = styleOf(layer.feature, layer.options._top);
        if(layer === selected){
          layer.setStyle(layer.options._base);
          if (layer._path) layer._path.classList.add('selected');
        } else {
          layer.setStyle(layer.options._base);
        }
      });
    });
    drawLegend();
  };

  /* --- sélection initiale --- */
  function autoSelect() {
    const grp = level === 'gov' ? lyrGov
              : level === 'del' ? lyrDel
              : lyrSec;
    
    const layers = grp.getLayers();
    if (!layers.length) return;
    
    const first = layers[0];
    if (!first) return;

    if (selected) {
      selected.setStyle(selected.options._base);
      if (selected._path) {
        selected._path.classList.remove('selected');
      }
    }

    selected = first;
    if (selected._path) {
      selected._path.classList.add('selected');
    }
    updatePanel(first.feature.properties);
    
    // Centrage avec zoom adapté
    const zoomLevel = level === 'gov' ? 8 : level === 'del' ? 10 : 12;
    map.setView(first.getBounds().getCenter(), zoomLevel);
  }

  drawLegend();
  apply();
  setTimeout(autoSelect, 300);
}