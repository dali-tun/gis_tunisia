// main.js
fetch('merged_secteurs_optimized.geojson')
  .then(r => r.json())
  .then(data => {
    /* ------------------------------------------------------------------ */
    /* Carte Leaflet                                                      */
    /* ------------------------------------------------------------------ */
    const map = L.map('map').setView([34, 9], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

    /* Couleur par délégation ------------------------------------------ */
    const palette = [
      '#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd',
      '#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'
    ];
    const delegColor = {}; let idx = 0;
    const colDeleg = n => delegColor[n = (n||'—').toLowerCase().trim()]
                     || (delegColor[n] = palette[idx++ % palette.length]);

    /* ------------------------------------------------------------------ */
    /* Panneau Info (Leaflet control)                                     */
    /* ------------------------------------------------------------------ */
    let clicked = null;
    const info = L.control();
    info.onAdd = () => (info._div = L.DomUtil.create('div','info'), info.update(), info._div);

    info.update = p => {
      if (!p || !p.population) {
        info._div.innerHTML = '<h4>Secteur Information</h4><p>Survolez ou cliquez…</p>';
        return;
      }
      const pop = p.population;
      let hTot=0,fTot=0,maxH=['',0],maxF=['',0];
      for (const a in pop) {
        const h=pop[a]?.Masculin??0, f=pop[a]?.Féminin??0;
        hTot+=h; fTot+=f;
        if (h>maxH[1]) maxH=[a,h];
        if (f>maxF[1]) maxF=[a,f];
      }
      const tot = hTot+fTot;
      let html = `<h4>Secteur Information</h4>
                  <strong>${p.name_fr||p.NOM}</strong><br/>
                  <em>Délégation : ${p.NomDelegat||'—'}</em><br/><br/>
                  <table style="border-collapse:collapse;width:100%;">
                  <tr><th>Âge</th><th>👨</th><th>👩</th><th>%</th></tr>`;
      for (const a in pop) {
        const h=pop[a]?.Masculin??0, f=pop[a]?.Féminin??0,
              pct = tot?(((h+f)/tot)*100).toFixed(1)+'%':'0%';
        const stH = a===maxH[0]?'background:#125e87;':'',
              stF = a===maxF[0]?'background:#a61f44;':'';
        html += `<tr><td>${a}</td>
                   <td style="text-align:center;${stH}">${h}</td>
                   <td style="text-align:center;${stF}">${f}</td>
                   <td style="text-align:center;">${pct}</td></tr>`;
      }
      html += `<tr style="font-weight:bold;background:#f1f1f1;">
                 <td>Total</td><td style="text-align:center;">${hTot}</td>
                 <td style="text-align:center;">${fTot}</td>
                 <td style="text-align:center;">100%</td></tr></table>`;
      info._div.innerHTML = html;
    };
    info.addTo(map);

    /* ------------------------------------------------------------------ */
    /* Graphiques Chart.js                                                */
    /* ------------------------------------------------------------------ */
    const maleCtx    = document.getElementById('maleChart').getContext('2d');
    const femaleCtx  = document.getElementById('femaleChart').getContext('2d');
    let maleChart, femaleChart;

    function drawCharts(pop, titre) {
      const ages = Object.keys(pop).sort((a,b)=>parseInt(a)-parseInt(b));
      const males = ages.map(a=>pop[a]?.Masculin??0);
      const females = ages.map(a=>pop[a]?.Féminin??0);

      /* Hommes */
      if (maleChart) {
        maleChart.data.labels = ages;
        maleChart.data.datasets[0].data = males;
        maleChart.options.plugins.title.text = `${titre} – Hommes`;
        maleChart.update();
      } else {
        maleChart = new Chart(maleCtx, {
          type:'bar',
          data:{ labels:ages, datasets:[{ label:'Hommes', data:males, backgroundColor:'#3498db' }]},
          options:{ plugins:{ title:{display:true,text:`${titre} – Hommes`,font:{size:16}} },
                    scales:{ y:{beginAtZero:true} } }
        });
      }

      /* Femmes */
      if (femaleChart) {
        femaleChart.data.labels = ages;
        femaleChart.data.datasets[0].data = females;
        femaleChart.options.plugins.title.text = `${titre} – Femmes`;
        femaleChart.update();
      } else {
        femaleChart = new Chart(femaleCtx, {
          type:'bar',
          data:{ labels:ages, datasets:[{ label:'Femmes', data:females, backgroundColor:'#e76f8a' }]},
          options:{ plugins:{ title:{display:true,text:`${titre} – Femmes`,font:{size:16}} },
                    scales:{ y:{beginAtZero:true} } }
        });
      }
    }

    /* ------------------------------------------------------------------ */
    /* Handlers carte                                                     */
    /* ------------------------------------------------------------------ */
    function hilite(e){
      const l=e.target; l.setStyle({weight:3,color:'#666',fillOpacity:.85});
      l.bringToFront(); if(!clicked) info.update(l.feature.properties);
    }
    function unhilite(e){ geo.resetStyle(e.target); if(!clicked) info.update(); }
    function click(e){
      clicked=e.target;
      const p=clicked.feature.properties;
      info.update(p);
      drawCharts(p.population, p.name_fr||p.NOM);
    }

    /* ------------------------------------------------------------------ */
    /* Ajout GeoJSON                                                      */
    /* ------------------------------------------------------------------ */
    const geo=L.geoJson(data,{
      style:f=>({ fillColor:colDeleg(f.properties.NomDelegat),
                  weight:1,color:'#fff',fillOpacity:.7 }),
      onEachFeature:(f,l)=>{
        l.on({mouseover:hilite,mouseout:unhilite,click});
        l.bindTooltip(`${f.properties.name_fr||f.properties.NOM}`,{direction:'top',offset:[0,-15]});
      }
    }).addTo(map);
  });
