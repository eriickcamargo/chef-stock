/* ══════════════════════════════════════════════════
   UTILS — Funções utilitárias e helpers de UI
══════════════════════════════════════════════════ */

/* Nível de estoque */
function nvl(q,m){if(q<=m*.2)return'e';if(q<m)return'w';return'o';}
function npct(q,m){return Math.min(100,m>0?Math.round(q/(m*2)*100):100);}
function nlbl(n){return{o:'Normal',w:'Baixo',e:'Crítico'}[n];}
function nbdg(n){return{o:'bok',w:'bwa',e:'ber'}[n];}

/* Formatação */
function round2(v){return Math.round((parseFloat(v)||0)*100)/100;}
function brl(v){return'R$ '+round2(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}

/* Barra de nível */
function sb(q,m){
  const n=nvl(q,m),p=npct(q,m);
  return`<div class="sbw"><div class="sb"><div class="sf sf${n}" style="width:${p}%"></div></div><span class="bdg ${nbdg(n)}">${nlbl(n)}</span></div>`;
}

/* Badges de status */
function stBdg(s){
  const m={
    pendente: ['bwa','⏳ Pendente'],
    aprovada: ['bin','✓ Aprovada'],
    parcial:  ['partial-tag','⚡ Aprovada Parcial'],
    recusada: ['ber','✗ Recusada'],
    retirado: ['bok','📦 Retirado'],
    enviado:  ['bin','🚚 Enviado'],
    finalizado:['bok','✅ Finalizado'],
    entregue: ['bok','✓ Entregue'],
  };
  return`<span class="bdg ${m[s]?m[s][0]:'bgr'}">${m[s]?m[s][1]:s}</span>`;
}
function itemStBdg(s){
  const m={
    pendente:  'bgr',
    aprovado:  'bok',
    cancelado: 'ber',
  };
  const l={pendente:'Aguardando',aprovado:'✓ Confirmado',cancelado:'✗ Cancelado'};
  return`<span class="bdg ${m[s]}">${l[s]}</span>`;
}

/* Toast */
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),3200);}

/* Modais */
function openM(id){document.getElementById(id)?.classList.add('on');}
function closeM(id){document.getElementById(id)?.classList.remove('on');}

/* Páginas */
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));document.getElementById('pg-'+id)?.classList.add('on');}

/* Tabs */
function stab(el,tid){
  const p=el.closest('.tabs');p.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));el.classList.add('on');
  let s=p.nextElementSibling;while(s&&s.classList.contains('tp')){s.classList.remove('on');s=s.nextElementSibling;}
  document.getElementById(tid)?.classList.add('on');
}

/* Filtros */
function filt(v,id){const q=v.toLowerCase();document.querySelectorAll(`#${id} tr`).forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none');}
function filtCat(v,tbId,attr){
  document.querySelectorAll(`#${tbId} tr`).forEach(r=>r.style.display=(!v||r.dataset[attr]===v)?'':'none');
}
function filtNivel(v,tbId){
  document.querySelectorAll(`#${tbId} tr`).forEach(r=>r.style.display=(!v||r.dataset.nivel===v)?'':'none');
}

/* Auto-unidade no recebimento */
function autoUnit(){
  const sel=document.getElementById('r-prod');
  const opt=sel.options[sel.selectedIndex];
  const un=opt.dataset.un||'kg';
  const unSel=document.getElementById('r-un');
  for(let i=0;i<unSel.options.length;i++){if(unSel.options[i].value===un||unSel.options[i].text===un){unSel.selectedIndex=i;break;}}
}

/* Criar página */
function mkPg(id){const d=document.createElement('div');d.className='page';d.id='pg-'+id;return d;}

/* Ícone de categoria */
function catIcon(c){
  const m={'Comida Paraense':'🍲','Comida Caseira':'🥘','Comida+ Paraense':'⭐','Adicional':'➕'};
  return m[c]||'🍽';
}

/* Next ID helper */
function nextId(arr){return arr.length?Math.max(...arr.map(x=>x.id))+1:100;}

/* Popula todos os selects de fornecedor dinamicamente */
function populateFornSelects(selectedValue){
  const opts='<option value="">Selecione...</option>'+
    fornecedores.map(f=>`<option value="${f.nome}">${f.nome}</option>`).join('');
  document.querySelectorAll('.forn-select').forEach(sel=>{
    const prev=selectedValue||sel.value;
    sel.innerHTML=opts;
    if(prev)sel.value=prev;
  });
}

/* ── F2: Inicializa overlay click-to-close com alerta de dados não salvos ── */
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{
  if(e.target!==o)return;
  const formEls=o.querySelectorAll('input:not([type="hidden"]),select,textarea');
  const hasData=Array.from(formEls).some(el=>{
    if(el.tagName==='SELECT')return el.selectedIndex>0&&el.value!=='';
    return (el.value||'').trim()!==''&&el.value!==el.defaultValue;
  });
  if(hasData){
    if(!confirm('O formulário possui dados não salvos.\nDeseja fechar sem salvar?'))return;
  }
  o.classList.remove('on');
}));
