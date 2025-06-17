
/* main.js — point d’entrée avec loader visuel */
import { loadData } from './loader.js';
import { buildUI } from './ui.js';

function showLoader(txt='Chargement…'){
  const l=document.getElementById('loader');
  l.querySelector('.loading-text').textContent=txt;
  l.classList.remove('hidden');
}
function hideLoader(){ document.getElementById('loader').classList.add('hidden'); }

window.showLoader = showLoader;
window.hideLoader = hideLoader;

showLoader('Chargement des données…');
loadData().then(({ gov, del, sec }) => {
  buildUI(gov, del, sec);
}).catch(err=>{
  console.error('Erreur lors du chargement :',err);
  alert('Erreur de chargement des données');
}).finally(hideLoader);


/* ===== Toggle buttons listeners ===== */
document.addEventListener('DOMContentLoaded', () => {
  const chkSchools = document.getElementById('showSchools');
  chkSchools?.addEventListener('change', e => toggleSchools(e.target.checked));

  const btnSidebar = document.getElementById('toggleSidebar');
  const btnFilters = document.getElementById('toggleFilters');
  btnSidebar?.addEventListener('click', () => {
    document.body.classList.toggle('hide-info');
  });
  btnFilters?.addEventListener('click', () => {
    document.body.classList.toggle('show-filters');
  });
});


/* ===== Établissements scolaires ===== */
let schoolsLayer = null;
let schoolsLegendCtrl = null;

const TYPE_COLORS = {
  'E.PRIMAIRE': '#1f77b4',
  'COLLEGE': '#ff7f0e',
  'LYCEE': '#2ca02c',
  'PREP.TECH': '#d62728'
};

function createSchoolsLegend() {
  const div = L.DomUtil.create('div', 'info legend legend-schools');
  div.innerHTML = '<strong>Établissements</strong><br>' +
    Object.entries(TYPE_COLORS).map(([t,c]) =>
      `<i style="background:${c}"></i> ${t.replace(/E\.|\./g,'').replace('_',' ')}`).join('<br>');
  return div;
}

function toggleSchools(show) {
  if(show){
    if(!schoolsLayer){
      showLoader('Chargement des établissements…');
      fetch('./etab_scolaires.geojson')
        .then(resp => { if(!resp.ok) throw new Error('Fichier établissements introuvable'); return resp.json(); })
        .then(data => {
          schoolsLayer = L.geoJSON(data, {
            pointToLayer:(f, latlng) => {
              const color = TYPE_COLORS[f.properties.Type] || '#666';
              const m = L.circleMarker(latlng, {
                radius:5,
                weight:1,
                color:'#fff',
                fillColor:color,
                fillOpacity:0.9
              });
              m.bindTooltip(
                `<b>${f.properties.nom_etablissement}</b><br>`+
                `${f.properties.Type}<br>`+
                `${f.properties.delegation}`
              );
              return m;
            }
          }).addTo(map);
          if(!schoolsLegendCtrl){
            schoolsLegendCtrl = L.control({position:'bottomleft'});
            schoolsLegendCtrl.onAdd = () => createSchoolsLegend();
          }
          schoolsLegendCtrl.addTo(map);
          hideLoader();
        });
    } else {
      map.addLayer(schoolsLayer);
      schoolsLegendCtrl?.addTo(map);
    }
  } else {
    if(schoolsLayer) map.removeLayer(schoolsLayer);
    schoolsLegendCtrl?.remove();
  }
}