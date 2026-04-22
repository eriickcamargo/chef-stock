/* ══════════════════════════════════════════════════
   ChefStock Bot — Servidor Node.js 24/7
   Telegram polling + alertas de estoque crítico
══════════════════════════════════════════════════ */
const admin = require('firebase-admin');
const fetch = require('node-fetch');

/* ── Firebase Admin Init ── */
function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
    );
  }
  throw new Error(
    'Configure a variável de ambiente FIREBASE_SERVICE_ACCOUNT_BASE64 com o JSON da conta de serviço em base64.'
  );
}

admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
const db = admin.firestore();

/* ── Estado ── */
let telegramConfig = { ativo: false, token: '', chatId: '' };
let tgUpdateOffset  = 0;
let alertedItems    = new Set(); /* IDs já notificados (evita spam no restart) */

const POLL_INTERVAL         = 5_000;          /* checar Telegram a cada 5s */
const STOCK_CHECK_INTERVAL  = 5 * 60_000;     /* checar estoque a cada 5min */
const CONFIG_RELOAD_INTERVAL= 5 * 60_000;     /* recarregar config a cada 5min */

/* ── Helpers (espelham a lógica do browser) ── */
function nvl(q, m) {
  if (q <= m * 0.2) return 'e';
  if (q < m)        return 'w';
  return 'o';
}

function getEstqTotal(item) {
  const dist    = item.distribuicao;
  const distArr = Array.isArray(dist) ? dist : [];
  const distSum = distArr.reduce((s, d) => s + (d?.qtd || 0), 0);
  return (item.estq || 0) + distSum;
}

function brl(v) {
  return 'R$ ' + (Math.round(parseFloat(v || 0) * 100) / 100)
    .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Firestore ── */
async function loadTelegramConfig() {
  try {
    const doc = await db.collection('configuracoes').doc('geral').get();
    if (doc.exists) {
      telegramConfig = doc.data().telegram || telegramConfig;
    }
    console.log(`[Config] Telegram ativo: ${telegramConfig.ativo}`);
  } catch (e) {
    console.error('[Config] Erro ao carregar:', e.message);
  }
}

async function loadItemsGroupedByTipo() {
  const [tiposSnap, itensSnap] = await Promise.all([
    db.collection('tipos').get(),
    db.collection('itens').get(),
  ]);

  const tipos = tiposSnap.docs.map(d => ({
    id: d.data().id,
    nome: d.data().nome,
    icon: d.data().icon || '📦',
    itens: [],
  }));

  for (const doc of itensSnap.docs) {
    const item = { _docId: doc.id, ...doc.data() };
    const tipo = tipos.find(t => t.id === item.tipoId);
    if (tipo) tipo.itens.push(item);
  }

  return tipos;
}

/* ── Telegram ── */
async function sendTelegram(message, chatId = null) {
  if (!telegramConfig.ativo || !telegramConfig.token) return;
  const targetId = chatId || telegramConfig.chatId;
  if (!targetId) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${telegramConfig.token}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: targetId, text: message, parse_mode: 'HTML' }),
      }
    );
    if (!res.ok) console.warn('[Telegram] Falha:', await res.text());
  } catch (e) {
    console.warn('[Telegram] Rede:', e.message);
  }
}

async function responderListaCompras(chatId) {
  try {
    const tipos   = await loadItemsGroupedByTipo();
    const criticos = tipos.flatMap(t => t.itens).filter(i => nvl(getEstqTotal(i), i.min) === 'e');

    if (criticos.length === 0) {
      await sendTelegram(
        '✅ <b>Lista de Compras Vazia</b>\nNenhum produto está abaixo do limite mínimo de estoque no momento.',
        chatId
      );
      return;
    }

    let secoes = [];
    let totalEstimado = 0;

    for (const tipo of tipos) {
      const itensCrit = tipo.itens.filter(i => nvl(getEstqTotal(i), i.min) === 'e');
      if (itensCrit.length === 0) continue;

      const linhas = itensCrit.map(i => {
        const total       = getEstqTotal(i);
        const falta       = parseFloat((i.min - total).toFixed(2));
        const estimativa  = falta * (i.custo || 0);
        totalEstimado    += estimativa;
        const precoTexto  = i.custo > 0 ? ` — ~${brl(estimativa)}` : '';
        return `  • <b>${i.nome}</b>: faltam ${falta} ${i.un}${precoTexto}`;
      });

      secoes.push(`${tipo.icon} <b>${tipo.nome.toUpperCase()}</b>\n${linhas.join('\n')}`);
    }

    const totalTexto = totalEstimado > 0 ? `\n\n💰 <b>Estimativa Total: ${brl(totalEstimado)}</b>` : '';
    await sendTelegram(
      `🛒 <b>LISTA DE COMPRAS URGENTES</b>\n\n${secoes.join('\n\n')}${totalTexto}\n\n<i>Gerado agora pelo app ChefStock</i>`,
      chatId
    );
  } catch (e) {
    console.error('[Bot] Erro ao gerar lista:', e.message);
    await sendTelegram('❌ Erro ao gerar a lista de compras. Tente novamente.', chatId);
  }
}

async function responderEstoqueBaixo(chatId) {
  try {
    const tipos = await loadItemsGroupedByTipo();
    const baixos = tipos.flatMap(t =>
      t.itens
        .filter(i => nvl(getEstqTotal(i), i.min) === 'w')
        .map(i => ({ ...i, _tipoNome: t.nome, _tipoIcon: t.icon }))
    );

    if (baixos.length === 0) {
      await sendTelegram(
        '✅ <b>Estoque OK</b>\nNenhum produto está abaixo do mínimo no momento.',
        chatId
      );
      return;
    }

    const linhas = baixos.map(i => {
      const total = getEstqTotal(i);
      const pct   = Math.round((total / i.min) * 100);
      return `  ${i._tipoIcon} <b>${i.nome}</b>: ${total} / ${i.min} ${i.un} (${pct}%)`;
    });

    await sendTelegram(
      `⚠️ <b>ESTOQUE ABAIXO DO MÍNIMO</b>\n\n${linhas.join('\n')}\n\n<i>${baixos.length} item(ns) — use /lista_de_compras para os críticos</i>`,
      chatId
    );
  } catch (e) {
    console.error('[Bot] Erro ao gerar estoque baixo:', e.message);
    await sendTelegram('❌ Erro ao consultar estoque baixo. Tente novamente.', chatId);
  }
}

async function responderResumo(chatId) {
  try {
    const [tipos, solsSnap, prodsSnap] = await Promise.all([
      loadItemsGroupedByTipo(),
      db.collection('solicitacoes').get(),
      db.collection('producoes').get(),
    ]);

    const todos    = tipos.flatMap(t => t.itens);
    const criticos = todos.filter(i => nvl(getEstqTotal(i), i.min) === 'e');
    const baixos   = todos.filter(i => nvl(getEstqTotal(i), i.min) === 'w');

    const pendentes = solsSnap.docs.filter(d => d.data().status === 'pendente').length;
    const andamento = solsSnap.docs.filter(d =>
      ['aprovada', 'parcial', 'retirado', 'enviado'].includes(d.data().status)
    ).length;

    const prodsAtivas = prodsSnap.docs.filter(d => d.data().status === 'em_andamento').length;

    const valorEstoque = todos.reduce((s, i) => s + getEstqTotal(i) * (i.custo || 0), 0);

    const linhasCrit = criticos.length > 0
      ? `\n🚨 Itens críticos: <b>${criticos.length}</b>`
      : '\n🚨 Itens críticos: <b>0</b> ✅';

    await sendTelegram(
      `📊 <b>RESUMO CHEFSTOCK</b>\n` +
      `<i>${new Date().toLocaleString('pt-BR', { timeZone: 'America/Belem' })}</i>\n` +
      `\n📦 <b>Estoque</b>${linhasCrit}` +
      `\n⚠️ Abaixo do mínimo: <b>${baixos.length}</b>` +
      `\n💰 Valor total: <b>${brl(valorEstoque)}</b>` +
      `\n\n📋 <b>Solicitações</b>` +
      `\n🕐 Pendentes (aguardando aprovação): <b>${pendentes}</b>` +
      `\n🔄 Em andamento: <b>${andamento}</b>` +
      `\n\n🍳 <b>Produções ativas:</b> ${prodsAtivas}`,
      chatId
    );
  } catch (e) {
    console.error('[Bot] Erro ao gerar resumo:', e.message);
    await sendTelegram('❌ Erro ao gerar resumo. Tente novamente.', chatId);
  }
}

async function responderSolicitacoes(chatId) {
  try {
    const snap = await db.collection('solicitacoes')
      .where('status', '==', 'pendente')
      .get();

    const docs = snap.docs.sort((a, b) => {
      const tA = a.data().ts?.toMillis?.() ?? 0;
      const tB = b.data().ts?.toMillis?.() ?? 0;
      return tA - tB;
    });

    if (snap.empty) {
      await sendTelegram(
        '✅ <b>Sem Solicitações Pendentes</b>\nNenhuma solicitação aguardando aprovação.',
        chatId
      );
      return;
    }

    const linhas = docs.map(d => {
      const s        = d.data();
      const qtdItens = Array.isArray(s.itens) ? s.itens.length : 0;
      const hora     = s.hora || (s.ts?.toDate
        ? s.ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Belem' })
        : '');
      const deTexto  = s.de ? ` — <i>${s.de}</i>` : '';
      return `  📌 <b>${s.id || d.id}</b>${deTexto}: ${qtdItens} item(ns) às ${hora}`;
    });

    await sendTelegram(
      `📋 <b>SOLICITAÇÕES PENDENTES (${snap.size})</b>\n\n${linhas.join('\n')}\n\n<i>Acesse o app para aprovar ou recusar.</i>`,
      chatId
    );
  } catch (e) {
    console.error('[Bot] Erro ao buscar solicitações:', e.message);
    await sendTelegram('❌ Erro ao buscar solicitações. Tente novamente.', chatId);
  }
}

async function verificarComandosTelegram() {
  if (!telegramConfig.ativo || !telegramConfig.token) return;

  try {
    const res  = await fetch(
      `https://api.telegram.org/bot${telegramConfig.token}/getUpdates?offset=${tgUpdateOffset}`
    );
    const data = await res.json();

    if (!data.ok || !data.result.length) return;

    for (const update of data.result) {
      tgUpdateOffset = update.update_id + 1;
      const msg = update.message;
      if (!msg?.text) continue;

      const t = msg.text.trim();
      console.log(`[Bot] Comando: ${t} | chat_id: ${msg.chat.id}`);

      if (t === '/lista_de_compras' || t === '/lista') {
        await responderListaCompras(msg.chat.id);
      } else if (t === '/estoque_baixo') {
        await responderEstoqueBaixo(msg.chat.id);
      } else if (t === '/resumo') {
        await responderResumo(msg.chat.id);
      } else if (t === '/solicitacoes') {
        await responderSolicitacoes(msg.chat.id);
      } else if (t === '/start') {
        await sendTelegram(
          '🤖 Olá! Eu sou o Bot do <b>ChefStock</b>.\n\n' +
          '<b>Comandos disponíveis:</b>\n' +
          '/resumo — Painel geral do dia\n' +
          '/lista_de_compras — Produtos críticos para comprar\n' +
          '/estoque_baixo — Produtos abaixo do mínimo\n' +
          '/solicitacoes — Solicitações pendentes de aprovação',
          msg.chat.id
        );
      }
    }
  } catch (_) {
    /* silent — falha temporária de rede */
  }
}

async function verificarEstoqueCritico(silencioso = false) {
  if (!telegramConfig.ativo || !telegramConfig.token || !telegramConfig.chatId) return;

  try {
    const tipos = await loadItemsGroupedByTipo();
    const todos  = tipos.flatMap(t => t.itens);

    for (const item of todos) {
      const total    = getEstqTotal(item);
      const isCrit   = nvl(total, item.min) === 'e';
      const itemKey  = item._docId || String(item.id);

      if (isCrit && !alertedItems.has(itemKey)) {
        alertedItems.add(itemKey);
        if (!silencioso) {
          await sendTelegram(
            `🚨 <b>Estoque Crítico</b>\nO item <b>${item.nome}</b> atingiu nível crítico.\n📦 Saldo Total: ${total} ${item.un}\n📉 Mínimo Exigido: ${item.min} ${item.un}`
          );
        }
      } else if (!isCrit && alertedItems.has(itemKey)) {
        alertedItems.delete(itemKey);
      }
    }
  } catch (e) {
    console.error('[StockCheck] Erro:', e.message);
  }
}

/* ── Main ── */
async function main() {
  console.log('[ChefStock Bot] Iniciando...');

  await loadTelegramConfig();

  /* Scan inicial silencioso: popula alertedItems sem enviar notificações
     (evita spam de itens que já eram críticos antes do bot subir) */
  await verificarEstoqueCritico(true);
  console.log(`[ChefStock Bot] ${alertedItems.size} item(ns) crítico(s) no startup (sem alerta).`);

  setInterval(loadTelegramConfig,       CONFIG_RELOAD_INTERVAL);
  setInterval(verificarComandosTelegram, POLL_INTERVAL);
  setInterval(verificarEstoqueCritico,   STOCK_CHECK_INTERVAL);

  if (telegramConfig.ativo) {
    await sendTelegram('🤖 <b>ChefStock Bot</b> iniciado e rodando 24/7.');
  }

  console.log('[ChefStock Bot] Pronto.');
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
