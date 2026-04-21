/* ══════════════════════════════════════════════════
   PAGE: Dashboard — Admin/Cozinha
   Admin  → dashHTML()    (Centro de Comando)
   Cozinha → cozDashHTML() (turno-oriented panel)
══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════
   ADMIN DASHBOARD — Centro de Comando
═══════════════════════════════════════ */
function dashHTML(){
  const now       = new Date();
  const hojeStr   = now.toISOString().split('T')[0]; /* YYYY-MM-DD */
  const all       = getAllItems();

  /* ── 1. Métricas base ── */
  const crit      = all.filter(i => nvl(getEstqTotal(i), i.min) === 'e');
  const baixo     = all.filter(i => nvl(getEstqTotal(i), i.min) === 'w');
  const vencidos  = all.filter(i => i.val && i.val < hojeStr);
  const pend      = solicitacoes.filter(s => s.status === 'pendente');
  const emProd    = producoes.filter(p => p.status === 'em_andamento');

  /* Conferências aguardando aprovação do ADM */
  const pendConf  = atividades
    .filter(a => a.tipo === 'conferencia' && (a.texto || '').includes('aprovação'))
    .slice(0, 1); /* usado apenas para detectar se existe */
  /* Busca real via array global de conferencias se disponível, senão fallback */
  const pendAprovConf = (typeof confHistorico !== 'undefined')
    ? confHistorico.filter(c => c.status === 'pendente_aprovacao')
    : [];

  /* ── 2. KPIs financeiros ── */
  const valorEstoque = all.reduce((s, i) => s + (getEstqTotal(i) * (i.custo || 0)), 0);

  /* Compras últimos 30d */
  const cutoff30 = new Date(now); cutoff30.setDate(cutoff30.getDate() - 29); cutoff30.setHours(0,0,0,0);
  const receb30  = recebimentos.filter(r => {
    const ts = r.ts?.toDate?.() ?? parseLegacyData(r.data);
    const d  = ts instanceof Date ? ts : new Date(ts);
    return d >= cutoff30;
  });
  const compras30 = receb30.reduce((s, r) => s + (r.valor || 0), 0);

  /* CMV estimado 30d: Ei + Compras − Ef  (Ei ≈ Ef − Compras) */
  const estoqueInicial = Math.max(0, valorEstoque - compras30);
  const cmv30 = Math.max(0, estoqueInicial + compras30 - valorEstoque);

  /* ── 3. Seção alertas ── */
  let alertasHTML = '';
  if (pendAprovConf.length) {
    alertasHTML += `
      <div class="al al-wa" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>🗂️ <strong>${pendAprovConf.length} conferência(s)</strong> aguardando sua aprovação.</div>
        <button class="btn btn-wa btn-sm" onclick="navTo('conferencia')" style="flex-shrink:0">Revisar agora →</button>
      </div>`;
  }
  if (pend.length) {
    alertasHTML += `
      <div class="al al-wa" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>⏳ <strong>${pend.length} pedido(s) do Trailer</strong> aguardando confirmação.</div>
        <button class="btn btn-wa btn-sm" onclick="navTo('sols')" style="flex-shrink:0">Ver agora →</button>
      </div>`;
  }
  if (crit.length) {
    alertasHTML += `
      <div class="al al-er">⚠ <strong>${crit.length} item(ns) crítico(s):</strong> ${crit.slice(0,4).map(i=>i.nome).join(', ')}${crit.length>4?` e mais ${crit.length-4}…`:''}</div>`;
  }
  if (vencidos.length) {
    alertasHTML += `
      <div class="al al-er">📅 <strong>${vencidos.length} item(ns) com validade vencida</strong> — verifique o estoque.</div>`;
  }
  if (!alertasHTML) {
    alertasHTML = `<div class="al al-ok">✓ Tudo em ordem — sem pendências no momento</div>`;
  }

  /* ── 4. KPI cards ── */
  const kpiCards = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">
      <div class="kpi" style="cursor:pointer" onclick="navTo('relatorios')" title="Ver relatório de estoque">
        <div class="kl">💰 Valor em Estoque</div>
        <div class="kv" style="font-size:20px;color:var(--ok)">${brl(valorEstoque)}</div>
        <div class="ks">soma atual (qtd × custo)</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="navTo('receb')" title="Ver recebimentos">
        <div class="kl">📦 Compras (30d)</div>
        <div class="kv" style="font-size:20px">${brl(compras30)}</div>
        <div class="ks">${receb30.length} nota(s) recebida(s)</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="navTo('relatorios')" title="Ver CMV no relatório">
        <div class="kl">📉 CMV Est. (30d)</div>
        <div class="kv" style="font-size:20px;color:${cmv30>0?'var(--wa)':'var(--ink3)'}">${brl(cmv30)}</div>
        <div class="ks">Ei + Compras − Ef</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="navTo('relatorios')" title="Ver itens críticos">
        <div class="kl">⚠️ Itens em Alerta</div>
        <div class="kv" style="font-size:28px;color:${crit.length?'var(--er)':baixo.length?'var(--wa)':'var(--ok)'}">${crit.length+baixo.length}</div>
        <div class="ks">${crit.length} críticos · ${baixo.length} baixos</div>
      </div>
    </div>`;

  /* ── 5. Atalhos rápidos ADM ── */
  const _bs = 'display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 10px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);cursor:pointer;transition:all .15s;font-family:inherit;position:relative;width:100%';

  const solBadge = pend.length
    ? `<span style="position:absolute;top:8px;right:8px;background:var(--er);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">${pend.length}</span>` : '';
  const confBadge = pendAprovConf.length
    ? `<span style="position:absolute;top:8px;right:8px;background:var(--wa);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">${pendAprovConf.length}</span>` : '';

  const atalhos = `
    <div style="margin-bottom:24px">
      <div class="sec"><div class="st">⚡ Atalhos Rápidos</div><div class="sl"></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <button onclick="navTo('receb')" style="${_bs}" onmouseover="this.style.borderColor='var(--ok)';this.style.background='var(--bg)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
          <span style="font-size:24px">📦</span>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">Recebimento</div>
          <div style="font-size:10px;color:var(--ink3)">entrada de NF</div>
        </button>
        <button onclick="navTo('relatorios')" style="${_bs}" onmouseover="this.style.borderColor='var(--pr)';this.style.background='var(--bg)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
          <span style="font-size:24px">📊</span>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">Relatórios</div>
          <div style="font-size:10px;color:var(--ink3)">análise completa</div>
        </button>
        <button onclick="navTo('sols')" style="${_bs}" onmouseover="this.style.borderColor='var(--wa)';this.style.background='var(--bg)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
          ${solBadge}
          <span style="font-size:24px">📋</span>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">Solicitações</div>
          <div style="font-size:10px;color:var(--ink3)">${pend.length?`${pend.length} pendente(s)`:'nenhum pedido'}</div>
        </button>
        <button onclick="navTo('conferencia')" style="${_bs}" onmouseover="this.style.borderColor='var(--pr)';this.style.background='var(--bg)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
          ${confBadge}
          <span style="font-size:24px">🗂️</span>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">Conferência</div>
          <div style="font-size:10px;color:var(--ink3)">${pendAprovConf.length?`${pendAprovConf.length} p/ aprovar`:'inventário'}</div>
        </button>
        <button onclick="navTo('producao')" style="${_bs}" onmouseover="this.style.borderColor='var(--coz)';this.style.background='var(--bg)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
          <span style="font-size:24px">🍳</span>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">Produção</div>
          <div style="font-size:10px;color:var(--ink3)">${emProd.length?`${emProd.length} em andamento`:'fichas'}</div>
        </button>
        <button onclick="navTo('usuarios')" style="${_bs}" onmouseover="this.style.borderColor='var(--trl)';this.style.background='var(--bg)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
          <span style="font-size:24px">👥</span>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">Usuários</div>
          <div style="font-size:10px;color:var(--ink3)">equipe</div>
        </button>
      </div>
    </div>`;


  /* ── 6. Itens críticos top-5 ── */
  const critList = all
    .filter(i => nvl(getEstqTotal(i), i.min) === 'e')
    .sort((a, b) => (getEstqTotal(a) / Math.max(a.min, 0.1)) - (getEstqTotal(b) / Math.max(b.min, 0.1)))
    .slice(0, 5);

  const critSection = `
    <div>
      <div class="sec"><div class="st">🚨 Itens Críticos</div><div class="sl"></div><button class="btn btn-g btn-sm" onclick="navTo('relatorios')">Ver relatório →</button></div>
      ${critList.length ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${critList.map(i => {
            const total   = getEstqTotal(i);
            const deficit = (i.min - total).toFixed(1);
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
              background:var(--er-l);border:1px solid var(--er-b);border-left:4px solid var(--er);border-radius:var(--r2)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nome}</div>
                <div style="font-size:11px;color:var(--ink3);margin-top:2px">
                  ${i.forn ? `🏢 ${i.forn} · ` : ''}mín: ${i.min} ${i.un}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--er)">${total} ${i.un}</div>
                <div style="font-size:10px;color:var(--er)">déficit: ${deficit}</div>
              </div>
            </div>`;
          }).join('')}
          ${crit.length > 5 ? `<div style="text-align:center;font-size:11px;color:var(--ink3);padding:4px">… e mais ${crit.length-5} item(ns) crítico(s)</div>` : ''}
        </div>` :
        `<div style="padding:20px;text-align:center;background:var(--ok-l);border:1px solid var(--ok-b);border-radius:var(--r)">
          <div style="font-size:22px;margin-bottom:6px">✅</div>
          <div style="font-size:13px;color:var(--ok);font-weight:600">Todos os itens acima do mínimo</div>
        </div>`
      }
    </div>`;

  /* ── 7. Produções em andamento ── */
  const prodSection = `
    <div>
      <div class="sec"><div class="st">🍳 Em Produção Agora</div><div class="sl"></div><button class="btn btn-g btn-sm" onclick="navTo('producao')">Ver todas →</button></div>
      ${emProd.length ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${emProd.slice(0,4).map(p => {
            const elapsed = getElapsed(p.horaInicio);
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
              background:color-mix(in srgb,var(--wa) 6%,transparent);border:1px solid var(--wa-b);border-left:4px solid var(--wa);border-radius:var(--r2)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🍳 ${p.produto}</div>
                <div style="font-size:11px;color:var(--ink3);margin-top:2px">
                  por ${p.responsavel} · ${p.horaInicio}${elapsed?` · ⏱ ${elapsed}`:''}
                </div>
              </div>
              <button class="btn btn-r btn-sm" onclick="openFinalizarFicha('${p.id}')">Finalizar →</button>
            </div>`;
          }).join('')}
          ${emProd.length > 4 ? `<div style="text-align:center;font-size:11px;color:var(--ink3);padding:4px">… e mais ${emProd.length-4} em andamento</div>` : ''}
        </div>` :
        `<div style="padding:20px;text-align:center;background:var(--surf);border:1px dashed var(--bdr);border-radius:var(--r)">
          <div style="font-size:24px;margin-bottom:6px">🍳</div>
          <div style="font-size:13px;color:var(--ink3)">Nenhuma produção em andamento</div>
        </div>`
      }
    </div>`;

  /* ── 8. Pedidos pendentes do Trailer ── */
  const pendSols = solicitacoes.filter(s => s.status === 'pendente').slice(0, 4);
  const solsSection = `
    <div>
      <div class="sec"><div class="st">📋 Pedidos Pendentes</div><div class="sl"></div><button class="btn btn-g btn-sm" onclick="navTo('sols')">Ver todos →</button></div>
      ${pendSols.length ? pendSols.map(s => solCardHTML(s, false)).join('') :
        `<div style="padding:20px;text-align:center;background:var(--ok-l);border:1px solid var(--ok-b);border-radius:var(--r)">
          <div style="font-size:22px;margin-bottom:6px">✅</div>
          <div style="font-size:13px;color:var(--ok);font-weight:600">Nenhum pedido pendente</div>
        </div>`
      }
    </div>`;

  /* ── 9. Atividade recente (destacando tipos críticos) ── */
  const typeStyle = {
    'ajuste':      { dot:'tdo', label:'Ajuste',      em:false },
    'inventario':  { dot:'tdo', label:'Inventário',  em:false },
    'exclusao':    { dot:'tde', label:'Exclusão',    em:true  },
    'recebimento': { dot:'tdo', label:'Recebimento', em:false },
    'producao':    { dot:'tdi', label:'Produção',    em:false },
    'conferencia': { dot:'tdi', label:'Conferência', em:false },
    'consumo':     { dot:'tdi', label:'Consumo',     em:false },
    'cadastro':    { dot:'tdo', label:'Cadastro',    em:false },
    'default':     { dot:'tdi', label:'',            em:false },
  };
  const recentAtiv = atividades.slice(0, 8);
  const ativSection = `
    <div>
      <div class="sec"><div class="st">📋 Atividade Recente</div><div class="sl"></div></div>
      <div class="tline">
        ${recentAtiv.length ? recentAtiv.map(a => {
          const cfg = typeStyle[a.tipo] || typeStyle['default'];
          const label = cfg.label ? `<span class="chip" style="font-size:9px;padding:1px 5px">${cfg.label}</span> ` : '';
          return `<div class="tli">
            <div class="tld ${cfg.dot}"></div>
            <div class="tlt">${a.hora||'—'}</div>
            <div class="tltx" style="${cfg.em?'color:var(--er)':''}">${label}${a.texto}</div>
          </div>`;
        }).join('') : '<div style="padding:16px 0;text-align:center;font-size:12px;color:var(--ink3)">Nenhuma atividade registrada ainda</div>'}
      </div>
    </div>`;

  /* ── Montar layout final ── */
  return `
    ${alertasHTML}
    <div style="margin-bottom:4px"></div>
    ${kpiCards}
    ${atalhos}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      ${critSection}
      ${prodSection}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      ${solsSection}
      ${ativSection}
    </div>`;
}


/* ═══════════════════════════════════════
   COZINHA DASHBOARD — orientado ao turno
═══════════════════════════════════════ */
function cozDashHTML(){
  const now = new Date();
  const hojeStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const horaStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  /* ── 1. Dados relevantes ── */
  const all = getAllItems();
  const pendTrl = solicitacoes.filter(s => s.status === 'pendente');
  const emAndamento = producoes.filter(p => p.status === 'em_andamento');
  // Itens críticos de locais da cozinha
  const cozLocais = locais.filter(l => l.setor === 'Cozinha').map(l => l.nome);
  const critCoz = all.filter(i => {
    const isCozItem = cozLocais.includes(i.local) || (i.distribuicao||[]).some(d => cozLocais.includes(d.local));
    return isCozItem && nvl(i.estq, i.min) === 'e';
  });
  // Fallback: se sem locais de cozinha definidos, usa todos críticos
  const critList = critCoz.length ? critCoz : all.filter(i => nvl(i.estq, i.min) === 'e');

  /* Produções finalizadas hoje pelo usuário */
  const minhasHoje = producoes.filter(p =>
    p.status === 'finalizada' &&
    p.responsavel === SESSION.name &&
    (p.data || '').includes(hojeStr.slice(0,5)) // DD/MM match
  );

  /* Atividades do usuário hoje */
  const minhasAtiv = atividades
    .filter(a => a.usuario === SESSION.name)
    .slice(0, 6);

  /* ── 2. SEÇÃO: Cabeçalho do turno ── */
  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;
      padding:16px 20px;background:linear-gradient(135deg,var(--coz-l),color-mix(in srgb,var(--coz) 8%,transparent));
      border:1px solid var(--coz-b);border-radius:var(--r);gap:12px">
      <div>
        <div style="font-weight:700;font-size:16px;color:var(--coz)">👨‍🍳 Bom turno, ${SESSION.name.split(' ')[0]}!</div>
        <div style="font-size:12px;color:var(--ink3);margin-top:2px">${hojeStr} · ${horaStr}</div>
      </div>
      <div class="coz-header-flex" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <span style="font-size:12px;padding:6px 12px;background:var(--coz);color:#fff;border-radius:var(--r2);font-weight:600">Cozinha</span>
        ${emAndamento.length ? `<span style="font-size:12px;padding:6px 12px;background:var(--wa-l);color:var(--wa);border:1px solid var(--wa-b);border-radius:var(--r2);font-weight:600">🍳 ${emAndamento.length} em produção</span>` : ''}
      </div>
    </div>`;

  /* ── 3. SEÇÃO: Alertas ativos ── */
  let alertas = '';
  if (pendTrl.length) {
    alertas += `
      <div class="al al-wa" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>⏳ <strong>${pendTrl.length} pedido(s) do Trailer</strong> aguardando sua conferência.</div>
        <button class="btn btn-wa btn-sm" onclick="navTo('sols')" style="flex-shrink:0">Conferir agora →</button>
      </div>`;
  }
  if (critList.length) {
    alertas += `
      <div class="al al-er">⚠ <strong>${critList.length} item(ns) crítico(s):</strong> ${critList.slice(0,4).map(i=>i.nome).join(', ')}${critList.length>4?` e mais ${critList.length-4}…`:''}</div>`;
  }
  if (!pendTrl.length && !critList.length) {
    alertas += `<div class="al al-ok">✓ Tudo em ordem — sem pendências para a cozinha</div>`;
  }

  /* ── 4. SEÇÃO: Atalhos rápidos ── */
  const atalhos = `
    <div class="coz-atalhos" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
      <button onclick="navTo('producao')" style="display:flex;flex-direction:column;align-items:center;gap:8px;
        padding:18px 12px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);cursor:pointer;
        transition:all .15s;font-family:inherit" onmouseover="this.style.borderColor='var(--coz)';this.style.background='var(--coz-l)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
        <span class="coz-btn-icon" style="font-size:26px">🍳</span>
        <div class="coz-btn-label" style="font-size:13px;font-weight:600;color:var(--ink)">Nova Produção</div>
        <div class="coz-btn-sub" style="font-size:10px;color:var(--ink3)">${emAndamento.length} em andamento</div>
      </button>
      <button onclick="navTo('consumo')" style="display:flex;flex-direction:column;align-items:center;gap:8px;
        padding:18px 12px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);cursor:pointer;
        transition:all .15s;font-family:inherit" onmouseover="this.style.borderColor='var(--coz)';this.style.background='var(--coz-l)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
        <span class="coz-btn-icon" style="font-size:26px">🏷️</span>
        <div class="coz-btn-label" style="font-size:13px;font-weight:600;color:var(--ink)">Registrar Uso</div>
        <div class="coz-btn-sub" style="font-size:10px;color:var(--ink3)">descartáveis e limpeza</div>
      </button>
      <button onclick="navTo('sols')" style="display:flex;flex-direction:column;align-items:center;gap:8px;
        padding:18px 12px;position:relative;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);cursor:pointer;
        transition:all .15s;font-family:inherit" onmouseover="this.style.borderColor='var(--coz)';this.style.background='var(--coz-l)'" onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--surf)'">
        ${pendTrl.length ? `<span style="position:absolute;top:10px;right:10px;background:var(--er);color:#fff;border-radius:10px;padding:2px 7px;font-size:10px;font-weight:700">${pendTrl.length}</span>` : ''}
        <span class="coz-btn-icon" style="font-size:26px">📋</span>
        <div class="coz-btn-label" style="font-size:13px;font-weight:600;color:var(--ink)">Solicitações</div>
        <div class="coz-btn-sub" style="font-size:10px;color:var(--ink3)">${pendTrl.length ? `${pendTrl.length} pendente(s)` : 'nenhum pedido'}</div>
      </button>
    </div>`;

  /* ── 5. SEÇÃO: Fichas em andamento ── */
  let fichasHTML = '';
  if (emAndamento.length) {
    fichasHTML = `
      <div class="sec"><div class="st">🍳 Em Produção Agora</div><div class="sl"></div>
        <button class="btn btn-g btn-sm" onclick="navTo('producao')">Ver todas →</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
        ${emAndamento.map(p => {
          const elapsed = getElapsed(p.horaInicio);
          return `
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;
            background:linear-gradient(90deg,color-mix(in srgb,var(--wa) 6%,transparent),transparent);
            border:1px solid var(--wa-b);border-left:4px solid var(--wa);border-radius:var(--r)">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🍳 ${p.produto}</div>
              <div style="font-size:11px;color:var(--ink3);margin-top:3px">
                <span class="chip" style="font-size:10px">${p.id}</span>
                Início: ${p.horaInicio}${elapsed ? ` · ⏱ ${elapsed}` : ''}
                · por ${p.responsavel}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <span class="bdg bwa" style="font-size:11px">⏳ Em curso</span>
              <button class="btn btn-r btn-sm" onclick="openFinalizarFicha('${p.id}')">Finalizar →</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  } else {
    fichasHTML = `
      <div class="sec"><div class="st">🍳 Em Produção Agora</div><div class="sl"></div></div>
      <div style="padding:24px;text-align:center;background:var(--surf);border:1px dashed var(--bdr);border-radius:var(--r);margin-bottom:24px">
        <div style="font-size:28px;margin-bottom:8px">🍳</div>
        <div style="font-size:13px;color:var(--ink3);margin-bottom:12px">Nenhuma produção em andamento</div>
        <button class="btn btn-r btn-sm" onclick="navTo('producao')">+ Nova Ficha de Produção</button>
      </div>`;
  }

  /* ── 6. SEÇÃO: Layout de 2 colunas (turno + estoque crítico) ── */

  /* Estoque crítico compacto */
  const critSection = critList.length ? `
    <div class="sec"><div class="st">⚠️ Estoque Crítico</div><div class="sl"></div>
      <button class="btn btn-g btn-sm" onclick="navTo('estoque')">Ver estoque →</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:24px">
      ${critList.slice(0,6).map(i => {
        const total = (i.estq||0) + ((i.distribuicao||[]).reduce((s,d)=>s+(d.qtd||0),0));
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
          background:var(--er-l);border:1px solid var(--er-b);border-left:4px solid var(--er);border-radius:var(--r2)">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nome}</div>
            <div style="font-size:11px;color:var(--ink3);margin-top:1px">mín: ${i.min} ${i.un}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:var(--er)">${total} ${i.un}</div>
          </div>
        </div>`;
      }).join('')}
      ${critList.length > 6 ? `<div style="text-align:center;font-size:12px;color:var(--ink3);padding:4px">… e mais ${critList.length-6} item(ns)</div>` : ''}
    </div>` : `
    <div class="sec"><div class="st">⚠️ Estoque Crítico</div><div class="sl"></div></div>
    <div style="padding:20px;text-align:center;background:var(--ok-l);border:1px solid var(--ok-b);border-radius:var(--r);margin-bottom:24px">
      <div style="font-size:22px;margin-bottom:6px">✅</div>
      <div style="font-size:13px;color:var(--ok);font-weight:600">Todos os itens acima do mínimo</div>
    </div>`;

  /* Meu turno — timeline de atividades */
  const turnoSection = `
    <div class="sec"><div class="st">📋 Meu Turno de Hoje</div><div class="sl"></div></div>
    <div style="margin-bottom:24px">
      ${minhasHoje.length ? `
        <div style="margin-bottom:12px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:8px">Produções finalizadas hoje</div>
          ${minhasHoje.slice(0,3).map(p=>`
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:6px;
              background:var(--ok-l);border:1px solid var(--ok-b);border-radius:var(--r2)">
              <span style="font-size:14px">🍳</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600">${p.produto}</div>
                <div style="font-size:10px;color:var(--ink3)">${p.qtdProduzida} ${p.unProduto} · ${p.horaFim||'—'}</div>
              </div>
              <span class="bdg bok" style="font-size:10px">✓ Finalizada</span>
            </div>`).join('')}
        </div>` : ''}
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:8px">Atividade recente</div>
      <div class="tline">
        ${minhasAtiv.length ? minhasAtiv.map(a=>{
          const dotMap={'producao':'tdo','pedido':'tdi','consumo':'tdi','ajuste':'tdo','inventario':'tdo','conferencia':'tdo'};
          const dot=dotMap[a.tipo]||'tdi';
          return `<div class="tli"><div class="tld ${dot}"></div><div class="tlt">${a.hora||'—'}</div><div class="tltx">${a.texto}</div></div>`;
        }).join('') : `<div style="padding:16px 0;text-align:center;font-size:12px;color:var(--ink3)">Nenhuma atividade registrada ainda hoje</div>`}
      </div>
    </div>`;

  return `
    ${header}
    ${alertas}
    <div style="margin-bottom:24px"></div>
    ${atalhos}
    ${fichasHTML}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>${turnoSection}</div>
      <div>${critSection}</div>
    </div>`;
}

/* ═══════════════════════════════════════
   PAGE BUILDER — roteia por role
═══════════════════════════════════════ */
function mkDash(){
  const pg=mkPg('dash');
  pg.innerHTML = SESSION.role === 'coz' ? cozDashHTML() : dashHTML();
  return pg;
}
