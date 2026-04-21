/* ══════════════════════════════════════════════════
   DATA — Estado da aplicação (carregado do Firestore)
   ChefStock — Gosto Paraense
══════════════════════════════════════════════════ */

/* Configuração de roles (estática) */
const CFG = {
  adm:{ label:'Administrador', rc:'var(--adm)', rb:'var(--adm-l)', rbr:'var(--adm-b)' },
  coz:{ label:'Cozinha',       rc:'var(--coz)', rb:'var(--coz-l)', rbr:'var(--coz-b)' },
  trl:{ label:'Trailer',       rc:'var(--trl)', rb:'var(--trl-l)', rbr:'var(--trl-b)' },
  conf:{ label:'Conferente',   rc:'var(--conf)', rb:'var(--conf-l)', rbr:'var(--conf-b)' },
};

/* Sessão ativa */
let SESSION = null;

/* ═══ Arrays locais (populados do Firestore) ═══ */
let fornecedores = [];
let USERS = [];  /* cache local para tela de usuários */
let cardapio = [];  /* itens do cardápio para produção */
let locais = [];    /* locais de armazenamento */
let TIPOS = [];
let recebimentos = [];
let solicitacoes = [];
let producoes = [];

/* Estado mutável (UI) */
let reqQtd = {};
let solAtiva = null;
let editando = null;
let toastT;

/* ═══ Helpers de TIPOS ═══ */
function getAllItems(){ return TIPOS.flatMap(t=>t.itens); }
function getTipo(id){ return TIPOS.find(t=>t.id===id); }
function getTipoByItem(itemId){
  for(const t of TIPOS){ if(t.itens.find(i=>i.id===itemId)) return t; }
  return null;
}
function nextGlobalId(){ return getAllItems().length ? Math.max(...getAllItems().map(x=>x.id))+1 : 100; }

/* ═══ Carregar TODOS os dados do Firestore ═══ */
async function loadAllData(){
  await Promise.all([
    loadFornecedores(),
    loadTipos(),
    loadRecebimentos(),
    loadSolicitacoes(),
    loadProducoes(),
    loadUsuarios(),
    loadCardapio(),
    loadLocais(),
    loadAtividades(),
  ]);
}

/* ── Fornecedores ── */
async function loadFornecedores(){
  try {
    const snap = await db.collection('fornecedores').orderBy('nome').get();
    fornecedores = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  } catch(e) {
    console.warn('loadFornecedores fallback:', e.code);
    const snap = await db.collection('fornecedores').get();
    fornecedores = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  }
}

/* ── Tipos + Itens ── */
async function loadTipos(){
  try {
    const snap = await db.collection('tipos').get();
    TIPOS = [];
    for(const d of snap.docs){
      const t = {_docId:d.id, ...d.data(), itens:[]};
      /* Load itens belonging to this tipo */
      const isnap = await db.collection('itens').where('tipoId','==',t.id).get();
      t.itens = isnap.docs.map(id=>({_docId:id.id, ...id.data()}));
      TIPOS.push(t);
    }
  } catch(e) {
    console.warn('loadTipos error:', e.message);
    TIPOS = [];
  }
}

/* ── Recebimentos ── */
async function loadRecebimentos(){
  try {
    /* Busca todos os documentos sem orderBy para incluir registros legados
       (que não possuem o campo ts). A ordenação é feita inteiramente no JS. */
    const snap = await db.collection('recebimentos').get();
    recebimentos = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
    /* Ordena: usa ts (Firestore Timestamp) quando disponível;
       senão parseia o campo data (string "DD/MM/AAAA HH:MM" ou legado "DD/MM HH:MM") */
    recebimentos.sort((a,b)=>{
      const tA = a.ts?.toDate?.()?.getTime?.() ?? parseLegacyData(a.data);
      const tB = b.ts?.toDate?.()?.getTime?.() ?? parseLegacyData(b.data);
      return tB - tA;
    });
  } catch(e) {
    console.warn('loadRecebimentos error:', e.message);
    recebimentos = [];
  }
}

/* Converte string "DD/MM/AAAA HH:MM" ou legada "DD/MM HH:MM" para timestamp numérico */
function parseLegacyData(str){
  if(!str) return 0;
  /* Formato novo: "06/04/2026 19:59" */
  const m1 = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if(m1) return new Date(+m1[3], +m1[2]-1, +m1[1], +m1[4], +m1[5]).getTime();
  /* Formato legado: "06/04 19:59" (sem ano — assume ano corrente) */
  const m2 = str.match(/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if(m2) return new Date(new Date().getFullYear(), +m2[2]-1, +m2[1], +m2[3], +m2[4]).getTime();
  return 0;
}

/* ── Solicitações ── */
async function loadSolicitacoes(){
  try {
    const snap = await db.collection('solicitacoes').orderBy('ts','desc').get();
    solicitacoes = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  } catch(e) {
    console.warn('loadSolicitacoes fallback (sem índice):', e.code);
    try {
      const snap = await db.collection('solicitacoes').get();
      solicitacoes = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
    } catch(e2) { solicitacoes = []; }
  }
  /* Fallback sort if ts is missing (legacy data): sort by SOL-XXX number desc */
  solicitacoes.sort((a,b)=>{
    const tA=a.ts?.toDate?.()?.getTime?.()||0;
    const tB=b.ts?.toDate?.()?.getTime?.()||0;
    if(tA||tB) return tB-tA;
    const nA=parseInt((a.id||'').replace(/\D/g,''))||0;
    const nB=parseInt((b.id||'').replace(/\D/g,''))||0;
    return nB-nA;
  });
}

/* ── Produções ── */
async function loadProducoes(){
  try {
    const snap = await db.collection('producoes').orderBy('data','desc').get();
    producoes = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  } catch(e) {
    console.warn('loadProducoes fallback (sem índice):', e.code);
    try {
      const snap = await db.collection('producoes').get();
      producoes = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
    } catch(e2) { producoes = []; }
  }
}

/* ── Usuários (para tela admin) ── */
async function loadUsuarios(){
  try {
    const snap = await db.collection('usuarios').get();
    USERS = snap.docs.map(d=>({_docId:d.id, uid:d.id, ...d.data()}));
  } catch(e) {
    console.warn('loadUsuarios error:', e.message);
    USERS = [];
  }
}

/* ── Cardápio ── */
async function loadCardapio(){
  try {
    const snap = await db.collection('cardapio').orderBy('nome').get();
    cardapio = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  } catch(e) {
    console.warn('loadCardapio fallback:', e.code);
    const snap = await db.collection('cardapio').get();
    cardapio = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  }
}

/* ── Locais de Armazenamento ── */
async function loadLocais(){
  try {
    const snap = await db.collection('locais').orderBy('nome').get();
    locais = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  } catch(e) {
    console.warn('loadLocais fallback:', e.code);
    const snap = await db.collection('locais').get();
    locais = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  }
}

/* ── Atividades (log de ações) ── */
let atividades = [];

async function loadAtividades(){
  try{
    const snap = await db.collection('atividades').orderBy('ts','desc').limit(50).get();
    atividades = snap.docs.map(d=>({_docId:d.id, ...d.data()}));
  }catch(e){ atividades=[]; }
}

async function logActivity(tipo, texto){
  try{
    const now=new Date();
    const hora=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    const data={
      tipo,
      texto,
      hora,
      usuario:SESSION?.name||'Sistema',
      role:SESSION?.role||'',
      ts:firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref=await db.collection('atividades').add(data);
    atividades.unshift({_docId:ref.id,...data,ts:now});
    if(atividades.length>50)atividades.pop();
  }catch(e){/* silent */}
}
