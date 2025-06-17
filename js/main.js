
/* main.js — version corrigée */
import { loadData } from './loader.js';
import { buildUI  } from './ui.js';

/* ═════ Helpers loader ═════ */
function showLoader(txt = 'Chargement…') {
  const el = document.getElementById('loader');
  if (!el) return;
  el.querySelector('.loading-text').textContent = txt;
  el.classList.remove('hidden');
}
function hideLoader() {
  document.getElementById('loader')?.classList.add('hidden');
}
window.showLoader = showLoader;
window.hideLoader = hideLoader;

/* ═════ Chargement initial ═════ */
showLoader('Chargement des données…');
loadData()
  .then(({ gov, del, sec }) => buildUI(gov, del, sec))
  .catch(err => {
    console.error('Erreur lors du chargement :', err);
    alert('Erreur de chargement des données');
  })
  .finally(hideLoader);

/* ═════ Points de vente Fatales ═════ */
const FATALES_COLOR = '#000';
let fatalesLayer    = null;
let fatalesLegend   = null;

function createFatalesLegend() {
  const div = L.DomUtil.create('div', 'info legend legend-fatales');
  div.innerHTML = `<i style="background:${FATALES_COLOR}"></i> Points de vente Fatales`;
  return div;
}

async function ensureFatalesLayer() {
  if (fatalesLayer) return;
  showLoader('Chargement des points de vente…');
  try {
    const resp = await fetch('./fatales_stores.geojson');
    if (!resp.ok) throw new Error('Impossible de charger fatales_stores.geojson');
    const data = await resp.json();
    fatalesLayer = L.geoJSON(data, {
      pointToLayer: (_f, latlng) =>
        L.circleMarker(latlng, {
          radius: 6,
          weight: 1,
          color: '#fff',
          fillColor: FATALES_COLOR,
          fillOpacity: 0.95
        }),
      onEachFeature: (f, layer) => {
        const { name = 'Point de vente', address = '' } = f.properties || {};
        layer.bindTooltip(`<b>${name}</b><br>${address}`);
      }
    });

    if (!fatalesLegend) {
      fatalesLegend       = L.control({ position: 'bottomleft' });
      fatalesLegend.onAdd = createFatalesLegend;
    }
  } finally {
    hideLoader();
  }
}

function toggleFatales(show) {
  if (show) {
    ensureFatalesLayer().then(() => {
      if (!window.map.hasLayer(fatalesLayer)) fatalesLayer.addTo(window.map);
      fatalesLegend?.addTo(window.map);
    });
  } else {
    if (fatalesLayer && window.map.hasLayer(fatalesLayer)) {
      window.map.removeLayer(fatalesLayer);
    }
    fatalesLegend?.remove();
  }
}
window.toggleFatales = toggleFatales;

/* ═════ Listeners DOMContentLoaded ═════ */
document.addEventListener('DOMContentLoaded', () => {
  /* Sidebar et panneau filtres */
  document.getElementById('toggleSidebar')?.addEventListener('click', () =>
    document.body.classList.toggle('hide-info')
  );
  document.getElementById('toggleFilters')?.addEventListener('click', () =>
    document.body.classList.toggle('show-filters')
  );

  /* Checkbox Fatales */
  document.getElementById('fatalesToggle')?.addEventListener('change', e =>
    toggleFatales(e.target.checked)
  );

  /* Checkbox écoles (si présente ailleurs dans le projet) */
  document.getElementById('showSchools')?.addEventListener('change', e =>
    toggleSchools?.(e.target.checked)
  );
});
