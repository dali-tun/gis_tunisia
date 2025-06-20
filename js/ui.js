/* ui.js — interactions principales (version responsive + loader) */
import { female, male, safe } from './utils.js';
import { palAge, youngBands } from './constants.js';
import { state }              from './state.js';
import { mkLayer, styleOf }   from './mapLayers.js';
import { mkDens }             from './loader.js';

/*--------------------------------------------------
  Utilitaires
--------------------------------------------------*/
function refreshLayer(group) {
  group.eachLayer(l => {
    l.options._base = styleOf(l.feature, l.options._top);
    l.setStyle(l.options._base);
    if (l !== state.selected && l._path) l._path.classList.remove('selected');
  });
}
const showLoader = (txt = 'Chargement…') => window.showLoader?.(txt);
const hideLoader = ()                    => window.hideLoader?.();

/*--------------------------------------------------
  Point d’entrée (appelé par main.js)
--------------------------------------------------*/
export function buildUI(gov, del, sec) {
  /* ===== Initialisation état global ===== */
  state.level = 'gov';
  state.mode = 'density';

  /* ===== Carte ===== */
  const map = L.map('map', { attributionControl: false }).setView([34, 9], 7);
  window.map = map;
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© OSM / Carto' }
  ).addTo(map);
  state.densCls = mkDens(gov.features);

  /* ===== Légende ===== */
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const d = L.DomUtil.create('div', 'info legend');
    Object.assign(d.style, {
      background: 'rgba(255,255,255,.85)',
      padding: '10px',
      borderRadius: '6px',
      boxShadow: '0 0 10px rgba(0,0,0,.2)'
    });
    return d;
  };
  legend.addTo(map);

  function drawLegend() {
    const c = legend.getContainer();
    c.innerHTML = '';

    if (state.mode === 'density') {
      c.insertAdjacentHTML(
        'beforeend',
        '<div style="font-weight:bold;margin-bottom:8px">DENSITÉ (hab/km²)</div>'
      );
      state.densCls.forEach(b => {
        c.insertAdjacentHTML(
          'beforeend',
          `<div style="display:flex;align-items:center;margin-bottom:5px">
             <div style="width:20px;height:20px;background:${b.col};border:1px solid #555;margin-right:8px"></div>
             <div>
               <div style="font-size:14px">${b.lab}</div>
               <div style="font-size:12px;color:#666">${b.desc}</div>
             </div>
           </div>`
        );
      });
    } else {
      const items = [
        { col: palAge[0], lab: '&lt; 30 ans', desc: 'Population jeune' },
        { col: palAge[1], lab: '30-39 ans',  desc: 'Population adulte' },
        { col: palAge[2], lab: '40-49 ans',  desc: 'Population mûre' },
        { col: palAge[3], lab: '≥ 50 ans',   desc: 'Population âgée' }
      ];
      c.insertAdjacentHTML(
        'beforeend',
        '<div style="font-weight:bold;margin-bottom:8px">ÂGE MÉDIAN</div>'
      );
      items.forEach(i => {
        c.insertAdjacentHTML(
          'beforeend',
          `<div style="display:flex;align-items:center;margin-bottom:5px">
             <div style="width:20px;height:20px;background:${i.col};border:1px solid #555;margin-right:8px"></div>
             <div>
               <div style="font-size:14px">${i.lab}</div>
               <div style="font-size:12px;color:#666">${i.desc}</div>
             </div>
           </div>`
        );
      });
    }

    c.insertAdjacentHTML(
      'beforeend',
      '<div style="margin-top:10px;font-size:11px;color:#777">Source : INS — WGS-84</div>'
    );
  }

  /* ===== Couches vectorielles ===== */
  const tooltip = p =>
    `<b>${p.LABEL}</b><br>Population : ${p.POPTOT.toLocaleString()}<br>` +
    `Densité : ${safe(p.DENSITY)} hab/km²<br>Âge médian : ${safe(p.MED_AGE)} ans`;

  const onSelect = (layer, feature) => {
    if (state.selected && state.selected._path) {
      state.selected._path.classList.remove('selected');
      state.selected.setStyle(state.selected.options._base);
    }
    state.selected = layer;
    if (layer._path) layer._path.classList.add('selected');
    updatePanel(feature.properties);
  };

  const lyrGov = mkLayer(gov.features, true,  tooltip, onSelect).addTo(map);
  const lyrDel = mkLayer(del.features, true,  tooltip, onSelect);
  const lyrSec = mkLayer(sec.features, false, tooltip, onSelect);

  /* Labels gouvernorats */
  const gLab = L.layerGroup();
  gov.features.forEach(f => {
    const c = L.geoJSON(f).getBounds().getCenter();
    L.marker(c, { 
      icon: L.divIcon({ 
        className: 'gov-label', 
        html: f.properties.LABEL 
      }) 
    }).addTo(gLab);
  });
  map.addLayer(gLab);

  /* ===== Panneau info ===== */
  const box   = document.getElementById('info');
  let   chart = null;

  function updatePanel(p) {
    if (chart) { chart.destroy(); chart = null; }
    
    /* Cas aucune sélection */
    if (!p) {
      box.innerHTML = '<div class="panel-header"><h3>Aucune sélection</h3></div>';
      return;
    }

    /* Pas de distribution d’âge ? */
    if (!p.DIST || !Object.keys(p.DIST).length) {
      box.innerHTML =
        `<div style="text-align:center;padding:20px;color:#666">
           <h3 style="margin:0">${p.LABEL}</h3>
           <p>Population : <b>${p.POPTOT.toLocaleString()}</b></p>
           <p>Densité : <b>${safe(p.DENSITY)} hab/km²</b></p>
           <p>Âge médian : <b>${safe(p.MED_AGE)} ans</b></p>
           <div style="margin-top:18px;opacity:.7">Pas de détail d’âge disponible</div>
         </div>`;
      return;
    }

    /* Détail complet */
    box.innerHTML =
      `<div class="panel-header">
         <h3>${p.LABEL}</h3>
         <div class="indicators">
           <div class="indicator">
             <div class="indicator-value">${p.POPTOT.toLocaleString()}</div>
             <div class="indicator-label">Population</div>
           </div>
           <div class="indicator">
             <div class="indicator-value">${safe(p.DENSITY)}</div>
             <div class="indicator-label">Densité</div>
           </div>
           <div class="indicator">
             <div class="indicator-value">${safe(p.MED_AGE)}</div>
             <div class="indicator-label">Âge médian</div>
           </div>
           <div class="indicator">
             <div class="indicator-value">${safe(p.superficie || p.AREA)}</div>
             <div class="indicator-label">Superficie&nbsp;(km²)</div>
           </div>
         </div>
       </div>
       <div class="schools">
         <h4>Établissements&nbsp;scolaires</h4>
         <ul class="schools-list">
           <li>Écoles primaires&nbsp;: ${safe(p.nb_primaire,0)}</li>
           <li>Collèges&nbsp;: ${safe(p.nb_college,0)}</li>
           <li>Lycées&nbsp;: ${safe(p.nb_lycee,0)}</li>
           <li>Centres&nbsp;prépa&nbsp;tech.&nbsp;: ${safe(p.nb_prep_tech,0)}</li>
         </ul>
       </div>

       <div class="chart-container" style="height:300px"><canvas id="ageChart"></canvas></div>
       <div id="table-container" class="panel-body"></div>`;

    /* Préparation des séries */
    const order = [
      '00-04','05-09','10-14','15-19','20-24','25-29','30-34','35-39',
      '40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+'
    ];
    const bands = order.filter(b => p.DIST[b]).concat(order.filter(b => !p.DIST[b]));
    const hm  = bands.map(b => male(p.DIST[b] || 0));
    const fm  = bands.map(b => female(p.DIST[b] || 0));
    const tot = hm.reduce((s,v,i) => s + v + fm[i], 0) || 1;

    /* Histogramme Chart.js */
    setTimeout(() => {
      const ctx = document.getElementById('ageChart').getContext('2d');
      chart = new Chart(ctx, {
        type : 'bar',
        data : {
          labels   : bands,
          datasets : [
            { label:'Hommes', data:hm, backgroundColor:'rgba(54,162,235,.7)',  borderColor:'rgba(54,162,235,1)',  borderWidth:1 },
            { label:'Femmes', data:fm, backgroundColor:'rgba(255,99,132,.7)', borderColor:'rgba(255,99,132,1)', borderWidth:1 }
          ]
        },
        options : {
          responsive: true,
          maintainAspectRatio: false,
          plugins:{
            title : { display:true, text:'Répartition par âge et sexe', font:{ size:16, weight:'bold' } },
            legend: { position:'top', labels:{ boxWidth:14, font:{ size:12 } } }
          },
          scales:{
            x:{ title:{ display:true, text:"Tranche d'âge", font:{ weight:'bold' } }, grid:{ display:false },
                ticks:{ color:'#555', font:{ size:11 } } },
            y:{ title:{ display:true, text:'Population', font:{ weight:'bold' } }, grid:{ color:'#e8e8e8' },
                ticks:{ color:'#555', font:{ size:11 }, callback:v=>v>=1000?`${v/1000}k`:v } }
          },
          animation:{ duration:400 }
        }
      });

      /* Tableau détaillé */
      const tb   = document.getElementById('table-container');
      let rows   = '', hTot = 0, fTot = 0;
      bands.forEach((b,i) => {
        const h = hm[i], f = fm[i], bandTot = h + f, pct = ((bandTot / tot) * 100).toFixed(1);
        hTot += h; fTot += f;
        const label = b === '80+' ? '80 ans et +' : `${b.replace('-', '–')} ans`;
        rows +=
          `<tr>
             <td>${label}</td><td>${h.toLocaleString()}</td><td>${f.toLocaleString()}</td>
             <td>${bandTot.toLocaleString()}</td>
             <td><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></td>
             <td>${pct}%</td>
           </tr>`;
      });

      tb.innerHTML =
        `<table>
           <thead>
             <tr><th>Tranche d'âge</th><th>Hommes</th><th>Femmes</th><th>Total</th><th>Répartition</th><th>%</th></tr>
           </thead>
           <tbody>${rows}</tbody>
           <tfoot>
             <tr>
               <td><strong>Total</strong></td>
               <td><strong>${hTot.toLocaleString()}</strong></td>
               <td><strong>${fTot.toLocaleString()}</strong></td>
               <td><strong>${(hTot + fTot).toLocaleString()}</strong></td>
               <td><div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div></td>
               <td><strong>100%</strong></td>
             </tr>
             <tr>
               <td colspan="6" style="text-align:center;padding-top:14px">
                 Hommes : ${(hTot / tot * 100).toFixed(1)} % &nbsp;|&nbsp;
                 Femmes : ${(fTot / tot * 100).toFixed(1)} %
               </td>
             </tr>
           </tfoot>
         </table>`;
    }, 40);
  }

  /* ===== Filtres ===== */
  const selAge = document.getElementById('ageFil');
  const selLvl = document.getElementById('levelSel');
  const selCol = document.getElementById('colorSel');
  const btnR   = document.getElementById('resetFil');

  function match(dist, crit) {
    if (!crit) return true;
    if (!dist) return false;

    let total = 0, jeunes = 0, vieux = 0, fem = 0, hom = 0;
    for (const band in dist) {
      const m = male(dist[band]);
      const f = female(dist[band]);
      total += m + f;
      
      if (youngBands.includes(band)) {
        jeunes += m + f;
      } else {
        vieux += m + f;
      }
      
      fem += f;
      hom += m;
    }
    if (total === 0) return false;

    return crit === 'jeunes'  ? jeunes / total > 0.5
         : crit === 'vieux'   ? vieux  / total > 0.5
         : crit === 'femmes'  ? fem    / total > 0.5
         : crit === 'hommes'  ? hom    / total > 0.5
         : true;
  }

  function applyFilter() {
    showLoader('Filtrage…');
    const crit   = selAge.value;
    const grp    = state.level === 'gov' ? lyrGov
                  : state.level === 'del' ? lyrDel
                  : lyrSec;
    const baseO  = state.level === 'sec' ? 0.9 : 0.85;

    grp.eachLayer(l => {
      const visible = match(l.feature.properties.DIST, crit);
      l.options._filtered = !visible;
      l.setStyle({
        ...l.options._base,
        fillOpacity: visible ? baseO : 0,
        opacity    : visible ? 1    : 0
      });
      if (!visible && l === state.selected) {
        if (l._path) l._path.classList.remove('selected');
        state.selected = null;
      }
    });

    if (!state.selected) setTimeout(autoSelect, 20);
    setTimeout(hideLoader, 150);
  }

  selAge.onchange = applyFilter;
  btnR.onclick    = () => { selAge.value = ''; applyFilter(); };

  /* ===== Changement de niveau ===== */
  selLvl.onchange = e => {
    showLoader('Changement de niveau…');
    /* reset global */
    [lyrGov, lyrDel, lyrSec].forEach(refreshLayer);
    if (state.selected && state.selected._path) state.selected._path.classList.remove('selected');
    state.selected = null;
    selAge.value   = '';

    /* nouvelle palette */
    state.level  = e.target.value;
    const feats  = state.level === 'gov' ? gov.features
                 : state.level === 'del' ? del.features
                 : sec.features;
    state.densCls = mkDens(feats);

    /* switch couches */
    [lyrGov, lyrDel, lyrSec, gLab].forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
    let active;
    if (state.level === 'gov')  { map.addLayer(lyrGov); active = lyrGov; map.addLayer(gLab); }
    else if (state.level === 'del') { map.addLayer(lyrDel); active = lyrDel; }
    else                           { map.addLayer(lyrSec); active = lyrSec; }

    refreshLayer(active);
    drawLegend();
    applyFilter();
    setTimeout(() => { hideLoader(); }, 200);
  };

  /* ===== Changement de mode couleur ===== */
  selCol.onchange = e => {
    state.mode = e.target.value === 'age' ? 'age' : 'density';
    [lyrGov, lyrDel, lyrSec].forEach(refreshLayer);
    drawLegend();
  };

  /* ===== Sélection initiale ===== */
  function autoSelect() {
    const grp = state.level === 'gov' ? lyrGov
             : state.level === 'del' ? lyrDel
             : lyrSec;
    const l0  = grp.getLayers().find(x => !x.options._filtered);
    
    if (!l0) {
      state.selected = null;
      updatePanel(null);
      return;
    }
    
    if (state.selected && state.selected._path) state.selected._path.classList.remove('selected');
    state.selected = l0;
    if (l0._path) l0._path.classList.add('selected');
    updatePanel(l0.feature.properties);
  }

  /* ===== Démarrage ===== */
  // Initialiser state.mode selon la sélection UI
  state.mode = selCol.value === 'age' ? 'age' : 'density';
  
  drawLegend();
  applyFilter();
  hideLoader();
/* ui.js — interactions principales (version responsive + loader) */
// ... (le reste du code reste inchangé)

/* ===== Barre de recherche corrigée ===== */
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    
    if (q.length < 2) {
      searchResults.classList.remove('visible');
      return;
    }
    
    const feats = state.level === 'gov' ? gov.features
                 : state.level === 'del' ? del.features
                 : sec.features;
    
    const seen = new Set();
    const matches = [];
    
    for (const f of feats) {
      const n = f.properties.LABEL;
      if (!seen.has(n) && n.toLowerCase().includes(q)) {
        seen.add(n);
        matches.push({ name: n, feature: f });
        if (matches.length >= 8) break;
      }
    }
    
    if (matches.length) {
      searchResults.classList.add('visible');
      matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-map-marker-alt';
        div.appendChild(icon);
        
        const text = document.createTextNode(item.name);
        div.appendChild(text);
        
        div.onclick = () => {
          const layer = findLayerByName(item.name);
          if (layer) {
            onSelect(layer, layer.feature);
            map.fitBounds(layer.getBounds().pad(0.005));
            document.body.classList.remove('hide-info');
          }
          searchResults.classList.remove('visible');
        };
        searchResults.appendChild(div);
      });
    } else {
      const noResults = document.createElement('div');
      noResults.className = 'search-result-item';
      noResults.innerHTML = '<i class="fas fa-exclamation-circle"></i> Aucun résultat trouvé';
      searchResults.appendChild(noResults);
      searchResults.classList.add('visible');
    }
  });
  
  // Fermer les résultats quand on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.classList.remove('visible');
    }
  });
}

function findLayerByName(name) {
  const grp = state.level === 'gov' ? lyrGov 
            : state.level === 'del' ? lyrDel 
            : lyrSec;
  
  let found = null;
  grp.eachLayer(layer => {
    if (layer.feature.properties.LABEL === name) {
      found = layer;
    }
  });
  return found;
}

// ... (le reste du code reste inchangé)

}