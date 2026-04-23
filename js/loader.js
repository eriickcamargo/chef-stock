/* ══════════════════════════════════════════════════
   LOADER — Carregamento de scripts por perfil
   Apenas os módulos necessários para o perfil
   autenticado são baixados pelo browser.
══════════════════════════════════════════════════ */

const _SCRIPTS_CORE = [
  'js/pages/dashboard.js?v=2',
  'js/pages/solicitacoes.js?v=2',
  'js/pages/estoqueLocal.js?v=2',
  'js/pages/conferencia.js?v=1',
];

const _SCRIPTS_BY_ROLE = {
  adm: [
    'js/pages/estoque.js?v=3',
    'js/pages/consumo.js?v=1',
    'js/pages/producao.js?v=3',
    'js/pages/cardapio.js?v=1',
    'js/pages/trailer.js?v=3',
    'js/pages/recebimento.js?v=2',
    'js/pages/relatorio.js?v=2',
    'js/pages/relatorios.js?v=1',
    'js/pages/usuarios.js?v=3',
    'js/pages/fornecedores.js?v=3',
    'js/pages/locais.js?v=1',
    'js/pages/categorias.js?v=1',
  ],
  coz: [
    'js/pages/estoque.js?v=3',
    'js/pages/consumo.js?v=1',
    'js/pages/producao.js?v=3',
    'js/pages/cardapio.js?v=1',
  ],
  trl: [
    'js/pages/consumo.js?v=1',
    'js/pages/trailer.js?v=3',
  ],
  conf: [
    'js/pages/estoque.js?v=3',
  ],
};

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar: ' + src));
    document.head.appendChild(s);
  });
}

async function loadRoleScripts(role) {
  const srcs = [..._SCRIPTS_CORE, ...(_SCRIPTS_BY_ROLE[role] || [])];
  await Promise.all(srcs.map(_loadScript));
}
