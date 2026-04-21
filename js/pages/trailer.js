/* ══════════════════════════════════════════════════
   PAGE: Trailer — Dashboard, Novo Pedido, Meus Pedidos
   (Uses TIPOS registry for dynamic item sections)
══════════════════════════════════════════════════ */

function buildTrailerPages(main) {
  main.appendChild(mkTrlDash());
  main.appendChild(mkNovo());
  main.appendChild(mkMeus());
  main.appendChild(mkConferencia());
  main.appendChild(mkEstoqueLocal());
  main.appendChild(mkConsumo());
  loadConsumos();
}

/* ── Dashboard Trailer ── */
function trlDashHTML() {
  const meus = solicitacoes.filter(s => s.de === `Trailer (${SESSION.name.split(' ')[0]})`);
  const pend = meus.filter(s => s.status === 'pendente').length;
  const aprov = meus.filter(s => ['aprovada', 'parcial'].includes(s.status)).length;
  return `
    ${aprov ? `<div class="al al-ok">✅ <strong>${aprov} pedido(s) confirmado(s)</strong> pela cozinha — prontos para retirada!</div>` : ''}
    ${pend ? `<div class="al al-wa">⏳ <strong>${pend} pedido(s)</strong> aguardando confirmação da cozinha</div>` : ''}
    ${!pend && !aprov ? `<div class="al al-ok">✓ Nenhum pedido em aberto</div>` : ''}
    <div class="krow">
      <div class="kpi"><div class="kl">Pedidos Hoje</div><div class="kv">${meus.length}</div></div>
      <div class="kpi"><div class="kl">Pendentes</div><div class="kv">${pend}</div></div>
      <div class="kpi"><div class="kl">Confirmados</div><div class="kv">${aprov}</div></div>
      <div class="kpi"><div class="kl">Entregues</div><div class="kv">${meus.filter(s => s.status === 'entregue').length}</div></div>
    </div>
    <div class="sec"><div class="st">Meus Pedidos</div><div class="sl"></div><button class="btn btn-g btn-sm" onclick="navTo('meus')">Ver todos →</button></div>
    ${meus.slice(0, 2).map(s => trlSolCard(s)).join('')}
    <div style="margin-top:20px">
      <button class="btn btn-r" style="width:100%;justify-content:center;padding:14px;font-size:14px" onclick="navTo('novo')">
        📝 Fazer Novo Pedido
      </button>
    </div>`;
}

function mkTrlDash() { const pg = mkPg('dash'); pg.innerHTML = trlDashHTML(); return pg; }

function rebuildDash() {
  const pg = document.getElementById('pg-dash'); if (!pg) return;
  if (SESSION.role === 'trl') pg.innerHTML = trlDashHTML();
  else if (SESSION.role === 'coz') pg.innerHTML = cozDashHTML();
  else pg.innerHTML = dashHTML();
}

/* ── Card de Solicitação (visão Trailer) ── */
function trlSolCard(s) {
  const aprov = s.itens.filter(i => i.status === 'aprovado').length;
  const canc = s.itens.filter(i => i.status === 'cancelado').length;

  /* Progress bar */
  const steps = [
    { label: 'Pedido', done: true },
    { label: 'Conferido', done: !['pendente'].includes(s.status) },
    { label: 'Retirado', done: ['retirado', 'enviado', 'finalizado'].includes(s.status) },
    { label: 'Enviado', done: ['enviado', 'finalizado'].includes(s.status) },
    { label: 'Recebido', done: s.status === 'finalizado' },
  ];
  const progressBar = (s.status !== 'recusada') ? `<div style="display:flex;gap:2px;margin:10px 0 6px">
    ${steps.map(st => `<div style="flex:1;height:4px;border-radius:2px;background:${st.done ? 'var(--ok)' : 'var(--bdr)'}"></div>`).join('')}
  </div>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-bottom:6px">
    ${steps.map(st => `<span style="${st.done ? 'color:var(--ok);font-weight:600' : ''}">${st.label}</span>`).join('')}
  </div>`: '';

  /* Action button */
  let action = '';
  if (s.status === 'enviado') {
    action = `<button class="btn btn-r btn-sm" onclick="openRecebimento('${s.id}')">📋 Confirmar Recebimento</button>`;
  }

  return `<div class="scard">
    <div class="sch">
      <div style="flex:1">
        <strong>${s.id}</strong>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--ink3);margin-left:8px">${s.hora}</span>
      </div>
      ${stBdg(s.status)}
    </div>
    ${progressBar}
    <div>
      ${s.itens.map(it => `<div class="sci">
        <span class="bdg ${it.tipo === 'Prato' ? 'bpar' : it.tipo === 'Bebida' ? 'bin' : 'bok'}" style="font-size:10px;flex-shrink:0">${it.tipo}</span>
        <div style="flex:1">${it.nome}</div>
        <strong style="font-family:'DM Mono',monospace;margin-right:10px">${it.qtd} ${it.un}</strong>
        ${itemStBdg(it.status)}
        ${it.qtdRecebida !== undefined && s.status === 'finalizado' ? `<span class="bdg bok" style="font-size:10px;margin-left:4px">Recebido: ${it.qtdRecebida} ${it.un}</span>` : ''}
      </div>`).join('')}
    </div>
    <div class="scf">
      ${(s.status === 'parcial' || s.cozObs) ? `
        ${s.status === 'parcial' ? `<span style="font-size:12px;color:var(--wa)">⚡ ${aprov} itens confirmados · ${canc} cancelados pela cozinha</span>` : ''}
        ${s.cozObs ? `<span style="font-size:12px;color:var(--ink3);font-style:italic">— ${s.cozObs}</span>` : ''}` : ''}
      ${action}
    </div>
  </div>`;
}

/* ── Novo Pedido (search-based) ── */
function novoHTML() {
  reqQtd = {};
  return `
    <div class="flow">
      <div class="fn fn-a">1 · Buscar itens</div><div class="fa">→</div>
      <div class="fn">2 · Enviar pedido</div><div class="fa">→</div>
      <div class="fn">3 · Conferência</div><div class="fa">→</div>
      <div class="fn">4 · Retirada</div><div class="fa">→</div>
      <div class="fn">5 · Entrega</div><div class="fa">→</div>
      <div class="fn">6 · Recebimento</div>
    </div>
    <div class="al al-in" style="margin-bottom:16px;font-size:12px">
      ℹ️ Digite o nome do item que deseja adicionar ao pedido. A cozinha poderá confirmar ou cancelar cada item individualmente.
    </div>
    <div style="display:grid;grid-template-columns:1fr 310px;gap:20px;align-items:start">
      <div>
        <!-- Barra de busca -->
        <div class="panel" style="margin-bottom:16px">
          <div class="pb" style="padding:14px 18px">
            <label class="fl" style="margin-bottom:8px">🔍 Buscar item para adicionar</label>
            <input class="fc" id="pedido-busca" type="text" placeholder="Digite o nome do item... (ex: camarão, refrigerante, tacacá)"
              oninput="filtrarItensPedido(this.value)" autocomplete="off"
              style="font-size:14px;padding:12px 14px">
            <div style="font-size:11px;color:var(--ink3);margin-top:6px" id="pedido-busca-hint">
              Digite pelo menos 2 caracteres para buscar
            </div>
          </div>
        </div>

        <!-- Resultados da busca -->
        <div id="pedido-resultados">
          <div class="empty" style="padding:40px 0">
            <div class="ei" style="font-size:32px">🔍</div>
            <div style="font-size:13px;color:var(--ink3);margin-top:8px">Busque um item acima para começar seu pedido</div>
          </div>
        </div>

        <!-- Itens já adicionados ao pedido -->
        <div id="pedido-adicionados" style="display:none;margin-top:16px">
          <div class="form-section-title" style="margin-bottom:10px">✅ Itens no pedido</div>
          <div id="pedido-adicionados-list"></div>
        </div>
      </div>

      <div style="position:sticky;top:66px">
        <div class="panel">
          <div class="ph"><div class="pht">Resumo do Pedido</div><span id="res-count" style="font-size:12px;color:var(--ink3)">0 itens</span></div>
          <div class="pb">
            <div id="res-list">
              <div class="empty" style="padding:20px 0"><div class="ei" style="font-size:26px">📝</div><div style="font-size:12px">Busque e adicione itens ao pedido</div></div>
            </div>
            <div class="dvd"></div>
            <div class="fg" style="margin-bottom:14px">
              <label class="fl">Observações</label>
              <textarea class="fc" id="req-obs" rows="3" placeholder="Ex: Urgente para 10h, chegará cliente especial..."></textarea>
            </div>
            <button class="btn btn-r" id="btn-send" style="width:100%;justify-content:center" onclick="enviarPedido()" disabled>
              Enviar Solicitação de Reposição
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function filtrarItensPedido(query) {
  const container = document.getElementById('pedido-resultados');
  const hint = document.getElementById('pedido-busca-hint');
  if (!container) return;

  const q = query.trim().toLowerCase();

  if (q.length < 2) {
    container.innerHTML = `<div class="empty" style="padding:40px 0">
      <div class="ei" style="font-size:32px">🔍</div>
      <div style="font-size:13px;color:var(--ink3);margin-top:8px">Busque um item acima para começar seu pedido</div>
    </div>`;
    if (hint) hint.textContent = 'Digite pelo menos 2 caracteres para buscar';
    return;
  }

  const all = getAllItems();
  const matches = all.filter(i => i.nome.toLowerCase().includes(q));

  if (!matches.length) {
    container.innerHTML = `<div class="empty" style="padding:30px 0">
      <div class="ei" style="font-size:26px">😕</div>
      <div style="font-size:13px;color:var(--ink3);margin-top:8px">Nenhum item encontrado para "<strong>${query}</strong>"</div>
    </div>`;
    if (hint) hint.textContent = `0 resultados para "${query}"`;
    return;
  }

  if (hint) hint.textContent = `${matches.length} resultado(s) encontrado(s)`;

  /* Group by tipo/category */
  const grouped = {};
  matches.forEach(item => {
    const tipo = getTipoByItem(item.id);
    const key = tipo ? `${tipo.icon} ${item.cat || tipo.nome}` : `📦 ${item.cat || 'Outros'}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  container.innerHTML = Object.entries(grouped).map(([cat, items]) => `
    <div class="panel" style="margin-bottom:10px">
      <div class="ph"><div class="pht">${cat}</div></div>
      <div class="pb" style="padding:0 18px">
        ${items.map(item => renderItemPedido(item)).join('')}
      </div>
    </div>`).join('');
}

function renderItemPedido(item) {
  const currentQty = reqQtd[item.id] || 0;
  return `<div class="req-item">
    <div class="req-item-n">
      <div class="req-item-name">${item.nome}</div>
      <div class="req-item-sub">${item.un} · ${item.estq} disponíveis ${item.estq < item.min ? '<span style="color:var(--wa)">⚠ Baixo</span>' : ''}</div>
    </div>
    <div class="qty-wrap">
      <button class="qb" onclick="chgQty(${item.id},-1)">−</button>
      <input class="qi" id="qi-${item.id}" type="number" value="${currentQty}" min="0" max="${item.estq}" oninput="setQty(${item.id},this.value)" onblur="refreshPedidoBusca()">
      <button class="qb" onclick="chgQty(${item.id},1)">+</button>
    </div>
  </div>`;
}

function refreshPedidoBusca() {
  /* Só redesenha a lista de busca se nenhum input de quantidade estiver com foco.
     Isso evita que o teclado feche ao digitar. */
  const activeEl = document.activeElement;
  const isQtyFocused = activeEl && activeEl.classList.contains('qi');
  if (!isQtyFocused) {
    const busca = document.getElementById('pedido-busca');
    if (busca && busca.value.trim().length >= 2) filtrarItensPedido(busca.value);
  } else {
    /* Apenas atualiza os valores dos inputs sem redesenhar o HTML */
    Object.entries(reqQtd).forEach(([id, q]) => {
      const inp = document.getElementById('qi-' + id);
      if (inp && inp !== activeEl) inp.value = q;
    });
  }
  /* Update "itens no pedido" section */
  const all = getAllItems();
  const active = Object.entries(reqQtd).filter(([, q]) => q > 0);
  const addedDiv = document.getElementById('pedido-adicionados');
  const addedList = document.getElementById('pedido-adicionados-list');
  if (!addedDiv || !addedList) return;
  if (active.length) {
    addedDiv.style.display = '';
    addedList.innerHTML = active.map(([id, q]) => {
      const it = all.find(i => i.id === parseInt(id)); if (!it) return '';
      return renderItemPedido(it);
    }).join('');
  } else {
    addedDiv.style.display = 'none';
  }
}

function mkNovo() { const pg = mkPg('novo'); pg.innerHTML = novoHTML(); return pg; }
function rebuildNovo() { const pg = document.getElementById('pg-novo'); if (pg) pg.innerHTML = novoHTML(); }

/* ── Meus Pedidos ── */
function meusHTML() {
  const de = `Trailer (${SESSION.name.split(' ')[0]})`;
  const meus = solicitacoes.filter(s => s.de === de);
  if (!meus.length) return `<div class="empty"><div class="ei">📋</div>Nenhum pedido ainda.<br><button class="btn btn-r" onclick="navTo('novo')" style="margin-top:14px">Fazer Novo Pedido</button></div>`;
  return meus.map(s => trlSolCard(s)).join('');
}
function mkMeus() { const pg = mkPg('meus'); pg.innerHTML = meusHTML(); return pg; }
function rebuildMeus() { const pg = document.getElementById('pg-meus'); if (pg) pg.innerHTML = meusHTML(); }

/* ── Quantidade / Resumo (uses getAllItems) ── */
function chgQty(id, delta) {
  const all = getAllItems();
  const item = all.find(i => i.id === id);
  const nv = Math.max(0, Math.min(item ? item.estq : 9999, (reqQtd[id] || 0) + delta));
  reqQtd[id] = nv;
  const inp = document.getElementById('qi-' + id); if (inp) inp.value = nv;
  updateResumo();
  refreshPedidoBusca();
}
function setQty(id, v) {
  const all = getAllItems();
  const item = all.find(i => i.id === id);
  const max = item ? item.estq : 9999;
  const nv = Math.max(0, Math.min(max, parseInt(v) || 0));
  reqQtd[id] = nv;
  /* Se o valor digitado ultrapassar o estoque disponível, corrige o campo
     visualmente em tempo real para que o usuário perceba o limite. */
  if (parseInt(v) > max) {
    const inp = document.getElementById('qi-' + id);
    if (inp) inp.value = nv;
  }
  updateResumo();
  /* NÃO chamar refreshPedidoBusca() aqui: recriar o HTML destrói o <input>
     em foco e fecha o teclado no celular. A lista de busca é atualizada
     apenas quando o usuário terminar de digitar (blur) ou usar ＋/−. */
}
function updateResumo() {
  const all = getAllItems();
  const active = Object.entries(reqQtd).filter(([, q]) => q > 0);
  const cnt = document.getElementById('res-count');
  const lst = document.getElementById('res-list');
  const btn = document.getElementById('btn-send');
  if (!lst) return;
  if (cnt) cnt.textContent = active.length + ' ite' + (active.length === 1 ? 'm' : 'ns');
  if (!active.length) {
    if (lst) lst.innerHTML = `<div class="empty" style="padding:20px 0"><div class="ei" style="font-size:26px">📝</div><div style="font-size:12px">Preencha as quantidades ao lado</div></div>`;
    if (btn) btn.disabled = true; return;
  }
  if (lst) lst.innerHTML = active.map(([id, q]) => {
    const it = all.find(i => i.id === parseInt(id)); if (!it) return '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bdr)">
      <div style="flex:1;font-size:13px">${it.nome}</div>
      <strong style="font-family:'DM Mono',monospace">${q} ${it.un}</strong>
    </div>`;
  }).join('');
  if (btn) btn.disabled = false;
}

/* ── Enviar Pedido (uses TIPOS) ── */
async function enviarPedido() {
  const all = getAllItems();
  const active = Object.entries(reqQtd).filter(([, q]) => q > 0);
  if (!active.length) { toast('Informe ao menos 1 item!'); return; }
  const obs = document.getElementById('req-obs')?.value || '';
  const id = 'SOL-' + String(solicitacoes.length + 1).padStart(3, '0');
  const now = new Date();
  const hora = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const de = `Trailer (${SESSION.name.split(' ')[0]})`;
  const solData = {
    id, de, hora, status: 'pendente', obs,
    ts: firebase.firestore.FieldValue.serverTimestamp(),
    itens: active.map(([sid, q]) => {
      const it = all.find(i => i.id === parseInt(sid));
      const tipo = getTipoByItem(parseInt(sid));
      return { id: parseInt(sid), nome: it.nome, un: it.un, qtd: q, tipo: tipo ? tipo.nome : 'Outro', status: 'pendente' };
    })
  };
  const docRef = await db.collection('solicitacoes').add(solData);
  solicitacoes.unshift({ _docId: docRef.id, ...solData });
  reqQtd = {};
  updateNotifs();
  enviarAlertaTelegram(`📝 <b>Novo Pedido do Trailer</b>\n\n🆔 ${id}\n⏰ ${hora}\n🛒 ${active.length} item(ns) solicitados.\n\nAcesse o painel do ChefStock para confirmar.`);
  toast(`✅ Pedido ${id} enviado à cozinha!`);
  navTo('meus');
}
