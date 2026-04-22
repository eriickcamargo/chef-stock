/* ══════════════════════════════════════════════════
   NAV — Navegação lateral e roteamento
══════════════════════════════════════════════════ */

/* NAV — estrutura encapsulada; somente o perfil ativo é acessível em runtime */
const NAV = (() => {
  const _data = {
    adm:[
      {s:'Principal',   items:[{id:'dash',ic:'⬛',lb:'Painel Geral'}]},
      {s:'Operacional', items:[
        {id:'receb',       ic:'📦',lb:'Recebimento'},
        {id:'estoque',     ic:'🏪',lb:'Estoque'},
        {id:'conferencia', ic:'🗂️',lb:'Conferência'},
        {id:'producao',    ic:'🍳',lb:'Produção'},
        {id:'consumo',     ic:'🏷️',lb:'Registro de Uso'},
        {id:'sols',        ic:'📋',lb:'Solicitações',bdg:()=>solicitacoes.filter(s=>s.status==='pendente').length},
        {id:'novo',        ic:'📝',lb:'Novo Pedido'},
      ]},
      {s:'Consulta',    items:[{id:'estoque-local',ic:'📍',lb:'Estoque por Local'},{id:'relatorios',ic:'📊',lb:'Relatórios'}]},
      {s:'Cadastros',   items:[{id:'cardapio',ic:'🍽️',lb:'Cardápio'},{id:'categorias',ic:'🏷️',lb:'Categorias'},{id:'locais',ic:'📍',lb:'Locais'},{id:'fornecedores',ic:'🏢',lb:'Fornecedores'},{id:'usuarios',ic:'👥',lb:'Usuários'}]},
      {s:'Sistema',     items:[{id:'config',ic:'⚙️',lb:'Configurações', action:'openConfigModal'}]},
    ],
    coz:[
      {s:'Principal',   items:[{id:'dash',ic:'⬛',lb:'Painel'}]},
      {s:'Minha Área',  items:[
        {id:'estoque',     ic:'🏪',lb:'Estoque'},
        {id:'conferencia', ic:'🗂️',lb:'Conferência'},
        {id:'producao',    ic:'🍳',lb:'Produção'},
        {id:'consumo',     ic:'🏷️',lb:'Registro de Uso'},
        {id:'sols',        ic:'📋',lb:'Solicitações',bdg:()=>solicitacoes.filter(s=>s.status==='pendente').length},
      ]},
      {s:'Consulta',   items:[{id:'estoque-local',ic:'📍',lb:'Estoque por Local'}]},
      {s:'Cadastros',   items:[{id:'cardapio',ic:'🍽️',lb:'Cardápio'}]},
    ],
    trl:[
      {s:'Principal',   items:[{id:'dash',ic:'⬛',lb:'Meu Painel'}]},
      {s:'Pedidos',     items:[
        {id:'novo',        ic:'📝',lb:'Novo Pedido'},
        {id:'meus',        ic:'📋',lb:'Meus Pedidos'},
        {id:'conferencia', ic:'🗂️',lb:'Conferência'},
        {id:'consumo',     ic:'🏷️',lb:'Registro de Uso'},
      ]},
      {s:'Consulta',   items:[{id:'estoque-local',ic:'📍',lb:'Estoque por Local'}]},
    ],
    conf:[
      {s:'Principal',   items:[{id:'dash',ic:'⬛',lb:'Painel'}]},
      {s:'Conferência', items:[
        {id:'conferencia', ic:'🗂️',lb:'Conf. Estoque'},
        {id:'sols',        ic:'📋',lb:'Pedidos',bdg:()=>solicitacoes.filter(s=>s.status==='pendente').length},
        {id:'estoque',     ic:'🏪',lb:'Estoque'},
        {id:'estoque-local',ic:'📍',lb:'Estoque por Local'},
      ]},
    ],
  };
  return {
    /* Retorna apenas a estrutura do perfil solicitado */
    get(role){ return _data[role] || []; },
    /* Retorna IDs de páginas permitidas para o perfil */
    allowedIds(role){ return (_data[role]||[]).flatMap(g=>g.items.map(it=>it.id)); },
  };
})();

function buildNav(){
  const el=document.getElementById('side');el.innerHTML='';
  NAV.get(SESSION.role).forEach(g=>{
    const s=document.createElement('div');s.className='ns';s.textContent=g.s;el.appendChild(s);
    g.items.forEach(item=>{
      const n=document.createElement('div');n.className='ni';n.dataset.pg=item.id;
      const b=item.bdg?item.bdg():0;
      n.innerHTML=`<span class="ni-ic">${item.ic}</span>${item.lb}${b>0?`<span class="nbdg">${b}</span>`:''}`;
      if(item.action){
        n.onclick=()=>{
          if(typeof window[item.action]==='function') window[item.action]();
        };
      } else {
        n.onclick=()=>navTo(item.id,n);
      }
      el.appendChild(n);
    });
  });
  const first=el.querySelector('.ni');
  if(first){first.classList.add('on');showPage(first.dataset.pg);}
  buildBottomNav();
}

function navTo(id,el){
  if(!NAV.allowedIds(SESSION?.role).includes(id)) return;
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  const target=el||document.querySelector(`.ni[data-pg="${id}"]`);
  if(target)target.classList.add('on');
  showPage(id);
  document.getElementById('main')?.scrollTo(0,0);
  if(id==='sols')rebuildSols();
  if(id==='meus')rebuildMeus();
  if(id==='dash')rebuildDash();
  if(id==='novo')rebuildNovo();
  if(id==='estoque')rebuildEstoque();
  if(id==='producao')rebuildProducao();
  if(id==='consumo')rebuildConsumo();
  if(id==='conferencia')rebuildConferencia();
  if(id==='fornecedores')rebuildFornecedores();
  if(id==='cardapio')rebuildCardapio();
  if(id==='locais')rebuildLocais();
  if(id==='categorias')rebuildCategorias();
  if(id==='estoque-local')rebuildEstoqueLocal();
  if(id==='relatorios')rebuildRelatorios();
  /* Sync bottom nav */
  syncBottomNav(id);
  closeMoreMenu();
}

/* ═══ Mobile Bottom Nav ═══ */
const MAX_BNAV = 4; /* max direct buttons before "more" */

function buildBottomNav(){
  const bn=document.getElementById('bottom-nav');
  if(!bn)return;
  const allItems=[];
  NAV.get(SESSION.role).forEach(g=>g.items.forEach(it=>allItems.push(it)));

  const direct=allItems.slice(0,MAX_BNAV);
  const overflow=allItems.slice(MAX_BNAV);

  let html=direct.map(it=>{
    const b=it.bdg?it.bdg():0;
    return`<button class="bnav-item" data-pg="${it.id}" onclick="navTo('${it.id}')">
      <span class="bnav-ic">${it.ic}</span>
      <span class="bnav-lb">${shortLabel(it.lb)}</span>
      ${b>0?`<span class="bnav-bdg">${b}</span>`:''}
    </button>`;
  }).join('');

  if(overflow.length){
    html+=`<button class="bnav-item" id="bnav-more-btn" onclick="toggleMoreMenu()">
      <span class="bnav-ic">⋯</span>
      <span class="bnav-lb">Mais</span>
    </button>`;
    html+=`<div class="bnav-more-menu" id="bnav-more-menu">
      ${overflow.map(it=>{
        const b=it.bdg?it.bdg():0;
        return`<button class="bnav-more-item" data-pg="${it.id}" onclick="navTo('${it.id}')">
          <span>${it.ic}</span>${it.lb}${b>0?` <span class="nbdg">${b}</span>`:''}
        </button>`;
      }).join('')}
    </div>`;
  }

  bn.innerHTML=html;
  /* Set first item as active */
  const firstBtn=bn.querySelector('.bnav-item');
  if(firstBtn)firstBtn.classList.add('on');
}

function shortLabel(lb){
  const map={'Painel Geral':'Painel','Recebimento':'Receber','Solicitações':'Pedidos','Estoque por Local':'Est.Local','Meus Pedidos':'Pedidos','Novo Pedido':'Pedido','Relatórios':'Relat.','Conferência':'Conf.','Conf. Estoque':'Conf.','Registro de Uso':'Uso'};
  return map[lb]||lb;
}

function syncBottomNav(id){
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('.bnav-more-item').forEach(b=>b.classList.remove('on'));
  const directBtn=document.querySelector(`.bnav-item[data-pg="${id}"]`);
  if(directBtn){directBtn.classList.add('on');return;}
  /* If in overflow items, highlight "more" button instead */
  const moreItem=document.querySelector(`.bnav-more-item[data-pg="${id}"]`);
  if(moreItem){
    moreItem.classList.add('on');
    const moreBtn=document.getElementById('bnav-more-btn');
    if(moreBtn)moreBtn.classList.add('on');
  }
}

function toggleMoreMenu(){
  const menu=document.getElementById('bnav-more-menu');
  if(menu)menu.classList.toggle('on');
}
function closeMoreMenu(){
  const menu=document.getElementById('bnav-more-menu');
  if(menu)menu.classList.remove('on');
}
/* Close more menu when tapping outside */
document.addEventListener('click',e=>{
  const menu=document.getElementById('bnav-more-menu');
  const btn=document.getElementById('bnav-more-btn');
  if(menu&&menu.classList.contains('on')&&!menu.contains(e.target)&&e.target!==btn&&!btn?.contains(e.target)){
    menu.classList.remove('on');
  }
});

/* Page builder central */
function buildPages(){
  const main=document.getElementById('main');main.innerHTML='';
  if(SESSION.role==='trl'){buildTrailerPages(main);return;}
  if(SESSION.role==='conf'){buildConferentPages(main);return;}
  buildKitchenPages(main);
}

function buildKitchenPages(main){
  main.appendChild(mkDash());
  main.appendChild(mkEstoque());
  main.appendChild(mkConferencia());
  main.appendChild(mkProducao());
  main.appendChild(mkConsumo());
  main.appendChild(mkSols());
  main.appendChild(mkEstoqueLocal());
  main.appendChild(mkRelatorios());
  main.appendChild(mkCardapio());
  if(SESSION.role==='adm'){main.appendChild(mkReceb());main.appendChild(mkNovo());main.appendChild(mkMeus());main.appendChild(mkCategorias());main.appendChild(mkLocais());main.appendChild(mkFornecedores());main.appendChild(mkUsuarios());}
  populateFornSelects();
  populateLocalSelects();
  loadConsumos();
}

function buildConferentPages(main){
  main.appendChild(mkDash());
  main.appendChild(mkConferencia());
  main.appendChild(mkEstoque());
  main.appendChild(mkEstoqueLocal());
  main.appendChild(mkSols());
}
