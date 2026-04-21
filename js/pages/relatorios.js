/* ══════════════════════════════════════════════════
   PAGE: Relatórios — 6 relatórios automáticos (Admin)
══════════════════════════════════════════════════ */

function mkRelatorios(){
  const pg=mkPg('relatorios');
  pg.innerHTML=relatoriosHTML();
  return pg;
}
function rebuildRelatorios(){
  const pg=document.getElementById('pg-relatorios');
  if(pg) pg.innerHTML=relatoriosHTML();
}

/* F10: Filtro de data global */
let relFiltro = { de: null, ate: null };

function setRelPeriodo(preset) {
  const now = new Date();
  const ate = new Date(now); ate.setHours(23,59,59,999);
  let de = new Date(now);
  if (preset === '7d') { de.setDate(de.getDate()-6); de.setHours(0,0,0,0); }
  else if (preset === '30d') { de.setDate(de.getDate()-29); de.setHours(0,0,0,0); }
  else if (preset === '1y') { de.setFullYear(de.getFullYear()-1); de.setHours(0,0,0,0); }
  else if (preset === 'custom') {
    const deDe = document.getElementById('rel-de').value;
    const deAte = document.getElementById('rel-ate').value;
    if (!deDe || !deAte) { toast('⚠ Informe as datas de início e fim.'); return; }
    relFiltro = { de: new Date(deDe+'T00:00:00'), ate: new Date(deAte+'T23:59:59') };
    rebuildRelatorios(); return;
  } else {
    relFiltro = { de: null, ate: null };
    rebuildRelatorios(); return;
  }
  relFiltro = { de, ate };
  rebuildRelatorios();
}

function filtrarPorData(items, getTs) {
  if (!relFiltro.de && !relFiltro.ate) return items;
  return items.filter(item => {
    const ts = getTs(item);
    if (!ts) return true; /* sem data: incluir */
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (relFiltro.de && d < relFiltro.de) return false;
    if (relFiltro.ate && d > relFiltro.ate) return false;
    return true;
  });
}

function relFiltroLabel() {
  if (!relFiltro.de && !relFiltro.ate) return 'Todos os períodos';
  const fmt = d => d.toLocaleDateString('pt-BR');
  return `${fmt(relFiltro.de)} → ${fmt(relFiltro.ate)}`;
}


function relatoriosHTML(){
  const btnStyle = () => '';
  return`
    <div style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink3)">Relatórios automáticos do ChefStock — dados em tempo real.</div>
    </div>
    <!-- F10: Filtro de data -->
    <div class="panel" style="margin-bottom:16px">
      <div class="pb" style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:600;color:var(--ink3)">📅 Período:</span>
          <button class="btn btn-g btn-sm" onclick="setRelPeriodo('all')">Tudo</button>
          <button class="btn btn-g btn-sm" onclick="setRelPeriodo('7d')">Últimos 7 dias</button>
          <button class="btn btn-g btn-sm" onclick="setRelPeriodo('30d')">Últimos 30 dias</button>
          <button class="btn btn-g btn-sm" onclick="setRelPeriodo('1y')">Último ano</button>
          <span style="font-size:11px;color:var(--ink3);margin-left:4px">Personalizado:</span>
          <input type="date" id="rel-de" class="fc" style="font-size:11px;padding:4px 8px;width:130px">
          <span style="font-size:11px;color:var(--ink3)">→</span>
          <input type="date" id="rel-ate" class="fc" style="font-size:11px;padding:4px 8px;width:130px">
          <button class="btn btn-r btn-sm" onclick="setRelPeriodo('custom')">Filtrar</button>
          ${relFiltro.de?`<span style="font-size:11px;background:var(--pr);color:#fff;padding:2px 8px;border-radius:10px">${relFiltroLabel()}</span>`:''}
        </div>
      </div>
    </div>
    <div class="tabs">
      <div class="tab on" onclick="stab(this,'tr-resumo')">📦 Resumo Geral</div>
      <div class="tab" onclick="stab(this,'tr-criticos')">⚠️ Itens Críticos</div>
      <div class="tab" onclick="stab(this,'tr-movs')">📋 Movimentações</div>
      <div class="tab" onclick="stab(this,'tr-transf')">🔄 Transferências</div>
      <div class="tab" onclick="stab(this,'tr-prod')">🍳 Produção</div>
      <div class="tab" onclick="stab(this,'tr-forn')">🚛 Fornecedores</div>
      <div class="tab" onclick="stab(this,'tr-graficos');initCharts()">📈 Gráficos</div>
      <div class="tab" onclick="stab(this,'tr-confs');loadRelConfs()">📋 Conferências</div>
      <div class="tab" onclick="stab(this,'tr-forn-hist');loadRelPrecos()">💰 Preços/Fornec.</div>
    </div>
    <div class="tp on" id="tr-resumo">${relResumoGeral()}</div>
    <div class="tp" id="tr-criticos">${relItensCriticos()}</div>
    <div class="tp" id="tr-movs">${relMovimentacoes()}</div>
    <div class="tp" id="tr-transf">${relTransferencias()}</div>
    <div class="tp" id="tr-prod">${relProducao()}</div>
    <div class="tp" id="tr-forn">${relFornecedores()}</div>
    <div class="tp" id="tr-graficos">${relGraficosHTML()}</div>
    <div class="tp" id="tr-confs"><div class="empty" style="padding:28px"><div class="ei">📋</div>Clique na aba para carregar</div></div>
    <div class="tp" id="tr-forn-hist"><div class="empty" style="padding:28px"><div class="ei">💰</div>Clique na aba para carregar</div></div>`;
}


/* ════════════════════════════════════════
   0. GRÁFICOS — Chart.js
════════════════════════════════════════ */
let _charts={}; /* cache de instâncias de Chart.js */

function relGraficosHTML(){
  return`
  <div class="charts-grid">
    <div class="panel" style="padding:18px">
      <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--ink2)">📦 Compras por Mês (últimos 6 meses)</div>
      <div style="position:relative;height:220px"><canvas id="chart-compras"></canvas></div>
    </div>
    <div class="panel" style="padding:18px">
      <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--ink2)">💰 Valor de Estoque por Tipo</div>
      <div style="position:relative;height:220px"><canvas id="chart-tipo"></canvas></div>
    </div>
    <div class="panel charts-full" style="padding:18px">
      <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--ink2)">🔥 Top 10 Insumos mais Consumidos</div>
      <div style="position:relative;height:220px"><canvas id="chart-insumos"></canvas></div>
    </div>
  </div>`;
}

function initCharts(){
  /* Aguarda o DOM renderizar os <canvas> */
  requestAnimationFrame(()=>{
    _buildChartCompras();
    _buildChartTipo();
    _buildChartInsumos();
  });
}

function _destroyChart(id){
  if(_charts[id]){_charts[id].destroy();delete _charts[id];}
}

/* ── Gráfico 1: Compras por mês ── */
function _buildChartCompras(){
  _destroyChart('compras');
  const ctx=document.getElementById('chart-compras');
  if(!ctx||typeof Chart==='undefined') return;

  /* Monta os últimos 6 meses */
  const meses=[];
  const valores=[];
  const now=new Date();
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const label=d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
    meses.push(label);
    const total=recebimentos.filter(r=>{
      const ts=r.ts?.toDate?.()??parseLegacyData(r.data);
      const rd=ts instanceof Date?ts:new Date(ts);
      return rd.getFullYear()===d.getFullYear()&&rd.getMonth()===d.getMonth();
    }).reduce((s,r)=>s+(r.valor||0),0);
    valores.push(parseFloat(total.toFixed(2)));
  }

  _charts['compras']=new Chart(ctx,{
    type:'bar',
    data:{
      labels:meses,
      datasets:[{
        label:'Valor em Compras (R$)',
        data:valores,
        backgroundColor:'rgba(200,107,58,0.75)',
        borderColor:'#c86b3a',
        borderWidth:1.5,
        borderRadius:6,
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`R$ ${c.raw.toLocaleString('pt-BR',{minimumFractionDigits:2})}`}}},
      scales:{y:{beginAtZero:true,ticks:{callback:v=>`R$ ${v.toLocaleString('pt-BR')}`},grid:{color:'rgba(0,0,0,.05)'}},x:{grid:{display:false}}}
    }
  });
}

/* ── Gráfico 2: Valor de estoque por tipo ── */
function _buildChartTipo(){
  _destroyChart('tipo');
  const ctx=document.getElementById('chart-tipo');
  if(!ctx||typeof Chart==='undefined') return;

  const palette=['#c86b3a','#2d6142','#1c3455','#6b2fa0','#7a3b00','#c89a00','#1c4585','#a02800'];
  const labels=[];
  const valores=[];
  TIPOS.forEach(t=>{
    const val=t.itens.reduce((s,i)=>s+((i.custo||0)*(getEstqTotal(i)||0)),0);
    if(val>0){labels.push(t.icon?`${t.icon} ${t.nome}`:t.nome);valores.push(parseFloat(val.toFixed(2)));}
  });

  _charts['tipo']=new Chart(ctx,{
    type:'doughnut',
    data:{
      labels,
      datasets:[{data:valores,backgroundColor:palette.slice(0,labels.length),borderWidth:2,borderColor:'#fff',hoverOffset:8}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'58%',
      plugins:{
        legend:{position:'right',labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{label:c=>`${c.label}: R$ ${c.raw.toLocaleString('pt-BR',{minimumFractionDigits:2})}`}}
      }
    }
  });
}

/* ── Gráfico 3: Top 10 insumos consumidos ── */
function _buildChartInsumos(){
  _destroyChart('insumos');
  const ctx=document.getElementById('chart-insumos');
  if(!ctx||typeof Chart==='undefined') return;

  /* Agrega consumo por insumo em todas as produções finalizadas */
  const mapa={};
  producoes.filter(p=>p.status==='finalizada').forEach(p=>{
    (p.insumos||[]).forEach(ins=>{
      mapa[ins.nome]=(mapa[ins.nome]||0)+ins.qtd;
    });
  });
  const entries=Object.entries(mapa).sort(([,a],[,b])=>b-a).slice(0,10);
  const labels=entries.map(([n])=>n);
  const valores=entries.map(([,v])=>parseFloat(v.toFixed(2)));

  _charts['insumos']=new Chart(ctx,{
    type:'bar',
    data:{
      labels,
      datasets:[{label:'Qtd. Total Consumida',data:valores,backgroundColor:'rgba(44,97,66,0.75)',borderColor:'#2d6142',borderWidth:1.5,borderRadius:6}]
    },
    options:{
      indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw} un.`}}},
      scales:{x:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'}},y:{grid:{display:false},ticks:{font:{size:11}}}}
    }
  });
}

/* ════════════════════════════════════════
   1. RESUMO GERAL DE ESTOQUE
════════════════════════════════════════ */
function relResumoGeral(){
  const all=getAllItems();
  const totalItens=all.length;
  const valorTotal=all.reduce((s,i)=>{
    const total=getEstqTotal(i);
    return s+(total*(i.custo||0));
  },0);
  const crit=all.filter(i=>nvl(getEstqTotal(i),i.min)==='e').length;
  const baixo=all.filter(i=>nvl(getEstqTotal(i),i.min)==='w').length;
  const normal=totalItens-crit-baixo;

  /* Distribution by sector */
  let qtdCozinha=0, qtdTrailer=0;
  all.forEach(i=>{
    qtdCozinha+=(i.estq||0);
    if(i.distribuicao) i.distribuicao.forEach(d=>{
      const loc=locais.find(l=>l.nome===d.local);
      if(loc?.setor==='Trailer') qtdTrailer+=d.qtd;
      else qtdCozinha+=d.qtd;
    });
  });

  /* Per type breakdown */
  const tipoRows=TIPOS.map(t=>{
    const tItens=t.itens;
    const tValor=tItens.reduce((s,i)=>s+(getEstqTotal(i)*(i.custo||0)),0);
    const tCrit=tItens.filter(i=>nvl(getEstqTotal(i),i.min)==='e').length;
    const tBaixo=tItens.filter(i=>nvl(getEstqTotal(i),i.min)==='w').length;
    return`<tr>
      <td>${t.icon} <strong>${t.nome}</strong></td>
      <td style="text-align:center">${tItens.length}</td>
      <td style="text-align:center">${tCrit?`<span class="bdg ber">${tCrit}</span>`:'—'}</td>
      <td style="text-align:center">${tBaixo?`<span class="bdg bwa">${tBaixo}</span>`:'—'}</td>
      <td style="font-family:'DM Mono',monospace;text-align:right">${brl(tValor)}</td>
    </tr>`;
  }).join('');

  /* Per category breakdown */
  const catMap={};
  all.forEach(i=>{
    const c=i.cat||'Sem categoria';
    if(!catMap[c]) catMap[c]={count:0,valor:0,crit:0};
    catMap[c].count++;
    catMap[c].valor+=getEstqTotal(i)*(i.custo||0);
    if(nvl(getEstqTotal(i),i.min)==='e') catMap[c].crit++;
  });
  const catRows=Object.entries(catMap).sort((a,b)=>b[1].valor-a[1].valor).map(([cat,d])=>
    `<tr><td><strong>${cat}</strong></td><td style="text-align:center">${d.count}</td>
     <td style="text-align:center">${d.crit?`<span class="bdg ber">${d.crit}</span>`:'—'}</td>
     <td style="font-family:'DM Mono',monospace;text-align:right">${brl(d.valor)}</td></tr>`
  ).join('');

  /* ── CMV: Custo das Mercadorias Vendidas ── */
  /* CMV = Ei + Compras − Ef
     Ei é estimado retroativamente: Ef − Compras (aproximação quando não há snapshot)
     Compras = soma dos valores das NFs filtradas no período */
  const recebFilt = filtrarPorData(recebimentos, r => {
    /* recebimento.data é "DD/MM HH:MM" ou "DD/MM/YYYY HH:MM" */
    if (!r.data) return null;
    const parts = r.data.split(' ');
    const datePart = parts[0]; // "DD/MM" ou "DD/MM/YYYY"
    const segs = datePart.split('/');
    const now = new Date();
    const day = parseInt(segs[0]) || 1;
    const month = parseInt(segs[1]) - 1;
    const year = segs[2] ? parseInt(segs[2]) : now.getFullYear();
    return new Date(year, month, day);
  });
  const comprasPeriodo = recebFilt.reduce((s, r) => s + (r.valor || 0), 0);
  const estoqueAtual = valorTotal; /* já calculado acima */
  /* Estimativa: Ei ≈ Ef − Compras (assume que o estoque no início do período
     era o atual menos o que foi comprado — válido quando o giro é pelo período) */
  const estoqueInicial = Math.max(0, estoqueAtual - comprasPeriodo);
  const cmvEstimado = estoqueInicial + comprasPeriodo - estoqueAtual;
  /* Margem de contribuição bruta: quanto das compras "saiu" do estoque (consumo) */
  const cmvPositivo = Math.max(0, cmvEstimado);
  const pctConsumo = comprasPeriodo > 0 ? Math.round(cmvPositivo / comprasPeriodo * 100) : 0;

  const temFiltro = !!(relFiltro.de && relFiltro.ate);
  const cmvLabel = temFiltro ? relFiltroLabel() : 'período completo';

  return`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Total de Itens</div>
        <div class="kv" style="font-size:24px">${totalItens}</div>
        <div class="ks">${TIPOS.length} tipos cadastrados</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Valor Estimado do Estoque</div>
        <div class="kv" style="font-size:22px;color:var(--ok)">${brl(valorTotal)}</div>
        <div class="ks">soma de (qtd × custo)</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Em Alerta</div>
        <div class="kv" style="font-size:24px;color:var(--er)">${crit+baixo}</div>
        <div class="ks">${crit} críticos · ${baixo} baixos · ${normal} normais</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Distribuição por Setor</div>
        <div class="kv" style="font-size:18px">🍳 ${Math.round(qtdCozinha)} / 🚌 ${Math.round(qtdTrailer)}</div>
        <div class="ks">Cozinha / Trailer (unidades)</div>
      </div></div>
    </div>

    <!-- CMV Card -->
    <div class="panel" style="margin-bottom:20px">
      <div class="pb" style="padding:16px 18px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">📉</span>
            <div>
              <div style="font-weight:700;font-size:14px">CMV — Custo das Mercadorias Vendidas</div>
              <div style="font-size:11px;color:var(--ink3);margin-top:1px">Estimado por variação de estoque · ${cmvLabel}</div>
            </div>
          </div>
          ${!temFiltro ? `<div class="al al-wa" style="margin:0;padding:6px 12px;font-size:11px">⚠️ Selecione um período acima para uma estimativa mais precisa</div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
          <!-- Estoque Inicial estimado -->
          <div style="background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2);padding:12px 14px">
            <div class="kl" style="margin-bottom:5px">Estoque Inicial (est.)</div>
            <div style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:var(--ink)">${brl(estoqueInicial)}</div>
            <div style="font-size:10px;color:var(--ink3);margin-top:3px">Ef − Compras do período</div>
          </div>
          <!-- Compras (Entradas NF) -->
          <div style="background:var(--in-l);border:1px solid var(--in-b);border-radius:var(--r2);padding:12px 14px">
            <div class="kl" style="margin-bottom:5px;color:var(--in)">+ Compras (Entradas NF)</div>
            <div style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:var(--in)">${brl(comprasPeriodo)}</div>
            <div style="font-size:10px;color:var(--ink3);margin-top:3px">${recebFilt.length} nota(s) no período</div>
          </div>
          <!-- Estoque Final -->
          <div style="background:var(--ok-l);border:1px solid var(--ok-b);border-radius:var(--r2);padding:12px 14px">
            <div class="kl" style="margin-bottom:5px;color:var(--ok)">− Estoque Final (atual)</div>
            <div style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:var(--ok)">${brl(estoqueAtual)}</div>
            <div style="font-size:10px;color:var(--ink3);margin-top:3px">valor total em estoque agora</div>
          </div>
          <!-- CMV Resultado -->
          <div style="background:${cmvPositivo > 0 ? 'var(--wa-l)' : 'var(--bg)'};border:2px solid ${cmvPositivo > 0 ? 'var(--wa-b)' : 'var(--bdr)'};border-radius:var(--r2);padding:12px 14px">
            <div class="kl" style="margin-bottom:5px;color:${cmvPositivo > 0 ? 'var(--wa)' : 'var(--ink3)'}">= CMV Estimado</div>
            <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:${cmvPositivo > 0 ? 'var(--wa)' : 'var(--ink3)'}">${brl(cmvPositivo)}</div>
            <div style="font-size:10px;color:var(--ink3);margin-top:3px">${pctConsumo}% das compras consumidas</div>
          </div>
        </div>

        <!-- Fórmula explicativa -->
        <div style="margin-top:12px;padding:8px 12px;background:var(--bg);border-radius:var(--r2);font-size:11px;color:var(--ink3);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span>📐 Fórmula:</span>
          <span style="font-family:'DM Mono',monospace">CMV = Estoque Inicial + Compras − Estoque Final</span>
          <span>·</span>
          <span style="font-family:'DM Mono',monospace">${brl(estoqueInicial)} + ${brl(comprasPeriodo)} − ${brl(estoqueAtual)} = <strong style="color:${cmvPositivo > 0 ? 'var(--wa)' : 'var(--ink)'}">${brl(cmvPositivo)}</strong></span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="panel" style="margin:0"><div class="pb">
        <div class="form-section-title" style="font-size:13px">📊 Estoque por Tipo</div>
        <div class="tw"><table>
          <thead><tr><th>Tipo</th><th>Itens</th><th>Crítico</th><th>Baixo</th><th>Valor Est.</th></tr></thead>
          <tbody>${tipoRows}</tbody>
          <tfoot><tr style="font-weight:700;border-top:2px solid var(--bdr)">
            <td>Total</td><td style="text-align:center">${totalItens}</td>
            <td style="text-align:center">${crit}</td><td style="text-align:center">${baixo}</td>
            <td style="font-family:'DM Mono',monospace;text-align:right">${brl(valorTotal)}</td>
          </tr></tfoot>
        </table></div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb">
        <div class="form-section-title" style="font-size:13px">📂 Estoque por Categoria</div>
        <div class="tw" style="max-height:300px;overflow-y:auto"><table>
          <thead><tr><th>Categoria</th><th>Itens</th><th>Crítico</th><th>Valor Est.</th></tr></thead>
          <tbody>${catRows}</tbody>
        </table></div>
      </div></div>
    </div>`;
}

/* ══════════════════════════════════════
   2. ITENS CRÍTICOS E PREVISÃO
══════════════════════════════════════ */
function relItensCriticos(){
  const all=getAllItems();
  const criticos=all.filter(i=>nvl(getEstqTotal(i),i.min)==='e')
    .sort((a,b)=>(getEstqTotal(a)/Math.max(a.min,0.1))-(getEstqTotal(b)/Math.max(b.min,0.1)));
  const baixos=all.filter(i=>nvl(getEstqTotal(i),i.min)==='w')
    .sort((a,b)=>(getEstqTotal(a)/Math.max(a.min,0.1))-(getEstqTotal(b)/Math.max(b.min,0.1)));
  const proximoMin=all.filter(i=>{
    const t=getEstqTotal(i);
    const n=nvl(t,i.min);
    return n==='o' && i.min>0 && t<i.min*1.5;
  });

  /* Items with expiration date approaching */
  const today=new Date().toISOString().split('T')[0];
  const nextMonth=new Date(Date.now()+30*86400000).toISOString().split('T')[0];
  const vencendo=all.filter(i=>i.val && i.val>=today && i.val<=nextMonth)
    .sort((a,b)=>a.val.localeCompare(b.val));
  const vencidos=all.filter(i=>i.val && i.val<today);

  const critRows=criticos.map(i=>{
    const tipo=getTipoByItem(i.id);
    const total=getEstqTotal(i);
    const deficit=i.min-total;
    return`<tr>
      <td><strong>${i.nome}</strong><div style="font-size:10px;color:var(--ink3)">${tipo?.icon||''} ${tipo?.nome||''}</div></td>
      <td style="text-align:center"><span class="chip">${i.cat||'—'}</span></td>
      <td style="font-family:'DM Mono',monospace;text-align:center;color:var(--er)"><strong>${total}</strong> ${i.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${i.min} ${i.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;color:var(--er)"><strong>-${deficit.toFixed(1)}</strong> ${i.un}</td>
      <td>${i.forn||'—'}</td>
    </tr>`;
  }).join('');

  const baixoRows=baixos.map(i=>{
    const total=getEstqTotal(i);
    return`<tr>
      <td><strong>${i.nome}</strong></td>
      <td style="text-align:center"><span class="chip">${i.cat||'—'}</span></td>
      <td style="font-family:'DM Mono',monospace;text-align:center;color:var(--wa)">${total} ${i.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${i.min} ${i.un}</td>
      <td>${i.forn||'—'}</td>
    </tr>`;
  }).join('');

  return`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">⚠️ Críticos</div>
        <div class="kv" style="font-size:28px;color:var(--er)">${criticos.length}</div>
        <div class="ks">abaixo de 20% do mínimo</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">⬇️ Estoque Baixo</div>
        <div class="kv" style="font-size:28px;color:var(--wa)">${baixos.length}</div>
        <div class="ks">abaixo do mínimo</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">📉 Próx. do Mínimo</div>
        <div class="kv" style="font-size:28px;color:#e67e22">${proximoMin.length}</div>
        <div class="ks">entre 1x e 1.5x do mín</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">📅 Vencimento Próx.</div>
        <div class="kv" style="font-size:28px;color:var(--wa)">${vencendo.length+vencidos.length}</div>
        <div class="ks">${vencidos.length} vencidos · ${vencendo.length} nos próx. 30d</div>
      </div></div>
    </div>

    ${criticos.length?`
    <div class="panel" style="margin-bottom:16px"><div class="pb">
      <div class="form-section-title" style="font-size:13px;color:var(--er)">⚠️ Itens em Nível Crítico (${criticos.length})</div>
      <div class="tw"><table>
        <thead><tr><th>Item</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th>Déficit</th><th>Fornecedor</th></tr></thead>
        <tbody>${critRows}</tbody>
      </table></div>
    </div></div>`:''}

    ${baixos.length?`
    <div class="panel" style="margin-bottom:16px"><div class="pb">
      <div class="form-section-title" style="font-size:13px;color:var(--wa)">⬇️ Estoque Baixo (${baixos.length})</div>
      <div class="tw"><table>
        <thead><tr><th>Item</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th>Fornecedor</th></tr></thead>
        <tbody>${baixoRows}</tbody>
      </table></div>
    </div></div>`:''}

    ${vencendo.length||vencidos.length?`
    <div class="panel"><div class="pb">
      <div class="form-section-title" style="font-size:13px">📅 Itens com Validade Próxima / Vencidos</div>
      <div class="tw"><table>
        <thead><tr><th>Item</th><th>Validade</th><th>Status</th><th>Estoque</th></tr></thead>
        <tbody>${[...vencidos,...vencendo].map(i=>{
          const venc=i.val<today;
          return`<tr><td><strong>${i.nome}</strong></td>
            <td style="font-family:'DM Mono',monospace">${i.val}</td>
            <td><span class="bdg ${venc?'ber':'bwa'}">${venc?'⚠ Vencido':'Próximo'}</span></td>
            <td style="font-family:'DM Mono',monospace">${getEstqTotal(i)} ${i.un}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div></div>`:''}

    ${!criticos.length&&!baixos.length?`<div class="al al-ok" style="margin-top:10px">✅ Todos os itens estão com estoque dentro do esperado!</div>`:''}`;
}

/* ══════════════════════════════════════
   3. MOVIMENTAÇÕES DE ESTOQUE
══════════════════════════════════════ */
function relMovimentacoes(){
  /* F10: Filtrar atividades por data */
  const atividadesFilt = filtrarPorData(atividades, a => a.ts);
  /* Group activities by type */
  const ajustes=atividadesFilt.filter(a=>a.tipo==='ajuste');
  const inventarios=atividadesFilt.filter(a=>a.tipo==='inventario');
  const recebs=atividadesFilt.filter(a=>a.tipo==='recebimento');
  const exclusoes=atividadesFilt.filter(a=>a.tipo==='exclusao');
  const cadastros=atividadesFilt.filter(a=>a.tipo==='cadastro');
  const producaoAts=atividadesFilt.filter(a=>a.tipo==='producao');

  const total=atividadesFilt.length;
  const recebTotal=recebimentos.length;
  const totalRecebs=recebimentos.reduce((s,r)=>s+(r.itens?.length||0),0);

  /* Recent activities table */
  const recentRows=atividadesFilt.slice(0,30).map(a=>{
    const ts=a.ts?.toDate?.()?.toLocaleDateString('pt-BR')||'—';
    return`<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${ts}</td>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${a.hora||'—'}</td>
      <td><span class="chip">${a.tipo||'—'}</span></td>
      <td style="font-size:12px">${a.texto||'—'}</td>
      <td style="font-size:12px">${a.usuario||'—'}</td>
    </tr>`;
  }).join('');

  return`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Total de Atividades</div>
        <div class="kv" style="font-size:24px">${total}</div>
        <div class="ks">registradas no sistema</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">📦 Ajustes</div>
        <div class="kv" style="font-size:24px">${ajustes.length}</div>
        <div class="ks">${inventarios.length} inventários</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">📥 Recebimentos NF</div>
        <div class="kv" style="font-size:24px">${recebTotal}</div>
        <div class="ks">${totalRecebs} itens recebidos</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">🗑️ Exclusões</div>
        <div class="kv" style="font-size:24px">${exclusoes.length}</div>
        <div class="ks">${cadastros.length} cadastros</div>
      </div></div>
    </div>

    <div class="panel"><div class="pb">
      <div class="form-section-title" style="font-size:13px">📋 Últimas 30 Atividades</div>
      ${recentRows?`<div class="tw" style="max-height:400px;overflow-y:auto"><table>
        <thead><tr><th>Data</th><th>Hora</th><th>Tipo</th><th>Descrição</th><th>Usuário</th></tr></thead>
        <tbody>${recentRows}</tbody>
      </table></div>`:`<div class="empty" style="padding:20px 0"><div class="ei">📋</div><div>Nenhuma atividade registrada</div></div>`}
    </div></div>`;
}

/* ══════════════════════════════════════
   4. TRANSFERÊNCIAS COZINHA ↔ TRAILER
══════════════════════════════════════ */
function relTransferencias(){
  /* F10: Filtrar solicitações por data */
  const solsFilt = filtrarPorData(solicitacoes, s => s.ts);
  const total=solsFilt.length;
  const finalizadas=solsFilt.filter(s=>s.status==='finalizado');
  const pendentes=solsFilt.filter(s=>s.status==='pendente');
  const emAndamento=solsFilt.filter(s=>['aprovada','parcial','retirado','enviado'].includes(s.status));
  const recusadas=solsFilt.filter(s=>s.status==='recusada');

  /* Most transferred items */
  const itemCount={};
  solsFilt.forEach(s=>{
    s.itens?.forEach(it=>{
      if(!itemCount[it.nome]) itemCount[it.nome]={nome:it.nome,un:it.un||'un',qtdTotal:0,vezes:0};
      itemCount[it.nome].qtdTotal+=(it.qtd||0);
      itemCount[it.nome].vezes++;
    });
  });
  const topItems=Object.values(itemCount).sort((a,b)=>b.qtdTotal-a.qtdTotal).slice(0,10);

  /* History table */
  const histRows=solsFilt.slice(0,20).map(s=>{
    const itensCount=s.itens?.length||0;
    const aprovados=s.itens?.filter(i=>i.status==='aprovado').length||0;
    return`<tr>
      <td><span class="chip">${s.id}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${s.hora||'—'}</td>
      <td style="text-align:center">${itensCount} itens</td>
      <td style="text-align:center">${aprovados} aprov.</td>
      <td>${stBdg(s.status)}</td>
      <td style="font-size:12px">${s.de||'—'}</td>
    </tr>`;
  }).join('');

  return`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Total de Solicitações</div>
        <div class="kv" style="font-size:24px">${total}</div>
        <div class="ks">${finalizadas.length} finalizadas</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">⏳ Pendentes</div>
        <div class="kv" style="font-size:24px;color:var(--wa)">${pendentes.length}</div>
        <div class="ks">${emAndamento.length} em andamento</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">✅ Finalizadas</div>
        <div class="kv" style="font-size:24px;color:var(--ok)">${finalizadas.length}</div>
        <div class="ks">${total?Math.round(finalizadas.length/total*100):0}% do total</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">✗ Recusadas</div>
        <div class="kv" style="font-size:24px;color:var(--er)">${recusadas.length}</div>
        <div class="ks">${total?Math.round(recusadas.length/total*100):0}% do total</div>
      </div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="panel" style="margin:0"><div class="pb">
        <div class="form-section-title" style="font-size:13px">🏆 Itens Mais Transferidos</div>
        ${topItems.length?`<div class="tw"><table>
          <thead><tr><th>Item</th><th>Qtd Total</th><th>Nº Pedidos</th></tr></thead>
          <tbody>${topItems.map((it,idx)=>`<tr>
            <td><strong>${idx+1}.</strong> ${it.nome}</td>
            <td style="font-family:'DM Mono',monospace;text-align:center">${it.qtdTotal} ${it.un}</td>
            <td style="text-align:center">${it.vezes}x</td>
          </tr>`).join('')}</tbody>
        </table></div>`:`<div class="empty" style="padding:16px 0"><div>Nenhuma transferência registrada</div></div>`}
      </div></div>

      <div class="panel" style="margin:0"><div class="pb">
        <div class="form-section-title" style="font-size:13px">📊 Resumo por Status</div>
        <div style="display:flex;flex-direction:column;gap:8px;padding:10px 0">
          ${[
            {label:'Pendentes',count:pendentes.length,color:'var(--wa)',icon:'⏳'},
            {label:'Em Andamento',count:emAndamento.length,color:'var(--pr)',icon:'🔄'},
            {label:'Finalizadas',count:finalizadas.length,color:'var(--ok)',icon:'✅'},
            {label:'Recusadas',count:recusadas.length,color:'var(--er)',icon:'✗'},
          ].map(s=>{
            const pct=total?Math.round(s.count/total*100):0;
            return`<div style="display:flex;align-items:center;gap:10px">
              <div style="width:100px;font-size:12px">${s.icon} ${s.label}</div>
              <div style="flex:1;height:20px;background:var(--bg);border-radius:10px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${s.color};border-radius:10px;transition:.3s"></div>
              </div>
              <div style="width:50px;text-align:right;font-size:12px;font-weight:600">${s.count}</div>
            </div>`;
          }).join('')}
        </div>
      </div></div>
    </div>

    <div class="panel"><div class="pb">
      <div class="form-section-title" style="font-size:13px">📋 Histórico de Solicitações (últimas 20)</div>
      ${histRows?`<div class="tw" style="max-height:350px;overflow-y:auto"><table>
        <thead><tr><th>ID</th><th>Data/Hora</th><th>Itens</th><th>Aprovados</th><th>Status</th><th>Solicitante</th></tr></thead>
        <tbody>${histRows}</tbody>
      </table></div>`:`<div class="empty" style="padding:20px 0"><div>Sem solicitações</div></div>`}
    </div></div>`;
}

/* ══════════════════════════════════════
   5. RELATÓRIO DE PRODUÇÃO
══════════════════════════════════════ */
function relProducao(){
  /* F10: Filtrar produções por data */
  const producoesFilt = filtrarPorData(producoes, p => {
    if (p.ts) return p.ts;
    /* Tentar parsear data string DD/MM/YYYY */
    if (p.data) {
      const [d,m,y] = p.data.split('/').map(Number);
      if (y) return new Date(y,m-1,d);
      if (m) {
        const yr = new Date().getFullYear();
        return new Date(yr,m-1,d);
      }
    }
    return null;
  });
  const totalProd=producoesFilt.length;
  const finalizadas=producoesFilt.filter(p=>p.status==='finalizada');
  const emAndamento=producoesFilt.filter(p=>p.status==='em_andamento');

  /* Total produced */
  const totalQtd=finalizadas.reduce((s,p)=>s+(p.qtdProduzida||0),0);

  /* Most produced items */
  const prodCount={};
  finalizadas.forEach(p=>{
    if(!prodCount[p.produto]) prodCount[p.produto]={nome:p.produto,un:p.unProduto||'un',qtd:0,vezes:0};
    prodCount[p.produto].qtd+=(p.qtdProduzida||0);
    prodCount[p.produto].vezes++;
  });
  const topProd=Object.values(prodCount).sort((a,b)=>b.qtd-a.qtd).slice(0,10);

  /* Most consumed ingredients */
  const insCount={};
  finalizadas.forEach(p=>{
    p.insumos?.forEach(ins=>{
      if(!insCount[ins.nome]) insCount[ins.nome]={nome:ins.nome,un:ins.un||'un',qtd:0,vezes:0};
      insCount[ins.nome].qtd+=(ins.qtd||0);
      insCount[ins.nome].vezes++;
    });
  });
  const topIns=Object.values(insCount).sort((a,b)=>b.qtd-a.qtd).slice(0,10);

  /* Production history */
  const prodRows=finalizadas.slice(0,15).map(p=>{
    return`<tr>
      <td><span class="chip">${p.id}</span></td>
      <td><strong>${p.produto}</strong></td>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${p.data||'—'}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center"><strong>${p.qtdProduzida}</strong> ${p.unProduto}</td>
      <td style="text-align:center">${p.insumos?.length||0}</td>
      <td style="font-size:12px">${p.responsavel||'—'}</td>
    </tr>`;
  }).join('');

  return`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Fichas de Produção</div>
        <div class="kv" style="font-size:24px">${totalProd}</div>
        <div class="ks">${emAndamento.length} em andamento</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">✅ Finalizadas</div>
        <div class="kv" style="font-size:24px;color:var(--ok)">${finalizadas.length}</div>
        <div class="ks">${totalProd?Math.round(finalizadas.length/totalProd*100):0}% do total</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Total Produzido</div>
        <div class="kv" style="font-size:24px">${totalQtd}</div>
        <div class="ks">unidades finalizadas</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Pratos no Cardápio</div>
        <div class="kv" style="font-size:24px">${cardapio.length}</div>
        <div class="ks">itens cadastrados</div>
      </div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="panel" style="margin:0"><div class="pb">
        <div class="form-section-title" style="font-size:13px">🍽️ Pratos Mais Produzidos</div>
        ${topProd.length?`<div class="tw"><table>
          <thead><tr><th>#</th><th>Produto</th><th>Qtd Produzida</th><th>Nº Fichas</th></tr></thead>
          <tbody>${topProd.map((p,idx)=>`<tr>
            <td style="font-weight:700">${idx+1}</td>
            <td><strong>${p.nome}</strong></td>
            <td style="font-family:'DM Mono',monospace;text-align:center">${p.qtd} ${p.un}</td>
            <td style="text-align:center">${p.vezes}x</td>
          </tr>`).join('')}</tbody>
        </table></div>`:`<div class="empty" style="padding:16px 0"><div>Nenhuma produção finalizada</div></div>`}
      </div></div>

      <div class="panel" style="margin:0"><div class="pb">
        <div class="form-section-title" style="font-size:13px">📦 Insumos Mais Consumidos</div>
        ${topIns.length?`<div class="tw"><table>
          <thead><tr><th>#</th><th>Insumo</th><th>Qtd Consumida</th><th>Nº Usos</th></tr></thead>
          <tbody>${topIns.map((ins,idx)=>`<tr>
            <td style="font-weight:700">${idx+1}</td>
            <td><strong>${ins.nome}</strong></td>
            <td style="font-family:'DM Mono',monospace;text-align:center">${ins.qtd} ${ins.un}</td>
            <td style="text-align:center">${ins.vezes}x</td>
          </tr>`).join('')}</tbody>
        </table></div>`:`<div class="empty" style="padding:16px 0"><div>Sem dados</div></div>`}
      </div></div>
    </div>

    <div class="panel"><div class="pb">
      <div class="form-section-title" style="font-size:13px">📋 Produções Finalizadas (últimas 15)</div>
      ${prodRows?`<div class="tw" style="max-height:350px;overflow-y:auto"><table>
        <thead><tr><th>Ficha</th><th>Produto</th><th>Data</th><th>Qtd Produzida</th><th>Insumos</th><th>Responsável</th></tr></thead>
        <tbody>${prodRows}</tbody>
      </table></div>`:`<div class="empty" style="padding:20px 0"><div>Sem produções finalizadas</div></div>`}
    </div></div>`;
}

/* ══════════════════════════════════════
   6. RELATÓRIO DE FORNECEDORES
══════════════════════════════════════ */
function relFornecedores(){
  const totalForn=fornecedores.length;
  const all=getAllItems();

  /* Items per supplier */
  const fornMap={};
  all.forEach(i=>{
    const f=i.forn||'Sem fornecedor';
    if(!fornMap[f]) fornMap[f]={nome:f,itens:[],valor:0};
    fornMap[f].itens.push(i);
    fornMap[f].valor+=getEstqTotal(i)*(i.custo||0);
  });

  const semForn=fornMap['Sem fornecedor'];
  delete fornMap['Sem fornecedor'];

  const fornList=Object.values(fornMap).sort((a,b)=>b.itens.length-a.itens.length);
  const ativosCount=fornList.length;
  const inativosCount=totalForn-ativosCount;

  /* Supplier cards */
  const fornCards=fornList.map(f=>{
    const criticos=f.itens.filter(i=>nvl(getEstqTotal(i),i.min)==='e').length;
    return`
    <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:700;font-size:14px">🏢 ${f.nome}</div>
        <div style="font-size:11px;color:var(--ink3)">${f.itens.length} itens</div>
      </div>
      <div style="font-size:12px;color:var(--ink3);margin-bottom:8px">Valor est.: <strong>${brl(f.valor)}</strong>
        ${criticos?` · <span style="color:var(--er)">⚠ ${criticos} crítico(s)</span>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${f.itens.slice(0,8).map(i=>`<span class="chip" style="font-size:10px">${i.nome}</span>`).join('')}
        ${f.itens.length>8?`<span style="font-size:10px;color:var(--ink3)">+${f.itens.length-8} mais</span>`:''}
      </div>
    </div></div>`;
  }).join('');

  /* Full table */
  const fornRows=fornList.map(f=>{
    const criticos=f.itens.filter(i=>nvl(getEstqTotal(i),i.min)==='e').length;
    return`<tr>
      <td><strong>${f.nome}</strong></td>
      <td style="text-align:center">${f.itens.length}</td>
      <td style="text-align:center">${criticos?`<span class="bdg ber">${criticos}</span>`:'—'}</td>
      <td style="font-family:'DM Mono',monospace;text-align:right">${brl(f.valor)}</td>
      <td style="font-size:11px">${f.itens.map(i=>i.nome).join(', ')}</td>
    </tr>`;
  }).join('');

  return`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Fornecedores Cadastrados</div>
        <div class="kv" style="font-size:24px">${totalForn}</div>
        <div class="ks">${ativosCount} ativos</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Fornecedores Ativos</div>
        <div class="kv" style="font-size:24px;color:var(--ok)">${ativosCount}</div>
        <div class="ks">com itens vinculados</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Sem Movimentação</div>
        <div class="kv" style="font-size:24px;color:var(--ink3)">${inativosCount}</div>
        <div class="ks">sem itens vinculados</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Itens sem Fornecedor</div>
        <div class="kv" style="font-size:24px;color:var(--wa)">${semForn?.itens?.length||0}</div>
        <div class="ks">sem vínculo</div>
      </div></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:16px">
      ${fornCards||''}
    </div>

    <div class="panel"><div class="pb">
      <div class="form-section-title" style="font-size:13px">📊 Detalhamento por Fornecedor</div>
      ${fornRows?`<div class="tw"><table>
        <thead><tr><th>Fornecedor</th><th>Nº Itens</th><th>Críticos</th><th>Valor Est.</th><th>Itens</th></tr></thead>
        <tbody>${fornRows}</tbody>
      </table></div>`:`<div class="empty" style="padding:20px 0"><div>Nenhum fornecedor com itens vinculados</div></div>`}
    </div></div>`;
}

/* ══════════════════════════════════════
   7. HISTÓRICO DE PREÇOS POR FORNECEDOR
══════════════════════════════════════ */

let _precoHistCache = {}; /* itemDocId -> [{fornecedor,valor,data,ts}] */
let _precoHistLoaded = false;

async function loadRelPrecos(){
  const panel = document.getElementById('tr-forn-hist');
  if(!panel) return;
  panel.innerHTML = '<div class="empty"><div class="ei" style="font-size:28px">⏳</div>Carregando histórico de preços...</div>';
  try{
    _precoHistCache = {};
    const all = getAllItems();
    /* Buscar subcoleção precoHistorico dos itens que têm _docId */
    const docItems = all.filter(i=>i._docId);
    /* Limitar para evitar excesso de leituras: 100 itens */
    const slice = docItems.slice(0,100);
    await Promise.all(slice.map(async item=>{
      const snap = await db.collection('itens').doc(item._docId)
        .collection('precoHistorico')
        .orderBy('ts','desc').limit(10).get();
      if(!snap.empty){
        _precoHistCache[item._docId] = snap.docs.map(d=>({...d.data(), _docId:d.id}));
      }
    }));
    _precoHistLoaded = true;
    panel.innerHTML = _relPrecosHTML(all);
  }catch(e){
    panel.innerHTML=`<div class="al al-er">⚠ Erro ao carregar: ${e.message}</div>`;
  }
}

function _precoTrend(historico){
  /* Retorna {icon,color,pct} comparando os 2 últimos registros */
  if(!historico||historico.length<2) return {icon:'—',color:'var(--ink3)',pct:null};
  const atual  = historico[0].valor;
  const anterior = historico[1].valor;
  if(!anterior||anterior===0) return {icon:'—',color:'var(--ink3)',pct:null};
  const diff = atual - anterior;
  const pct  = Math.round(Math.abs(diff)/anterior*100);
  if(Math.abs(diff)<0.001) return {icon:'=',color:'var(--ink2)',pct:0};
  if(diff>0) return {icon:'↑',color:'var(--er)',pct};
  return {icon:'↓',color:'var(--ok)',pct};
}

function _relPrecosHTML(all){
  /* Agrupar itens com histórico por fornecedor */
  const fornGrupos = {}; /* fornecedorNome -> [{item, historico}] */

  all.forEach(item=>{
    if(!item._docId) return;
    const hist = _precoHistCache[item._docId];
    if(!hist||!hist.length) return;
    const forn = hist[0].fornecedor || item.forn || 'Sem Fornecedor';
    if(!fornGrupos[forn]) fornGrupos[forn]=[];
    fornGrupos[forn].push({item, historico:hist});
  });

  const fornKeys = Object.keys(fornGrupos).sort();

  if(!fornKeys.length){
    return `<div class="empty" style="padding:28px"><div class="ei">📭</div>
      <div>Nenhum histórico de preços registrado ainda.</div>
      <div style="font-size:12px;color:var(--ink3);margin-top:6px">Os preços são registrados automaticamente a cada recebimento de NF.</div>
    </div>`;
  }

  /* KPIs gerais */
  let totalRegistros=0, itensComHistorico=0, countAlta=0, countQueda=0;
  Object.values(fornGrupos).forEach(grupo=>{
    grupo.forEach(({historico})=>{
      itensComHistorico++;
      totalRegistros+=historico.length;
      const t=_precoTrend(historico);
      if(t.icon==='↑') countAlta++;
      else if(t.icon==='↓') countQueda++;
    });
  });

  const kpis=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Fornecedores c/ Histórico</div>
        <div class="kv" style="font-size:24px">${fornKeys.length}</div>
        <div class="ks">${itensComHistorico} itens rastreados</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">Total de Registros</div>
        <div class="kv" style="font-size:24px">${totalRegistros}</div>
        <div class="ks">entradas de preço</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">↑ Preços em Alta</div>
        <div class="kv" style="font-size:24px;color:var(--er)">${countAlta}</div>
        <div class="ks">itens vs. recebimento anterior</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px">
        <div class="kl">↓ Preços em Queda</div>
        <div class="kv" style="font-size:24px;color:var(--ok)">${countQueda}</div>
        <div class="ks">itens vs. recebimento anterior</div>
      </div></div>
    </div>`;

  /* Bloco por fornecedor */
  const fornBlocks = fornKeys.map(fornNome=>{
    const grupo = fornGrupos[fornNome].sort((a,b)=>{
      const ta=_precoTrend(a.historico);
      const tb=_precoTrend(b.historico);
      /* Alta primeiro, depois equilíbrio, depois queda */
      const rank={'↑':0,'—':1,'=':1,'↓':2};
      return (rank[ta.icon]||1)-(rank[tb.icon]||1);
    });

    const rows = grupo.map(({item, historico})=>{
      const t = _precoTrend(historico);
      const atual = historico[0]?.valor;
      const ult5 = historico.slice(0,5).reverse(); /* cronológico */
      const minispark = ult5.map((h,idx)=>{
        const maxV = Math.max(...ult5.map(x=>x.valor));
        const pct = maxV>0 ? Math.round((h.valor/maxV)*28) : 14;
        const isLast = idx===ult5.length-1;
        return `<div style="width:8px;height:${pct}px;background:${isLast?'var(--pr)':'var(--bdr)'};border-radius:2px 2px 0 0;align-self:flex-end" title="${brl(h.valor)}"></div>`;
      }).join('');
      const dataUlt = historico[0]?.data||'—';
      const pctStr = t.pct!==null ? `${t.pct}%` : '';
      return `<tr>
        <td><strong>${item.nome}</strong><div style="font-size:10px;color:var(--ink3)">${item.cat||''} · ${item.un}</div></td>
        <td style="font-family:'DM Mono',monospace;text-align:right">${brl(atual)}<br><span style="font-size:10px;color:var(--ink3)">/un consumo</span></td>
        <td style="text-align:center">
          <span style="font-size:18px;font-weight:700;color:${t.color}">${t.icon}</span>
          ${pctStr?`<div style="font-size:10px;color:${t.color};font-weight:600">${t.icon!=='—'?(t.icon==='↑'?'+':'-')+pctStr:''}</div>`:''}
        </td>
        <td>
          <div style="display:flex;align-items:flex-end;gap:2px;height:32px;padding:2px 0">${minispark}</div>
        </td>
        <td style="font-size:10px;color:var(--ink3);font-family:'DM Mono',monospace">${dataUlt}</td>
        <td style="text-align:center"><span class="chip" style="font-size:10px">${historico.length}x</span></td>
      </tr>`;
    }).join('');

    /* Alertas do bloco */
    const altasDoForn = grupo.filter(g=>_precoTrend(g.historico).icon==='↑');
    const alertaHtml = altasDoForn.length>0
      ? `<div class="al al-wa" style="margin-bottom:10px;font-size:12px">⚠️ ${altasDoForn.length} item(ns) com alta de preço neste fornecedor: ${altasDoForn.map(g=>`<strong>${g.item.nome}</strong>`).join(', ')}.</div>`
      : '';

    return `
    <div class="panel" style="margin-bottom:16px">
      <div class="pb">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-weight:700;font-size:14px">🏢 ${fornNome}</div>
          <div style="font-size:11px;color:var(--ink3)">${grupo.length} item(ns) rastreado(s)</div>
        </div>
        ${alertaHtml}
        <div class="tw"><table>
          <thead><tr>
            <th>Item</th>
            <th style="text-align:right">Custo Atual</th>
            <th style="text-align:center">Tendência</th>
            <th style="text-align:center">Últimos 5</th>
            <th>Último Receb.</th>
            <th style="text-align:center">Recebimentos</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
    </div>`;
  }).join('');

  return kpis + fornBlocks;
}

/* ══════════════════════════════════════
   RELATÓRIO DE CONFERÊNCIA DE ESTOQUE
══════════════════════════════════════ */

let _relConfs = [];      /* conferências carregadas */
let _relConfAtiva = null; /* conferência selecionada para detalhamento */

async function loadRelConfs(){
  const panel = document.getElementById('tr-confs');
  if(!panel) return;
  panel.innerHTML = '<div class="empty"><div class="ei" style="font-size:28px">⏳</div>Carregando conferências...</div>';
  try{
    const snap = await db.collection('conferencias')
      .orderBy('ts','desc').limit(50).get();
    _relConfs = snap.docs.map(d=>({_docId:d.id,...d.data()}))
      .filter(c=>c.status!=='em_andamento');
    panel.innerHTML = _relConfsHTML();
    /* Renderizar gráficos após DOM pronto */
    requestAnimationFrame(()=>{
      _buildChartConfsAcuracia();
      _buildChartConfsLocal();
    });
  }catch(e){
    panel.innerHTML=`<div class="al al-er">⚠ Erro ao carregar: ${e.message}</div>`;
  }
}

function _relConfsHTML(){
  if(!_relConfs.length) return '<div class="empty" style="padding:28px"><div class="ei">📋</div>Nenhuma conferência realizada ainda</div>';

  /* KPIs globais */
  const finalizadas   = _relConfs.filter(c=>c.status==='finalizada');
  const pendentes     = _relConfs.filter(c=>c.status==='pendente_aprovacao');
  const totalDivs     = finalizadas.reduce((s,c)=>s+(c.totalDivergencias||0),0);
  const totalAjustes  = finalizadas.reduce((s,c)=>s+(c.totalAjustados||0),0);
  const totalConf     = finalizadas.reduce((s,c)=>s+(c.totalConferidos||0),0);
  const acuraciaMedia = totalConf>0 ? Math.round(100-((totalDivs/totalConf)*100)) : 100;

  /* Ranking de divergências por item */
  const divMap={};
  finalizadas.forEach(c=>{
    (c.itens||[]).forEach(it=>{
      if(it.diferenca!==0&&it.diferenca!==undefined){
        if(!divMap[it.nome]) divMap[it.nome]={nome:it.nome,un:it.un,total:0,soma:0};
        divMap[it.nome].total++;
        divMap[it.nome].soma+=Math.abs(it.diferenca||0);
      }
    });
  });
  const ranking=Object.values(divMap).sort((a,b)=>b.total-a.total).slice(0,10);

  /* Impacto financeiro estimado */
  const allItems=getAllItems();
  let valorAjustado=0;
  finalizadas.forEach(c=>{
    (c.itens||[]).filter(it=>it.ajustou).forEach(it=>{
      const item=allItems.find(x=>x.nome===it.nome);
      valorAjustado+=Math.abs(it.diferenca||0)*(item?.custo||0);
    });
  });

  /* Tabela do histórico */
  const histRows=_relConfs.map(c=>{
    const ts=c.ts?.toDate?c.ts.toDate().toLocaleString('pt-BR'):'—';
    const stBdg={
      finalizada:`<span class="bdg bok">✅ Finalizada</span>`,
      pendente_aprovacao:`<span class="bdg bwa">⏳ Pendente</span>`,
      recusada:`<span class="bdg ber">✕ Recusada</span>`,
    }[c.status]||`<span class="bdg bgr">${c.status}</span>`;
    const prec=c.totalConferidos>0
      ?Math.round(100-((c.totalDivergencias||0)/c.totalConferidos*100))
      :100;
    const precColor=prec>=95?'var(--ok)':prec>=80?'#c89a00':'var(--er)';
    return`<tr onclick="_relConfDetalhar('${c._docId}')" style="cursor:pointer" title="Clique para detalhes">
      <td><span class="chip">${c.id||'—'}</span></td>
      <td style="font-size:11px">${ts}</td>
      <td>${c.usuario||'—'}</td>
      <td><span class="bdg bgr" style="font-size:10px">${c.escopo||'—'}</span></td>
      <td style="text-align:center;font-family:'DM Mono',monospace">${c.totalConferidos||0}</td>
      <td style="text-align:center;font-family:'DM Mono',monospace;color:${c.totalDivergencias?'var(--wa)':'var(--ok)'}">${c.totalDivergencias||0}</td>
      <td style="text-align:center;font-family:'DM Mono',monospace">${c.totalAjustados||0}</td>
      <td style="text-align:center;font-family:'DM Mono',monospace;color:${precColor};font-weight:700">${prec}%</td>
      <td>${stBdg}</td>
    </tr>`;
  }).join('');

  /* Ranking HTML */
  const rankRows=ranking.length?ranking.map((r,i)=>{
    const pct=finalizadas.length>0?Math.round(r.total/finalizadas.length*100):0;
    return`<tr>
      <td><span style="font-size:11px;color:var(--ink3);margin-right:6px">#${i+1}</span><strong>${r.nome}</strong></td>
      <td style="text-align:center;font-family:'DM Mono',monospace;color:var(--wa)">${r.total} vez(es)</td>
      <td style="text-align:center;font-family:'DM Mono',monospace">${pct}% das conferências</td>
      <td style="font-family:'DM Mono',monospace;text-align:right">ø ${(r.soma/r.total).toFixed(2)} ${r.un}</td>
    </tr>`;
  }).join(''):'<tr><td colspan="4" class="empty" style="padding:16px">Nenhuma divergência registrada</td></tr>';

  return`
  <!-- KPIs -->
  <div class="krow" style="margin-bottom:18px">
    <div class="kpi"><div class="kl">Total de Conferências</div><div class="kv">${_relConfs.length}</div><div class="ks">${finalizadas.length} finalizadas · ${pendentes.length} pendentes</div></div>
    <div class="kpi"><div class="kl">Itens Verificados</div><div class="kv">${totalConf.toLocaleString('pt-BR')}</div><div class="ks">entradas contadas no total</div></div>
    <div class="kpi"><div class="kl">Divergências Encontradas</div><div class="kv" style="color:var(--wa)">${totalDivs}</div><div class="ks">${totalAjustes} ajustes aplicados</div></div>
    <div class="kpi"><div class="kl">Acurácia Média</div><div class="kv" style="color:${acuraciaMedia>=95?'var(--ok)':acuraciaMedia>=80?'#c89a00':'var(--er)'}">${acuraciaMedia}%</div><div class="ks">itens sem divergência</div></div>
    <div class="kpi"><div class="kl">Impacto Financeiro</div><div class="kv" style="color:var(--er)">${brl(valorAjustado)}</div><div class="ks">valor total ajustado</div></div>
  </div>

  <!-- Gráficos -->
  <div class="charts-grid" style="margin-bottom:20px">
    <div class="panel" style="padding:18px">
      <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--ink2)">📈 Acurácia por Conferência</div>
      <div style="position:relative;height:200px"><canvas id="chart-conf-acuracia"></canvas></div>
    </div>
    <div class="panel" style="padding:18px">
      <div style="font-size:13px;font-weight:600;margin-bottom:14px;color:var(--ink2)">📍 Divergências por Local</div>
      <div style="position:relative;height:200px"><canvas id="chart-conf-local"></canvas></div>
    </div>
  </div>

  <!-- Ranking -->
  <div class="panel" style="margin-bottom:20px">
    <div class="ph"><div class="pht">🔥 Top 10 Itens com Mais Divergências Históricas</div></div>
    <div class="tw"><table>
      <thead><tr><th>Item</th><th style="text-align:center">Ocorrências</th><th style="text-align:center">Frequência</th><th style="text-align:right">Desvio Médio</th></tr></thead>
      <tbody>${rankRows}</tbody>
    </table></div>
  </div>

  <!-- Histórico -->
  <div class="panel" style="margin-bottom:20px">
    <div class="ph"><div class="pht">📋 Histórico de Conferências</div><span style="font-size:11px;color:var(--ink3)">Clique em uma linha para ver detalhes</span></div>
    <div class="tw"><table>
      <thead><tr>
        <th>ID</th><th>Data</th><th>Operador</th><th>Escopo</th>
        <th style="text-align:center">Contados</th><th style="text-align:center">Diverg.</th>
        <th style="text-align:center">Ajustados</th><th style="text-align:center">Acurácia</th>
        <th>Status</th>
      </tr></thead>
      <tbody>${histRows}</tbody>
    </table></div>
  </div>

  <!-- Detalhe da conferência selecionada -->
  <div id="rel-conf-detalhe"></div>`;
}

function _relConfDetalhar(docId){
  const c=_relConfs.find(x=>x._docId===docId);
  if(!c) return;
  _relConfAtiva=c;

  const itens=c.itens||[];
  const contados=itens.filter(it=>it.contado!==null&&it.contado!==undefined);
  const comDiv=contados.filter(it=>it.diferenca!==0&&it.diferenca!==undefined);
  const ajustados=contados.filter(it=>it.ajustou);
  const naoContados=itens.filter(it=>it.contado===null||it.contado===undefined);

  /* Impacto financeiro */
  const allItems=getAllItems();
  let valorAjdPos=0,valorAjdNeg=0;
  ajustados.forEach(it=>{
    const item=allItems.find(x=>x.nome===it.nome);
    const custo=item?.custo||0;
    if(it.diferenca>0) valorAjdPos+=it.diferenca*custo;
    else valorAjdNeg+=Math.abs(it.diferenca)*custo;
  });

  const ts=c.ts?.toDate?c.ts.toDate().toLocaleString('pt-BR'):'—';
  const tsFim=c.tsFim?.toDate?c.tsFim.toDate().toLocaleString('pt-BR'):'—';
  const aprovadoEm=c.aprovadoEm?.toDate?c.aprovadoEm.toDate().toLocaleString('pt-BR'):'—';

  /* Agrupar por local */
  const porLocal={};
  contados.forEach(it=>{
    if(!porLocal[it.localNome]) porLocal[it.localNome]={total:0,divs:0};
    porLocal[it.localNome].total++;
    if(it.diferenca!==0&&it.diferenca!==undefined) porLocal[it.localNome].divs++;
  });

  const localRows=Object.entries(porLocal).map(([loc,v])=>{
    const prec=Math.round((1-v.divs/v.total)*100);
    const cor=prec>=95?'var(--ok)':prec>=80?'#c89a00':'var(--er)';
    return`<tr>
      <td>📍 ${loc}</td>
      <td style="text-align:center">${v.total}</td>
      <td style="text-align:center;color:${v.divs?'var(--wa)':'var(--ok)'}">${v.divs}</td>
      <td style="text-align:center;color:${cor};font-weight:700">${prec}%</td>
    </tr>`;
  }).join('');

  /* Tabela de itens */
  const itemRows=contados.map(it=>{
    const dif=it.diferenca||0;
    const cor=dif>0?'var(--ok)':dif<0?'var(--er)':'var(--ink3)';
    const difStr=(dif>0?'+':'')+dif.toFixed(2);
    const item=allItems.find(x=>x.nome===it.nome);
    const custo=item?.custo||0;
    const impacto=Math.abs(dif)*custo;
    const rowBg=dif===0?'':'background:'+(dif>0?'var(--ok-l, rgba(45,97,66,.06))':'rgba(200,0,0,.04)')+';';
    return`<tr style="${rowBg}">
      <td>
        <div style="font-weight:500">${it.nome}</div>
        <div style="font-size:11px;color:var(--ink3)">📍 ${it.localNome}</div>
      </td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${it.estoqueAntes??'—'} ${it.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;font-weight:600">${Number(it.contado).toFixed(2)} ${it.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;color:${cor};font-weight:700">${dif!==0?difStr:'—'}</td>
      <td style="text-align:center">${it.ajustou?'<span class="bdg bok" style="font-size:10px">✓ Aplicado</span>':dif!==0?'<span class="bdg bgr" style="font-size:10px">✕ Ignorado</span>':'<span style="color:var(--ink3);font-size:11px">—</span>'}</td>
      <td style="font-family:'DM Mono',monospace;text-align:right;font-size:11px;color:var(--ink3)">${impacto>0?brl(impacto):'—'}</td>
    </tr>`;
  }).join('');

  const statusBdg={
    finalizada:`<span class="bdg bok">✅ Finalizada</span>`,
    pendente_aprovacao:`<span class="bdg bwa">⏳ Aguardando Aprovação</span>`,
    recusada:`<span class="bdg ber">✕ Recusada</span>`,
  }[c.status]||'';

  const el=document.getElementById('rel-conf-detalhe');
  if(!el) return;
  el.scroll&&el.scrollIntoView({behavior:'smooth',block:'start'});
  el.innerHTML=`
  <div class="sec" style="margin-top:8px"><div class="st">⚖️ Detalhe — ${c.id||docId}</div><div class="sl"></div>${statusBdg}</div>

  <!-- Cabeçalho info -->
  <div class="panel" style="margin-bottom:16px">
    <div class="pb" style="padding:14px 18px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;font-size:12px">
        <div><span style="color:var(--ink3)">Operador:</span> <strong>${c.usuario||'—'}</strong></div>
        <div><span style="color:var(--ink3)">Escopo:</span> <strong>${c.escopo||'—'}</strong></div>
        <div><span style="color:var(--ink3)">Iniciada:</span> ${ts}</div>
        <div><span style="color:var(--ink3)">Concluída:</span> ${tsFim}</div>
        ${c.aprovadoPor?`<div><span style="color:var(--ink3)">Aprovado por:</span> <strong>${c.aprovadoPor}</strong></div>`:''}
        ${c.aprovadoEm?`<div><span style="color:var(--ink3)">Aprovado em:</span> ${aprovadoEm}</div>`:''}
      </div>
    </div>
  </div>

  <!-- KPIs do detalhe -->
  <div class="krow" style="margin-bottom:16px">
    <div class="kpi"><div class="kl">Contados</div><div class="kv">${contados.length}</div><div class="ks">de ${itens.length} total</div></div>
    <div class="kpi"><div class="kl">Divergências</div><div class="kv" style="color:${comDiv.length?'var(--wa)':'var(--ok)'}">${comDiv.length}</div><div class="ks">${ajustados.length} ajustados</div></div>
    <div class="kpi"><div class="kl">Acurácia</div><div class="kv" style="color:${contados.length>0&&(1-comDiv.length/contados.length)>=.95?'var(--ok)':'#c89a00'}">${contados.length>0?Math.round((1-comDiv.length/contados.length)*100):100}%</div></div>
    ${naoContados.length?`<div class="kpi"><div class="kl">Não Contados</div><div class="kv" style="color:var(--ink3)">${naoContados.length}</div></div>`:''}
    ${valorAjdNeg>0?`<div class="kpi"><div class="kl">Perda estimada</div><div class="kv" style="color:var(--er)">${brl(valorAjdNeg)}</div><div class="ks">em ajustes negativos</div></div>`:''}
    ${valorAjdPos>0?`<div class="kpi"><div class="kl">Ganho estimado</div><div class="kv" style="color:var(--ok)">${brl(valorAjdPos)}</div><div class="ks">em ajustes positivos</div></div>`:''}
  </div>

  <!-- Por local -->
  ${localRows?`
  <div class="panel" style="margin-bottom:16px">
    <div class="ph"><div class="pht">📍 Acurácia por Local de Armazenamento</div></div>
    <div class="tw"><table>
      <thead><tr><th>Local</th><th style="text-align:center">Contados</th><th style="text-align:center">Diverg.</th><th style="text-align:center">Acurácia</th></tr></thead>
      <tbody>${localRows}</tbody>
    </table></div>
  </div>`:''}

  <!-- Todos os itens -->
  <div class="panel">
    <div class="ph">
      <div class="pht">📦 Itens Contados (${contados.length})</div>
      <div style="display:flex;gap:8px;font-size:11px">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:rgba(45,97,66,.1);border-radius:2px;display:inline-block"></span>OK</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:rgba(200,0,0,.06);border-radius:2px;display:inline-block"></span>Falta</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:rgba(45,97,66,.12);border-radius:2px;display:inline-block"></span>Sobra</span>
      </div>
    </div>
    <div class="tw"><table>
      <thead><tr>
        <th>Item / Local</th>
        <th style="text-align:center">Sistema</th>
        <th style="text-align:center">Contado</th>
        <th style="text-align:center">Diferença</th>
        <th style="text-align:center">Ajuste</th>
        <th style="text-align:right">Impacto R$</th>
      </tr></thead>
      <tbody>${itemRows||'<tr><td colspan="6" class="empty" style="padding:16px">Nenhum item contado</td></tr>'}</tbody>
    </table></div>
  </div>`;

  /* Mover para o detalhe */
  requestAnimationFrame(()=>el.scrollIntoView({behavior:'smooth',block:'start'}));
}

/* Gráfico de acurácia por conferência (linha) */
function _buildChartConfsAcuracia(){
  _destroyChart('conf-acuracia');
  const ctx=document.getElementById('chart-conf-acuracia');
  if(!ctx||typeof Chart==='undefined') return;

  const fin=[..._relConfs.filter(c=>c.status==='finalizada')].reverse().slice(-12);
  const labels=fin.map(c=>c.id||'?');
  const acuracias=fin.map(c=>{
    const tot=c.totalConferidos||0;
    const div=c.totalDivergencias||0;
    return tot>0?Math.round((1-div/tot)*100):100;
  });

  _charts['conf-acuracia']=new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:[{
        label:'Acurácia (%)',
        data:acuracias,
        borderColor:'#2d6142',
        backgroundColor:'rgba(44,97,66,0.1)',
        borderWidth:2,
        pointRadius:4,
        pointBackgroundColor:'#2d6142',
        tension:0.3,
        fill:true
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw}%`}}},
      scales:{
        y:{min:0,max:100,ticks:{callback:v=>v+'%'},grid:{color:'rgba(0,0,0,.05)'}},
        x:{grid:{display:false},ticks:{font:{size:10}}}
      }
    }
  });
}

/* Gráfico de divergências por local (barra horizontal) */
function _buildChartConfsLocal(){
  _destroyChart('conf-local');
  const ctx=document.getElementById('chart-conf-local');
  if(!ctx||typeof Chart==='undefined') return;

  const locMap={};
  _relConfs.filter(c=>c.status==='finalizada').forEach(c=>{
    (c.itens||[]).forEach(it=>{
      if((it.diferenca||0)!==0){
        locMap[it.localNome]=(locMap[it.localNome]||0)+1;
      }
    });
  });
  const entries=Object.entries(locMap).sort(([,a],[,b])=>b-a).slice(0,8);
  const labels=entries.map(([n])=>n);
  const valores=entries.map(([,v])=>v);

  _charts['conf-local']=new Chart(ctx,{
    type:'bar',
    data:{
      labels,
      datasets:[{label:'Divergências',data:valores,backgroundColor:'rgba(200,107,58,0.75)',borderColor:'#c86b3a',borderWidth:1.5,borderRadius:6}]
    },
    options:{
      indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw} divergência(s)`}}},
      scales:{x:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'}},y:{grid:{display:false},ticks:{font:{size:11}}}}
    }
  });
}
