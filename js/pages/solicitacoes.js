/* ══════════════════════════════════════════════════
   PAGE: Solicitações + Confirmação Item a Item
   Flow: pendente → aprovada/parcial → retirado → enviado → finalizado
══════════════════════════════════════════════════ */

function mkSols() { const pg = mkPg('sols'); pg.innerHTML = solsHTML(); return pg; }

function solsHTML() {
  const isAdmConf = SESSION.role === 'adm' || SESSION.role === 'conf' || SESSION.role === 'coz';
  const pend = solicitacoes.filter(s => s.status === 'pendente');
  const emAndamento = solicitacoes.filter(s => ['aprovada','parcial','retirado','enviado'].includes(s.status));
  const hist = solicitacoes.filter(s => ['recusada','finalizado','entregue'].includes(s.status));

  const adminBar = SESSION.role === 'adm' && solicitacoes.length
    ? `<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-er btn-sm" onclick="excluirTodasSols()">🗑️ Excluir Todas (${solicitacoes.length})</button>
      </div>` : '';

  return `
    ${adminBar}
    <div class="tabs">
      <div class="tab on" onclick="stab(this,'ts-p')">
        Pendentes${pend.length ? ` <span style="background:var(--er);color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">${pend.length}</span>` : ''}
      </div>
      <div class="tab" onclick="stab(this,'ts-a')">
        Em Andamento${emAndamento.length ? ` <span style="background:var(--wa);color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">${emAndamento.length}</span>` : ''}
      </div>
      <div class="tab" onclick="stab(this,'ts-h')">Finalizados</div>
    </div>
    <div class="tp on" id="ts-p">
      ${pend.length === 0 ? `<div class="empty"><div class="ei">✅</div>Nenhum pedido pendente</div>` : pend.map(s => solCardHTML(s)).join('')}
    </div>
    <div class="tp" id="ts-a">
      ${emAndamento.length === 0 ? `<div class="empty"><div class="ei">📋</div>Nenhum pedido em andamento</div>` : emAndamento.map(s => solCardHTML(s)).join('')}
    </div>
    <div class="tp" id="ts-h">
      ${hist.length === 0 ? `<div class="empty"><div class="ei">📋</div>Sem histórico</div>` : hist.map(s => solCardHTML(s)).join('')}
    </div>`;
}

function rebuildSols() {
  const pg = document.getElementById('pg-sols'); if (!pg) return;
  /* Save active tab */
  const activePanel = pg.querySelector('.tp.on');
  const activeTabId = activePanel ? activePanel.id : null;
  pg.innerHTML = solsHTML();
  /* Restore active tab */
  if (activeTabId) {
    pg.querySelectorAll('.tp').forEach(p => p.classList.remove('on'));
    pg.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    const panel = document.getElementById(activeTabId);
    if (panel) {
      panel.classList.add('on');
      /* Find matching tab button */
      pg.querySelectorAll('.tab').forEach(t => {
        if (t.getAttribute('onclick')?.includes(activeTabId)) t.classList.add('on');
      });
    }
  }
  const b = document.querySelector('.ni[data-pg="sols"] .nbdg');
  const n = solicitacoes.filter(s => s.status === 'pendente').length;
  if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
}

function solCardHTML(s) {
  const aprov = s.itens.filter(i => i.status === 'aprovado').length;
  const canc = s.itens.filter(i => i.status === 'cancelado').length;
  const isAdmConf = SESSION.role === 'adm' || SESSION.role === 'conf' || SESSION.role === 'coz';
  const isTrl = SESSION.role === 'trl';

  /* Determine available actions based on status and role */
  let actions = '';
  if (s.status === 'pendente' && isAdmConf) {
    actions = `<button class="btn btn-r btn-sm" onclick="openSol('${s.id}')">Efetuar conferência</button>`;
  } else if (['aprovada','parcial'].includes(s.status) && isAdmConf) {
    actions = `<button class="btn btn-ok btn-sm" onclick="marcarRetirado('${s.id}')">📦 Marcar Retirada</button>`;
  } else if (s.status === 'retirado' && isAdmConf) {
    actions = `<button class="btn btn-r btn-sm" onclick="confirmarEnvio('${s.id}')">🚚 Confirmar Entrega</button>`;
  } else if (s.status === 'enviado' && (isTrl || SESSION.role === 'adm')) {
    actions = `<button class="btn btn-r btn-sm" onclick="openRecebimento('${s.id}')">📋 Confirmar Recebimento</button>`;
  }

  /* Progress bar */
  const steps = [
    { label: 'Pedido', done: true },
    { label: 'Conferido', done: !['pendente'].includes(s.status) },
    { label: 'Retirado', done: ['retirado','enviado','finalizado'].includes(s.status) },
    { label: 'Enviado', done: ['enviado','finalizado'].includes(s.status) },
    { label: 'Recebido', done: s.status === 'finalizado' },
  ];
  const progressBar = (s.status !== 'recusada') ? `<div style="display:flex;gap:2px;margin:10px 0 6px">
    ${steps.map(st => `<div style="flex:1;height:4px;border-radius:2px;background:${st.done ? 'var(--ok)' : 'var(--bdr)'}"></div>`).join('')}
  </div>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-bottom:6px">
    ${steps.map(st => `<span style="${st.done ? 'color:var(--ok);font-weight:600' : ''}">${st.label}</span>`).join('')}
  </div>` : '';

  return `<div class="scard">
    <div class="sch">
      <div style="flex:1">
        <strong>${s.id}</strong>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--ink3);margin-left:8px">${s.hora}</span>
        ${s.status === 'parcial' ? `<span class="partial-tag" style="margin-left:8px">⚡ ${aprov} confirmados · ${canc} cancelados</span>` : ''}
      </div>
      <span class="bdg bgr" style="margin-right:6px">${s.de}</span>
      ${stBdg(s.status)}
    </div>
    ${progressBar}
    <div>
      ${s.itens.map(it => `<div class="sci">
        <span class="bdg ${it.tipo === 'Prato' ? 'bpar' : it.tipo === 'Bebida' ? 'bin' : 'bok'}" style="font-size:10px;flex-shrink:0">${it.tipo}</span>
        <div style="flex:1">${it.nome}</div>
        <strong style="font-family:'DM Mono',monospace;margin-right:10px">${it.qtd} ${it.un}</strong>
        ${s.status !== 'pendente' ? itemStBdg(it.status) : ''}
        ${it.qtdRecebida !== undefined && s.status === 'finalizado' ? `<span class="bdg bok" style="font-size:10px;margin-left:4px">Recebido: ${it.qtdRecebida} ${it.un}</span>` : ''}
      </div>`).join('')}
    </div>
    <div class="scf">
      <span style="font-size:12px;color:var(--ink3);font-style:italic">${s.obs || s.cozObs || 'Sem observações'}</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${actions}
        ${SESSION.role === 'adm' ? `<button class="btn btn-er btn-xs" onclick="excluirSolicitacao('${s._docId}')" title="Excluir pedido">🗑️</button>` : ''}
      </div>
    </div>
  </div>`;
}

/* ── Confirmação Item a Item (Step 2: Conferência) ── */

function openSol(id) {
  const s = solicitacoes.find(x => x.id === id); if (!s) return;
  solAtiva = s;
  s.itens.forEach(it => { if (it.status !== 'aprovado' && it.status !== 'cancelado') it.status = 'pendente'; });
  document.getElementById('ms-id').textContent = id;
  document.getElementById('ms-from').textContent = `De: ${s.de} · ${s.hora}`;
  document.getElementById('ms-obs-area').innerHTML = s.obs
    ? `<div class="al al-in" style="margin-bottom:14px">💬 "${s.obs}"</div>` : '';
  document.getElementById('ms-obs').value = '';
  renderSolItems();
  document.getElementById('ms-footer').innerHTML = `
    <button class="btn btn-g" onclick="closeM('m-sol')">Cancelar</button>
    <button class="btn btn-er btn-sm" onclick="atualizarTodos('cancelado')">✗ Cancelar Todos</button>
    <button class="btn btn-ok btn-sm" onclick="atualizarTodos('aprovado')">✓ Confirmar Todos</button>
    <button class="btn btn-r" onclick="finalizarSol()">Finalizar Conferência →</button>`;
  openM('m-sol');
}

function renderSolItems() {
  if (!solAtiva) return;
  document.getElementById('ms-items-list').innerHTML = solAtiva.itens.map((it, idx) => `
    <div class="conf-item" id="ci-${idx}">
      <div class="conf-item-info">
        <div class="conf-item-name">${it.nome}</div>
        <div class="conf-item-tipo">
          <span class="bdg ${it.tipo === 'Prato' ? 'bpar' : it.tipo === 'Bebida' ? 'bin' : 'bok'}" style="font-size:10px">${it.tipo}</span>
        </div>
      </div>
      <div class="conf-item-qty">${it.qtd} ${it.un}</div>
      <div class="conf-actions">
        ${it.status === 'pendente'
      ? `<button class="btn btn-er btn-xs" onclick="setItemStatus(${idx},'cancelado')">✗ Cancelar</button>
             <button class="btn btn-ok btn-xs" onclick="setItemStatus(${idx},'aprovado')">✓ Confirmar</button>`
      : `<div class="conf-status">
               ${itemStBdg(it.status)}
               <button class="btn btn-g btn-xs" onclick="setItemStatus(${idx},'pendente')" title="Desfazer">↩</button>
             </div>`
    }
      </div>
    </div>`).join('');
}

function setItemStatus(idx, st) {
  if (!solAtiva) return;
  solAtiva.itens[idx].status = st;
  renderSolItems();
}

function atualizarTodos(st) {
  if (!solAtiva) return;
  solAtiva.itens.forEach(it => it.status = st);
  renderSolItems();
}

async function finalizarSol() {
  if (!solAtiva) return;
  const aprov = solAtiva.itens.filter(i => i.status === 'aprovado').length;
  const canc = solAtiva.itens.filter(i => i.status === 'cancelado').length;
  const pend = solAtiva.itens.filter(i => i.status === 'pendente').length;
  if (pend > 0) { toast('⚠ Ainda há itens aguardando decisão. Confirme ou cancele todos.'); return; }
  if (aprov === 0) { solAtiva.status = 'recusada'; }
  else if (canc > 0) { solAtiva.status = 'parcial'; }
  else { solAtiva.status = 'aprovada'; }
  const obs = document.getElementById('ms-obs')?.value;
  if (obs) solAtiva.cozObs = obs;

  if(solAtiva._docId){
    const {_docId, ...data} = solAtiva;
    await db.collection('solicitacoes').doc(_docId).update(data);
  }
  await logActivity('pedido', `Conferência: ${solAtiva.id} → ${solAtiva.status}`);

  closeM('m-sol');
  const msg = solAtiva.status === 'recusada'
    ? `✗ Pedido ${solAtiva.id} recusado.`
    : solAtiva.status === 'parcial'
      ? `⚡ Pedido ${solAtiva.id} aprovado parcialmente (${aprov} de ${solAtiva.itens.length} itens).`
      : `✅ Pedido ${solAtiva.id} aprovado integralmente!`;
  toast(msg);
  solAtiva = null;
  updateNotifs(); rebuildSols(); rebuildDash();
}

/* ── Step 3: Retirada (Adm/Conf marks items as separated) ── */

async function marcarRetirado(id) {
  const s = solicitacoes.find(x => x.id === id); if (!s) return;
  s.status = 'retirado';
  if(s._docId){
    await db.collection('solicitacoes').doc(s._docId).update({ status: 'retirado' });
  }
  await logActivity('pedido', `Retirada: ${s.id} — itens separados`);
  toast(`📦 Pedido ${s.id} marcado como retirado!`);
  updateNotifs(); rebuildSols(); rebuildDash();
}

/* ── Step 4: Confirmar Envio (Adm/Conf confirms delivery) ── */

async function confirmarEnvio(id) {
  const s = solicitacoes.find(x => x.id === id); if (!s) return;
  s.status = 'enviado';
  if(s._docId){
    await db.collection('solicitacoes').doc(s._docId).update({ status: 'enviado' });
  }
  await logActivity('pedido', `Envio: ${s.id} — entregue ao trailer`);
  toast(`🚚 Pedido ${s.id} enviado ao Trailer!`);
  updateNotifs(); rebuildSols(); rebuildDash();
}

/* ── Step 5: Confirmar Recebimento (Trailer confirms receipt + assigns location) ── */

let recebAtivo = null;

function openRecebimento(id) {
  const s = solicitacoes.find(x => x.id === id); if (!s) return;
  recebAtivo = s;

  document.getElementById('rec-id').textContent = id;
  document.getElementById('rec-from').textContent = `De: Cozinha · ${s.hora}`;

  /* F8: Admin vê todos os locais; Trailer vê apenas locais do Trailer */
  const trlLocais = SESSION.role === 'adm' ? locais : locais.filter(l => l.setor === 'Trailer');
  const locOpts = trlLocais.length
    ? trlLocais.map(l => `<option value="${l.nome}">${l.nome}</option>`).join('')
    : `<option value="">Nenhum local cadastrado</option>`;

  /* Only show approved items for receipt confirmation */
  const aprovados = s.itens.filter(i => i.status === 'aprovado');

  document.getElementById('rec-items-list').innerHTML = aprovados.map((it, idx) => {
    const origIdx = s.itens.indexOf(it);
    return `
    <div class="conf-item" style="flex-direction:column;align-items:stretch;gap:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="conf-item-info" style="flex:1">
          <div class="conf-item-name">${it.nome}</div>
          <div class="conf-item-tipo">
            <span class="bdg ${it.tipo === 'Prato' ? 'bpar' : it.tipo === 'Bebida' ? 'bin' : 'bok'}" style="font-size:10px">${it.tipo}</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--ink3)">Enviado: <strong>${it.qtd} ${it.un}</strong></div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg2);border-radius:8px;padding:8px 10px">
        <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:140px">
          <label style="font-size:11px;color:var(--ink3);white-space:nowrap">📍 Local:</label>
          <select class="fc rec-local-input" data-idx="${origIdx}" style="font-size:12px;padding:4px 6px;min-width:120px">
            ${locOpts}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <label style="font-size:11px;color:var(--ink3);white-space:nowrap">Qtd recebida:</label>
          <input class="fc rec-qtd-input" data-idx="${origIdx}" type="number" min="0" max="${it.qtd}" step="0.5" value="${it.qtd}" style="width:70px;font-size:12px;text-align:center;padding:4px 6px">
          <span style="font-size:11px;color:var(--ink3)">${it.un}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  openM('m-recebimento');
}

async function finalizarRecebimento() {
  if (!recebAtivo) return;

  /* Validate: all items must have a location selected */
  const localInputs = document.querySelectorAll('.rec-local-input');
  for (const sel of localInputs) {
    if (!sel.value) {
      toast('⚠ Selecione um local para todos os itens!');
      return;
    }
  }

  /* Collect received quantities and locations */
  const qtdInputs = document.querySelectorAll('.rec-qtd-input');
  const movimentos = []; /* {itemId, qtdRecebida, localDestino} */

  qtdInputs.forEach(inp => {
    const idx = parseInt(inp.dataset.idx);
    const qtdRecebida = parseFloat(inp.value) || 0;
    recebAtivo.itens[idx].qtdRecebida = qtdRecebida;
  });
  localInputs.forEach(sel => {
    const idx = parseInt(sel.dataset.idx);
    recebAtivo.itens[idx].localDestino = sel.value;
  });

  /* Perform stock movements for each approved item */
  const allItems = getAllItems();

  for (const it of recebAtivo.itens) {
    if (it.status !== 'aprovado' || !it.qtdRecebida) continue;

    const item = allItems.find(i => i.id === it.id);
    if (!item) continue;

    const qtdMover = it.qtdRecebida;
    const destino = it.localDestino;

    /* 1. Decrease source item stock (kitchen) */
    item.estq = Math.max(0, (item.estq || 0) - qtdMover);

    /* 2. Update source item distribuicao (decrease from current local) */
    if (!item.distribuicao) item.distribuicao = [];
    if (item.local) {
      /* Decrease from primary location */
      const srcDist = item.distribuicao.find(d => d.local === item.local);
      if (srcDist) {
        srcDist.qtd = Math.max(0, srcDist.qtd - qtdMover);
      }
    }

    /* 3. Add to destination (trailer location) in distribuicao */
    const destDist = item.distribuicao.find(d => d.local === destino);
    if (destDist) {
      destDist.qtd = (destDist.qtd || 0) + qtdMover;
    } else {
      item.distribuicao.push({ local: destino, qtd: qtdMover });
    }

    /* Clean up zero-qty entries */
    item.distribuicao = item.distribuicao.filter(d => d.qtd > 0);

    /* 4. Persist to Firestore */
    if (item._docId) {
      await db.collection('itens').doc(item._docId).update({
        estq: item.estq,
        distribuicao: item.distribuicao,
      });
    }
  }

  const obsReceb = document.getElementById('rec-obs')?.value || '';
  if (obsReceb) recebAtivo.obsReceb = obsReceb;

  recebAtivo.status = 'finalizado';

  if (recebAtivo._docId) {
    const { _docId, ...data } = recebAtivo;
    await db.collection('solicitacoes').doc(_docId).update(data);
  }

  await logActivity('pedido', `Recebimento confirmado: ${recebAtivo.id}`);

  closeM('m-recebimento');
  toast(`✅ Pedido ${recebAtivo.id} finalizado — estoque atualizado!`);
  recebAtivo = null;
  updateNotifs(); rebuildSols(); rebuildDash(); rebuildEstoque();
  if (typeof rebuildEstoqueLocal === 'function') rebuildEstoqueLocal();
  if (typeof rebuildMeus === 'function') rebuildMeus();
}

/* ── Admin: Excluir Solicitação Individual ── */

async function excluirSolicitacao(docId) {
  if (SESSION.role !== 'adm') return;
  const s = solicitacoes.find(x => x._docId === docId);
  if (!s) return;
  if (!confirm(`Tem certeza que deseja excluir o pedido ${s.id}?\nEsta ação não pode ser desfeita.`)) return;

  try {
    await db.collection('solicitacoes').doc(docId).delete();
    solicitacoes = solicitacoes.filter(x => x._docId !== docId);
    toast(`🗑️ Pedido ${s.id} excluído.`);
    updateNotifs(); rebuildSols(); rebuildDash();
  } catch (e) {
    toast(`⚠ Erro ao excluir: ${e.message}`);
  }
}

/* ── Admin: Excluir Todas as Solicitações ── */

async function excluirTodasSols() {
  if (SESSION.role !== 'adm') return;
  const total = solicitacoes.length;
  if (!total) return;
  if (!confirm(`⚠️ ATENÇÃO!\n\nVocê está prestes a excluir TODAS as ${total} solicitações.\nEsta ação é IRREVERSÍVEL.\n\nDeseja continuar?`)) return;
  if (!confirm(`Última confirmação: excluir permanentemente ${total} pedidos?`)) return;

  try {
    toast('⏳ Excluindo pedidos...');
    for (const s of solicitacoes) {
      if (s._docId) await db.collection('solicitacoes').doc(s._docId).delete();
    }
    solicitacoes = [];
    toast(`🗑️ ${total} pedidos excluídos.`);
    updateNotifs(); rebuildSols(); rebuildDash();
  } catch (e) {
    toast(`⚠ Erro: ${e.message}`);
  }
}
