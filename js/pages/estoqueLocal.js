/* ══════════════════════════════════════════════════
   PAGE: Consulta de Estoque por Local
   (View-only, sem custos — para coz/trl/conf)
   Agrupado por Setor (Cozinha / Trailer)
   Suporta distribuição multi-local via item.distribuicao[]
══════════════════════════════════════════════════ */

function mkEstoqueLocal(){
  const pg=mkPg('estoque-local');
  pg.innerHTML=estoqueLocalHTML();
  return pg;
}

function estoqueLocalHTML(){
  /* Build location → items map using distribuicao + fallback to item.local */
  const all=TIPOS.filter(t=>t.campos.local).flatMap(t=>t.itens);
  const locMap={};

  all.forEach(i=>{
    /* If item has distribuicao array, add entry per location */
    if(i.distribuicao && i.distribuicao.length){
      i.distribuicao.forEach(d=>{
        if(d.qtd<=0)return;
        const key=d.local||'Sem local definido';
        if(!locMap[key])locMap[key]=[];
        locMap[key].push({...i, estqLocal:d.qtd});
      });
      /* Also show remaining qty at primary location if not accounted for */
      const distTotal=(Array.isArray(i.distribuicao)?i.distribuicao:[]).reduce((s,d)=>s+d.qtd,0);
      const remainOnPrimary=(i.estq||0);
      /* Only show primary if it has stock beyond what's distributed elsewhere */
      if(i.local && remainOnPrimary>0){
        const primaryDist=i.distribuicao.find(d=>d.local===i.local);
        if(!primaryDist){
          /* Primary location not in distribuicao — show remaining stock there */
          const key=i.local;
          if(!locMap[key])locMap[key]=[];
          const alreadyAdded=locMap[key]?.find(x=>x.id===i.id);
          if(!alreadyAdded) locMap[key].push({...i, estqLocal:remainOnPrimary});
        }
      }
    } else {
      /* No distribuicao — all stock at primary local */
      const key=i.local||'Sem local definido';
      if(!locMap[key])locMap[key]=[];
      locMap[key].push({...i, estqLocal:i.estq});
    }
  });

  /* Count unique items across all locations */
  const totalEntries=Object.values(locMap).flat().length;
  const crit=all.filter(i=>nvl(i.estq,i.min)==='e').length;
  const low=all.filter(i=>nvl(i.estq,i.min)==='w').length;

  /* Find setor for each local */
  function getSetor(locNome){
    const found=locais.find(l=>l.nome===locNome);
    return found?.setor||'Cozinha';
  }

  const locKeys=Object.keys(locMap).sort();
  const cozLocs=locKeys.filter(l=>getSetor(l)==='Cozinha'||l==='Sem local definido');
  const trlLocs=locKeys.filter(l=>getSetor(l)==='Trailer'&&l!=='Sem local definido');

  /* Filter selects */
  const setorOpts=[
    `<option value="">Todos os setores</option>`,
    `<option value="Cozinha">🍳 Cozinha</option>`,
    `<option value="Trailer">🚌 Trailer</option>`,
  ].join('');
  const filterOpts=locKeys.map(l=>`<option value="${l}">${l}</option>`).join('');

  return`
    <div style="display:flex;gap:10px;margin-bottom:16px;align-items:end;flex-wrap:wrap">
      <div class="fg" style="min-width:150px;margin:0">
        <label class="fl">🏢 Filtrar por Setor</label>
        <select class="fc" id="el-filtro-setor" onchange="filtrarEstoqueLocal()">
          ${setorOpts}
        </select>
      </div>
      <div class="fg" style="min-width:175px;margin:0">
        <label class="fl">📍 Filtrar por local</label>
        <select class="fc" id="el-filtro-local" onchange="filtrarEstoqueLocal()">
          <option value="">Todos os locais</option>
          ${filterOpts}
        </select>
      </div>
      <div class="fg" style="min-width:180px;margin:0">
        <label class="fl">🔍 Buscar item</label>
        <input class="fc" id="el-busca" placeholder="Digite o nome..." oninput="filtrarEstoqueLocal()">
      </div>
      <div class="fg" style="min-width:130px;margin:0">
        <label class="fl">Nível</label>
        <select class="fc" id="el-filtro-nivel" onchange="filtrarEstoqueLocal()">
          <option value="">Todos</option>
          <option value="e">⚠️ Crítico</option>
          <option value="w">⬇️ Baixo</option>
          <option value="o">✅ Normal</option>
        </select>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Itens por Local</div>
        <div class="kv" style="font-size:22px">${totalEntries}</div>
        <div class="ks">${locKeys.length} locais</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Em Alerta</div>
        <div class="kv" style="font-size:22px;color:var(--er)">${crit+low}</div>
        <div class="ks">${crit} críticos, ${low} baixos</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Normais</div>
        <div class="kv" style="font-size:22px;color:var(--ok)">${all.length-crit-low}</div>
        <div class="ks">dentro do mínimo</div>
      </div></div>
    </div>

    ${cozLocs.length?`
      <div class="el-setor-title" data-setor="Cozinha" style="font-size:16px;font-weight:700;margin:18px 0 10px;display:flex;align-items:center;gap:6px">🍳 Cozinha</div>
      <div id="el-cozinha-grid" class="lgrid" data-setor="Cozinha">
        ${cozLocs.map(loc=>renderLocalCard(loc,locMap[loc],getSetor(loc))).join('')}
      </div>
    `:''}

    ${trlLocs.length?`
      <div class="el-setor-title" data-setor="Trailer" style="font-size:16px;font-weight:700;margin:18px 0 10px;display:flex;align-items:center;gap:6px">🚌 Trailer</div>
      <div id="el-trailer-grid" class="lgrid" data-setor="Trailer">
        ${trlLocs.map(loc=>renderLocalCard(loc,locMap[loc],getSetor(loc))).join('')}
      </div>
    `:''}

    ${!totalEntries?`<div class="empty" style="padding:40px 0"><div class="ei" style="font-size:32px">📍</div><div>Nenhum item com local definido</div></div>`:''}`;
}

function renderLocalCard(loc, items, setor){
  const crit=items.filter(i=>nvl(i.estqLocal,i.min)==='e').length;
  const low=items.filter(i=>nvl(i.estqLocal,i.min)==='w').length;
  return`
    <div class="lc el-local-card" data-local="${loc}" data-setor="${setor}">
      <div class="lch" style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:600;font-size:14px">📍 ${loc}</div>
        <div style="display:flex;gap:6px;font-size:11px">
          <span>${items.length} itens</span>
          ${crit?`<span style="color:var(--er)">⚠ ${crit}</span>`:''}
          ${low?`<span style="color:var(--wa)">⬇ ${low}</span>`:''}
        </div>
      </div>
      <table style="margin:0;font-size:13px">
        <thead><tr>
          <th style="font-size:11px">Item</th>
          <th style="font-size:11px;width:100px">Neste Local</th>
          <th style="font-size:11px;width:70px">Nível</th>
        </tr></thead>
        <tbody>
          ${items.map(i=>`<tr class="el-item-row" data-nome="${i.nome.toLowerCase()}" data-nivel="${nvl(i.estqLocal,i.min)}">
            <td><strong>${i.nome}</strong><div style="font-size:11px;color:var(--ink3)">${i.cat||''}</div></td>
            <td style="font-family:'DM Mono',monospace;text-align:center"><strong>${i.estqLocal}</strong> ${i.un}</td>
            <td>${sb(i.estqLocal,i.min)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function rebuildEstoqueLocal(){
  const pg=document.getElementById('pg-estoque-local');if(pg)pg.innerHTML=estoqueLocalHTML();
}

function filtrarEstoqueLocal(){
  const setorFiltro=document.getElementById('el-filtro-setor')?.value||'';
  const localFiltro=document.getElementById('el-filtro-local')?.value||'';
  const busca=(document.getElementById('el-busca')?.value||'').trim().toLowerCase();
  const nivel=document.getElementById('el-filtro-nivel')?.value||'';

  /* Filter sector groups */
  document.querySelectorAll('.lgrid[data-setor]').forEach(grid=>{
    const gridSetor=grid.dataset.setor;
    const matchSetor=!setorFiltro||gridSetor===setorFiltro;
    grid.style.display=matchSetor?'':'none';
  });
  document.querySelectorAll('.el-setor-title').forEach(title=>{
    const titleSetor=title.dataset.setor;
    const matchSetor=!setorFiltro||titleSetor===setorFiltro;
    title.style.display=matchSetor?'':'none';
  });

  /* Filter local cards */
  document.querySelectorAll('.el-local-card').forEach(card=>{
    const cardLocal=card.dataset.local;
    const cardSetor=card.dataset.setor;
    const matchSetor=!setorFiltro||cardSetor===setorFiltro;
    const matchLocal=!localFiltro||cardLocal===localFiltro;
    card.style.display=(matchSetor&&matchLocal)?'':'none';

    if(matchSetor&&matchLocal){
      let visibleRows=0;
      card.querySelectorAll('.el-item-row').forEach(row=>{
        const matchNome=!busca||row.dataset.nome.includes(busca);
        const matchNivel=!nivel||row.dataset.nivel===nivel;
        const show=matchNome&&matchNivel;
        row.style.display=show?'':'none';
        if(show)visibleRows++;
      });
      if(!visibleRows&&(busca||nivel))card.style.display='none';
    }
  });
}
