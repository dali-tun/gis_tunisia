/* ---------------- Sécurité double-init ---------------- */
if (L.DomUtil.get('map')?._leaflet_id) {
    L.DomUtil.get('map')._leaflet_id = null;
  }
  
  /* ---------------- Utilitaires ---------------- */
  const ageMid = tr => tr === '80+' ? 82.5
    : (parseInt(tr) + parseInt(tr.split('-')[1])) / 2;
  
  const colorPop = p =>
    p > 5000 ? '#800026' :
    p > 3000 ? '#BD0026' :
    p > 2000 ? '#E31A1C' :
    p > 1000 ? '#FC4E2A' :
    p > 500  ? '#FD8D3C' :
    p > 200  ? '#FEB24C' : '#FED976';
  
  /* ---------------- Chargement & init ------------- */
  fetch('merged_secteurs_optimized.geojson')
    .then(r => r.json())
    .then(data => {
  
    /* Carte */
    const map = L.map('map').setView([34, 9], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution:'&copy; OSM' }).addTo(map);
  
    /* Panneau info */
    const info = L.control();
    info.onAdd = () => (info._div=L.DomUtil.create('div','info'), info.update(), info._div);
  
    info.update = p => {
      if (!p || !p.population) {
        info._div.innerHTML='<h4>Secteur Information</h4><p>Survolez ou cliquez…</p>';
        return;
      }
      const pop=p.population; let hT=0,fT=0,maxH=['',0],maxF=['',0];
      for(const t in pop){
        const h=pop[t].Masculin??0, f=pop[t].Féminin??0;
        hT+=h; fT+=f;
        if(h>maxH[1]) maxH=[t,h];
        if(f>maxF[1]) maxF=[t,f];
      }
      const tot=hT+fT;
      let html=`<h4>Secteur Information</h4>
        <strong>${p.name_fr||p.NOM}</strong><br/>
        <em>Délégation : ${p.NomDelegat||'—'}</em><br/><br/>
        <table><tr><th>Âge</th><th>👨</th><th>👩</th><th>%</th></tr>`;
      for(const t in pop){
        const h=pop[t].Masculin??0,f=pop[t].Féminin??0,
              pct=((h+f)/tot*100).toFixed(1)+'%',
              stH=t===maxH[0]?'background:#125e87;':'',
              stF=t===maxF[0]?'background:#a61f44;':'';
        html+=`<tr><td>${t}</td><td style="${stH}">${h}</td><td style="${stF}">${f}</td><td>${pct}</td></tr>`;
      }
      html+=`<tr style="font-weight:bold;background:#f1f1f1;">
               <td>Total</td><td>${hT}</td><td>${fT}</td><td>100%</td></tr></table>`;
      info._div.innerHTML=html;
    };
    info.addTo(map);
  
    /* Graphiques */
    const mCtx=document.getElementById('maleChart').getContext('2d');
    const fCtx=document.getElementById('femaleChart').getContext('2d');
    let mChart=null, fChart=null;
  
    function drawCharts(pop,title){
      const trs=Object.keys(pop).sort((a,b)=>parseInt(a)-parseInt(b));
      const males   = trs.map(t=>pop[t].Masculin ??0);
      const females = trs.map(t=>pop[t].Féminin  ??0);
  
      if(mChart){mChart.destroy(); mChart=null;}
      if(fChart){fChart.destroy(); fChart=null;}
  
      mChart=new Chart(mCtx,{type:'bar',
        data:{labels:trs,datasets:[{label:'Hommes',data:males,backgroundColor:'#3498db'}]},
        options:{plugins:{title:{display:true,text:`${title} – Hommes`,font:{size:16}}},
                 scales:{y:{beginAtZero:true}}}});
  
      fChart=new Chart(fCtx,{type:'bar',
        data:{labels:trs,datasets:[{label:'Femmes',data:females,backgroundColor:'#e76f8a'}]},
        options:{plugins:{title:{display:true,text:`${title} – Femmes`,font:{size:16}}},
                 scales:{y:{beginAtZero:true}}}});
  
      const totH=males.reduce((a,b)=>a+b,0);
      const totF=females.reduce((a,b)=>a+b,0);
      const total=totH+totF;
      const ratio=(totH/totF).toFixed(2);
  
      const avg=(trs.reduce((s,t,i)=>s+ageMid(t)*(males[i]+females[i]),0)/total).toFixed(1);
  
      let cum=0, medBand=trs[0];
      for(let i=0;i<trs.length;i++){ cum+=males[i]+females[i]; if(cum>=total/2){medBand=trs[i];break;} }
      const med=ageMid(medBand).toFixed(1);
  
      document.getElementById('totalPop').textContent=`Population totale : ${total}`;
      document.getElementById('ratioHF' ).textContent=`Ratio H/F : ${ratio}`;
      document.getElementById('avgAge' ).textContent=`Âge moyen : ${avg}`;
      document.getElementById('medAge' ).textContent=`Âge médian : ${med}`;
    }
  
    /* Couche GeoJSON */
    const geo=L.geoJson(data,{
      style:f=>{
        const tot=Object.values(f.properties.population||{})
                  .reduce((a,b)=>a+b.Masculin+b.Féminin,0);
        return{fillColor:colorPop(tot),weight:1,color:'#fff',fillOpacity:.7};
      },
      onEachFeature:(f,l)=>{
        l.options.inFilter=true;
        l.on({
          mouseover:()=>{ if(l.options.inFilter) l.setStyle({weight:3}); },
          mouseout :()=>{ if(l.options.inFilter) l.setStyle({weight:1}); },
          click    :()=>{
            info.update(f.properties);
            drawCharts(f.properties.population,f.properties.name_fr||f.properties.NOM);
          }
        });
        l.bindTooltip(f.properties.name_fr||f.properties.NOM,{direction:'top',offset:[0,-15]});
      }
    }).addTo(map);
  
    /* Recherche */
    if (L.Control?.Search){
      new L.Control.Search({
        layer: geo,
        propertyName: 'name_fr',
        moveToLocation: ll => map.setView(ll,12)
      }).addTo(map);
    }
  
    /* Filtres */
 /* ---------- Filtres (jeunes / vieux / femmes / hommes) ----------- */
const ageSelect = document.getElementById('ageFilter');
const btnReset  = document.getElementById('resetFilter');

btnReset.onclick = () => {
  ageSelect.value = '';
  geo.eachLayer(l => {
    l.options.inFilter = true;
    l.setStyle({ fillOpacity: 0.7 });
  });
};

ageSelect.onchange = () => {
  const crit = ageSelect.value;

  geo.eachLayer(layer => {
    const pop   = layer.feature.properties.population;
    const total = Object.values(pop).reduce(
      (s,b) => s + (+b.Masculin||0) + (+b["F\u00e9minin"]||0), 0);

    /* sommes < 40 ans et ≥ 40 ans */
    const less40 = [
      '00-04','05-09','10-14','15-19','20-24',
      '25-29','30-34','35-39'
    ].reduce((s,t)=>s + (+pop[t]?.Masculin||0) + (+pop[t]?.["F\u00e9minin"]||0),0);

    const plus40 = total - less40;

    const femTot = Object.values(pop).reduce((s,b)=>s + (+b["F\u00e9minin"]||0),0);
    const masTot = total - femTot;

    /* Application du critère */
    let keep = true;
    switch (crit) {
      case 'jeunes' : keep = less40 / total >= 0.5; break;
      case 'vieux'  : keep = plus40 / total >= 0.5; break;
      case 'femmes' : keep = femTot  / total >= 0.5; break;
      case 'hommes' : keep = masTot  / total >  0.5; break;
      default       : keep = true;
    }

    layer.options.inFilter = keep;
    layer.setStyle({ fillOpacity: keep ? 0.7 : 0.1 });
  });
};

  
  });
  