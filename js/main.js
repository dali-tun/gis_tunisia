/* main.js — point d'entrée avec loader visuel */
import { loadData } from './loader.js';
import { buildUI }  from './ui.js';

/* ===== Loader helpers ===== */
function showLoader(txt='Chargement…'){
  const l=document.getElementById('loader');
  l.querySelector('.loading-text').textContent=txt;
  l.classList.remove('hidden');
}
function hideLoader(){
  document.getElementById('loader').classList.add('hidden');
}
window.showLoader = showLoader;
window.hideLoader = hideLoader;

/* ===== Chargement des couches principales ===== */
showLoader('Chargement des données…');
loadData()
  .then(({ gov, del, sec }) => buildUI(gov, del, sec))
  .catch(err => {
    console.error('Erreur lors du chargement :', err);
    alert('Erreur de chargement des données');
  })
  .finally(hideLoader);

/* -------------------------------------------------
   Listeners d'interface
--------------------------------------------------*/
document.addEventListener('DOMContentLoaded', () => {
  /* Établissements scolaires */
  const chkAll   = document.getElementById('schoolsAll');
  const chkTypes = document.querySelectorAll('.schoolTypeChk');

  chkAll?.addEventListener('change', e => toggleAllSchools(e.target.checked));

  chkTypes.forEach(el =>
    el.addEventListener('change', e => {
      toggleSchoolType(e.target.dataset.type, e.target.checked);
      syncGlobalToggle();
    })
  );
  
  /* Navigation mobile */
  const mobileFiltersBtn = document.getElementById('mobileFilters');
  const mobileInfoBtn = document.getElementById('mobileInfo');
  const mobileLegendBtn = document.getElementById('mobileLegend');
  const mobileSearchBtn = document.getElementById('mobileSearch');
  
  if (mobileFiltersBtn) {
    mobileFiltersBtn.addEventListener('click', () => {
      document.body.classList.toggle('show-filters');
      mobileFiltersBtn.classList.toggle('active');
    });
  }
  
  if (mobileInfoBtn) {
    mobileInfoBtn.addEventListener('click', () => {
      document.body.classList.toggle('hide-info');
      mobileInfoBtn.classList.toggle('active');
    });
  }
  
  if (mobileLegendBtn) {
    mobileLegendBtn.addEventListener('click', () => {
      // Afficher la légende
      mobileLegendBtn.classList.toggle('active');
    });
  }
  
  if (mobileSearchBtn) {
    mobileSearchBtn.addEventListener('click', () => {
      document.getElementById('searchInput').focus();
      mobileSearchBtn.classList.toggle('active');
    });
  }
});

/* -------------------------------------------------
   Gestion des établissements scolaires
--------------------------------------------------*/
const TYPE_COLORS = {
  'E.PRIMAIRE':    '#1f77b4',
  'E.PREP':        '#ff7f0e',
  'E.PREP.TECH':   '#2ca02c',
  'LYCEE':         '#d62728'
};
const schoolLayers      = {};   // type => L.GeoJSON
let   schoolsLegendCtrl = null; // L.Control
let   schoolsDataPromise = null;

/* ----- Chargement paresseux des données ----- */
function ensureSchoolLayers(){
  if(schoolsDataPromise) return schoolsDataPromise;

  showLoader('Chargement des établissements…');
  schoolsDataPromise = fetch('./etab_scolaires.geojson')
    .then(resp => {
      if(!resp.ok) throw new Error('Fichier établissements introuvable');
      return resp.json();
    })
    .then(data => {
      /* Regrouper les features par type */
      const byType = {};
      data.features.forEach(f => {
        const t = String(f.properties.Type || '').toUpperCase();
        if(!byType[t]) byType[t] = [];
        byType[t].push(f);
      });

      /* Construire une couche GeoJSON pour chaque type */
      Object.entries(byType).forEach(([type, feats]) => {
        schoolLayers[type] = L.geoJSON({ type:'FeatureCollection', features: feats }, {
          pointToLayer: (f, latlng) => {
            const col = TYPE_COLORS[type] || '#666';
            const m = L.circleMarker(latlng, {
              radius: 6,
              weight: 1,
              color: '#fff',
              fillColor: col,
              fillOpacity: 0.9
            });
            m.bindTooltip(
              `<b>${f.properties.nom_etablissement}</b><br>${f.properties.Type}<br>${f.properties.delegation}`
            );
            return m;
          }
        });
      });

      /* Préparer la légende (une seule fois) */
      if(!schoolsLegendCtrl){
        schoolsLegendCtrl = L.control({ position:'bottomleft' });
        schoolsLegendCtrl.onAdd = () => {
          const div = L.DomUtil.create('div', 'info legend legend-schools');
          div.innerHTML =
            '<strong>Établissements</strong><br>' +
            Object.entries(TYPE_COLORS)
              .map(([t,c]) => `<i style="background:${c}"></i> ${t.replace(/E\.|\./g,'').replace('_',' ')}`)
              .join('<br>');
          return div;
        };
      }
    })
    .finally(hideLoader);

  return schoolsDataPromise;
}

/* ----- Ajout / retrait d'un type ----- */
function toggleSchoolType(type, show){
  ensureSchoolLayers().then(() => {
    const layer = schoolLayers[type];
    if(!layer) return;
    if(show){
      if(!window.map.hasLayer(layer)) layer.addTo(window.map);
    } else {
      if(window.map.hasLayer(layer)) window.map.removeLayer(layer);
    }
    updateLegendVisibility();
  });
}

/* ----- Toggle global ----- */
function toggleAllSchools(show){
  const chkTypes = document.querySelectorAll('.schoolTypeChk');
  chkTypes.forEach(el => {
    el.checked = show;
    toggleSchoolType(el.dataset.type, show);
  });
  syncGlobalToggle();
}

/* ----- Synchroniser l'état du toggle global ----- */
function syncGlobalToggle(){
  const chkAll   = document.getElementById('schoolsAll');
  const chkTypes = document.querySelectorAll('.schoolTypeChk');
  if(!chkAll) return;

  const total   = chkTypes.length;
  const onCount = Array.from(chkTypes).filter(el => el.checked).length;

  chkAll.checked       = onCount === total;
  chkAll.indeterminate = onCount > 0 && onCount < total;
  updateLegendVisibility();
}

/* ----- Afficher / masquer la légende ----- */
function updateLegendVisibility(){
  if(!schoolsLegendCtrl) return;
  const visible = Object.values(schoolLayers).some(l => window.map.hasLayer(l));
  if(visible){
    schoolsLegendCtrl.addTo(window.map);
  } else {
    schoolsLegendCtrl.remove();
  }
}

/* Zones industrielles integration */
const ZONES_COLOR = '#9c27b0';
const ZONES_CENTER = '#ff9800';
let zonesLayer=null, zonesLegendCtrl=null, zonesDataPromise=null;

function ensureZonesLayer(){
  if(zonesDataPromise) return zonesDataPromise;
  showLoader('Chargement zones industrielles…');
  zonesDataPromise = fetch('./zonesindustrielles.geojson')
    .then(r=>{if(!r.ok) throw new Error('GeoJSON non trouvé'); return r.json()})
    .then(data=>{
      const areas = data.features.map(f=>parseFloat(String(f.properties['المساحة (هك)']??0).replace(',','.'))||0).filter(a=>a>0).sort((a,b)=>a-b);
      const minA=areas[0]||1, midA=areas[Math.floor(areas.length/2)]||minA, maxA=areas[areas.length-1]||minA;
      const scale=25/Math.sqrt(maxA);
      const rPx=a=>Math.max(4,Math.sqrt(a)*scale);
      zonesLayer = L.geoJSON(data,{pointToLayer:(f,latlng)=>{
        const a=parseFloat(String(f.properties['المساحة (هك)']||0).replace(',','.'))||0;
        const circle=L.circleMarker(latlng,{radius:rPx(a),color:ZONES_COLOR,fillColor:ZONES_COLOR,fillOpacity:0.25,weight:1});
        const marker=L.circleMarker(latlng,{radius:4,color:ZONES_CENTER,fillColor:ZONES_CENTER,fillOpacity:1,weight:1});
        const grp=L.featureGroup([circle,marker]);
        grp.bindTooltip('<b>'+ (f.properties.name||'Zone industrielle') +'</b><br>Surface: '+a+' ha',{sticky:true});
        return grp;
      }});
      if(!zonesLegendCtrl){
        zonesLegendCtrl=L.control({position:'bottomleft'});
        zonesLegendCtrl.onAdd=()=>{const d=L.DomUtil.create('div','info legend legend-zones');d.innerHTML='<strong>Zones industrielles</strong><ul><li><span class="legend-circle"></span>Petite</li><li><span class="legend-circle" style="width:16px;height:16px;"></span>Moyenne</li><li><span class="legend-circle" style="width:24px;height:24px;"></span>Grande</li></ul><div><span class="legend-center"></span>Centre</div>';return d;};
      }
    })
    .finally(hideLoader);
  return zonesDataPromise;
}
function toggleZones(show){
  ensureZonesLayer().then(()=>{
    if(!zonesLayer) return;
    if(show){ zonesLayer.addTo(window.map); zonesLegendCtrl.addTo(window.map); } else { window.map.removeLayer(zonesLayer); zonesLegendCtrl.remove(); }
  });
}
document.addEventListener('DOMContentLoaded',()=>{
  const chk=document.getElementById('zonesIndToggle');
  chk?.addEventListener('change',e=>toggleZones(e.target.checked));
});
document.querySelectorAll('.close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const floating = btn.closest('.floating-ui');
    if (floating) {
      floating.style.display = 'none';
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleFilters');
  const filtersPanel = document.getElementById('filters');
  
  if (toggleBtn && filtersPanel) {
    // Basculer l'état des filtres
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('show-filters');
    });
    
    // Fermer en cliquant à l'extérieur
    document.addEventListener('click', (e) => {
      const isClickInside = filtersPanel.contains(e.target);
      const isToggleButton = e.target === toggleBtn || toggleBtn.contains(e.target);
      
      if (!isClickInside && !isToggleButton && document.body.classList.contains('show-filters')) {
        document.body.classList.remove('show-filters');
      }
    });
    
    // Ajouter l'overlay
    const overlay = document.createElement('div');
    overlay.className = 'filter-overlay';
    document.body.appendChild(overlay);
    
    // Fermer avec la touche ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('show-filters')) {
        document.body.classList.remove('show-filters');
      }
    });
  }
});