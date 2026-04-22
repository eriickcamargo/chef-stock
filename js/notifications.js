/* ══════════════════════════════════════════════════
   NOTIFICATIONS — Central de notificações
   + Browser Push Notifications via Notification API
   + Firestore real-time listener for new orders
══════════════════════════════════════════════════ */

let seenNotifIds=new Set(); /* Track seen notification IDs for trailer */
let tgAlertedItems=new Set(); /* Track critical items already sent to Telegram */

let tgFirstLoad=true; /* Prevent sending alerts on page reload */

function updateNotifs(){
  const pend=solicitacoes.filter(s=>s.status==='pendente');
  const de=SESSION.role==='trl'?`Trailer (${SESSION.name.split(' ')[0]})`:'';
  let notifs=[],cnt=0;
  if(SESSION.role==='trl'){
    const aprov=solicitacoes.filter(s=>s.de===de&&['aprovada','parcial'].includes(s.status));
    /* Only count unseen approved orders */
    const unseen=aprov.filter(s=>!seenNotifIds.has(s.id));
    cnt=unseen.length;
    aprov.forEach(s=>{
      const c=s.itens.filter(i=>i.status==='cancelado').length;
      notifs.push({t:'ok',m:`Pedido ${s.id} ${s.status==='parcial'?`aprovado parcialmente (${c} item(ns) cancelado(s))`:'aprovado integralmente'}!`,id:s.id});
    });
    pend.filter(s=>s.de===de).forEach(s=>notifs.push({t:'wa',m:`Pedido ${s.id} aguardando confirmação`,id:s.id}));
  } else {
    cnt=pend.length;
    pend.forEach(s=>notifs.push({t:'wa',m:`Pedido ${s.id} do ${s.de} aguarda confirmação (${s.hora})`}));
    getAllItems().filter(i=>nvl(getEstqTotal(i),i.min)==='e').forEach(i=> {
      const total=getEstqTotal(i);
      notifs.push({t:'er',m:`Crítico: ${i.nome} — ${total} ${i.un} (mín: ${i.min})`});
      if(!tgAlertedItems.has(i.id)){
        tgAlertedItems.add(i.id);
        if(!tgFirstLoad){
          enviarAlertaTelegram(`🚨 <b>Estoque Crítico</b>\nO item <b>${i.nome}</b> atingiu nível crítico.\n📦 Saldo Total: ${total} ${i.un}\n📉 Mínimo Exigido: ${i.min} ${i.un}`);
        }
      }
    });
    tgFirstLoad=false;
    getAllItems().forEach(i=>{
      if(nvl(getEstqTotal(i),i.min)!=='e' && tgAlertedItems.has(i.id)) tgAlertedItems.delete(i.id);
    });
  }
  document.getElementById('bell-n').textContent=cnt;
  document.getElementById('bell-dot').style.display=cnt>0?'block':'none';
  document.getElementById('notif-body').innerHTML=notifs.length
    ?notifs.map(n=>`<div class="al al-${n.t}" style="margin-bottom:8px">${{ok:'✅',wa:'⏳',er:'⚠',in:'ℹ'}[n.t]} ${n.m}</div>`).join('')
    :`<div class="empty" style="padding:20px"><div class="ei" style="font-size:26px">🔔</div>Sem notificações</div>`;
}

/* Mark all current trailer notifications as seen (called when bell panel opens) */
function markNotifsRead(){
  if(SESSION.role==='trl'){
    const de=`Trailer (${SESSION.name.split(' ')[0]})`;
    solicitacoes.filter(s=>s.de===de&&['aprovada','parcial'].includes(s.status))
      .forEach(s=>seenNotifIds.add(s.id));
  }
  /* Clear badge immediately */
  document.getElementById('bell-n').textContent='0';
  document.getElementById('bell-dot').style.display='none';
}

/* ══════════════════════════════════════
   BROWSER NOTIFICATIONS (Notification API)
══════════════════════════════════════ */

/* Request permission on load */
function requestNotifPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission==='default'){
    Notification.requestPermission();
  }
}

/* Send a browser push-like notification */
function sendBrowserNotif(title, body, icon='📋'){
  if(!('Notification' in window)) return;
  if(Notification.permission!=='granted') return;
  try{
    const n=new Notification(title,{
      body,
      icon:'/icon-192.png',
      badge:'/icon-192.png',
      tag:'chefstock-'+Date.now(),
      requireInteraction:false,
    });
    /* Auto close after 8 seconds */
    setTimeout(()=>n.close(),8000);
    /* Focus app on click */
    n.onclick=()=>{window.focus();n.close();};
  }catch(e){/* silent — may fail in some contexts */}
}

/* ══════════════════════════════════════
   FIRESTORE REAL-TIME LISTENER
   Watches for new pending orders (for adm/conf)
══════════════════════════════════════ */

let solsUnsubscribe=null;
let recebUnsubscribe=null;
let approvalUnsubscribe=null;
let lastKnownSolCount=0;

function startOrderListener(){
  /* Pedir permissão de notificação */
  requestNotifPermission();

  /* Track current pending orders count */
  lastKnownSolCount=solicitacoes.filter(s=>s.status==='pendente').length;

  /* ── Listener 1: Novas solicitações pendentes (Cozinha / Adm / Conf) ── */
  if(SESSION.role==='adm'||SESSION.role==='conf'||SESSION.role==='coz'){
    solsUnsubscribe=db.collection('solicitacoes')
      .where('status','==','pendente')
      .onSnapshot(snapshot=>{
        snapshot.docChanges().forEach(change=>{
          if(change.type==='added'){
            const data=change.doc.data();
            const alreadyKnown=solicitacoes.find(s=>s._docId===change.doc.id);
            if(!alreadyKnown){
              solicitacoes.unshift({_docId:change.doc.id,...data});
              const itemCount=data.itens?data.itens.length:0;
              sendBrowserNotif(
                `📝 Novo Pedido: ${data.id||'Pedido'}`,
                `${data.de||'Trailer'} solicitou ${itemCount} item(ns) às ${data.hora||'--:--'}`,
              );
              toast(`📝 Novo pedido ${data.id||''} do ${data.de||'Trailer'}!`);
              updateNotifs();
              rebuildSols();
              rebuildDash();
            }
          }
        });
      },err=>console.error('Order listener error:',err));
  }

  /* ── Listener 2: Aprovações para o Trailer (vê status aprovada/parcial) ── */
  if(SESSION.role==='trl'){
    const de=`Trailer (${SESSION.name.split(' ')[0]})`;
    approvalUnsubscribe=db.collection('solicitacoes')
      .where('de','==',de)
      .onSnapshot(snapshot=>{
        snapshot.docChanges().forEach(change=>{
          if(change.type==='modified'||change.type==='added'){
            const data=change.doc.data();
            const idx=solicitacoes.findIndex(s=>s._docId===change.doc.id);
            if(idx>-1) solicitacoes[idx]={_docId:change.doc.id,...data};
            else solicitacoes.unshift({_docId:change.doc.id,...data});

            if(['aprovada','parcial'].includes(data.status)){
              const msg=data.status==='parcial'
                ?`Pedido ${data.id} aprovado parcialmente pela Cozinha.`
                :`Pedido ${data.id} aprovado integralmente! ✅`;
              sendBrowserNotif('🍳 Pedido Aprovado', msg);
              if(!seenNotifIds.has(data.id)) toast(`✅ ${msg}`);
            }
            updateNotifs();
            rebuildSols();
          }
        });
      },err=>console.error('Approval listener error:',err));
  }

  /* ── Listener 3: Novos recebimentos (Adm / Conf) ──
     Atualiza a lista de recebimentos e a dashboard ao vivo */
  if(SESSION.role==='adm'||SESSION.role==='conf'){
    let recebFirstLoad=true;
    recebUnsubscribe=db.collection('recebimentos')
      .onSnapshot(snapshot=>{
        let changed=false;
        snapshot.docChanges().forEach(change=>{
          if(change.type==='added'||change.type==='modified'){
            const data=change.doc.data();
            const idx=recebimentos.findIndex(r=>r._docId===change.doc.id);
            if(idx>-1){ recebimentos[idx]={_docId:change.doc.id,...data}; changed=true; }
            else if(!recebFirstLoad){
              recebimentos.unshift({_docId:change.doc.id,...data});
              toast(`📦 Novo recebimento registrado: ${data.ref||''}`);
              changed=true;
            } else {
              recebimentos.push({_docId:change.doc.id,...data});
            }
          }
          if(change.type==='removed'){
            recebimentos=recebimentos.filter(r=>r._docId!==change.doc.id);
            changed=true;
          }
        });
        if(recebFirstLoad){ recebFirstLoad=false; return; }
        if(changed){
          /* Re-ordenar */
          recebimentos.sort((a,b)=>{
            const tA=a.ts?.toDate?.()?.getTime?.()??parseLegacyData(a.data);
            const tB=b.ts?.toDate?.()?.getTime?.()??parseLegacyData(b.data);
            return tB-tA;
          });
          const tb=document.getElementById('tb-receb');
          if(tb) tb.innerHTML=recebRows();
          rebuildDash();
        }
      },err=>console.error('Receb listener error:',err));
  }
}

function stopOrderListener(){
  if(solsUnsubscribe){solsUnsubscribe();solsUnsubscribe=null;}
  if(approvalUnsubscribe){approvalUnsubscribe();approvalUnsubscribe=null;}
  if(recebUnsubscribe){recebUnsubscribe();recebUnsubscribe=null;}
}

/* ══════════════════════════════════════
   TELEGRAM INTEGRATION (F2) & COMMAND LISTENER
══════════════════════════════════════ */
let telegramConfig = { ativo: false, token: '', chatId: '' };
let tgUpdateOffset = 0;
let tgListenerInterval = null;

async function loadTelegramConfig(){
  try{
    const doc = await db.collection('configuracoes').doc('geral').get();
    if(doc.exists){
      telegramConfig = doc.data().telegram || telegramConfig;
      if(telegramConfig.ativo && telegramConfig.token) {
        iniciarTelegramListener();
      }
    }
  }catch(e){ console.error('Error loading config:',e); }
}

async function enviarAlertaTelegram(mensagem, toChatId=null){
  if(!telegramConfig.ativo || !telegramConfig.token) return;
  const targetId = toChatId || telegramConfig.chatId;
  if(!targetId) return;
  
  const url = `https://api.telegram.org/bot${telegramConfig.token}/sendMessage`;
  try{
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetId,
        text: mensagem,
        parse_mode: 'HTML'
      })
    });
  }catch(e){
    console.warn('Falha ao enviar Telegram:', e);
  }
}

/* ── Bot Listener (Browser-side Polling) ── */
function iniciarTelegramListener(){
  if(tgListenerInterval) clearInterval(tgListenerInterval);
  /* Lê mensagens do Telegram a cada 5 segundos */
  tgListenerInterval = setInterval(verificarComandosTelegram, 5000);
}

async function verificarComandosTelegram(){
  if(!telegramConfig.ativo || !telegramConfig.token) return;
  const url = `https://api.telegram.org/bot${telegramConfig.token}/getUpdates?offset=${tgUpdateOffset}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if(data.ok && data.result.length > 0) {
      for(const update of data.result) {
        tgUpdateOffset = update.update_id + 1; /* Mark as read */
        
        const msg = update.message;
        if(msg && msg.text) {
          const t = msg.text.trim();
          
          /* Command Processing */
          if(t === '/lista_de_compras' || t === '/lista') {
            responderListaCompras(msg.chat.id);
          }
          else if(t === '/start') {
            enviarAlertaTelegram(`🤖 Olá! Eu sou o Bot do **ChefStock**.\n\nDigite /lista_de_compras para ver os produtos que precisam de reposição na cozinha.`, msg.chat.id);
          }
        }
      }
    }
  } catch(e) {
    /* Silent fail para não poluir o console do navegador se sem internet */
  }
}

function responderListaCompras(chatId){
  const criticos = getAllItems().filter(i => nvl(getEstqTotal(i), i.min) === 'e');

  if(criticos.length === 0){
    enviarAlertaTelegram(`✅ <b>Lista de Compras Vazia</b>\nNenhum produto está abaixo do limite mínimo de estoque no momento.`, chatId);
    return;
  }

  let secoes = [];
  let totalEstimado = 0;

  for(const tipo of TIPOS){
    const itensTipo = tipo.itens.filter(i => nvl(i.estq, i.min) === 'e');
    if(itensTipo.length === 0) continue;

    const linhas = itensTipo.map(i => {
      const falta = parseFloat((i.min - getEstqTotal(i)).toFixed(2));
      const custo = i.custo || 0;
      const estimativa = falta * custo;
      totalEstimado += estimativa;
      const precoTexto = custo > 0 ? ` — ~${brl(estimativa)}` : '';
      return `  • <b>${i.nome}</b>: ${falta} ${i.un}${precoTexto}`;
    });

    secoes.push(`${tipo.icon || '📦'} <b>${tipo.nome.toUpperCase()}</b>\n${linhas.join('\n')}`);
  }

  const totalTexto = totalEstimado > 0
    ? `\n\n💰 <b>Estimativa Total: ${brl(totalEstimado)}</b>`
    : '';

  const relatorio = `🛒 <b>LISTA DE COMPRAS URGENTES</b>\n\n${secoes.join('\n\n')}${totalTexto}\n\n<i>Gerado agora pelo app ChefStock</i>`;
  enviarAlertaTelegram(relatorio, chatId);
}

/* ── Modal Configurações Admin ── */
function openConfigModal(){
  document.getElementById('cfg-err').style.display='none';
  document.getElementById('cfg-ok').style.display='none';
  document.getElementById('cfg-tg-token').value=telegramConfig.token||'';
  document.getElementById('cfg-tg-chat').value=telegramConfig.chatId||'';
  document.getElementById('cfg-tg-ativo').checked=telegramConfig.ativo||false;
  openM('m-config');
}

async function salvarConfiguracoes(){
  const errEl=document.getElementById('cfg-err');
  const okEl=document.getElementById('cfg-ok');
  errEl.style.display='none'; okEl.style.display='none';
  
  const token=document.getElementById('cfg-tg-token').value.trim();
  const chatId=document.getElementById('cfg-tg-chat').value.trim();
  const ativo=document.getElementById('cfg-tg-ativo').checked;
  
  if(ativo && (!token || !chatId)){
    errEl.textContent='Para ativar os alertas, preencha o Token do Bot e o Chat ID.';
    errEl.style.display='block'; return;
  }
  
  telegramConfig = { ativo, token, chatId };
  try{
    await db.collection('configuracoes').doc('geral').set({ telegram: telegramConfig }, { merge: true });
    okEl.textContent='Configurações salvas com sucesso!';
    okEl.style.display='block';
    setTimeout(()=>closeM('m-config'), 2000);
  }catch(e){
    errEl.textContent='Erro ao salvar: '+e.message;
    errEl.style.display='block';
  }
}

async function testarTelegram(){
  const errEl=document.getElementById('cfg-err');
  const okEl=document.getElementById('cfg-ok');
  errEl.style.display='none'; okEl.style.display='none';
  
  const token=document.getElementById('cfg-tg-token').value.trim();
  const chatId=document.getElementById('cfg-tg-chat').value.trim();
  if(!token || !chatId){
    errEl.textContent='Insira Token e Chat ID para testar.';
    errEl.style.display='block'; return;
  }
  
  const original = {...telegramConfig};
  telegramConfig = { ativo: true, token, chatId };
  
  try{
    await enviarAlertaTelegram(`🤖 *ChefStock: Teste de Conexão*\n\nA integração com o bot está funcionando perfeitamente!`);
    okEl.textContent='Mensagem de teste enviada!';
    okEl.style.display='block';
  }catch(e){
    errEl.textContent='Falha ao testar. Verifique o Token e Chat ID.';
    errEl.style.display='block';
  }
  /* Restore original if not saved yet */
  telegramConfig = original;
}
