/*********************************************************************
 *  main.js – Carte démographique + filtres exclusifs
 *  Filtres : majorité jeunes (<40), majorité vieux (≥40),
 *            majorité femmes, majorité hommes
 *********************************************************************/

/* ─── Sécurité double-init (pour hot-reload) ─────────────────────── */
if (L.DomUtil.get('map')?._leaflet_id) {
    L.DomUtil.get('map')._leaflet_id = null;
  }
  
  /* ─── Utilitaires ───────────────────────────────────────────────── */
  const ageMid = tr => tr === '80+' ? 82.5
    : (parseInt(tr) + parseInt(tr.split('-')[1])) / 2;
  
  const colorPop = n =>
    n > 5000 ? '#800026' :
    n > 3000 ? '#BD0026' :
    n > 2000 ? '#E31A1C' :
    n > 1000 ? '#FC4E2A' :
    n >  500 ? '#FD8D3C' :
    n >  200 ? '#FEB24C' : '#FED976';
  
  /* aide conversion numérique sûre */
  const sumMas = v => Number(v?.Masculin        ?? 0);
  const sumFem = v => Number(v?.['F\u00e9minin'] ?? 0);
  
  /* ─── Chargement GeoJSON ───────────────────────────────────────── */
  fetch('merged_secteurs_optimized.geojson')
    .then(r => r.json())
    .then(data => {
  
    /* --- Carte --------------------------------------------------- */
    const map = L.map('map').setView([34, 9], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap' }).addTo(map);
  
    /* --- Panneau info -------------------------------------------- */
    const info = L.control();
    info.onAdd = () =>
      (info._div = L.DomUtil.create('div', 'info'), info.update(), info._div);
  
    info.update = p => {
      if (!p || !p.population) {
        info._div.innerHTML = '<h4>Secteur Information</h4><p>Survolez ou cliquez…</p>';
        return;
      }
      const pop = p.population;
      let hTot = 0, fTot = 0, maxH = ['', 0], maxF = ['', 0];
  
      for (const tr in pop) {
        const h = sumMas(pop[tr]), f = sumFem(pop[tr]);
        hTot += h; fTot += f;
        if (h > maxH[1]) maxH = [tr, h];
        if (f > maxF[1]) maxF = [tr, f];
      }
      const tot = hTot + fTot;
  
      let html = `<h4>Secteur Information</h4>
        <strong>${p.name_fr || p.NOM}</strong><br/>
        <em>Délégation&nbsp;: ${p.NomDelegat || '—'}</em><br/><br/>
        <table><tr><th>Âge</th><th>👨</th><th>👩</th><th>%</th></tr>`;
  
      for (const tr in pop) {
        const h = sumMas(pop[tr]), f = sumFem(pop[tr]),
              pct = ((h + f) / tot * 100).toFixed(1) + '%',
              stH = tr === maxH[0] ? 'background:#125e87;' : '',
              stF = tr === maxF[0] ? 'background:#a61f44;' : '';
  
        html += `<tr><td>${tr}</td>
                  <td style="${stH}">${h}</td>
                  <td style="${stF}">${f}</td>
                  <td>${pct}</td></tr>`;
      }
      html += `<tr style="font-weight:bold;background:#f1f1f1;">
                 <td>Total</td><td>${hTot}</td><td>${fTot}</td><td>100%</td></tr></table>`;
  
      info._div.innerHTML = html;
    };
    info.addTo(map);
  
    /* --- Graphiques ---------------------------------------------- */
    const mCtx = document.getElementById('maleChart').getContext('2d');
    const fCtx = document.getElementById('femaleChart').getContext('2d');
    let mChart = null, fChart = null;
  
    function drawCharts(pop, title) {
      const tr = Object.keys(pop).sort((a, b) => parseInt(a) - parseInt(b));
      const males   = tr.map(t => sumMas(pop[t]));
      const females = tr.map(t => sumFem(pop[t]));
  
      if (mChart) { mChart.destroy(); mChart = null; }
      if (fChart) { fChart.destroy(); fChart = null; }
  
      mChart = new Chart(mCtx, {
        type: 'bar',
        data: { labels: tr, datasets: [{ label: 'Hommes', data: males, backgroundColor: '#3498db' }] },
        options: { plugins: { title: { display: true, text: `${title} – Hommes`, font: { size: 16 } } },
                   scales: { y: { beginAtZero: true } } }
      });
  
      fChart = new Chart(fCtx, {
        type: 'bar',
        data: { labels: tr, datasets: [{ label: 'Femmes', data: females, backgroundColor: '#e76f8a' }] },
        options: { plugins: { title: { display: true, text: `${title} – Femmes`, font: { size: 16 } } },
                   scales: { y: { beginAtZero: true } } }
      });
  
      const totH = males.reduce((a, b) => a + b, 0);
      const totF = females.reduce((a, b) => a + b, 0);
      const total = totH + totF;
      const ratio = (totH / totF).toFixed(2);
  
      const avg = (tr.reduce((s, t, i) => s + ageMid(t) * (males[i] + females[i]), 0) / total).toFixed(1);
  
      let cum = 0, medBand = tr[0];
      for (let i = 0; i < tr.length; i++) {
        cum += males[i] + females[i];
        if (cum >= total / 2) { medBand = tr[i]; break; }
      }
      const med = ageMid(medBand).toFixed(1);
  
      document.getElementById('totalPop').textContent = `Population totale : ${total}`;
      document.getElementById('ratioHF' ).textContent = `Ratio H/F : ${ratio}`;
      document.getElementById('avgAge' ).textContent  = `Âge moyen : ${avg}`;
      document.getElementById('medAge' ).textContent  = `Âge médian : ${med}`;
    }
  
    /* --- GeoJSON -------------------------------------------------- */
    const geo = L.geoJson(data, {
      style: feat => {
        const tot = Object.values(feat.properties.population || {})
          .reduce((a, b) => a + sumMas(b) + sumFem(b), 0);
        return { fillColor: colorPop(tot), weight: 1, color: '#fff', fillOpacity: 0.7 };
      },
      onEachFeature: (feat, layer) => {
        layer.options.inFilter = true;
        layer.on({
          mouseover: () => { if (layer.options.inFilter) layer.setStyle({ weight: 3 }); },
          mouseout : () => { if (layer.options.inFilter) layer.setStyle({ weight: 1 }); },
          click    : () => { info.update(feat.properties);
                             drawCharts(feat.properties.population,
                                        feat.properties.name_fr || feat.properties.NOM); }
        });
        layer.bindTooltip(feat.properties.name_fr || feat.properties.NOM,
                          { direction: 'top', offset: [0, -15] });
      }
    }).addTo(map);
  
    /* --- Recherche ------------------------------------------------ */
    if (L.Control?.Search) {
      new L.Control.Search({
        layer: geo,
        propertyName: 'name_fr',
        moveToLocation: ll => map.setView(ll, 12)
      }).addTo(map);
    }
  
    /* --- Filtres exclusifs --------------------------------------- */
   /* ---------- Filtres exclusifs & masquage total ------------------- */
const sel   = document.getElementById('ageFilter');
const reset = document.getElementById('resetFilter');

reset.onclick = () => {
  sel.value = '';
  geo.eachLayer(l => {
    l.options.inFilter = true;
    l.setStyle({ fillOpacity: 0.7, opacity: 1 });
  });
};

sel.onchange = () => {
  const crit = sel.value;

  geo.eachLayer(layer => {
    const pop = layer.feature.properties.population;

    /* totaux sûrs */
    const total = Object.values(pop)
      .reduce((s,b)=> s + sumMas(b) + sumFem(b), 0);

    const jeunes = [
      '00-04','05-09','10-14','15-19','20-24',
      '25-29','30-34','35-39'
    ].reduce((s,t)=> s + sumMas(pop[t]) + sumFem(pop[t]), 0);

    const vieux   = total - jeunes;
    const femTot  = Object.values(pop).reduce((s,b)=> s + sumFem(b), 0);
    const homTot  = total - femTot;

    /* Exclusivité stricte : > 50 % */
    let keep = true;
    switch (crit) {
      case 'jeunes': keep = jeunes / total > 0.5; break;
      case 'vieux' : keep = vieux  / total > 0.5; break;
      case 'femmes': keep = femTot / total > 0.5; break;
      case 'hommes': keep = homTot / total > 0.5; break;
      default      : keep = true;
    }

    layer.options.inFilter = keep;
    layer.setStyle(
      keep
        ? { fillOpacity: 0.7, opacity: 1 }   // visible normalement
        : { fillOpacity: 0,   opacity: 0 }   // totalement masqué
    );
  });
};

  
  });
  