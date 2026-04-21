/* ══════════════════════════════════════════════════
   GLOBAL SEARCH — Busca Unificada (Ctrl+K)
   ChefStock — Gosto Paraense
══════════════════════════════════════════════════ */

(function(){
  /* ── State ── */
  let _query = '';
  let _debounce = null;
  let _selectedIdx = -1;
  let _results = [];

  /* ── Open / Close ── */
  function isAdm(){
    return (typeof SESSION !== 'undefined') && SESSION?.role === 'adm';
  }

  function openSearch(){
    if(!isAdm()) return; /* Somente Administradores */
    const ov = document.getElementById('gs-overlay');
    if(!ov) return;
    ov.classList.add('on');
    const inp = document.getElementById('gs-input');
    if(inp){ inp.value=''; inp.focus(); }
    _query=''; _results=[]; _selectedIdx=-1;
    renderResults([]);
    renderHints();
  }

  function closeSearch(){
    const ov = document.getElementById('gs-overlay');
    if(ov) ov.classList.remove('on');
  }

  /* ── Keyboard shortcut ── */
  document.addEventListener('keydown', e=>{
    /* Ctrl+K or Cmd+K — somente admins */
    if((e.ctrlKey||e.metaKey) && e.key==='k'){
      e.preventDefault();
      if(!isAdm()) return; /* bloqueia para não-admins */
      const ov=document.getElementById('gs-overlay');
      if(ov && ov.classList.contains('on')) closeSearch();
      else openSearch();
      return;
    }
    /* Escape closes */
    if(e.key==='Escape'){
      const ov=document.getElementById('gs-overlay');
      if(ov && ov.classList.contains('on')){ closeSearch(); return; }
    }
    /* Arrow navigation */
    const ov=document.getElementById('gs-overlay');
    if(!ov || !ov.classList.contains('on')) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); moveSelection(1); }
    if(e.key==='ArrowUp'){ e.preventDefault(); moveSelection(-1); }
    if(e.key==='Enter'){ e.preventDefault(); activateSelected(); }
  });

  function moveSelection(dir){
    if(!_results.length) return;
    _selectedIdx = Math.max(-1, Math.min(_results.length-1, _selectedIdx+dir));
    highlightSelected();
  }

  function highlightSelected(){
    const items = document.querySelectorAll('.gs-result-item');
    items.forEach((el,i)=>{
      el.classList.toggle('sel', i===_selectedIdx);
      if(i===_selectedIdx) el.scrollIntoView({block:'nearest'});
    });
  }

  function activateSelected(){
    if(_selectedIdx>=0 && _selectedIdx<_results.length){
      _results[_selectedIdx].action();
      closeSearch();
    }
  }

  /* ── Search engine ── */
  function normalize(str){
    return (str||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function matches(haystack, needle){
    return normalize(haystack).includes(normalize(needle));
  }

  function doSearch(q){
    _query = q.trim();
    if(_query.length < 2){ renderResults([]); renderHints(); return; }

    const results = [];

    /* ── 1. ESTOQUE — Itens ── */
    getAllItems().forEach(item=>{
      if(matches(item.nome,_query) || matches(item.cat,_query)){
        const tipo = getTipoByItem(item.id);
        const totalEstq = (item.estq||0) + ((Array.isArray(item.distribuicao)?item.distribuicao:[]).reduce((s,d)=>s+(d?.qtd||0),0));
        results.push({
          category:'📦 Estoque',
          title: item.nome,
          sub: `${tipo?.nome||'—'} · ${item.cat||'—'} · ${fmtQtd(totalEstq,item.un)} em estoque`,
          badge: getEstoqueBadge(item, totalEstq),
          action:()=>{ closeSearch(); navTo('estoque'); setTimeout(()=>{ focusEstoqueItem(item.id); },200); }
        });
      }
    });

    /* ── 2. RECEBIMENTOS ── */
    recebimentos.forEach(r=>{
      const nfMatch = matches(r.ref,_query);
      const fornMatch = matches(r.forn,_query);
      const itenMatch = (r.detalhes||[]).some(it=>{
        const item = getAllItems().find(x=>String(x.id)===String(it.id));
        return item ? matches(item.nome,_query) : false;
      });
      if(nfMatch||fornMatch||itenMatch){
        results.push({
          category:'📦 Recebimento',
          title: `NF ${r.ref||'—'}`,
          sub:`${r.forn||'—'} · ${r.data||'—'} · ${typeof r.itens==='number'?r.itens:(r.detalhes||[]).length} item(ns)`,
          badge: null,
          action:()=>{ closeSearch(); navTo('receb'); setTimeout(()=>{ if(typeof openEditReceb==='function') openEditReceb(r._docId); },300); }
        });
      }
    });

    /* ── 3. PRODUÇÕES ── */
    producoes.forEach(p=>{
      if(matches(p.nome,_query)||matches(p.data,_query)||matches(p.responsavel,_query)){
        results.push({
          category:'🍳 Produção',
          title: p.nome||'Produção',
          sub:`${p.data||'—'} · ${p.responsavel||'—'}`,
          badge: null,
          action:()=>{ closeSearch(); navTo('producao'); }
        });
      }
    });

    /* ── 4. SOLICITAÇÕES ── */
    solicitacoes.forEach(s=>{
      const idMatch = matches(s.id,_query);
      const origemMatch = matches(s.de,_query);
      const itenMatch = (s.itens||[]).some(it=>matches(it.nome,_query));
      if(idMatch||origemMatch||itenMatch){
        results.push({
          category:'📋 Solicitação',
          title:`Pedido ${s.id||'—'}`,
          sub:`${s.de||'—'} · Status: ${fmtStatus(s.status)}`,
          badge: solStatusBadge(s.status),
          action:()=>{ closeSearch(); navTo('sols'); }
        });
      }
    });

    /* ── 5. FORNECEDORES ── */
    if(SESSION?.role==='adm'){
      fornecedores.forEach(f=>{
        if(matches(f.nome,_query)||matches(f.cnpj,_query)){
          results.push({
            category:'🏢 Fornecedor',
            title:f.nome,
            sub:f.cnpj||'',
            badge:null,
            action:()=>{ closeSearch(); navTo('fornecedores'); }
          });
        }
      });
    }

    _results = results.slice(0,40); /* cap at 40 results */
    _selectedIdx = _results.length>0 ? 0 : -1;
    renderResults(_results);
  }

  /* ── Badge helpers ── */
  function getEstoqueBadge(item, totalEstq){
    const e = totalEstq !== undefined ? totalEstq : ((item.estq||0) + ((Array.isArray(item.distribuicao)?item.distribuicao:[]).reduce((s,d)=>s+(d?.qtd||0),0)));
    const m = item.min||0;
    if(e<=0) return {cls:'ber',txt:'Zerado'};
    if(e<=m) return {cls:'bwa',txt:'Baixo'};
    return {cls:'bok',txt:'OK'};
  }

  function solStatusBadge(s){
    const map={pendente:{cls:'bwa',txt:'Pendente'},aprovado:{cls:'bok',txt:'Aprovado'},recusado:{cls:'ber',txt:'Recusado'},recebido:{cls:'bin',txt:'Recebido'}};
    return map[s]||{cls:'bgr',txt:s||'—'};
  }

  function fmtStatus(s){ const m={pendente:'Pendente',aprovado:'Aprovado',recusado:'Recusado',recebido:'Recebido'}; return m[s]||s||'—'; }

  function fmtQtd(q,un){
    const n=parseFloat(q)||0;
    return (n%1===0?n.toFixed(0):n.toLocaleString('pt-BR',{maximumFractionDigits:2}))+' '+(un||'un');
  }

  /* ── Highlight matching text ── */
  function highlight(text, q){
    if(!q||!text) return esc(text||'');
    const norm = normalize(text);
    const nq = normalize(q);
    let idx = norm.indexOf(nq);
    if(idx<0) return esc(text);
    return esc(text.slice(0,idx))
      +'<mark class="gs-mark">'+esc(text.slice(idx,idx+q.length))+'</mark>'
      +esc(text.slice(idx+q.length));
  }

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ── Render ── */
  function renderResults(results){
    const box = document.getElementById('gs-results');
    if(!box) return;

    if(!results.length){
      if(_query.length>=2){
        box.innerHTML=`<div class="gs-empty"><span class="gs-empty-ic">🔍</span><div>Nenhum resultado para "<strong>${esc(_query)}</strong>"</div><div class="gs-empty-sub">Tente buscar por nome, NF, fornecedor ou status.</div></div>`;
      } else {
        box.innerHTML='';
      }
      return;
    }

    /* Group by category */
    const groups = {};
    results.forEach(r=>{ (groups[r.category]||(groups[r.category]=[])).push(r); });

    let html='';
    let globalIdx=0;
    Object.entries(groups).forEach(([cat,items])=>{
      html+=`<div class="gs-group-label">${cat}</div>`;
      items.forEach(r=>{
        const idx=globalIdx++;
        const badge=r.badge?`<span class="bdg ${r.badge.cls}" style="font-size:10px;padding:2px 7px">${r.badge.txt}</span>`:'';
        html+=`<div class="gs-result-item${idx===_selectedIdx?' sel':''}" data-idx="${idx}" onclick="gsActivate(${idx})">
          <div class="gs-result-left">
            <div class="gs-result-title">${highlight(r.title,_query)}</div>
            <div class="gs-result-sub">${highlight(r.sub,_query)}</div>
          </div>
          ${badge}
          <span class="gs-result-arrow">→</span>
        </div>`;
      });
    });
    box.innerHTML=html;

    /* count */
    const cnt=document.getElementById('gs-count');
    if(cnt) cnt.textContent=`${results.length} resultado${results.length!==1?'s':''}`;
  }

  function renderHints(){
    const cnt=document.getElementById('gs-count');
    if(cnt) cnt.textContent='';
  }

  /* expose activate to inline onclick */
  window.gsActivate = function(idx){
    if(idx>=0 && idx<_results.length){ _results[idx].action(); closeSearch(); }
  };

  /* ── Focus/highlight an estoque item by id (best-effort) ── */
  function focusEstoqueItem(id){
    const row = document.querySelector(`[data-item-id="${id}"]`);
    if(row){
      row.scrollIntoView({behavior:'smooth',block:'center'});
      row.classList.add('gs-flash');
      setTimeout(()=>row.classList.remove('gs-flash'),1800);
    }
  }

  /* ── Input handler ── */
  window.gsOnInput = function(val){
    clearTimeout(_debounce);
    _debounce = setTimeout(()=>doSearch(val), 140);
  };

  /* ── Public API ── */
  window.openGlobalSearch = openSearch;
  window.closeGlobalSearch = closeSearch;

  /* ── Visibilidade do botão na toolbar ── */
  function syncSearchBtn(){
    const btn = document.getElementById('btn-global-search');
    if(!btn) return;
    btn.style.display = isAdm() ? '' : 'none';
  }
  /* Verificar após login (SESSION pode não estar pronto ainda) */
  document.addEventListener('DOMContentLoaded', ()=>{
    /* Observa mudanças no DOM da toolbar-pill para detectar login */
    const pill = document.getElementById('tb-pill');
    if(pill){
      new MutationObserver(syncSearchBtn).observe(pill, {childList:true, subtree:true, characterData:true});
    }
    syncSearchBtn();
  });
  /* Expõe para ser chamado pelo auth flow após login */
  window.syncGlobalSearchBtn = syncSearchBtn;

  /* close on overlay click */
  document.addEventListener('click', e=>{
    const ov=document.getElementById('gs-overlay');
    if(!ov||!ov.classList.contains('on')) return;
    if(e.target===ov) closeSearch();
  });

})();
