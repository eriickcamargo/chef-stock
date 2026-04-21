/* ══════════════════════════════════════════════════
   PAGE: Estoque — Items as clickable list cards
   + Bulk operations (inventário, exclusão em massa)
   + Distribution popout per item
══════════════════════════════════════════════════ */

let bulkMode = false; /* whether checkboxes are visible */

function mkEstoque() {
  const pg = mkPg('estoque');
  pg.innerHTML = estqHTML();
  return pg;
}

function estqHTML() {
  const canEdit = SESSION.role === 'adm';
  const isAdm = SESSION.role === 'adm';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink3)">
        ${canEdit ? 'Gerencie todos os itens do estoque do Gosto Paraense.' : 'Visualize os itens do estoque.'}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${canEdit ? `<button class="btn btn-g btn-sm" onclick="toggleBulkMode()" id="btn-bulk-toggle">${bulkMode ? '✕ Sair do modo seleção' : '☑ Selecionar itens'}</button>` : ''}
        ${canEdit && bulkMode ? `<button class="btn btn-wa btn-sm" onclick="openBulkAjuste()">📦 Ajustar Selecionados</button>
        <button class="btn btn-er btn-sm" onclick="confirmarBulkDelete()">🗑️ Excluir Selecionados</button>` : ''}
        ${isAdm ? `<button class="btn btn-g" onclick="openM('m-novo-tipo')">➕ Novo Tipo</button>` : ''}
        ${canEdit ? `<button class="btn btn-r" onclick="openCadastro()">➕ Cadastrar Novo Item</button>` : ''}
      </div>
    </div>
    <div class="tabs">
      ${TIPOS.map((t, i) => `<div class="tab${i === 0 ? ' on' : ''}" onclick="stab(this,'te-${t.id}')">${t.icon} ${t.nome} <span style="font-size:10px;color:var(--ink3);margin-left:3px">(${t.itens.length})</span>${isAdm ? `<span style="margin-left:5px;cursor:pointer;opacity:.5;font-size:12px" onclick="event.stopPropagation();openEditTipo('${t.id}')" title="Editar tipo">⚙️</span>` : ''}</div>`).join('')}
    </div>

    ${TIPOS.map((t, i) => `
    <div class="tp${i === 0 ? ' on' : ''}" id="te-${t.id}">
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <input class="fc" style="width:210px" placeholder="🔍 Buscar ${t.nome.toLowerCase()}..." oninput="filtItemList(this.value,'elist-${t.id}')">
        ${t.cats.length ? `<select class="fc" style="width:175px" onchange="filtCatList(this.value,'elist-${t.id}')">
          <option value="">Todas as categorias</option>
          ${t.cats.map(c => `<option>${c}</option>`).join('')}
        </select>`: ''}
        <select class="fc" style="width:145px" onchange="filtNivelList(this.value,'elist-${t.id}')">
          <option value="">Todos os níveis</option>
          <option value="e">⚠️ Crítico</option><option value="w">⬇️ Baixo</option><option value="o">✅ Normal</option>
        </select>
        ${isAdm && t.campos.local ? `<button class="btn btn-g btn-sm" onclick="openM('m-receb')">➕ Entrada NF</button>` : ''}
      </div>
      <div class="estq-list" id="elist-${t.id}">
        ${t.itens.length ? t.itens.map(item => estqItemCard(item, t, canEdit)).join('') : '<div class="empty" style="padding:30px 0"><div class="ei">📦</div><div>Nenhum item neste tipo</div></div>'}
      </div>
    </div>`).join('')}`;
}

/* Total stock across all locations */
function getEstqTotal(item) {
  const dist = item.distribuicao;
  /* Guard: distribuicao can be Array, Object map, Number (zeroed by cleanup), or null */
  const distArr = Array.isArray(dist) ? dist : [];
  const distSum = distArr.reduce((s, d) => s + (d?.qtd || 0), 0);
  return (item.estq || 0) + distSum;
}

function estqItemCard(item, tipo, canEdit) {
  const total = getEstqTotal(item);
  const nivel = nvl(total, item.min);
  const nivelColor = nivel === 'e' ? 'var(--er)' : nivel === 'w' ? 'var(--wa)' : 'var(--ok)';
  const distCount = (item.distribuicao && item.distribuicao.length) || 0;
  const hasMulti = distCount > 0 && item.local;
  const totalLocs = hasMulti ? distCount + 1 : (distCount || (item.local ? 1 : 0));

  return `
  <div class="estq-item" data-cat="${item.cat || ''}" data-nivel="${nivel}" data-nome="${item.nome.toLowerCase()}" data-item-id="${item.id}" onclick="openItemDetail(${item.id},'${tipo.id}')" style="cursor:pointer">
    <div class="estq-item-left">
      ${bulkMode ? `<input type="checkbox" class="bulk-cb" value="${item.id}" data-grupo="${tipo.id}" onclick="event.stopPropagation()" style="width:18px;height:18px;accent-color:var(--pr);flex-shrink:0">` : ''}
      <div style="width:6px;height:36px;border-radius:3px;background:${nivelColor};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.nome}</div>
        <div style="font-size:11px;color:var(--ink3);display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
          <span class="chip" style="font-size:10px">${item.cat || '—'}</span>
          ${item.local ? `<span>📍 ${item.local}</span>` : ''}
          ${totalLocs > 1 ? `<span style="color:var(--pr)">📍 ${totalLocs} locais</span>` : ''}
          ${item.fatorConversao&&item.fatorConversao>1 ? `<span style="background:var(--pr);color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600">📦 1 ${item.unCompra||'pct'} = ${item.fatorConversao} ${item.un}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="estq-item-right">
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:600">${total} ${item.un}</div>
        <div style="font-size:10px;color:var(--ink3)">mín: ${item.min} ${item.un}</div>
      </div>
      ${sb(total, item.min)}
      <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--ink3);flex-shrink:0">${brl(item.custo)}</div>
      ${canEdit ? `<div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        <button class="btn btn-g btn-xs" onclick="openAj(${item.id},'${tipo.id}')">Ajustar</button>
        <button class="btn btn-ok btn-xs" onclick="openEditar(${item.id},'${tipo.id}')">✏️</button>
      </div>` : ''}
    </div>
  </div>`;
}

/* ── Item Detail Popout ── */

function openItemDetail(itemId, tipoId) {
  if (bulkMode) return; /* Don't open in bulk mode */
  const tipo = getTipo(tipoId);
  if (!tipo) return;
  const item = tipo.itens.find(x => x.id === itemId);
  if (!item) return;

  const total = getEstqTotal(item);
  const nivel = nvl(total, item.min);
  const nivelColor = nivel === 'e' ? 'var(--er)' : nivel === 'w' ? 'var(--wa)' : 'var(--ok)';

  /* Build distribution table — combine primary location + distribuicao */
  let distRows = [];

  /* Primary location (kitchen stock remaining in item.estq) */
  if (item.local && item.estq > 0) {
    const loc = locais.find(l => l.nome === item.local);
    const setor = loc?.setor || 'Cozinha';
    const setorIcon = setor === 'Trailer' ? '🚌' : '🍳';
    distRows.push(`<tr>
      <td><strong>📍 ${item.local}</strong></td>
      <td>${setorIcon} ${setor}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center"><strong>${item.estq}</strong> ${item.un}</td>
    </tr>`);
  }

  /* Distribuicao entries (transferred stock) */
  if (item.distribuicao && item.distribuicao.length) {
    item.distribuicao.filter(d => d.qtd > 0).forEach(d => {
      const loc = locais.find(l => l.nome === d.local);
      const setor = loc?.setor || 'Cozinha';
      const setorIcon = setor === 'Trailer' ? '🚌' : '🍳';
      distRows.push(`<tr>
        <td><strong>📍 ${d.local}</strong></td>
        <td>${setorIcon} ${setor}</td>
        <td style="font-family:'DM Mono',monospace;text-align:center"><strong>${d.qtd}</strong> ${item.un}</td>
      </tr>`);
    });
  }

  let distHTML = '';
  if (distRows.length) {
    distHTML = `
      <div style="margin-top:16px">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px">📍 Distribuição por Local</div>
        <div class="panel" style="margin:0"><div class="tw"><table>
          <thead><tr>
            <th>Local</th>
            <th>Setor</th>
            <th style="width:100px">Quantidade</th>
          </tr></thead>
          <tbody>
            ${distRows.join('')}
            <tr style="border-top:2px solid var(--bdr);font-weight:700">
              <td colspan="2">Total Geral</td>
              <td style="font-family:'DM Mono',monospace;text-align:center">${total} ${item.un}</td>
            </tr>
          </tbody>
        </table></div></div>
      </div>`;
  } else {
    distHTML = `<div style="margin-top:16px;font-size:13px;color:var(--ink3)">📍 Nenhum local de armazenamento definido.</div>`;
  }

  /* Build modal content */
  const el = document.getElementById('item-detail-body');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div style="width:8px;height:48px;border-radius:4px;background:${nivelColor}"></div>
      <div style="flex:1">
        <div style="font-size:20px;font-weight:700">${item.nome}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
          <span class="chip">${item.cat || '—'}</span>
          <span style="font-size:12px;color:var(--ink3)">${tipo.icon} ${tipo.nome}</span>
        </div>
      </div>
      ${sb(total, item.min)}
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:12px">
        <div class="kl">Estoque Total</div>
        <div class="kv" style="font-size:20px">${total} ${item.un}</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:12px">
        <div class="kl">Mínimo</div>
        <div class="kv" style="font-size:20px">${item.min} ${item.un}</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:12px">
        <div class="kl">Custo Unit. (${item.un})</div>
        <div class="kv" style="font-size:20px">${brl(item.custo)}</div>
      </div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px">
      ${item.forn ? `<div style="font-size:12px"><strong>Fornecedor:</strong> ${item.forn}</div>` : ''}
      ${item.val ? `<div style="font-size:12px"><strong>Validade:</strong> ${item.val}</div>` : ''}
      ${item.fatorConversao&&item.fatorConversao>1
        ? `<div style="font-size:12px;grid-column:1/-1"><span style="display:inline-flex;align-items:center;gap:6px;background:rgba(var(--pr-rgb,100,60,200),0.08);border:1px solid rgba(var(--pr-rgb,100,60,200),0.2);border-radius:var(--r2);padding:4px 10px">
            📦 <strong>Conversão de embalagem:</strong> 1 ${item.unCompra} de compra = <strong>${item.fatorConversao} ${item.un}</strong> no estoque &nbsp;·&nbsp; Custo real: <strong>${brl(item.custo)}/${item.un}</strong>
           </span></div>`
        : ''}
    </div>

    ${distHTML}
  `;

  document.getElementById('item-detail-title').textContent = item.nome;
  openM('m-item-detail');
}

function rebuildEstoque() {
  const pg = document.getElementById('pg-estoque'); if (!pg) return;
  /* Save active tab */
  const activePanel = pg.querySelector('.tp.on');
  const activeTabId = activePanel ? activePanel.id : null;
  pg.innerHTML = estqHTML();
  /* Restore active tab */
  if (activeTabId) {
    pg.querySelectorAll('.tp').forEach(p => p.classList.remove('on'));
    pg.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    const panel = document.getElementById(activeTabId);
    if (panel) {
      panel.classList.add('on');
      pg.querySelectorAll('.tab').forEach(t => {
        if (t.getAttribute('onclick')?.includes(activeTabId)) t.classList.add('on');
      });
    }
  }
}

/* ── List filtering ── */

function filtItemList(val, listId) {
  const q = val.trim().toLowerCase();
  document.querySelectorAll(`#${listId} .estq-item`).forEach(el => {
    el.style.display = !q || el.dataset.nome.includes(q) ? '' : 'none';
  });
}

function filtCatList(val, listId) {
  document.querySelectorAll(`#${listId} .estq-item`).forEach(el => {
    el.style.display = !val || el.dataset.cat === val ? '' : 'none';
  });
}

function filtNivelList(val, listId) {
  document.querySelectorAll(`#${listId} .estq-item`).forEach(el => {
    el.style.display = !val || el.dataset.nivel === val ? '' : 'none';
  });
}

/* ── Single item adjust ── */
function openAj(itemId, grupoId) {
  const tipo = getTipo(grupoId);
  if (!tipo) return;
  const item = tipo.itens.find(x => x.id === itemId);
  if (!item) return;

  document.getElementById('aj-item-id').value = itemId;
  document.getElementById('aj-grupo-id').value = grupoId;
  document.getElementById('aj-sub').textContent = item.nome;

  const total = getEstqTotal(item);
  document.getElementById('aj-info').textContent = `Estoque total: ${total} ${item.un}`;
  document.getElementById('aj-tipo').value = 'entrada';
  document.getElementById('aj-qtd').value = '';
  document.getElementById('aj-motivo').value = '';
  document.getElementById('aj-err').style.display = 'none';

  /* Build location options */
  let locOptions = [];

  /* Primary location */
  if (item.local) {
    const loc = locais.find(l => l.nome === item.local);
    const setor = loc?.setor || 'Cozinha';
    const setorIcon = setor === 'Trailer' ? '🚌' : '🍳';
    locOptions.push({
      key: '__primary__',
      label: `📍 ${item.local}`,
      setor: `${setorIcon} ${setor}`,
      qtd: item.estq || 0
    });
  } else {
    /* No location — show generic "Estoque Geral" */
    locOptions.push({
      key: '__primary__',
      label: '📦 Estoque Geral',
      setor: '',
      qtd: item.estq || 0
    });
  }

  /* Distribuicao entries */
  if (item.distribuicao && item.distribuicao.length) {
    item.distribuicao.forEach((d, idx) => {
      if (d.qtd > 0 || d.local) {
        const loc = locais.find(l => l.nome === d.local);
        const setor = loc?.setor || 'Cozinha';
        const setorIcon = setor === 'Trailer' ? '🚌' : '🍳';
        locOptions.push({
          key: `dist_${idx}`,
          label: `📍 ${d.local}`,
          setor: `${setorIcon} ${setor}`,
          qtd: d.qtd || 0
        });
      }
    });
  }

  /* Render location radio buttons */
  const locDiv = document.getElementById('aj-locais');
  if (locOptions.length > 1) {
    locDiv.innerHTML = `
      <label class="fl">Local de Ajuste *</label>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto">
        ${locOptions.map((lo, i) => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;
            background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2);cursor:pointer;font-size:12px"
            onclick="this.querySelector('input').checked=true">
            <input type="radio" name="aj-local" value="${lo.key}" ${i === 0 ? 'checked' : ''} style="accent-color:var(--pr)">
            <span style="flex:1"><strong>${lo.label}</strong> ${lo.setor ? `<span style="color:var(--ink3);margin-left:4px">${lo.setor}</span>` : ''}</span>
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--ink3)">${lo.qtd} ${item.un}</span>
          </label>
        `).join('')}
      </div>`;
  } else {
    locDiv.innerHTML = `
      <div style="padding:6px 10px;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2);font-size:12px;display:flex;justify-content:space-between">
        <span><strong>${locOptions[0].label}</strong> ${locOptions[0].setor ? `<span style="color:var(--ink3);margin-left:4px">${locOptions[0].setor}</span>` : ''}</span>
        <span style="font-family:'DM Mono',monospace;color:var(--ink3)">${locOptions[0].qtd} ${item.un}</span>
      </div>
      <input type="hidden" name="aj-local" value="__primary__">`;
  }

  openM('m-ajuste');
}

async function salvarAjuste() {
  const errEl = document.getElementById('aj-err');
  errEl.style.display = 'none';

  const itemId = parseInt(document.getElementById('aj-item-id').value);
  const grupoId = document.getElementById('aj-grupo-id').value;
  const tipoAj = document.getElementById('aj-tipo').value;
  const qtd = parseFloat(document.getElementById('aj-qtd').value) || 0;

  if (qtd <= 0 && tipoAj !== 'inventario') {
    errEl.textContent = '⚠ Informe uma quantidade válida.';
    errEl.style.display = 'flex'; return;
  }

  const tipo = getTipo(grupoId);
  if (!tipo) return;
  const item = tipo.itens.find(x => x.id === itemId);
  if (!item) return;

  /* Get selected location */
  const localRadio = document.querySelector('input[name="aj-local"]:checked') ||
                     document.querySelector('input[name="aj-local"]');
  const localKey = localRadio ? localRadio.value : '__primary__';

  let locLabel = '';

  if (localKey === '__primary__') {
    /* Adjust primary stock */
    let novoEstq;
    switch (tipoAj) {
      case 'entrada': novoEstq = (item.estq || 0) + qtd; break;
      case 'saida': novoEstq = Math.max(0, (item.estq || 0) - qtd); break;
      case 'perda': novoEstq = Math.max(0, (item.estq || 0) - qtd); break;
      case 'inventario': novoEstq = qtd; break;
      default: novoEstq = item.estq || 0;
    }
    item.estq = novoEstq;
    locLabel = item.local || 'Estoque Geral';
  } else {
    /* Adjust distribuicao entry */
    const distIdx = parseInt(localKey.replace('dist_', ''));
    if (item.distribuicao && item.distribuicao[distIdx]) {
      const d = item.distribuicao[distIdx];
      let novoQtd;
      switch (tipoAj) {
        case 'entrada': novoQtd = (d.qtd || 0) + qtd; break;
        case 'saida': novoQtd = Math.max(0, (d.qtd || 0) - qtd); break;
        case 'perda': novoQtd = Math.max(0, (d.qtd || 0) - qtd); break;
        case 'inventario': novoQtd = qtd; break;
        default: novoQtd = d.qtd || 0;
      }
      d.qtd = novoQtd;
      locLabel = d.local;
    }
  }

  const totalNovo = getEstqTotal(item);

  try {
    const updateData = { estq: item.estq };
    if (item.distribuicao) updateData.distribuicao = item.distribuicao;
    if (item._docId) await db.collection('itens').doc(item._docId).update(updateData);

    /* Log activity */
    await logActivity('ajuste', `Ajuste ${tipoAj}: ${item.nome} em "${locLabel}" → Total: ${totalNovo} ${item.un}`);

    closeM('m-ajuste');
    rebuildEstoque();
    updateNotifs();
    toast(`✓ "${item.nome}" ajustado em "${locLabel}" · Total: ${totalNovo} ${item.un}`);
  } catch (e) {
    errEl.textContent = '⚠ Erro: ' + e.message;
    errEl.style.display = 'flex';
  }
}

/* ══════════════════════════════════════
   BULK OPERATIONS
══════════════════════════════════════ */

function toggleBulkMode() {
  bulkMode = !bulkMode;
  rebuildEstoque();
}

function toggleAllBulk(masterCb, tbodyId) {
  const cbs = document.querySelectorAll(`#${tbodyId} .bulk-cb`);
  cbs.forEach(cb => cb.checked = masterCb.checked);
}

function getSelectedItems() {
  const cbs = document.querySelectorAll('.bulk-cb:checked');
  const selected = [];
  cbs.forEach(cb => {
    const itemId = parseInt(cb.value);
    const grupoId = cb.dataset.grupo;
    const tipo = getTipo(grupoId);
    if (tipo) {
      const item = tipo.itens.find(x => x.id === itemId);
      if (item) selected.push({ item, tipo, grupoId });
    }
  });
  return selected;
}

/* ── Bulk Adjust (Inventário) ── */
function openBulkAjuste() {
  const selected = getSelectedItems();
  if (!selected.length) { toast('⚠ Selecione ao menos 1 item!'); return; }

  const list = document.getElementById('bulk-aj-list');
  list.innerHTML = selected.map(({ item, tipo }) => {
    const total = getEstqTotal(item);
    let locRows = '';

    /* Primary location */
    const primLabel = item.local ? `📍 ${item.local}` : '📦 Estoque Geral';
    const primLoc = item.local ? locais.find(l => l.nome === item.local) : null;
    const primSetor = primLoc?.setor || '';
    const primSetorIcon = primSetor === 'Trailer' ? '🚌 ' : primSetor === 'Cozinha' ? '🍳 ' : '';
    locRows += `
      <div style="display:grid;grid-template-columns:1fr 80px;gap:6px;align-items:center;padding:4px 8px;background:var(--bg);border-radius:var(--r2);font-size:11px">
        <div>${primLabel} <span style="color:var(--ink3)">${primSetorIcon}${primSetor}</span></div>
        <input class="fc bulk-aj-loc" data-id="${item.id}" data-grupo="${tipo.id}" data-loc="__primary__"
          type="number" min="0" step="0.5" value="${item.estq || 0}" style="font-size:11px;text-align:center;padding:4px">
      </div>`;

    /* Distribuicao entries */
    if (item.distribuicao && item.distribuicao.length) {
      item.distribuicao.forEach((d, idx) => {
        if (d.local) {
          const loc = locais.find(l => l.nome === d.local);
          const setor = loc?.setor || '';
          const setorIcon = setor === 'Trailer' ? '🚌 ' : setor === 'Cozinha' ? '🍳 ' : '';
          locRows += `
            <div style="display:grid;grid-template-columns:1fr 80px;gap:6px;align-items:center;padding:4px 8px;background:var(--bg);border-radius:var(--r2);font-size:11px">
              <div>📍 ${d.local} <span style="color:var(--ink3)">${setorIcon}${setor}</span></div>
              <input class="fc bulk-aj-loc" data-id="${item.id}" data-grupo="${tipo.id}" data-loc="dist_${idx}"
                type="number" min="0" step="0.5" value="${d.qtd || 0}" style="font-size:11px;text-align:center;padding:4px">
            </div>`;
        }
      });
    }

    return `
    <div style="padding:8px 0;border-bottom:1px solid var(--bdr)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <strong style="font-size:13px">${item.nome}</strong>
        <span style="font-size:11px;color:var(--ink3)">${tipo.icon} Total: ${total} ${item.un}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">${locRows}</div>
    </div>`;
  }).join('');

  document.getElementById('bulk-aj-count').textContent = `${selected.length} item(ns) selecionado(s)`;
  document.getElementById('bulk-aj-err').style.display = 'none';
  openM('m-bulk-ajuste');
}

async function salvarBulkAjuste() {
  const errEl = document.getElementById('bulk-aj-err');
  errEl.style.display = 'none';
  const inputs = document.querySelectorAll('.bulk-aj-loc');
  let count = 0;

  /* Group inputs by item */
  const itemUpdates = {};
  inputs.forEach(inp => {
    const key = `${inp.dataset.grupo}_${inp.dataset.id}`;
    if (!itemUpdates[key]) itemUpdates[key] = { id: parseInt(inp.dataset.id), grupo: inp.dataset.grupo, locs: [] };
    itemUpdates[key].locs.push({ loc: inp.dataset.loc, val: parseFloat(inp.value) || 0 });
  });

  try {
    for (const upd of Object.values(itemUpdates)) {
      const tipo = getTipo(upd.grupo);
      if (!tipo) continue;
      const item = tipo.itens.find(x => x.id === upd.id);
      if (!item) continue;

      let changed = false;

      for (const l of upd.locs) {
        if (l.loc === '__primary__') {
          if (item.estq !== l.val) { item.estq = l.val; changed = true; }
        } else {
          const distIdx = parseInt(l.loc.replace('dist_', ''));
          if (item.distribuicao && item.distribuicao[distIdx]) {
            if (item.distribuicao[distIdx].qtd !== l.val) { item.distribuicao[distIdx].qtd = l.val; changed = true; }
          }
        }
      }

      if (changed) {
        const updateData = { estq: item.estq };
        if (item.distribuicao) updateData.distribuicao = item.distribuicao;
        if (item._docId) await db.collection('itens').doc(item._docId).update(updateData);
        count++;
      }
    }

    await logActivity('inventario', `Inventário em massa: ${count} item(ns) ajustado(s) por local`);

    closeM('m-bulk-ajuste');
    rebuildEstoque();
    updateNotifs();
    toast(`✓ Inventário concluído — ${count} item(ns) ajustado(s)`);
  } catch (e) {
    errEl.textContent = '⚠ Erro: ' + e.message;
    errEl.style.display = 'flex';
  }
}

/* ── Bulk Delete ── */
function confirmarBulkDelete() {
  const selected = getSelectedItems();
  if (!selected.length) { toast('⚠ Selecione ao menos 1 item!'); return; }

  document.getElementById('bulk-del-count').textContent = `${selected.length} item(ns) será(ão) removido(s) permanentemente.`;
  document.getElementById('bulk-del-list').textContent = selected.map(s => s.item.nome).join(', ');
  openM('m-bulk-delete');
}

async function doBulkDelete() {
  const selected = getSelectedItems();
  if (!selected.length) return;

  try {
    for (const { item, tipo } of selected) {
      if (item._docId) await db.collection('itens').doc(item._docId).delete();
      const idx = tipo.itens.findIndex(x => x.id === item.id);
      if (idx >= 0) tipo.itens.splice(idx, 1);
    }

    await logActivity('exclusao', `Exclusão em massa: ${selected.length} item(ns)`);

    bulkMode = false;
    closeM('m-bulk-delete');
    rebuildEstoque();
    updateNotifs();
    toast(`🗑️ ${selected.length} item(ns) removido(s) do estoque`);
  } catch (e) {
    toast(`⚠ Erro: ${e.message}`);
  }
}
