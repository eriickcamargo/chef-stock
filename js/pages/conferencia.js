/* ══════════════════════════════════════════════════
   PAGE: Conferência de Estoque
   - Escopo automático por perfil
   - Admin: vê valor do sistema + aprova conferências alheias
   - Não-admin: conferência "às cegas" → pendente_aprovacao
   - Rascunho salvo no Firestore (auto-save debounced)
══════════════════════════════════════════════════ */

let confSessao        = null;
let confHistorico     = [];
let confAutoSaveTimer = null;
let confPendente      = null;

/* ═══ Helpers de escopo ═══ */

function confIsAdm() { return SESSION.role === 'adm'; }

function confGetSetor(override) {
  if (override) return override;
  if (SESSION.role === 'trl') return 'Trailer';
  if (SESSION.role === 'adm') return 'todos';
  return 'Cozinha';
}

function confGetLocaisNomes(setor) {
  const s = setor || confGetSetor();
  if (s === 'todos') return locais.map(l => l.nome);
  return locais.filter(l => l.setor === s).map(l => l.nome);
}

function confBuildItens(locaisNomes) {
  const result = [];
  getAllItems().forEach(item => {
    const tipo = getTipoByItem(item.id);
    const itemLocais = [];
    if (item.local && locaisNomes.includes(item.local)) {
      itemLocais.push({
        localNome: item.local,
        setor: locais.find(l => l.nome === item.local)?.setor || '',
        estoqSys: item.estq || 0,
        contado: null, isPrimary: true, distIdx: -1
      });
    }
    (item.distribuicao || []).forEach((d, idx) => {
      if (d.local && locaisNomes.includes(d.local)) {
        itemLocais.push({
          localNome: d.local,
          setor: locais.find(l => l.nome === d.local)?.setor || '',
          estoqSys: d.qtd || 0,
          contado: null, isPrimary: false, distIdx: idx
        });
      }
    });
    if (itemLocais.length > 0) {
      result.push({
        itemId: item.id,
        grupoId: tipo?.id || '',
        tipoNome: tipo?.nome || 'Geral',
        tipoIcon: tipo?.icon || '📦',
        nome: item.nome, un: item.un, cat: item.cat || '',
        locais: itemLocais
      });
    }
  });
  return result;
}

function confProgress() {
  if (!confSessao) return { total: 0, contadas: 0 };
  let total = 0, contadas = 0;
  confSessao.itens.forEach(it => it.locais.forEach(loc => {
    total++;
    if (loc.contado !== null && loc.contado !== undefined) contadas++;
  }));
  return { total, contadas };
}

/* ═══ Page ═══ */

function mkConferencia() {
  const pg = mkPg('conferencia');
  pg.innerHTML = '<div class="empty"><div class="ei">🗂️</div>Carregando...</div>';
  _confInit().then(() => rebuildConferencia());
  return pg;
}

function rebuildConferencia() {
  const pg = document.getElementById('pg-conferencia');
  if (pg) pg.innerHTML = _confPageHTML();
}

async function _confInit() {
  /* Verificar rascunho em andamento */
  try {
    const snap = await db.collection('conferencias')
      .where('status', '==', 'em_andamento')
      .where('usuario', '==', SESSION.name)
      .limit(1).get();
    if (!confSessao)
      confPendente = snap.empty ? null : { _docId: snap.docs[0].id, ...snap.docs[0].data() };
  } catch(e) { confPendente = null; }

  await _carregarHistorico();
}

/* Busca histórico sem composite index: ordena por ts desc, filtra status localmente */
async function _carregarHistorico() {
  try {
    const snap = await db.collection('conferencias')
      .orderBy('ts', 'desc').limit(30).get();
    const todos = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    /* Admin vê tudo exceto rascunhos; não-admin vê só as próprias */
    confHistorico = todos.filter(c => {
      if (c.status === 'em_andamento') return false;
      if (confIsAdm()) return true;             /* admin vê todas */
      return c.usuario === SESSION.name;         /* outros veem só as suas */
    });
  } catch(e) { confHistorico = []; }
}

/* ═══ Router ═══ */

function _confPageHTML() {
  if (confSessao?.etapa === 2) return _confEtapa2HTML();
  if (confSessao?.etapa === 3) return _confEtapa3HTML();
  return _confEtapa1HTML();
}

/* ═══ Etapa 1 — Escopo ═══ */

function _confEtapa1HTML() {
  const isAdm  = confIsAdm();
  const setor  = confGetSetor();
  const nItems = confBuildItens(confGetLocaisNomes()).length;
  const nLocs  = confGetLocaisNomes().length;
  const setorLabels = { todos:'🏢 Todos os locais', Cozinha:'🍳 Cozinha', Trailer:'🚌 Trailer' };

  /* Card de rascunho pendente */
  let pendCard = '';
  if (confPendente) {
    let pT = 0, pC = 0;
    (confPendente.itens || []).forEach(it => (it.locais || []).forEach(loc => {
      pT++;
      if (loc.contado !== null && loc.contado !== undefined) pC++;
    }));
    const tsStr = confPendente.ts?.toDate
      ? confPendente.ts.toDate().toLocaleString('pt-BR') : '—';
    pendCard = `
    <div class="panel" style="border:2px solid var(--wa-b);margin-bottom:18px">
      <div class="ph" style="background:var(--wa-l);border-bottom-color:var(--wa-b)">
        <div class="pht" style="color:var(--wa)">⏳ Rascunho em andamento — ${confPendente.id || '…'}</div>
        <span class="bdg bwa">${pC}/${pT} contados</span>
      </div>
      <div class="pb">
        <div style="font-size:12px;color:var(--ink3);margin-bottom:12px">
          Iniciada em ${tsStr} · Escopo: <strong>${confPendente.escopo || '—'}</strong>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-g btn-sm" onclick="descartarConferenciaPendente()">🗑️ Descartar</button>
          <button class="btn btn-r" onclick="retomarConferencia()">↩️ Retomar</button>
        </div>
      </div>
    </div>`;
  }

  const setorSel = isAdm ? `
    <div class="fg" style="margin-bottom:12px;max-width:280px">
      <label class="fl">Escopo da Conferência</label>
      <select class="fc" id="conf-setor-sel" onchange="confAtualizarPreview()">
        <option value="todos">🏢 Todos os locais</option>
        <option value="Cozinha">🍳 Apenas Cozinha</option>
        <option value="Trailer">🚌 Apenas Trailer</option>
      </select>
    </div>` : `
    <div class="al al-in" style="margin-bottom:12px">
      ℹ️ Escopo automático: <strong>${setorLabels[setor] || setor}</strong>
    </div>`;

  /* Aviso de conferência às cegas para não-admin */
  const blindNote = !isAdm ? `
    <div class="al al-wa" style="margin-bottom:12px;font-size:12px">
      🔒 Os valores do sistema <strong>não serão exibidos</strong> durante sua contagem.
      Ao finalizar, sua conferência será enviada para revisão e aprovação do administrador.
    </div>` : '';

  /* Pendentes de aprovação para admin */
  let pendAprovHTML = '';
  if (isAdm) {
    const pendAprov = confHistorico.filter(c => c.status === 'pendente_aprovacao');
    if (pendAprov.length) {
      pendAprovHTML = `
      <div class="al al-wa" style="margin-bottom:18px">
        ⚠️ <strong>${pendAprov.length} conferência(s)</strong> aguardando sua aprovação — veja o Histórico abaixo.
      </div>`;
    }
  }

  return `
  <div style="max-width:640px;margin:0 auto">
    <div class="sec"><div class="st">🗂️ Conferência de Estoque</div><div class="sl"></div></div>
    <div style="font-size:13px;color:var(--ink3);margin-bottom:20px">
      ${isAdm
        ? 'Realize ou aprove conferências de estoque. O progresso é salvo automaticamente.'
        : 'Realize a contagem física. Ao finalizar, o administrador irá revisar e aprovar os ajustes.'}
    </div>

    ${pendAprovHTML}
    ${pendCard}

    <div class="panel" style="margin-bottom:24px">
      <div class="ph"><div class="pht">📋 Nova Conferência</div></div>
      <div class="pb">
        ${setorSel}
        ${blindNote}
        <div id="conf-preview" style="font-size:12px;color:var(--ink3);margin-bottom:16px">
          ${nItems} item(s) · ${nLocs} local(is)
        </div>
        <button class="btn btn-r" style="width:100%;padding:13px" onclick="iniciarConferencia()">
          🗂️ Iniciar Nova Conferência
        </button>
      </div>
    </div>

    <div class="sec"><div class="st">📋 Histórico</div><div class="sl"></div></div>
    ${_confHistoricoHTML()}
  </div>`;
}

function confAtualizarPreview() {
  const sel   = document.getElementById('conf-setor-sel');
  const setor = sel ? sel.value : confGetSetor();
  const n     = confBuildItens(confGetLocaisNomes(setor)).length;
  const nl    = confGetLocaisNomes(setor).length;
  const el    = document.getElementById('conf-preview');
  if (el) el.textContent = `${n} item(s) · ${nl} local(is)`;
}

/* ═══ Etapa 2 — Contagem ═══ */

function _confEtapa2HTML() {
  if (!confSessao) return _confEtapa1HTML();
  const isAdm = confIsAdm();
  const prog  = confProgress();
  const pct   = prog.total ? Math.round(prog.contadas / prog.total * 100) : 0;

  /* Agrupar por tipoNome */
  const byTipo = {};
  confSessao.itens.forEach(it => {
    if (!byTipo[it.tipoNome]) byTipo[it.tipoNome] = { icon: it.tipoIcon, itens: [] };
    byTipo[it.tipoNome].itens.push(it);
  });

  const lista = Object.entries(byTipo).map(([tipo, gr]) => {
    const rows = gr.itens.map(it => {
      const locRows = it.locais.map((loc, li) => {
        const v  = loc.contado;
        /* Admin vê cor de feedback; não-admin sempre borda padrão */
        const bc = !isAdm ? 'var(--bdr)'
          : (v === null ? 'var(--bdr)' : (Number(v) === Number(loc.estoqSys) ? 'var(--ok)' : '#c89a00'));
        const ic = !isAdm ? (v !== null ? '✅' : '⏳')
          : (v === null ? '⏳' : (Number(v) === Number(loc.estoqSys) ? '✅' : '⚠️'));

        /* Admin vê valor do sistema; não-admin não vê */
        const sysInfo = isAdm
          ? `<div style="font-size:11px;color:var(--ink3)">Sistema: <strong>${loc.estoqSys} ${it.un}</strong></div>`
          : '';

        return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--bdr)">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;color:var(--ink3)">📍 ${loc.localNome}</div>
            ${sysInfo}
          </div>
          <input type="number" min="0" step="0.5" class="fc conf-input"
            data-item-id="${it.itemId}" data-loc-idx="${li}"
            value="${v !== null && v !== undefined ? v : ''}"
            placeholder="Qtd."
            style="width:80px;text-align:center;border-color:${bc};font-family:'DM Mono',monospace;font-size:14px;padding:9px 6px"
            oninput="confInputChange(this,${it.itemId},${li})"
            onkeydown="confTabNext(event,this)">
          <span style="font-size:11px;color:var(--ink3);min-width:24px">${it.un}</span>
          <span id="conf-ic-${it.itemId}-${li}" style="font-size:16px">${ic}</span>
        </div>`;
      }).join('');

      const nC = it.locais.filter(l => l.contado !== null && l.contado !== undefined).length;
      return `
      <div class="conf-item-row" data-nome="${it.nome.toLowerCase()}" data-cat="${it.cat.toLowerCase()}"
        style="padding:12px 14px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div>
            <div style="font-weight:600;font-size:14px">${it.nome}</div>
            <div style="font-size:11px;color:var(--ink3)">${it.cat}</div>
          </div>
          <span class="chip" style="font-size:10px" id="conf-chip-${it.itemId}">${nC}/${it.locais.length} local(is)</span>
        </div>
        ${locRows}
      </div>`;
    }).join('');

    return `
    <div style="margin-bottom:16px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1.5px;
          text-transform:uppercase;color:var(--ink3);margin-bottom:10px;padding:6px 0;border-bottom:1px solid var(--bdr)">
        ${gr.icon} ${tipo} (${gr.itens.length})
      </div>
      ${rows}
    </div>`;
  }).join('');

  return `
  <div>
    <div style="position:sticky;top:54px;z-index:90;background:var(--surf);
        border-bottom:1px solid var(--bdr);padding:12px 0;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-g btn-sm" onclick="cancelarConferencia()">× Cancelar</button>
          <div>
            <div style="font-size:13px;font-weight:600">🗂️ ${confSessao.id}</div>
            <div style="font-size:11px;color:var(--ink3)">${confSessao.escopo}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:right">
            <div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:var(--ok)"
              id="conf-prog-n">${prog.contadas}/${prog.total}</div>
            <div style="font-size:10px;color:var(--ink3)">${pct}% contado</div>
          </div>
          <button class="btn btn-r" onclick="avancarParaRevisao()">Revisar →</button>
        </div>
      </div>
      <div style="height:4px;background:var(--bdr);border-radius:2px;margin-top:10px;overflow:hidden">
        <div id="conf-prog-bar" style="height:100%;width:${pct}%;background:var(--ok);border-radius:2px;transition:width .3s"></div>
      </div>
    </div>

    ${!isAdm ? `
    <div class="al al-in" style="margin-bottom:14px;font-size:12px">
      🔒 Conferência às cegas — os valores do sistema não são exibidos. Preencha o que você encontrou fisicamente.
    </div>` : ''}

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <input class="fc" id="conf-search" placeholder="🔍 Filtrar item..."
        oninput="confFiltrar(this.value)" style="max-width:280px">
      <div id="conf-save-ind" style="font-size:11px;color:var(--ink3);display:none">⏳ Salvando…</div>
    </div>

    ${lista}

    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--bdr);display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-g" onclick="cancelarConferencia()">× Cancelar</button>
      <button class="btn btn-r" onclick="avancarParaRevisao()">
        ${isAdm ? 'Verificar Divergências →' : 'Finalizar Contagem →'}
      </button>
    </div>
  </div>`;
}

/* ═══ Etapa 3 — Revisão ═══ */

function _confEtapa3HTML() {
  if (!confSessao) return _confEtapa1HTML();
  const isAdm = confIsAdm();

  let totalContados = 0, naoContados = 0;
  confSessao.itens.forEach(it => it.locais.forEach(loc => {
    if (loc.contado === null || loc.contado === undefined) naoContados++;
    else totalContados++;
  }));

  /* Não-admin: tela simples de envio para aprovação */
  if (!isAdm) {
    return `
    <div style="max-width:560px;margin:0 auto">
      <div class="sec"><div class="st">📬 Enviar para Revisão</div><div class="sl"></div></div>
      <div class="panel" style="margin-bottom:16px">
        <div class="ph" style="background:var(--in-l);border-bottom-color:var(--in-b)">
          <div class="pht" style="color:var(--in)">🗂️ ${confSessao.id} — ${confSessao.escopo}</div>
        </div>
        <div class="pb">
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
            <span class="bdg bok">✅ ${totalContados} entradas contadas</span>
            ${naoContados ? `<span class="bdg bgr">⏭️ ${naoContados} não contadas</span>` : ''}
          </div>
          <div class="al al-in" style="font-size:12px;margin-bottom:16px">
            ℹ️ Sua contagem será enviada ao administrador para revisão. 
            Os ajustes no estoque só serão aplicados após a aprovação.
          </div>
          ${naoContados ? `
          <div class="al al-wa" style="font-size:12px;margin-bottom:16px">
            ⚠️ ${naoContados} entrada(s) não foram contadas e serão marcadas como <strong>não conferidas</strong>.
          </div>` : ''}
        </div>
      </div>
      <div id="conf-rev-err" class="al al-er" style="display:none;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-g" onclick="voltarParaContagem()">← Voltar e corrigir</button>
        <button class="btn btn-r" id="btn-conf-confirmar" onclick="confirmarConferencia()">
          📬 Enviar para Aprovação
        </button>
      </div>
    </div>`;
  }

  /* Admin: tabela de divergências completa */
  const divs = []; let semDiv = 0;
  confSessao.itens.forEach(it => {
    it.locais.forEach((loc, li) => {
      if (loc.contado === null || loc.contado === undefined) return;
      if (Number(loc.contado) !== Number(loc.estoqSys)) {
        divs.push({ it, loc, li, dif: Number(loc.contado) - Number(loc.estoqSys) });
      } else { semDiv++; }
    });
  });

  const divRows = divs.map(({ it, loc, li, dif }) => {
    const cor    = dif > 0 ? 'var(--ok)' : 'var(--er)';
    const difStr = (dif > 0 ? '+' : '') + dif.toFixed(2);
    return `
    <tr>
      <td>
        <div style="font-weight:500">${it.nome}</div>
        <div style="font-size:11px;color:var(--ink3)">📍 ${loc.localNome}</div>
      </td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${loc.estoqSys} ${it.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;font-weight:600">${Number(loc.contado).toFixed(2)} ${it.un}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center;color:${cor};font-weight:700">${difStr}</td>
      <td style="text-align:center">
        <input type="checkbox" class="conf-div-cb"
          data-item-id="${it.itemId}" data-loc-idx="${li}"
          checked style="width:16px;height:16px;accent-color:var(--rc)">
      </td>
    </tr>`;
  }).join('');

  const divTable = divs.length ? `
  <div class="panel" style="margin-bottom:16px">
    <div class="ph">
      <div class="pht">⚠️ ${divs.length} divergência(s) encontrada(s)</div>
      <label style="font-size:11px;cursor:pointer">
        <input type="checkbox" checked onchange="confToggleTodos(this)"> Marcar tudo
      </label>
    </div>
    <div class="tw">
      <table>
        <thead><tr>
          <th>Item / Local</th><th style="text-align:center">Sistema</th>
          <th style="text-align:center">Contado</th><th style="text-align:center">Diferença</th>
          <th style="text-align:center">Ajustar?</th>
        </tr></thead>
        <tbody>${divRows}</tbody>
      </table>
    </div>
  </div>` : `
  <div class="al al-ok" style="margin-bottom:16px">
    ✅ Nenhuma divergência! Todos os itens contados estão de acordo com o sistema.
  </div>`;

  return `
  <div style="max-width:720px;margin:0 auto">
    <div class="sec"><div class="st">⚖️ Revisão — ${confSessao.id}</div><div class="sl"></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <span class="bdg bok">✅ ${semDiv} sem divergência</span>
      ${divs.length ? `<span class="bdg bwa">⚠️ ${divs.length} divergência(s)</span>` : ''}
      ${naoContados ? `<span class="bdg bgr">⏭️ ${naoContados} não contado(s)</span>` : ''}
    </div>
    ${divTable}
    ${naoContados ? `
    <div class="al al-in" style="margin-bottom:16px">
      ℹ️ ${naoContados} entrada(s) não contada(s) serão ignoradas.
    </div>` : ''}
    <div id="conf-rev-err" class="al al-er" style="display:none;margin-bottom:12px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-g" onclick="voltarParaContagem()">← Voltar e Contar mais</button>
      <button class="btn btn-r" id="btn-conf-confirmar" onclick="confirmarConferencia()">
        ✓ ${divs.length ? 'Aplicar Ajustes Selecionados' : 'Concluir Conferência'}
      </button>
    </div>
  </div>`;
}

function confToggleTodos(master) {
  document.querySelectorAll('.conf-div-cb').forEach(cb => cb.checked = master.checked);
}

/* ═══ Histórico HTML ═══ */

function _confHistoricoHTML() {
  if (!confHistorico.length)
    return `<div class="empty" style="padding:28px"><div class="ei">📋</div>Nenhuma conferência realizada ainda</div>`;

  return confHistorico.map(c => {
    const ts = c.ts?.toDate
      ? c.ts.toDate().toLocaleString('pt-BR')
      : (typeof c.ts === 'string' ? c.ts : '—');

    const statusBadge = {
      finalizada:        `<span class="bdg bok">✅ Finalizada</span>`,
      pendente_aprovacao:`<span class="bdg bwa">⏳ Aguardando aprovação</span>`,
      recusada:          `<span class="bdg ber">✕ Recusada</span>`,
    }[c.status] || `<span class="bdg bgr">${c.status}</span>`;

    const approvalBtns = confIsAdm() && c.status === 'pendente_aprovacao' ? `
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-er btn-sm" onclick="recusarConferencia('${c._docId}')">✕ Recusar</button>
        <button class="btn btn-r btn-sm" onclick="abrirAprovacaoConferencia('${c._docId}')">✓ Revisar e Aprovar</button>
      </div>` : '';

    return `
    <div class="panel" style="margin-bottom:10px">
      <div class="ph">
        <div class="pht"><span class="chip">${c.id || '—'}</span> ${c.escopo || ''}</div>
        <div style="display:flex;align-items:center;gap:8px">${statusBadge}<span style="font-size:11px;color:var(--ink3)">${ts}</span></div>
      </div>
      <div class="pb" style="padding:10px 16px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:${approvalBtns ? '4px' : '0'}">
          <span style="font-size:12px;color:var(--ink3)">👤 ${c.usuario || '—'}</span>
          <span class="bdg bok">✅ ${c.totalConferidos || 0} verificados</span>
          ${c.totalDivergencias ? `<span class="bdg bwa">⚠️ ${c.totalDivergencias} divergência(s)</span>` : ''}
          ${c.totalAjustados ? `<span class="bdg bin">✏️ ${c.totalAjustados} ajustado(s)</span>` : ''}
        </div>
        ${approvalBtns}
      </div>
    </div>`;
  }).join('');
}

/* ═══ Ações ═══ */

async function iniciarConferencia() {
  const sel   = document.getElementById('conf-setor-sel');
  const setor = sel ? sel.value : confGetSetor();
  const locaisNomes = confGetLocaisNomes(setor);
  const itens = confBuildItens(locaisNomes);
  if (!itens.length) { toast('⚠ Nenhum item no escopo selecionado.'); return; }

  const setorLabels = { todos:'Todos os locais', Cozinha:'Apenas Cozinha', Trailer:'Apenas Trailer' };

  let confNum = 1;
  try {
    const snap = await db.collection('conferencias').orderBy('ts','desc').limit(1).get();
    if (!snap.empty) confNum = parseInt((snap.docs[0].data().id || 'CONF-000').replace(/\D/g,'')) + 1;
  } catch(e) {}

  const id = 'CONF-' + String(confNum).padStart(3,'0');
  const docData = {
    id, usuario: SESSION.name, role: SESSION.role,
    escopo: setorLabels[setor] || setor, setor,
    ts: firebase.firestore.FieldValue.serverTimestamp(),
    itens, etapa: 2, status: 'em_andamento'
  };

  let docRef;
  try { docRef = await db.collection('conferencias').add(docData); }
  catch(e) { toast('⚠ Erro ao criar conferência: ' + e.message); return; }

  confSessao   = { _docId: docRef.id, ...docData, ts: new Date() };
  confPendente = null;
  rebuildConferencia();
  toast(`🗂️ Conferência ${id} iniciada — ${itens.length} item(s)`);
}

async function retomarConferencia() {
  if (!confPendente) return;
  confSessao   = { ...confPendente };
  confPendente = null;
  rebuildConferencia();
}

async function descartarConferenciaPendente() {
  if (!confPendente) return;
  if (!confirm('Descartar o rascunho? O progresso será perdido.')) return;
  try { if (confPendente._docId) await db.collection('conferencias').doc(confPendente._docId).delete(); }
  catch(e) {}
  confPendente = null;
  rebuildConferencia();
}

async function cancelarConferencia() {
  if (!confSessao) return;
  if (!confirm('Cancelar? O rascunho salvo permanece e pode ser retomado depois.')) return;
  confSessao = null;
  await _confInit();
  rebuildConferencia();
}

/* ── Inputs e auto-save ── */

function confInputChange(input, itemId, locIdx) {
  if (!confSessao) return;
  const it = confSessao.itens.find(x => x.itemId === itemId);
  if (!it?.locais[locIdx]) return;

  const val = input.value.trim();
  const num = val === '' ? null : parseFloat(val);
  it.locais[locIdx].contado = num;

  const isAdm = confIsAdm();

  /* Cor da borda apenas para admin */
  if (isAdm) {
    input.style.borderColor = num === null ? 'var(--bdr)'
      : (num == it.locais[locIdx].estoqSys ? 'var(--ok)' : '#c89a00');
  }

  /* Ícone de status */
  const icEl = document.getElementById(`conf-ic-${itemId}-${locIdx}`);
  if (icEl) {
    icEl.textContent = num === null ? '⏳'
      : (!isAdm ? '✅' : (num == it.locais[locIdx].estoqSys ? '✅' : '⚠️'));
  }

  /* Progresso */
  const prog = confProgress();
  const pct  = prog.total ? Math.round(prog.contadas / prog.total * 100) : 0;
  const pn   = document.getElementById('conf-prog-n');
  const pb   = document.getElementById('conf-prog-bar');
  if (pn) pn.textContent = `${prog.contadas}/${prog.total}`;
  if (pb) pb.style.width = pct + '%';

  /* Chip do item */
  const chip = document.getElementById(`conf-chip-${itemId}`);
  if (chip) chip.textContent = `${it.locais.filter(l => l.contado !== null && l.contado !== undefined).length}/${it.locais.length} local(is)`;

  confAgendarAutoSave();
}

function confAgendarAutoSave() {
  const ind = document.getElementById('conf-save-ind');
  if (ind) { ind.style.display = 'block'; ind.textContent = '⏳ Salvando…'; ind.style.color = 'var(--ink3)'; }
  if (confAutoSaveTimer) clearTimeout(confAutoSaveTimer);
  confAutoSaveTimer = setTimeout(confAutoSave, 1500);
}

async function confAutoSave() {
  if (!confSessao?._docId) return;
  try {
    await db.collection('conferencias').doc(confSessao._docId).update({
      itens: confSessao.itens, etapa: confSessao.etapa
    });
    const ind = document.getElementById('conf-save-ind');
    if (ind) { ind.textContent = '✓ Salvo'; ind.style.color = 'var(--ok)'; }
    setTimeout(() => { const i2 = document.getElementById('conf-save-ind'); if (i2) i2.style.display = 'none'; }, 2000);
  } catch(e) {
    const ind = document.getElementById('conf-save-ind');
    if (ind) { ind.textContent = '⚠ Falha ao salvar'; ind.style.color = 'var(--er)'; }
  }
}

function confTabNext(e, input) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const all = [...document.querySelectorAll('.conf-input')].filter(el => el.offsetParent);
  const idx = all.indexOf(input);
  if (idx > -1 && idx < all.length - 1) all[idx + 1].focus();
}

function confFiltrar(q) {
  const term = q.trim().toLowerCase();
  document.querySelectorAll('.conf-item-row').forEach(row => {
    row.style.display = (!term || row.dataset.nome.includes(term) || row.dataset.cat.includes(term)) ? '' : 'none';
  });
}

function avancarParaRevisao() {
  if (!confSessao) return;
  confSessao.etapa = 3;
  confAutoSave().then(() => rebuildConferencia());
}

function voltarParaContagem() {
  if (!confSessao) return;
  confSessao.etapa = 2;
  rebuildConferencia();
}

/* ── Confirmar (admin aplica direto; não-admin envia para aprovação) ── */

async function confirmarConferencia() {
  if (!confSessao) return;
  const btn = document.getElementById('btn-conf-confirmar');
  if (btn) btn.disabled = true;

  const isAdm = confIsAdm();
  let totalConferidos = 0, totalDivergencias = 0, totalAjustados = 0;
  const itensLog = [];

  try {
    if (isAdm) {
      /* Admin: coleta checkboxes e aplica ajustes */
      const toApply = new Set();
      document.querySelectorAll('.conf-div-cb:checked').forEach(cb => {
        toApply.add(`${cb.dataset.itemId}_${cb.dataset.locIdx}`);
      });

      for (const it of confSessao.itens) {
        for (let li = 0; li < it.locais.length; li++) {
          const loc = it.locais[li];
          if (loc.contado === null || loc.contado === undefined) continue;
          totalConferidos++;
          const dif = Number(loc.contado) - Number(loc.estoqSys);
          if (dif !== 0) totalDivergencias++;

          const doAdjust = dif !== 0 && toApply.has(`${it.itemId}_${li}`);
          if (doAdjust) {
            const tipo = getTipo(it.grupoId);
            const item = tipo?.itens.find(x => x.id === it.itemId);
            if (item) {
              if (loc.isPrimary) item.estq = Number(loc.contado);
              else if (item.distribuicao?.[loc.distIdx] !== undefined)
                item.distribuicao[loc.distIdx].qtd = Number(loc.contado);
              const upd = { estq: item.estq };
              if (item.distribuicao) upd.distribuicao = item.distribuicao;
              if (item._docId) await db.collection('itens').doc(item._docId).update(upd);
              totalAjustados++;
            }
          }
          itensLog.push({ itemId: it.itemId, nome: it.nome, un: it.un, localNome: loc.localNome,
            estoqueAntes: loc.estoqSys, contado: Number(loc.contado), diferenca: dif, ajustou: doAdjust });
        }
      }

      await db.collection('conferencias').doc(confSessao._docId).update({
        status: 'finalizada',
        tsFim: firebase.firestore.FieldValue.serverTimestamp(),
        itens: itensLog, totalConferidos, totalDivergencias, totalAjustados,
        aprovadoPor: SESSION.name
      });
      await logActivity('conferencia', `Conferência ${confSessao.id} finalizada — ${totalAjustados} ajuste(s)`);
      rebuildEstoque(); updateNotifs();
      toast(`✅ Conferência concluída — ${totalAjustados} ajuste(s) aplicado(s)`);

    } else {
      /* Não-admin: apenas registra a contagem, sem alterar estoque */
      for (const it of confSessao.itens) {
        for (let li = 0; li < it.locais.length; li++) {
          const loc = it.locais[li];
          if (loc.contado === null || loc.contado === undefined) continue;
          totalConferidos++;
          itensLog.push({ itemId: it.itemId, nome: it.nome, un: it.un, localNome: loc.localNome,
            estoqueAntes: loc.estoqSys, contado: Number(loc.contado),
            diferenca: Number(loc.contado) - Number(loc.estoqSys), ajustou: false });
        }
      }

      await db.collection('conferencias').doc(confSessao._docId).update({
        status: 'pendente_aprovacao',
        tsFim: firebase.firestore.FieldValue.serverTimestamp(),
        itens: itensLog, totalConferidos, totalDivergencias: 0, totalAjustados: 0
      });
      await logActivity('conferencia', `Conferência ${confSessao.id} enviada para aprovação por ${SESSION.name}`);
      toast(`📬 Conferência enviada ao administrador para aprovação`);
    }

    confSessao = null;
    await _carregarHistorico();
    rebuildConferencia();

  } catch(e) {
    const errEl = document.getElementById('conf-rev-err');
    if (errEl) { errEl.textContent = '⚠ Erro: ' + e.message; errEl.style.display = 'flex'; }
    if (btn) btn.disabled = false;
  }
}

/* ── Admin: Revisar e Aprovar conferência de outro usuário ── */

async function abrirAprovacaoConferencia(docId) {
  try {
    const doc = await db.collection('conferencias').doc(docId).get();
    if (!doc.exists) { toast('⚠ Conferência não encontrada.'); return; }
    const data = doc.data();

    /* Recalcular divergências comparando com estoque atual */
    const divs = [];
    (data.itens || []).forEach((it, idx) => {
      if (it.contado === null || it.contado === undefined) return;
      const tipo = getTipo(it.grupoId);
      const item = tipo?.itens.find(x => x.id === it.itemId);
      const estoqAtual = it.isPrimary !== false
        ? (item?.estq ?? it.estoqueAntes)
        : (item?.distribuicao?.[it.distIdx]?.qtd ?? it.estoqueAntes);
      const dif = Number(it.contado) - Number(estoqAtual);
      divs.push({ ...it, _idx: idx, estoqAtual, dif });
    });

    const divRows = divs.map(it => {
      const cor    = it.dif > 0 ? 'var(--ok)' : it.dif < 0 ? 'var(--er)' : 'var(--ink3)';
      const difStr = (it.dif > 0 ? '+' : '') + it.dif.toFixed(2);
      return `
      <tr>
        <td>
          <div style="font-weight:500">${it.nome}</div>
          <div style="font-size:11px;color:var(--ink3)">📍 ${it.localNome}</div>
        </td>
        <td style="font-family:'DM Mono',monospace;text-align:center">${it.estoqAtual} ${it.un}</td>
        <td style="font-family:'DM Mono',monospace;text-align:center;font-weight:600">${Number(it.contado).toFixed(2)} ${it.un}</td>
        <td style="font-family:'DM Mono',monospace;text-align:center;color:${cor};font-weight:700">${difStr}</td>
        <td style="text-align:center">
          <input type="checkbox" class="aprov-div-cb"
            data-item-id="${it.itemId}" data-grupo="${it.grupoId||''}"
            data-is-primary="${it.isPrimary!==false}" data-dist-idx="${it.distIdx??-1}"
            data-contado="${it.contado}"
            ${it.dif !== 0 ? 'checked' : ''}
            style="width:16px;height:16px;accent-color:var(--rc)">
        </td>
      </tr>`;
    }).join('');

    const el = document.getElementById('aprov-body');
    if (!el) {
      _confCriarModalAprovacao();
    }

    document.getElementById('aprov-conf-id').textContent = data.id || docId;
    document.getElementById('aprov-usuario').textContent = data.usuario || '—';
    document.getElementById('aprov-escopo').textContent  = data.escopo || '—';
    document.getElementById('aprov-ts').textContent = data.ts?.toDate
      ? data.ts.toDate().toLocaleString('pt-BR') : '—';
    document.getElementById('aprov-body').innerHTML = divRows;
    document.getElementById('aprov-docid').value = docId;
    document.getElementById('aprov-err').style.display = 'none';
    openM('m-aprov-conf');
  } catch(e) { toast('⚠ Erro ao carregar conferência: ' + e.message); }
}

function _confCriarModalAprovacao() {
  /* Cria o modal de aprovação dinamicamente se não existir */
  const div = document.createElement('div');
  div.className = 'ov';
  div.id = 'm-aprov-conf';
  div.innerHTML = `
  <div class="modal" style="width:680px">
    <div class="mh">
      <div>
        <div class="mt">⚖️ Aprovar Conferência — <span id="aprov-conf-id"></span></div>
        <div class="msb">Por <span id="aprov-usuario"></span> · <span id="aprov-escopo"></span> · <span id="aprov-ts"></span></div>
      </div>
      <span class="mx" onclick="closeM('m-aprov-conf')">×</span>
    </div>
    <div class="al al-wa" style="font-size:12px;margin-bottom:14px">
      ⚠️ Os itens marcados com ☑ terão seus estoques ajustados ao confirmar.
    </div>
    <div class="tw" style="max-height:360px;overflow-y:auto">
      <table>
        <thead><tr>
          <th>Item / Local</th><th style="text-align:center">Sistema atual</th>
          <th style="text-align:center">Contado</th><th style="text-align:center">Diferença</th>
          <th style="text-align:center">Aplicar?</th>
        </tr></thead>
        <tbody id="aprov-body"></tbody>
      </table>
    </div>
    <input type="hidden" id="aprov-docid">
    <div id="aprov-err" class="al al-er" style="display:none;margin-top:12px"></div>
    <div class="mf">
      <button class="btn btn-er" onclick="recusarConferencia(document.getElementById('aprov-docid').value)">✕ Recusar</button>
      <button class="btn btn-g" onclick="closeM('m-aprov-conf')">Cancelar</button>
      <button class="btn btn-r" onclick="confirmarAprovacao()">✓ Aprovar e Aplicar Ajustes</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function confirmarAprovacao() {
  const docId = document.getElementById('aprov-docid').value;
  const errEl = document.getElementById('aprov-err');
  errEl.style.display = 'none';

  const checks = document.querySelectorAll('.aprov-div-cb:checked');
  let totalAjustados = 0;

  try {
    for (const cb of checks) {
      const itemId    = parseInt(cb.dataset.itemId);
      const grupoId   = cb.dataset.grupo;
      const isPrimary = cb.dataset.isPrimary === 'true';
      const distIdx   = parseInt(cb.dataset.distIdx);
      const contado   = parseFloat(cb.dataset.contado);

      const tipo = getTipo(grupoId);
      const item = tipo?.itens.find(x => x.id === itemId);
      if (!item) continue;

      if (isPrimary) item.estq = contado;
      else if (item.distribuicao?.[distIdx] !== undefined) item.distribuicao[distIdx].qtd = contado;

      const upd = { estq: item.estq };
      if (item.distribuicao) upd.distribuicao = item.distribuicao;
      if (item._docId) await db.collection('itens').doc(item._docId).update(upd);
      totalAjustados++;
    }

    await db.collection('conferencias').doc(docId).update({
      status: 'finalizada',
      aprovadoPor: SESSION.name,
      aprovadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      totalAjustados
    });

    await logActivity('conferencia', `Conferência ${docId} aprovada pelo administrador — ${totalAjustados} ajuste(s)`);
    closeM('m-aprov-conf');
    await _carregarHistorico();
    rebuildEstoque(); updateNotifs(); rebuildConferencia();
    toast(`✅ Conferência aprovada — ${totalAjustados} ajuste(s) aplicado(s)`);
  } catch(e) {
    errEl.textContent = '⚠ Erro: ' + e.message;
    errEl.style.display = 'flex';
  }
}

async function recusarConferencia(docId) {
  if (!docId) return;
  if (!confirm('Recusar esta conferência? Nenhum ajuste será aplicado.')) return;
  try {
    await db.collection('conferencias').doc(docId).update({
      status: 'recusada',
      recusadoPor: SESSION.name,
      recusadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeM('m-aprov-conf');
    await _carregarHistorico();
    rebuildConferencia();
    toast('✕ Conferência recusada.');
  } catch(e) { toast('⚠ Erro: ' + e.message); }
}
