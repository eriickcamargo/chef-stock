/* ══════════════════════════════════════════════════
   PAGE: Consumo Interno — Registro de Uso / Baixa Rápida
   Permite que usuários da Cozinha e Trailer registrem
   a saída de itens não produtivos (limpeza, descartáveis)
   diretamente, sem passar pela ficha de produção.
══════════════════════════════════════════════════ */

/* ── Estado do "carrinho" de consumo ── */
let consumoCarrinho = []; /* [{itemId, grupoId, nome, un, qtd, estqAtual}] */
let consumoBuscaTimeout = null;

/* ── Page builder ── */
function mkConsumo() {
  const pg = mkPg('consumo');
  pg.innerHTML = consumoHTML();
  return pg;
}

function consumoHTML() {
  return `
    <!-- Cabeçalho da página -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;color:var(--ink3);margin-bottom:4px">
        Registre a saída de itens utilizados no dia a dia — limpeza, descartáveis, materiais gerais — sem precisar abrir uma ficha de produção.
      </div>
    </div>

    <!-- Layout principal: busca + carrinho -->
    <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start" id="consumo-layout">

      <!-- ── Coluna esquerda: busca e lista de itens ── -->
      <div>
        <!-- Barra de busca -->
        <div class="panel" style="margin-bottom:16px;overflow:visible">
          <div class="ph">
            <div class="pht">🔍 Buscar Item para Consumir</div>
          </div>
          <div class="pb" style="padding:14px;overflow:visible">
            <div style="position:relative">
              <input class="fc" id="consumo-search" type="text" placeholder="Digite o nome do item (ex: Detergente, Guardanapo...)"
                autocomplete="off" oninput="consumoBusca(this.value)"
                style="font-size:14px;padding:12px 14px">
              <div id="consumo-dropdown"
                style="display:none;position:absolute;top:100%;left:0;right:0;max-height:260px;overflow-y:auto;
                       background:white;border:1px solid var(--bdr);border-radius:0 0 var(--r2) var(--r2);
                       box-shadow:0 6px 20px rgba(0,0,0,.12);z-index:100">
              </div>
            </div>
            <div id="consumo-busca-hint" style="font-size:11px;color:var(--ink3);margin-top:8px">
              💡 Digite ao menos 2 letras para buscar. Todos os tipos de estoque são pesquisados.
            </div>
          </div>
        </div>

        <!-- Cards de acesso rápido por categoria -->
        <div id="consumo-shortcuts">
          ${consumoShortcutsHTML()}
        </div>
      </div>

      <!-- ── Coluna direita: carrinho ── -->
      <div id="consumo-carrinho-col">
        ${consumoCarrinhoHTML()}
      </div>
    </div>

    <!-- Histórico de registros recentes -->
    <div id="consumo-historico-wrap" style="margin-top:24px">
      ${consumoHistoricoHTML()}
    </div>
  `;
}

/* ── Atalhos de categorias frequentes ── */
const CONSUMO_CATS_RAPIDAS = [
  { label: 'Limpeza',      icon: '🧹', palavras: ['limpeza', 'limpa', 'detergente', 'sabão', 'desengordurante', 'veja', 'ajax', 'álcool', 'sanitizante', 'rodo', 'vassoura', 'pano'] },
  { label: 'Descartáveis', icon: '🥤', palavras: ['descartavel', 'descartável', 'copo', 'canudo', 'saco', 'sacola', 'embalagem', 'pote', 'bandeja', 'guardanapo', 'toalha', 'papel'] },
  { label: 'Higiene',      icon: '🧼', palavras: ['higiene', 'sabonete', 'papel higienico', 'papel higiênico', 'toalha'] },
  { label: 'Escritório',   icon: '📄', palavras: ['papel', 'caneta', 'bobina', 'fita', 'etiqueta', 'formulario', 'formulário'] },
];

function consumoShortcutsHTML() {
  const allItems = getAllItems();
  if (!allItems.length) return '';

  let shortcutCards = '';
  CONSUMO_CATS_RAPIDAS.forEach(cat => {
    const matches = allItems.filter(item => {
      const n = (item.nome || '').toLowerCase();
      const c = (item.cat || '').toLowerCase();
      return cat.palavras.some(p => n.includes(p) || c.includes(p));
    }).slice(0, 6);
    if (!matches.length) return;    shortcutCards += `
      <div class="panel" style="margin-bottom:14px">
        <div class="ph" style="padding:10px 14px">
          <div class="pht" style="font-size:13px">${cat.icon} ${cat.label} <span style="font-size:10px;color:var(--ink3);font-weight:400">${matches.length} item(ns) encontrado(s)</span></div>
        </div>
        <div class="pb" style="padding:10px 14px">
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${matches.map(item => {
              const nivel = nvl(item.estq || 0, item.min || 0);
              const nc = nivel === 'e' ? 'var(--er)' : nivel === 'w' ? 'var(--wa)' : 'var(--ok)';
              return `
              <button class="btn btn-g consumo-shortcut-btn" onclick="consumoAddFromShortcut(${item.id})"
                style="display:flex;flex-direction:column;align-items:flex-start;padding:8px 12px;min-width:140px;text-align:left;position:relative;border:1px solid var(--bdr)">
                <div style="width:4px;height:100%;position:absolute;left:0;top:0;border-radius:var(--r2) 0 0 var(--r2);background:${nc}"></div>
                <span style="font-size:12px;font-weight:600;padding-left:4px">${item.nome}</span>
                <span style="font-size:10px;color:var(--ink3);margin-top:2px;padding-left:4px">
                  <span style="font-family:'DM Mono',monospace">${item.estq || 0} ${item.un}</span> em estoque
                </span>
              </button>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  });

  return shortcutCards || `<div class="empty"><div class="ei">📦</div><div>Nenhum atalho de categoria disponível. Use a busca acima.</div></div>`;
}

/* ── Carrinho HTML ── */
function consumoCarrinhoHTML() {
  return `
    <div class="panel" id="consumo-carrinho">
      <div class="ph" style="display:flex;align-items:center;justify-content:space-between">
        <div class="pht">🛒 Itens para Baixa <span style="font-size:11px;color:var(--ink3);font-weight:400">(${consumoCarrinho.length})</span></div>
        ${consumoCarrinho.length ? `<button class="btn btn-er btn-xs" onclick="consumoLimparCarrinho()">✕ Limpar</button>` : ''}
      </div>
      <div class="pb" style="padding:12px">
        ${consumoCarrinho.length === 0 ? `
          <div style="text-align:center;padding:30px 16px;color:var(--ink3)">
            <div style="font-size:28px;margin-bottom:8px">📋</div>
            <div style="font-size:13px">Nenhum item adicionado</div>
            <div style="font-size:11px;margin-top:4px">Busque ou clique nos atalhos ao lado</div>
          </div>` : `
          <div id="consumo-itens-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
            ${consumoCarrinho.map((it, i) => consumoItemCard(it, i)).join('')}
          </div>

          <!-- Campo de observação -->
          <div class="fg" style="margin-bottom:14px">
            <label class="fl" style="font-size:11px">📝 Observação (opcional)</label>
            <input class="fc" id="consumo-obs" type="text" placeholder="Ex: Limpeza pós-fechamento do turno..."
              style="font-size:12px">
          </div>

          <!-- Resumo -->
          <div style="padding:10px 12px;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2);font-size:12px;margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span>Total de itens:</span>
              <strong>${consumoCarrinho.length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span>Custo estimado:</span>
              <strong style="color:var(--er)">${brl(consumoCarrinho.reduce((s, it) => s + (it.custo || 0) * (it.qtd || 0), 0))}</strong>
            </div>
          </div>

          <button class="btn btn-r" style="width:100%;padding:12px" onclick="consumoConfirmar()">
            ✓ Registrar Consumo (${consumoCarrinho.length} item${consumoCarrinho.length > 1 ? 'ns' : ''})
          </button>`
        }
      </div>
    </div>`;
}

function consumoItemCard(it, idx) {
  const nivel = nvl(it.estqAtual || 0, it.min || 0);
  const nc = nivel === 'e' ? 'var(--er)' : nivel === 'w' ? 'var(--wa)' : 'var(--ok)';
  const disponivelApos = Math.max(0, (it.estqAtual || 0) - (it.qtd || 0));
  return `
  <div style="padding:10px 12px;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2);border-left:3px solid ${nc}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.nome}</div>
        <div style="font-size:10px;color:var(--ink3);margin-top:2px">
          Em estoque: <span style="font-family:'DM Mono',monospace">${it.estqAtual || 0} ${it.un}</span>
          ${it.qtd > 0 ? ` → <span style="font-family:'DM Mono',monospace;color:${disponivelApos <= 0 ? 'var(--er)' : 'var(--ok)'}">${disponivelApos} ${it.un}</span>` : ''}
        </div>
      </div>
      <button class="btn btn-er btn-xs" onclick="consumoRemoverItem(${idx})" title="Remover">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <label style="font-size:11px;color:var(--ink3);white-space:nowrap">Qtd. (${it.un}):</label>
      <input class="fc" type="number" min="0.001" step="0.5" max="${it.estqAtual || 0}" value="${it.qtd || ''}" placeholder="0"
        oninput="consumoUpdateQtd(${idx}, parseFloat(this.value)||0)"
        style="font-size:13px;text-align:center;padding:6px 8px;flex:1">
      <span style="font-size:10px;color:var(--ink3);white-space:nowrap">máx: ${it.estqAtual || 0}</span>
    </div>
  </div>`;
}

/* ── Busca dinâmica ── */
function consumoBusca(query) {
  clearTimeout(consumoBuscaTimeout);
  const dd = document.getElementById('consumo-dropdown');
  const hint = document.getElementById('consumo-busca-hint');
  const q = query.trim().toLowerCase();

  if (q.length < 2) {
    dd.style.display = 'none';
    if (hint) hint.textContent = '💡 Digite ao menos 2 letras para buscar. Todos os tipos de estoque são pesquisados.';
    return;
  }

  if (hint) hint.textContent = '🔍 Buscando...';

  consumoBuscaTimeout = setTimeout(() => {
    const allItems = getAllItems();
    const matches = allItems
      .filter(item => (item.nome || '').toLowerCase().includes(q) || (item.cat || '').toLowerCase().includes(q))
      .slice(0, 20);

    if (!matches.length) {
      dd.style.display = '';
      dd.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:var(--ink3)">Nenhum item encontrado para "${query}"</div>`;
      if (hint) hint.textContent = `Nenhum resultado para "${query}".`;
      return;
    }

    dd.style.display = '';
    dd.innerHTML = matches.map(item => {
      const nivel = nvl(item.estq || 0, item.min || 0);
      const nc = nivel === 'e' ? 'var(--er)' : nivel === 'w' ? 'var(--wa)' : 'var(--ok)';
      const jaNoCarrinho = consumoCarrinho.some(c => c.itemId === item.id);
      return `
      <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:10px;${jaNoCarrinho ? 'background:var(--ok-l)' : ''}"
        onmousedown="consumoAddFromDropdown(${item.id})"
        onmouseover="if(!${jaNoCarrinho})this.style.background='var(--bg)'" onmouseout="this.style.background='${jaNoCarrinho ? 'var(--ok-l)' : ''}'">
        <div style="width:6px;height:36px;border-radius:3px;background:${nc};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px">${item.nome} ${jaNoCarrinho ? '<span style="font-size:10px;color:var(--ok)">✓ no carrinho</span>' : ''}</div>
          <div style="font-size:11px;color:var(--ink3);display:flex;gap:8px;margin-top:2px">
            <span>${item.cat || '—'}</span>
            <span>📦 <span style="font-family:\'DM Mono\',monospace">${item.estq || 0} ${item.un}</span> disp.</span>
          </div>
        </div>
        ${!jaNoCarrinho ? `<span style="font-size:11px;color:var(--pr);font-weight:600">+ Add</span>` : ''}
      </div>`;
    }).join('');

    if (hint) hint.textContent = `${matches.length} resultado(s) encontrado(s). Clique para adicionar ao registro.`;
  }, 200);
}

/* Fechar dropdown ao clicar fora */
document.addEventListener('click', e => {
  const dd = document.getElementById('consumo-dropdown');
  const wrap = document.getElementById('consumo-search')?.parentElement;
  if (dd && wrap && !wrap.contains(e.target)) dd.style.display = 'none';
});

/* ── Adicionar ao carrinho ── */
function consumoAddFromDropdown(itemId) {
  const dd = document.getElementById('consumo-dropdown');
  const searchEl = document.getElementById('consumo-search');
  if (dd) dd.style.display = 'none';
  if (searchEl) searchEl.value = '';
  _consumoAddItem(itemId);
}

function consumoAddFromShortcut(itemId) {
  _consumoAddItem(itemId);
}

function _consumoAddItem(itemId) {
  const allItems = getAllItems();
  const item = allItems.find(x => x.id === itemId);
  if (!item) return;

  /* Verificar se já está no carrinho */
  const jaExiste = consumoCarrinho.findIndex(c => c.itemId === itemId);
  if (jaExiste >= 0) {
    toast(`"${item.nome}" já está no registro. Ajuste a quantidade abaixo.`);
    rebuildConsumoCarrinho();
    return;
  }

  /* Descobrir o grupo/tipo do item */
  const tipo = getTipoByItem(itemId);
  consumoCarrinho.push({
    itemId: item.id,
    grupoId: tipo?.id || '',
    nome: item.nome,
    un: item.un,
    qtd: 1,
    custo: item.custo || 0,
    min: item.min || 0,
    estqAtual: item.estq || 0,
    _docId: item._docId || null,
  });

  rebuildConsumoCarrinho();
  toast(`✓ "${item.nome}" adicionado ao registro`);
}

/* ── Atualizar quantidade no carrinho ── */
function consumoUpdateQtd(idx, val) {
  if (!consumoCarrinho[idx]) return;
  const it = consumoCarrinho[idx];
  const max = it.estqAtual || 0;

  /* Clamp ao estoque disponível */
  if (val > max) {
    val = max;
    /* Corrige o input visualmente */
    const inputs = document.querySelectorAll('#consumo-itens-list input[type="number"]');
    if (inputs[idx]) inputs[idx].value = max;
    toast(`⚠ Quantidade máxima para "${it.nome}" é ${max} ${it.un}`);
  }

  consumoCarrinho[idx].qtd = val;
  /* Re-renderiza o painel do carrinho para atualizar custo e saldo */
  rebuildConsumoCarrinho();
}

/* ── Remover item do carrinho ── */
function consumoRemoverItem(idx) {
  consumoCarrinho.splice(idx, 1);
  rebuildConsumoCarrinho();
}

/* ── Limpar carrinho ── */
function consumoLimparCarrinho() {
  if (consumoCarrinho.length && !confirm('Limpar todos os itens do registro?')) return;
  consumoCarrinho = [];
  rebuildConsumoCarrinho();
}

/* ── Rebuild do carrinho (coluna direita) ── */
function rebuildConsumoCarrinho() {
  const col = document.getElementById('consumo-carrinho-col');
  if (col) col.innerHTML = consumoCarrinhoHTML();
}

/* ── Rebuild completo da página ── */
async function rebuildConsumo() {
  const pg = document.getElementById('pg-consumo');
  if (!pg) return;
  /* Recarrega histórico do Firestore antes de renderizar */
  await loadConsumos();
  pg.innerHTML = consumoHTML();
}

/* ── Confirmar e salvar consumo ── */
async function consumoConfirmar() {
  if (!consumoCarrinho.length) {
    toast('⚠ Adicione ao menos 1 item antes de registrar.');
    return;
  }

  const itensValidos = consumoCarrinho.filter(it => it.qtd > 0);
  if (itensValidos.length === 0) {
    toast('⚠ Informe a quantidade para ao menos 1 item.');
    return;
  }

  /* Verificar itens com qtd zerada */
  const semQtd = consumoCarrinho.filter(it => !it.qtd || it.qtd <= 0);
  if (semQtd.length > 0) {
    toast(`⚠ ${semQtd.length} item(ns) sem quantidade definida. Preencha ou remova-os.`);
    return;
  }

  /* Montar dados para o modal de confirmação */
  const obs = document.getElementById('consumo-obs')?.value || '';
  _consumoPendente = { itens: [...consumoCarrinho], obs };
  renderModalConfirmarConsumo();
  openM('m-consumo');
}

/* ── Modal de confirmação ── */
let _consumoPendente = null;

function renderModalConfirmarConsumo() {
  if (!_consumoPendente) return;
  const { itens } = _consumoPendente;

  const tbody = document.getElementById('mc-itens');
  if (!tbody) return;

  let temInsuficiente = false;
  tbody.innerHTML = itens.map(it => {
    const saldo = (it.estqAtual || 0) - (it.qtd || 0);
    const suf = saldo >= 0;
    if (!suf) temInsuficiente = true;
    return `<tr>
      <td><strong>${it.nome}</strong></td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${it.qtd} ${it.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${it.estqAtual || 0} ${it.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;color:${suf ? 'var(--ok)' : 'var(--er)'}">${saldo} ${it.un}</td>
      <td><span class="bdg ${suf ? 'bok' : 'ber'}">${suf ? '✓ OK' : '⚠ Insuf.'}</span></td>
    </tr>`;
  }).join('');

  const aviso = document.getElementById('mc-aviso-insuf');
  if (aviso) aviso.style.display = temInsuficiente ? '' : 'none';

  const obsEl = document.getElementById('mc-obs-display');
  if (obsEl) {
    if (_consumoPendente.obs) {
      obsEl.style.display = '';
      obsEl.innerHTML = `<strong>📝 Obs.:</strong> ${_consumoPendente.obs}`;
    } else {
      obsEl.style.display = 'none';
    }
  }

  document.getElementById('mc-sub').textContent = `${itens.length} item(ns) · ${brl(itens.reduce((s, it) => s + (it.custo || 0) * (it.qtd || 0), 0))} custo est.`;
  document.getElementById('mc-err').style.display = 'none';
}

async function consumoSalvar() {
  if (!_consumoPendente) return;
  const errEl = document.getElementById('mc-err');
  errEl.style.display = 'none';

  const { itens, obs } = _consumoPendente;
  const now = new Date();
  const hora = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dataFmt = `${dd}/${mm}/${yyyy} ${hora}`;

  try {
    const registroItens = [];
    for (const it of itens) {
      /* Dar baixa no estoque local */
      const allItems = getAllItems();
      const item = allItems.find(x => x.id === it.itemId);
      if (!item) continue;

      const novoEstq = Math.max(0, (item.estq || 0) - (it.qtd || 0));
      item.estq = novoEstq;
      if (item._docId) await db.collection('itens').doc(item._docId).update({ estq: novoEstq });

      registroItens.push({
        itemId: String(it.itemId),
        nome: it.nome,
        un: it.un,
        qtd: it.qtd,
        custoUnitario: it.custo || 0,
        custoTotal: round2((it.custo || 0) * (it.qtd || 0)),
      });
    }

    /* Salvar registro de consumo no Firestore */
    const custoTotalRegistro = round2(registroItens.reduce((s, ri) => s + (ri.custoTotal || 0), 0));
    const registro = {
      tipo: 'consumo_interno',
      data: dataFmt,
      ts: firebase.firestore.FieldValue.serverTimestamp(),
      usuario: SESSION.name,
      role: SESSION.role,
      obs: obs || '',
      itens: registroItens,
      custoTotal: custoTotalRegistro,
      local: _consumoGetLocalActual(),
    };
    await db.collection('consumos').add(registro);

    /* Log de atividade */
    await logActivity('consumo', `Consumo Interno: ${registroItens.length} item(ns) · ${brl(custoTotalRegistro)} · ${obs || 'Sem obs.'}`);

    /* Limpar estado */
    consumoCarrinho = [];
    _consumoPendente = null;
    closeM('m-consumo');
    rebuildConsumo();
    rebuildEstoque();
    updateNotifs();
    toast(`✅ Registro de consumo salvo — ${registroItens.length} item(ns) baixado(s) do estoque`);
  } catch (e) {
    errEl.textContent = '⚠ Erro ao salvar: ' + e.message;
    errEl.style.display = 'flex';
  }
}

function _consumoGetLocalActual() {
  /* Retorna o local padrão baseado no role do usuário */
  if (SESSION.role === 'trl') return 'Trailer';
  if (SESSION.role === 'coz') return 'Cozinha';
  return 'Geral';
}

function consumoCancelarModal() {
  _consumoPendente = null;
  closeM('m-consumo');
}

/* ── Histórico de consumos recentes ── */
let _consumos = []; /* Cache local */

async function loadConsumos() {
  try {
    const snap = await db.collection('consumos').orderBy('ts', 'desc').limit(30).get();
    _consumos = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
  } catch (e) {
    _consumos = [];
  }
}

function consumoHistoricoHTML() {
  /* Filtra por role para usuários não-admins */
  let lista = _consumos;
  if (SESSION.role === 'coz') lista = _consumos.filter(c => c.role === 'coz' || c.local === 'Cozinha');
  if (SESSION.role === 'trl') lista = _consumos.filter(c => c.role === 'trl' || c.local === 'Trailer');

  if (!lista.length) return `
    <div class="panel">
      <div class="ph"><div class="pht">📋 Histórico Recente</div></div>
      <div class="pb"><div class="empty" style="padding:24px 0"><div class="ei">📋</div><div>Nenhum registro de consumo ainda</div></div></div>
    </div>`;

  return `
    <div class="panel">
      <div class="ph">
        <div class="pht">📋 Histórico de Consumos Recentes</div>
        <span style="font-size:11px;color:var(--ink3)">${lista.length} registro(s)</span>
      </div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Usuário</th>
              <th>Local</th>
              <th>Itens</th>
              <th>Custo Total</th>
              <th>Obs.</th>
              ${SESSION.role === 'adm' ? '<th>Detalhes</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${lista.map(c => `<tr>
              <td style="font-family:'DM Mono',monospace;font-size:11px;white-space:nowrap">${c.data || '—'}</td>
              <td style="font-size:12px">${c.usuario || '—'}</td>
              <td><span class="chip" style="font-size:10px">${c.local || '—'}</span></td>
              <td style="font-family:'DM Mono',monospace;font-size:12px">${(c.itens || []).length} item(ns)</td>
              <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--er)">${brl(c.custoTotal || 0)}</td>
              <td style="font-size:11px;color:var(--ink3)" title="${c.obs || ''}">${c.obs ? c.obs.slice(0, 30) + (c.obs.length > 30 ? '…' : '') : '—'}</td>
              ${SESSION.role === 'adm' ? `<td><button class="btn btn-g btn-xs" onclick="consumoVerDetalhe('${c._docId}')">📋</button></td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ── Detalhe de um registro (admin) ── */
function consumoVerDetalhe(docId) {
  const c = _consumos.find(x => x._docId === docId);
  if (!c) return;
  const tbody = document.getElementById('mc-det-itens');
  if (tbody) {
    tbody.innerHTML = (c.itens || []).map(it => `<tr>
      <td><strong>${it.nome}</strong></td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${it.qtd} ${it.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${brl(it.custoUnitario || 0)}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;font-weight:700;color:var(--er)">${brl(it.custoTotal || 0)}</td>
    </tr>`).join('');
  }
  const header = document.getElementById('mc-det-header');
  if (header) header.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <span><strong>Data:</strong> ${c.data}</span>
      <span><strong>Usuário:</strong> ${c.usuario}</span>
      <span><strong>Local:</strong> ${c.local}</span>
      <span><strong>Custo Total:</strong> <strong style="color:var(--er)">${brl(c.custoTotal || 0)}</strong></span>
    </div>
    ${c.obs ? `<div class="al al-in" style="font-size:12px;margin-bottom:10px">📝 <strong>Obs.:</strong> ${c.obs}</div>` : ''}`;
  openM('m-consumo-det');
}
