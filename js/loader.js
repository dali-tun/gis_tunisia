/* loader.js — chargement et normalisation des données */
import { FILE } from './constants.js';
import { female, male, ageMid } from './utils.js';

/* Fusionne les valeurs dans un objet de distribution */
function merge(out, band, sex, val) {
  if (band && Number.isFinite(+val)) {
    (out[band] = out[band] || {})[sex] = (out[band][sex] || 0) + +val;
  }
}

/* Parse différentes structures de distribution d’âge */
export function parseDist(src) {
  const o = {};
  const blk = b => {
    if (!b) return;
    Object.entries(b).forEach(([bd, x]) => {
      merge(o, bd, 'Masculin', male(x));
      merge(o, bd, 'Féminin',  female(x));
    });
  };

  if (src.population_dict) {
    try {
      blk(typeof src.population_dict === 'string'
          ? JSON.parse(src.population_dict)
          : src.population_dict);
    } catch (e) { /* noop */ }
  }
  if (src.population) blk(src.population);

  for (const [k, v] of Object.entries(src)) {
    if (!Number.isFinite(+v)) continue;
    const g = k.match(/(male|female).*?(\d{1,2}).*?(\d{2})/i);
    if (g) {
      merge(o, `${g[2].padStart(2,'0')}-${g[3]}`, /fem/i.test(g[1]) ? 'Féminin':'Masculin', +v);
      continue;
    }
    const a = k.match(/age[._-](\d{1,2})[._-](\d{2})/i);
    if (a) {
      merge(o, `${a[1].padStart(2,'0')}-${a[2]}`, 'Masculin', +v);
      continue;
    }
    const b = k.match(/(\d{1,2})[._-]?(\d{2})?(\+)?[._-]*(M|F)$/i);
    if (b) {
      merge(o, b[3] ? `${b[1]}+` : `${b[1].padStart(2,'0')}-${b[2]}`, /f/i.test(b[4]) ? 'Féminin':'Masculin', +v);
    }
  }
  return Object.keys(o).length ? o : null;
}

/* Normalise un FeatureCollection en place */
export function norm(fc) {
  const RX = /^name_|deleg_|gouv_|nom|libell/i,
        RX_A = /sup|surface|area|shape|km/i,
        RX_P = /pop.*tot/i,
        RX_D = /dens/i;

  fc.features.forEach(ft => {
    const p = ft.properties;
    p.LABEL   = p.NAME_EN || p.deleg_na_1 || p.name_fr ||
                (Object.keys(p).find(k => RX.test(k)) && p[Object.keys(p).find(k => RX.test(k))]) || '—';
    p.AREA    = +p.AREA || +Object.entries(p).find(([k,v]) => RX_A.test(k) && Number.isFinite(+v))?.[1] || 0;
    p.DIST    = parseDist(p) || {};
    p.POPTOT  = +p.POPTOT || +Object.entries(p).find(([k,v]) => RX_P.test(k) && Number.isFinite(+v))?.[1]
                || Object.values(p.DIST).reduce((s,b) => s + male(b) + female(b), 0);
    p.DENSITY = +p.DENSITY || +Object.entries(p).find(([k,v]) => RX_D.test(k) && Number.isFinite(+v))?.[1]
                || (p.AREA ? p.POPTOT / p.AREA : null);

    if (!Number.isFinite(p.MED_AGE) && Object.keys(p.DIST).length) {
      const ord = Object.keys(p.DIST).sort((a,b) => +a.replace('+','') - +b.replace('+','')),
            cnt = ord.map(b => male(p.DIST[b]) + female(p.DIST[b])),
            tot = cnt.reduce((a,b) => a + b, 0);
      let cum = 0, band = ord[0];
      for (let i = 0; i < cnt.length; i++) {
        cum += cnt[i];
        if (cum >= tot / 2) { band = ord[i]; break; }
      }
      p.MED_AGE = ageMid(band);
    }
  });
}

/* Jenks breaks pour la densité */
export function mkDens(features) {
  const palDen = ['#f7fbff','#c6dbef','#6baed6','#2171b5','#08306b'];
  const values = features.map(x => x.properties.DENSITY).filter(n => n > 0).sort((a,b) => a - b);
  if (!values.length) {
    return [{min:0,max:1e12,col:palDen[2],lab:'—',desc:'Aucune donnée'}];
  }
  /* Algorithme de Jenks */
  const jenksBreaks = (data, k) => {
    data = data.slice().sort((a,b) => a - b);
    const mat = Array.from({length: data.length+1}, () => Array(k+1).fill(0));
    const lst = Array.from({length: data.length+1}, () => Array(k+1).fill(0));
    for (let i=1;i<=k;i++){mat[1][i]=1;mat[2][i]=1;for(let j=3;j<=data.length;j++){mat[j][i]=Infinity;}}
    let v=0;
    for (let l=2;l<=data.length;l++){
      let s1=0,s2=0,w=0;
      for (let m=1;m<=l;m++){
        const lower=l-m+1,val=data[lower-1];
        s2+=val*val;s1+=val;w++;v=s2-(s1*s1)/w;
        if(lower===1){mat[l][1]=v;}
        else{
          for(let j=2;j<=k;j++){
            if(mat[l][j]>=(v+mat[lower-1][j-1])){
              mat[l][j]=v+mat[lower-1][j-1];lst[l][j]=lower;
            }
          }
        }
      }
      mat[l][1]=v;
    }
    const breaks=[];
    let kclass=data.length;
    for(let j=k;j>=1;j--){
      const id=lst[kclass][j]-1;
      breaks.push(data[id]);
      kclass=lst[kclass][j]-1;
      if(kclass<0) break;
    }
    breaks.push(data[0]);
    breaks.sort((a,b)=>a-b);
    return breaks;
  };
  const bks = jenksBreaks(values, 5);
  return [
    {min:0,        max:bks[1], col:palDen[0], lab:`Très faible (≤ ${Math.round(bks[1])})`, desc:'Zones peu denses'},
    {min:bks[1],   max:bks[2], col:palDen[1], lab:`Faible (${Math.round(bks[1])}-${Math.round(bks[2])})`, desc:'Densité inférieure à la moyenne'},
    {min:bks[2],   max:bks[3], col:palDen[2], lab:`Moyenne (${Math.round(bks[2])}-${Math.round(bks[3])})`, desc:'Densité moyenne'},
    {min:bks[3],   max:bks[4], col:palDen[3], lab:`Élevée (${Math.round(bks[3])}-${Math.round(bks[4])})`, desc:'Densité supérieure à la moyenne'},
    {min:bks[4],   max:1e12,  col:palDen[4], lab:`Très élevée (> ${Math.round(bks[4])})`, desc:'Zones très denses'}
  ];
}

/* Charge les fichiers GeoJSON et les normalise */
export async function loadData() {
  const [gov, del, sec] = await Promise.all(Object.values(FILE).map(f => fetch(f).then(r => r.json())));
  [gov, del, sec].forEach(norm);
  return { gov, del, sec };
}
