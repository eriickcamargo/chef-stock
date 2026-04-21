/* ══════════════════════════════════════════════════
   PAGE: Produção — Ficha de Produção digital
   Automatiza a baixa de insumos e entrada de produtos acabados
   Features: F5 (busca dinâmica produto), F6 (editar/excluir fichas),
             F9 (busca nos atalhos)
══════════════════════════════════════════════════ */

let fichaInsumos = []; /* insumos da ficha ativa */
let fichaEditInsumos = []; /* insumos na edição de ficha (F6) */
let produtoSelecionado = null; /* {docId, nome, un} */
let _pendingProducaoData = null; /* dados pendentes antes de confirmar início (F8) */

function mkProducao(){
  const pg=mkPg('producao');
  pg.innerHTML=producaoHTML();
  return pg;
}

function producaoHTML(){
  const canEdit=SESSION.role==='adm'||SESSION.role==='coz';

  /* Build unique shortcuts from finalized productions */
  const finalizadas=producoes.filter(p=>p.status==='finalizada');
  const shortcutMap={};
  finalizadas.forEach(p=>{
    if(!shortcutMap[p.produto]){
      shortcutMap[p.produto]={produto:p.produto,unProduto:p.unProduto,insumos:p.insumos,count:1,lastData:p.data,lastQtd:p.qtdProduzida};
    } else {
      shortcutMap[p.produto].count++;
      shortcutMap[p.produto].lastData=p.data;
      shortcutMap[p.produto].lastQtd=p.qtdProduzida;
    }
  });
  const shortcuts=Object.values(shortcutMap);

  /* F9: Search bar + cards */
  const shortcutsHTML=canEdit && shortcuts.length?`
    <div class="panel" style="margin-bottom:16px">
      <div class="ph"><div class="pht">⚡ Atalhos de Produção</div></div>
      <div class="pb" style="padding:12px">
        <div style="font-size:11px;color:var(--ink3);margin-bottom:10px">Clique para repetir uma ficha anterior — insumos pré-carregados, preencha apenas as quantidades.</div>
        <!-- F9: Campo de busca -->
        <div style="position:relative;margin-bottom:12px">
          <input class="fc" id="shortcut-search" type="text" placeholder="🔍 Buscar ficha pelo nome..." autocomplete="off"
            oninput="filtrarShortcuts(this.value)"
            style="font-size:13px;padding:8px 12px">
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px" id="shortcut-cards">
          ${shortcuts.map(s=>`
            <button class="btn btn-g shortcut-card" data-nome="${s.produto.toLowerCase()}" onclick="openFichaFromShortcut('${s.produto.replace(/'/g,"\\'")}')"
              style="display:flex;flex-direction:column;align-items:flex-start;padding:10px 14px;min-width:160px;text-align:left;border:1px solid var(--bdr);border-radius:var(--r2)">
              <span style="font-size:13px;font-weight:600">🍳 ${s.produto}</span>
              <span style="font-size:10px;color:var(--ink3);margin-top:2px">${s.insumos.length} insumos · ${s.count}x produzido · Últ: ${s.lastData}</span>
            </button>
          `).join('')}
        </div>
        <div id="shortcut-noresult" style="display:none;font-size:12px;color:var(--ink3);padding:8px 0">Nenhuma ficha encontrada para este nome.</div>
      </div>
    </div>`:'' ;

  return`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink3)">
        Fichas de produção do Gosto Paraense. Cada ficha dá baixa nos insumos e entrada nos produtos acabados.
      </div>
      ${canEdit?`<button class="btn btn-r" onclick="openFichaProducao()">+ Nova Ficha de Produção</button>`:''}
    </div>

    ${shortcutsHTML}

    <div class="tabs">
      <div class="tab on" onclick="stab(this,'tp-ativas')">🟢 Em Andamento <span style="font-size:10px;color:var(--ink3)">(${producoes.filter(p=>p.status==='em_andamento').length})</span></div>
      <div class="tab" onclick="stab(this,'tp-finalizadas')">✅ Finalizadas <span style="font-size:10px;color:var(--ink3)">(${producoes.filter(p=>p.status==='finalizada').length})</span></div>
    </div>

    <div class="tp on" id="tp-ativas">
      ${producoes.filter(p=>p.status==='em_andamento').length?
        producoes.filter(p=>p.status==='em_andamento').map(p=>fichaCard(p,canEdit)).join(''):
        `<div class="empty" style="padding:40px 0"><div class="ei" style="font-size:32px">🍳</div><div>Nenhuma produção em andamento</div></div>`}
    </div>

    <div class="tp" id="tp-finalizadas">
      ${producoes.filter(p=>p.status==='finalizada').length?`
        <div class="panel"><div class="prod-fin-wrap"><table>
          <thead><tr><th>Ficha</th><th>Produto</th><th>Início</th><th>Fim</th><th>Qtd. Produzida</th><th>Custo Total</th><th>Custo Unit.</th><th>Insumos</th><th>Obs.</th><th>Responsável</th><th>Status</th>${canEdit?'<th>Ações</th>':''}</tr></thead>
          <tbody>${producoes.filter(p=>p.status==='finalizada').map(p=>`<tr>
            <td data-label="Ficha"><span class="chip">${p.id}</span></td>
            <td data-label="Produto"><strong>${p.produto}</strong></td>
            <td data-label="Início" style="font-family:'DM Mono',monospace;font-size:11px">${p.data} ${p.horaInicio}</td>
            <td data-label="Fim" style="font-family:'DM Mono',monospace;font-size:11px">${p.horaFim||'—'}</td>
            <td data-label="Qtd. Produzida" style="font-family:'DM Mono',monospace"><strong>${p.qtdProduzida} ${p.unProduto}</strong></td>
            <td data-label="Custo Total" style="font-family:'DM Mono',monospace;font-size:12px">${p.custoProducao!=null?brl(p.custoProducao):'—'}</td>
            <td data-label="Custo Unit." style="font-family:'DM Mono',monospace;font-size:12px;color:var(--ok)"><strong>${p.custoUnitario!=null?brl(p.custoUnitario):'—'}</strong></td>
            <td data-label="Insumos">${p.insumos.length} itens</td>
            <td data-label="Obs." style="font-size:11px;color:var(--ink3)" title="${p.obs||p.obsFinalizacao||''}">${p.obs?'📝 '+p.obs.slice(0,30)+(p.obs.length>30?'…':''):(p.obsFinalizacao?'📝 '+p.obsFinalizacao.slice(0,30)+(p.obsFinalizacao.length>30?'…':''):'—')}</td>
            <td data-label="Responsável">${p.responsavel}</td>
            <td data-label="Status"><span class="bdg bok">✓ Finalizada</span></td>
            ${canEdit?`<td data-label="Ações" style="white-space:nowrap">
              <button class="btn btn-g btn-xs" onclick="openEditFicha('${p.id}')" title="Editar">✏️</button>
              <button class="btn btn-er btn-xs" onclick="excluirFicha('${p.id}')" title="Excluir" style="margin-left:4px">🗑️</button>
            </td>`:''}
          </tr>`).join('')}</tbody>
        </table></div></div>`:
        `<div class="empty" style="padding:40px 0"><div class="ei" style="font-size:32px">📋</div><div>Nenhuma produção finalizada</div></div>`}
    </div>`;
}

/* F9: Filtrar atalhos */
function filtrarShortcuts(query){
  const q=query.trim().toLowerCase();
  const cards=document.querySelectorAll('#shortcut-cards .shortcut-card');
  let visivel=0;
  cards.forEach(c=>{
    const match=!q||c.dataset.nome.includes(q);
    c.style.display=match?'':'none';
    if(match)visivel++;
  });
  const noResult=document.getElementById('shortcut-noresult');
  if(noResult)noResult.style.display=visivel===0&&q?'':'none';
}

function fichaCard(p,canEdit){
  const elapsed=getElapsed(p.horaInicio);
  return`
  <div class="panel" style="margin-bottom:16px">
    <div class="ph" style="border-bottom:2px solid var(--rc)">
      <div class="pht" style="flex:1">
        <span class="chip" style="margin-right:8px">${p.id}</span>
        🍳 <strong>${p.produto}</strong>
        <span style="font-size:11px;color:var(--ink3);margin-left:8px">${p.unProduto}</span>
      </div>
      <span class="bdg bwa">⏳ Em produção${elapsed?` · ${elapsed}`:''}</span>
    </div>
    <div class="pb">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">
        <div><span style="font-size:11px;color:var(--ink3)">Data</span><div style="font-weight:500">${p.data}</div></div>
        <div><span style="font-size:11px;color:var(--ink3)">Início</span><div style="font-weight:500">${p.horaInicio}</div></div>
        <div><span style="font-size:11px;color:var(--ink3)">Responsável</span><div style="font-weight:500">${p.responsavel}</div></div>
      </div>
      ${p.obs?`<div style="margin-bottom:12px;padding:8px 10px;background:var(--in-l);border:1px solid var(--in-b);border-radius:var(--r2);font-size:12px;color:var(--in)">📝 <strong>Obs.:</strong> ${p.obs}</div>`:''}

      <div class="form-section-title" style="font-size:12px">Insumos Utilizados (${p.insumos.length})</div>
      <div style="border:1px solid var(--bdr);border-radius:var(--r2);overflow:hidden;margin-bottom:14px">
        <table style="margin:0">
          <thead><tr style="font-size:11px"><th>Ingrediente</th><th>Un.</th><th>Qtd. Utilizada</th><th>Baixa</th></tr></thead>
          <tbody>${p.insumos.map(ins=>{
            return`<tr>
              <td style="font-size:12px"><strong>${ins.nome}</strong></td>
              <td style="font-size:12px">${ins.un}</td>
              <td style="font-family:'DM Mono',monospace;font-size:12px">${ins.qtd}</td>
              <td><span class="bdg bok" style="font-size:10px">✓ Deduzido</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>

      ${canEdit?`<div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-g btn-sm" onclick="openEditFicha('${p.id}')">✏️ Editar</button>
        <button class="btn btn-er btn-sm" onclick="excluirFicha('${p.id}')">🗑️ Excluir</button>
        <button class="btn btn-r" onclick="openFinalizarFicha('${p.id}')">✓ Finalizar Produção</button>
      </div>`:''}
    </div>
  </div>`;
}

function getElapsed(horaStr){
  try{
    const[h,m]=horaStr.split(':').map(Number);
    const now=new Date();
    const diff=now.getHours()*60+now.getMinutes()-(h*60+m);
    if(diff<=0)return'';
    const hrs=Math.floor(diff/60);
    const mins=diff%60;
    return hrs>0?`${hrs}h${mins>0?mins+'min':''}`:`${mins}min`;
  }catch(e){return'';}
}

function rebuildProducao(){
  const pg=document.getElementById('pg-producao');if(pg)pg.innerHTML=producaoHTML();
}

/* ══════════════════════════════════════
   NOVA FICHA DE PRODUÇÃO
   F5: Busca dinâmica de produto
══════════════════════════════════════ */

function openFichaProducao(){
  fichaInsumos=[];
  produtoSelecionado=null;
  const now=new Date();
  const searchEl=document.getElementById('fp-produto-search');
  if(searchEl)searchEl.value='';
  const ddEl=document.getElementById('fp-produto-dd');
  if(ddEl)ddEl.style.display='none';
  document.getElementById('fp-un').value='porção';
  document.getElementById('fp-data').value=now.toISOString().split('T')[0];
  document.getElementById('fp-hora').value=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  document.getElementById('fp-err').style.display='none';
  const fpObs=document.getElementById('fp-obs'); if(fpObs)fpObs.value='';
  renderFichaInsumos();
  addFichaInsumo();
  resetXmlMode&&resetXmlMode();
  openM('m-ficha-prod');
}

/* ══════════════════════════════════════
   ATALHO — Repetir ficha de produção
══════════════════════════════════════ */

function openFichaFromShortcut(produtoNome){
  const ref=producoes.filter(p=>p.status==='finalizada' && p.produto===produtoNome)
    .sort((a,b)=>(b.data||'').localeCompare(a.data||''))[0];
  if(!ref){ toast('⚠ Ficha de referência não encontrada.'); return; }

  openFichaProducao();

  /* F5: Auto-selecionar o produto no campo de busca */
  const cardItem=cardapio.find(c=>c.nome===produtoNome);
  if(cardItem){
    produtoSelecionado={docId:cardItem._docId,nome:cardItem.nome,un:cardItem.un||'porção'};
    const searchEl=document.getElementById('fp-produto-search');
    if(searchEl)searchEl.value=cardItem.nome;
    document.getElementById('fp-un').value=cardItem.un||'porção';
  }

  /* Pre-fill insumos from the reference (with empty quantities) */
  fichaInsumos=ref.insumos.map(ins=>({
    itemId:ins.itemId,
    nome:ins.nome,
    un:ins.un,
    qtd:0
  }));
  renderFichaInsumos();

  toast(`⚡ Ficha de "${produtoNome}" carregada com ${ref.insumos.length} insumos. Preencha as quantidades.`);
}

/* F5: Dynamic product search */
function filtrarProdutosFicha(query){
  const dd=document.getElementById('fp-produto-dd');
  if(!dd)return;
  const q=query.trim().toLowerCase();
  if(!q){
    dd.style.display='none';
    produtoSelecionado=null;
    return;
  }
  const matches=cardapio.filter(c=>c.nome.toLowerCase().startsWith(q));
  if(matches.length){
    dd.style.display='';
    dd.innerHTML=matches.slice(0,10).map(c=>`<div style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--bdr)"
      onmousedown="selecionarProdutoFicha('${c._docId}')"
      onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      🍳 <strong>${c.nome}</strong> <span style="color:var(--ink3);font-size:11px">(${c.un||'porção'})</span>
    </div>`).join('');
  } else {
    dd.style.display='';
    dd.innerHTML='<div style="padding:10px 12px;font-size:12px;color:var(--ink3)">Nenhum produto encontrado</div>';
  }
}

function selecionarProdutoFicha(docId){
  const c=cardapio.find(x=>x._docId===docId);
  if(!c)return;
  produtoSelecionado={docId:c._docId,nome:c.nome,un:c.un||'porção'};
  const searchEl=document.getElementById('fp-produto-search');
  if(searchEl)searchEl.value=c.nome;
  document.getElementById('fp-un').value=c.un||'porção';
  const dd=document.getElementById('fp-produto-dd');
  if(dd)dd.style.display='none';
}

/* Close product dropdown when clicking outside */
document.addEventListener('click',e=>{
  const dd=document.getElementById('fp-produto-dd');
  const parent=document.getElementById('fp-produto-wrap');
  if(dd&&parent&&!parent.contains(e.target))dd.style.display='none';
});

/* ── Insumos da ficha (search-based, filtrado por tipo 'insumos') ── */
function getInsumosItems(){
  const tipoInsumo=TIPOS.find(t=>t.id.includes('insumo'));
  return tipoInsumo?tipoInsumo.itens:[];
}

function addFichaInsumo(){
  fichaInsumos.push({itemId:'',nome:'',un:'',qtd:0});
  renderFichaInsumos();
}

function removeFichaInsumo(idx){
  fichaInsumos.splice(idx,1);
  renderFichaInsumos();
}

function renderFichaInsumos(){
  const list=document.getElementById('fp-insumos-list');
  if(!list)return;
  list.innerHTML=fichaInsumos.map((ins,i)=>{
    const hasConv=ins.fatorConversao&&ins.fatorConversao>1;
    const convHint=hasConv?`<span style="font-size:10px;color:var(--pr);margin-top:2px;display:block">📦 Comprado em ${ins.unCompra||'pct'} — informe a quantidade em <strong>${ins.un}</strong></span>`:'';
    return `
    <div style="display:grid;grid-template-columns:1fr 80px 100px 32px;gap:8px;align-items:end;margin-bottom:6px;padding:8px 10px;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2)${hasConv?';border-left:3px solid var(--pr)':''}">
      <div class="fg" style="margin:0;position:relative">
        <label class="fl" style="font-size:11px">Ingrediente (5)</label>
        <input class="fc" id="fp-ins-search-${i}" type="text" placeholder="🔍 Digite para buscar insumo..."
          value="${ins.nome||''}" autocomplete="off"
          oninput="filtrarInsumosFicha(${i},this.value)" onfocus="filtrarInsumosFicha(${i},this.value)"
          style="font-size:12px">
        <div class="fp-ins-dropdown" id="fp-ins-dd-${i}" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:180px;overflow-y:auto;background:white;border:1px solid var(--bdr);border-radius:0 0 var(--r2) var(--r2);box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:10"></div>
      </div>
      <div class="fg" style="margin:0">
        <label class="fl" style="font-size:11px">Un. (6)</label>
        <input class="fc" id="fp-ins-un-${i}" value="${ins.un||''}" readonly style="font-size:12px;background:#f5f5f0">
      </div>
      <div class="fg" style="margin:0">
        <label class="fl" style="font-size:11px">Qtd. (${ins.un||'?'}) (7)</label>
        <input class="fc" type="number" min="0" step="0.001" value="${ins.qtd||''}" placeholder="0" oninput="fichaInsumos[${i}].qtd=parseFloat(this.value)||0" style="font-size:12px">
        ${convHint}
      </div>
      <button class="btn btn-er btn-xs" onclick="removeFichaInsumo(${i})" style="margin-bottom:2px" title="Remover">✕</button>
    </div>
  `;
  }).join('');
}

function filtrarInsumosFicha(idx,query){
  const dd=document.getElementById(`fp-ins-dd-${idx}`);
  if(!dd)return;
  const q=query.trim().toLowerCase();
  const items=getInsumosItems();

  if(!q){
    const shown=items.slice(0,15);
    if(shown.length){
      dd.style.display='';
      dd.innerHTML=shown.map(i=>{
        const convBadge=i.fatorConversao&&i.fatorConversao>1
          ?` <span style="background:var(--pr);color:#fff;padding:1px 5px;border-radius:8px;font-size:10px">📦${i.unCompra}→${i.un}</span>`
          :'';
        return `<div style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--bdr)"
          onmousedown="selecionarInsumoFicha(${idx},${i.id})"
          onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
          <strong>${i.nome}</strong>${convBadge} <span style="color:var(--ink3)">(${i.estq} ${i.un} disp.)</span>
        </div>`;
      }).join('');
    } else {
      dd.style.display='';
      dd.innerHTML='<div style="padding:10px 12px;font-size:12px;color:var(--ink3)">Nenhum insumo cadastrado</div>';
    }
    return;
  }

  const matches=items.filter(i=>i.nome.toLowerCase().includes(q));
  if(matches.length){
    dd.style.display='';
    dd.innerHTML=matches.slice(0,15).map(i=>{
      const convBadge=i.fatorConversao&&i.fatorConversao>1
        ?` <span style="background:var(--pr);color:#fff;padding:1px 5px;border-radius:8px;font-size:10px">📦${i.unCompra}→${i.un}</span>`
        :'';
      return `<div style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--bdr)"
        onmousedown="selecionarInsumoFicha(${idx},${i.id})"
        onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
        <strong>${i.nome}</strong>${convBadge} <span style="color:var(--ink3)">(${i.estq} ${i.un} disp.)</span>
      </div>`;
    }).join('');
  } else {
    dd.style.display='';
    dd.innerHTML='<div style="padding:10px 12px;font-size:12px;color:var(--ink3)">Nenhum insumo encontrado</div>';
  }
}

function selecionarInsumoFicha(idx,itemId){
  const items=getInsumosItems();
  const item=items.find(i=>i.id===itemId);
  if(!item)return;
  fichaInsumos[idx].itemId=String(itemId);
  fichaInsumos[idx].nome=item.nome;
  fichaInsumos[idx].un=item.un; /* sempre unidade de consumo */
  fichaInsumos[idx].fatorConversao=item.fatorConversao||1;
  fichaInsumos[idx].unCompra=item.unCompra||item.un;
  const searchEl=document.getElementById(`fp-ins-search-${idx}`);
  if(searchEl)searchEl.value=item.nome;
  const unEl=document.getElementById(`fp-ins-un-${idx}`);
  if(unEl)unEl.value=item.un;
  const dd=document.getElementById(`fp-ins-dd-${idx}`);
  if(dd)dd.style.display='none';
  renderFichaInsumos(); /* re-render para mostrar badge de conversão */
}

/* Close dropdowns when clicking outside */
document.addEventListener('click',e=>{
  document.querySelectorAll('.fp-ins-dropdown').forEach(dd=>{
    if(!dd.parentElement.contains(e.target))dd.style.display='none';
  });
});

/* ── Iniciar Produção ── */
async function iniciarProducao(){
  const errEl=document.getElementById('fp-err');
  errEl.style.display='none';

  const prodNome=produtoSelecionado?.nome||'';
  const prodId=produtoSelecionado?.docId||'';
  const un=document.getElementById('fp-un').value;
  const data=document.getElementById('fp-data').value;
  const hora=document.getElementById('fp-hora').value;
  const obs=document.getElementById('fp-obs')?.value||'';

  const erros=[];
  if(!prodNome)erros.push('Selecione o produto a ser produzido.');
  if(!data)erros.push('Informe a data de produção.');
  if(!hora)erros.push('Informe a hora de início.');

  const validIns=fichaInsumos.filter(ins=>ins.itemId&&ins.qtd>0);
  if(!validIns.length)erros.push('Adicione ao menos 1 insumo com quantidade.');

  if(erros.length){
    errEl.textContent='⚠ '+erros.join(' ');
    errEl.style.display='flex';return;
  }

  const dataFmt=data.split('-').reverse().join('/');

  /* F8: Armazenar dados e abrir modal de revisão */
  _pendingProducaoData={prodNome,prodId,un,dataFmt,hora,validIns,obs};
  renderConfirmacaoProducao();
  openM('m-confirmar-producao');
}

function renderConfirmacaoProducao(){
  if(!_pendingProducaoData)return;
  const{prodNome,validIns,obs}=_pendingProducaoData;
  const allItems=getAllItems();

  document.getElementById('cp-sub').textContent=`${prodNome} · ${validIns.length} insumo(s)`;

  let temInsuficiente=false;
  document.getElementById('cp-itens').innerHTML=validIns.map(ins=>{
    const item=allItems.find(x=>x.id===parseInt(ins.itemId));
    const disponivel=item?.estq??0;
    const suf=disponivel>=ins.qtd;
    if(!suf)temInsuficiente=true;
    return`<tr>
      <td><strong>${ins.nome}</strong></td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${ins.qtd} ${ins.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;color:${suf?'var(--ok)':'var(--er)'}">${disponivel} ${ins.un}</td>
      <td><span class="bdg ${suf?'bok':'ber'}">${suf?'✓ OK':'⚠ Insuf.'}</span></td>
    </tr>`;
  }).join('');

  const cpErr=document.getElementById('cp-err');
  if(temInsuficiente){
    cpErr.textContent='⚠ Um ou mais insumos estão abaixo da quantidade necessária. Você ainda pode confirmar, mas o estoque ficará negativo.';
    cpErr.style.display='flex';
  }else{cpErr.style.display='none';}

  const obsEl=document.getElementById('cp-obs-display');
  if(obs){obsEl.style.display='';obsEl.innerHTML=`<strong>📝 Observação:</strong> ${obs}`;}
  else{obsEl.style.display='none';}
}

function cancelarInicioProducao(){
  _pendingProducaoData=null;
  closeM('m-confirmar-producao');
}

async function confirmarInicioProducao(){
  if(!_pendingProducaoData)return;
  const{prodNome,prodId,un,dataFmt,hora,validIns,obs}=_pendingProducaoData;
  const errEl=document.getElementById('cp-err');

  const insumosRegistro=[];
  try{
    for(const ins of validIns){
      const item=getAllItems().find(x=>x.id===parseInt(ins.itemId));
      if(item){
        item.estq=Math.max(0,item.estq-ins.qtd);
        if(item._docId) await db.collection('itens').doc(item._docId).update({estq:item.estq});
        insumosRegistro.push({itemId:ins.itemId,nome:item.nome,un:item.un,qtd:ins.qtd});
      }
    }

    const id='FP-'+String(producoes.length+1).padStart(3,'0');
    const prodData={
      id,produtoId:prodId,produto:prodNome,unProduto:un,
      data:dataFmt,horaInicio:hora,horaFim:null,
      insumos:insumosRegistro,qtdProduzida:0,
      responsavel:SESSION.name,supervisor:null,
      status:'em_andamento',obs:obs||''
    };

    const docRef=await db.collection('producoes').add(prodData);
    producoes.unshift({_docId:docRef.id,...prodData});

    _pendingProducaoData=null;
    closeM('m-confirmar-producao');
    closeM('m-ficha-prod');
    rebuildProducao();rebuildEstoque();updateNotifs();
    toast(`🍳 Produção ${id} iniciada — "${prodNome}" · ${insumosRegistro.length} insumos deduzidos do estoque`);
  }catch(e){
    errEl.textContent='⚠ Erro ao iniciar produção: '+e.message;
    errEl.style.display='flex';
  }
}

/* ══════════════════════════════════════
   F6: EDITAR FICHA DE PRODUÇÃO
══════════════════════════════════════ */

function openEditFicha(fichaId){
  const ficha=producoes.find(p=>p.id===fichaId);
  if(!ficha)return;
  fichaEditInsumos=[...ficha.insumos.map(ins=>({...ins}))];

  document.getElementById('ef-id').value=fichaId;
  document.getElementById('ef-titulo').textContent=`✏️ Editar: ${ficha.produto}`;
  document.getElementById('ef-sub').textContent=`Ficha ${fichaId} · ${ficha.status==='finalizada'?'Finalizada':'Em andamento'}`;

  /* Data no formato YYYY-MM-DD */
  const dataParts=ficha.data.split('/');
  let dataVal='';
  if(dataParts.length===3)dataVal=`${dataParts[2]}-${dataParts[1].padStart(2,'0')}-${dataParts[0].padStart(2,'0')}`;
  else if(dataParts.length===2)dataVal=new Date().getFullYear()+'-'+dataParts[1].padStart(2,'0')+'-'+dataParts[0].padStart(2,'0');
  document.getElementById('ef-data').value=dataVal;
  document.getElementById('ef-hora').value=ficha.horaInicio||'';
  document.getElementById('ef-hora-fim').value=ficha.horaFim||'';
  document.getElementById('ef-qtd').value=ficha.qtdProduzida||'';
  document.getElementById('ef-un-label').textContent=ficha.unProduto||'porção';
  document.getElementById('ef-err').style.display='none';
  
  // populate ef-obs if present
  const efObs=document.getElementById('ef-obs');
  if(efObs)efObs.value=ficha.obs||ficha.obsFinalizacao||'';

  renderEditInsumos();
  openM('m-edit-ficha');
}

function renderEditInsumos(){
  const list=document.getElementById('ef-insumos-list');
  if(!list)return;
  list.innerHTML=fichaEditInsumos.map((ins,i)=>`
    <div style="display:grid;grid-template-columns:1fr 80px 100px 32px;gap:8px;align-items:end;margin-bottom:6px;padding:8px 10px;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2)">
      <div class="fg" style="margin:0"><label class="fl" style="font-size:11px">Ingrediente</label>
        <input class="fc" value="${ins.nome||''}" readonly style="font-size:12px;background:#f5f5f0">
      </div>
      <div class="fg" style="margin:0"><label class="fl" style="font-size:11px">Un.</label>
        <input class="fc" value="${ins.un||''}" readonly style="font-size:12px;background:#f5f5f0">
      </div>
      <div class="fg" style="margin:0"><label class="fl" style="font-size:11px">Qtd. Utilizada</label>
        <input class="fc" type="number" min="0" step="0.5" value="${ins.qtd||''}" placeholder="0"
          oninput="fichaEditInsumos[${i}].qtd=parseFloat(this.value)||0" style="font-size:12px">
      </div>
      <button class="btn btn-er btn-xs" onclick="fichaEditInsumos.splice(${i},1);renderEditInsumos()" style="margin-bottom:2px" title="Remover">✕</button>
    </div>
  `).join('');
}

async function salvarEditFicha(){
  const errEl=document.getElementById('ef-err');
  errEl.style.display='none';
  const fichaId=document.getElementById('ef-id').value;
  const ficha=producoes.find(p=>p.id===fichaId);
  if(!ficha)return;

  const data=document.getElementById('ef-data').value;
  if(!data){errEl.textContent='⚠ Informe a data.';errEl.style.display='flex';return;}

  const dataFmt=data.split('-').reverse().join('/');
  ficha.data=dataFmt;
  ficha.horaInicio=document.getElementById('ef-hora').value||ficha.horaInicio;
  ficha.horaFim=document.getElementById('ef-hora-fim').value||ficha.horaFim;
  const qtd=parseFloat(document.getElementById('ef-qtd').value)||ficha.qtdProduzida;
  if(ficha.status==='finalizada')ficha.qtdProduzida=qtd;
  ficha.insumos=fichaEditInsumos.filter(ins=>ins.itemId&&ins.qtd>0);
  ficha.obs=document.getElementById('ef-obs')?.value??ficha.obs??'';

  try{
    if(ficha._docId){
      const{_docId,...fdData}=ficha;
      await db.collection('producoes').doc(_docId).update(fdData);
    }
    closeM('m-edit-ficha');
    rebuildProducao();
    toast(`✓ Ficha ${fichaId} atualizada!`);
  }catch(e){errEl.textContent='⚠ Erro: '+e.message;errEl.style.display='flex';}
}

/* F6: Excluir ficha de produção */
async function excluirFicha(fichaId){
  const ficha=producoes.find(p=>p.id===fichaId);
  if(!ficha)return;
  if(!confirm(`Excluir ficha ${fichaId} — "${ficha.produto}"?\n\nOs insumos consumidos serão devolvidos ao estoque.`))return;
  try{
    /* Reverter insumos ao estoque */
    const allItems=getAllItems();
    for(const ins of ficha.insumos||[]){
      const item=allItems.find(x=>x.id===parseInt(ins.itemId));
      if(item){
        item.estq=(item.estq||0)+ins.qtd;
        if(item._docId) await db.collection('itens').doc(item._docId).update({estq:item.estq});
      }
    }
    /* Reverter produto acabado se finalizada */
    if(ficha.status==='finalizada'&&ficha.qtdProduzida>0){
      const produtoItem=allItems.find(x=>x.nome===ficha.produto);
      if(produtoItem){
        produtoItem.estq=Math.max(0,(produtoItem.estq||0)-ficha.qtdProduzida);
        if(produtoItem._docId) await db.collection('itens').doc(produtoItem._docId).update({estq:produtoItem.estq});
      }
    }
    if(ficha._docId) await db.collection('producoes').doc(ficha._docId).delete();
    producoes.splice(producoes.indexOf(ficha),1);
    rebuildProducao();
    rebuildEstoque();
    updateNotifs();
    toast(`🗑️ Ficha ${fichaId} excluída — insumos devolvidos ao estoque.`);
  }catch(e){toast('⚠ Erro ao excluir: '+e.message);}
}

/* ══════════════════════════════════════
   FINALIZAR PRODUÇÃO
══════════════════════════════════════ */

function openFinalizarFicha(fichaId){
  const ficha=producoes.find(p=>p.id===fichaId);
  if(!ficha)return;

  const now=new Date();
  document.getElementById('ff-id').value=fichaId;
  document.getElementById('ff-titulo').textContent=`Finalizar: ${ficha.produto}`;
  document.getElementById('ff-sub').textContent=`Ficha ${fichaId} · Início: ${ficha.horaInicio}`;
  document.getElementById('ff-hora').value=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  document.getElementById('ff-qtd').value='';
  document.getElementById('ff-un-label').textContent=ficha.unProduto;
  document.getElementById('ff-err').style.display='none';
  document.getElementById('ff-assinatura').textContent=SESSION.name;
  const ffObs=document.getElementById('ff-obs'); if(ffObs)ffObs.value='';

  openM('m-finalizar-prod');
}

async function finalizarProducao(){
  const errEl=document.getElementById('ff-err');
  errEl.style.display='none';

  const fichaId=document.getElementById('ff-id').value;
  const ficha=producoes.find(p=>p.id===fichaId);
  if(!ficha)return;

  const horaFim=document.getElementById('ff-hora').value;
  const qtd=parseFloat(document.getElementById('ff-qtd').value)||0;

  const erros=[];
  if(!horaFim)erros.push('Informe o horário de finalização.');
  if(qtd<=0)erros.push('Informe a quantidade produzida.');
  if(erros.length){errEl.textContent='⚠ '+erros.join(' ');errEl.style.display='flex';return;}

  /* Calculate production cost from ingredients */
  let custoTotal=0;
  const allItems=getAllItems();
  ficha.insumos.forEach(ins=>{
    const item=allItems.find(x=>x.id===parseInt(ins.itemId));
    if(item && item.custo){
      custoTotal+=(item.custo||0)*(ins.qtd||0);
    }
  });
  const custoUnitario=qtd>0?round2(custoTotal/qtd):0;
  custoTotal=round2(custoTotal);

  /* Dar entrada no produto acabado */
  const produtoItem=allItems.find(x=>x.nome===ficha.produto);
  if(produtoItem){
    produtoItem.estq=(produtoItem.estq||0)+qtd;
    produtoItem.custo=custoUnitario;
    if(produtoItem._docId) await db.collection('itens').doc(produtoItem._docId).update({
      estq:produtoItem.estq,
      custo:custoUnitario
    });
  }

  ficha.horaFim=horaFim;
  ficha.qtdProduzida=qtd;
  ficha.custoProducao=custoTotal;
  ficha.custoUnitario=custoUnitario;
  ficha.supervisor=SESSION.name;
  ficha.status='finalizada';
  ficha.obsFinalizacao=document.getElementById('ff-obs')?.value||'';

  if(ficha._docId){
    const {_docId,...data}=ficha;
    await db.collection('producoes').doc(_docId).update(data);
  }

  closeM('m-finalizar-prod');
  rebuildProducao();
  rebuildEstoque();
  updateNotifs();
  toast(`✅ Produção ${fichaId} finalizada — ${qtd} ${ficha.unProduto} de "${ficha.produto}" · Custo: ${brl(custoUnitario)}/${ficha.unProduto}`);
}
