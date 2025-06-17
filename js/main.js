/* main.js — point d’entrée avec loader visuel (v2025-06-17) */
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
   1. Listeners d’interface
--------------------------------------------------*/
document.addEventListener('DOMContentLoaded', () => {
  /* Sidebar & filtres */
  document.getElementById('toggleSidebar')?.addEventListener('click', () =>
    document.body.classList.toggle('hide-info')
  );
  document.getElementById('toggleFilters')?.addEventListener('click', () =>
    document.body.classList.toggle('show-filters')
  );

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
});

/* -------------------------------------------------
   2. Gestion des établissements scolaires
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
              radius: 5,
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

/* ----- Ajout / retrait d’un type ----- */
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

/* ----- Synchroniser l’état du toggle global ----- */
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
