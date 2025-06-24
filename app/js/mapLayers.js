/* mapLayers.js — fonctions liées aux couches Leaflet */
import { palAge, palDen, grey } from './constants.js';
import { state } from './state.js';
import { lighten } from './utils.js';

export const colAge = v => palAge[Math.min(3, Math.floor((v - 20) / 10))];
export const colDen = v => (state.densCls.find(c => v <= c.max) || state.densCls.at(-1)).col;

export const styleOf = (f, top) => {
  const v = state.mode === 'density' ? f.properties.DENSITY : f.properties.MED_AGE;
  return {
    fillColor: Number.isFinite(v) ? (state.mode==='density' ? colDen(v) : colAge(v)) : grey,
    fillOpacity: top ? 0.85 : 0.9,
    color: top ? '#000' : '#fff',
    weight: top ? 1 : 0.5
  };
};

/* Crée une couche GeoJSON avec interactions communes */
export function mkLayer(fc, top, tooltipFactory, clickHandler) {
  return L.geoJson(fc, {
    style: f => styleOf(f, top),
    onEachFeature: (f, l) => {
      l.options._top = top;
      l.options._base = styleOf(f, top);

      l.bindTooltip(tooltipFactory(f.properties), {offset:[0,80],opacity:.9,className:'leaflet-tooltip-dark',direction:'top'})
       .on({
        mouseover: () => {
          if (l.options._filtered) return;
          if (l !== state.selected) {
            const hoverColor = lighten(l.options._base.fillColor, 30);
            l.setStyle({...l.options._base, fillColor: hoverColor, weight: l.options._base.weight + 1});
          }
        },
        mouseout: () => {
          if (l.options._filtered) return; 
          if (l !== state.selected) l.setStyle(l.options._base);
        },
        click: () => clickHandler(l, f)
      });
    }
  });
}