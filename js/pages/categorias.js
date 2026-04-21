/* ══════════════════════════════════════════════════
   PAGE: Categorias — Gestão de categorias dos Tipos
   (Admin only — under Cadastros)
   Categories are stored inside each TIPO's `cats` array
══════════════════════════════════════════════════ */

function mkCategorias(){
  const pg=mkPg('categorias');
  pg.innerHTML=categoriasHTML();
  return pg;
}

function categoriasHTML(){
  return`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink3)">
        Gerencie as categorias de cada tipo de estoque. Categorias organizam os itens dentro de cada tipo.
      </div>
      <button class="btn btn-r" onclick="openNovaCat()">+ Nova Categoria</button>
    </div>

    ${TIPOS.map(tipo=>{
      const items=tipo.itens;
      return`<div class="panel" style="margin-bottom:14px">
        <div class="ph"><div class="pht">${tipo.icon} ${tipo.nome}</div><span style="font-size:11px;color:var(--ink3)">${tipo.cats.length} categoria(s)</span></div>
        <div class="pb" style="padding:0">
          ${tipo.cats.length?`<table style="margin:0">
            <thead><tr>
              <th>Categoria</th>
              <th style="width:120px;text-align:center">Itens</th>
              <th style="width:130px">Ações</th>
            </tr></thead>
            <tbody>${tipo.cats.map(cat=>{
              const count=items.filter(i=>i.cat===cat).length;
              return`<tr>
                <td><strong>${cat}</strong></td>
                <td style="text-align:center"><span class="chip">${count}</span></td>
                <td><div style="display:flex;gap:4px">
                  <button class="btn btn-ok btn-xs" onclick="openEditCat('${tipo.id}','${cat.replace(/'/g,"\\'")}')">✏️ Editar</button>
                  <button class="btn btn-er btn-xs" onclick="confirmarExcluirCat('${tipo.id}','${cat.replace(/'/g,"\\'")}')">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}</tbody>
          </table>`:`<div class="empty" style="padding:20px 0"><div style="font-size:12px;color:var(--ink3)">Nenhuma categoria cadastrada</div></div>`}
        </div>
      </div>`;
    }).join('')}

    ${!TIPOS.length?`<div class="empty" style="padding:40px 0"><div class="ei" style="font-size:32px">🏷️</div><div>Nenhum tipo de estoque cadastrado.</div></div>`:''}`;
}

function rebuildCategorias(){
  const pg=document.getElementById('pg-categorias');if(pg)pg.innerHTML=categoriasHTML();
}

/* ── Nova categoria ── */
function openNovaCat(){
  document.getElementById('cat-id').value='';
  document.getElementById('cat-old').value='';
  document.getElementById('cat-nome').value='';
  document.getElementById('cat-err').style.display='none';
  document.getElementById('cat-title').textContent='🏷️ Nova Categoria';
  document.getElementById('btn-cat-del').style.display='none';

  /* Populate tipo selector */
  const sel=document.getElementById('cat-tipo');
  sel.innerHTML=TIPOS.map(t=>`<option value="${t.id}">${t.icon} ${t.nome}</option>`).join('');
  sel.disabled=false;

  openM('m-categoria');
}

/* ── Editar categoria ── */
function openEditCat(tipoId, catNome){
  document.getElementById('cat-id').value=tipoId;
  document.getElementById('cat-old').value=catNome;
  document.getElementById('cat-nome').value=catNome;
  document.getElementById('cat-err').style.display='none';
  document.getElementById('cat-title').textContent='✏️ Editar Categoria';
  document.getElementById('btn-cat-del').style.display='';

  /* Lock tipo selector to current tipo */
  const sel=document.getElementById('cat-tipo');
  sel.innerHTML=TIPOS.map(t=>`<option value="${t.id}"${t.id===tipoId?' selected':''}>${t.icon} ${t.nome}</option>`).join('');
  sel.value=tipoId;
  sel.disabled=true;

  openM('m-categoria');
}

/* ── Salvar (criar ou editar) ── */
async function salvarCategoria(){
  const errEl=document.getElementById('cat-err');
  errEl.style.display='none';

  const tipoId=document.getElementById('cat-tipo').value;
  const oldCat=document.getElementById('cat-old').value;
  const nome=document.getElementById('cat-nome').value.trim();

  if(!nome){errEl.textContent='⚠ Nome é obrigatório.';errEl.style.display='flex';return;}
  if(!tipoId){errEl.textContent='⚠ Selecione um tipo.';errEl.style.display='flex';return;}

  const tipo=getTipo(tipoId);
  if(!tipo){errEl.textContent='⚠ Tipo não encontrado.';errEl.style.display='flex';return;}

  /* Check duplicate within this tipo */
  const dup=tipo.cats.find(c=>c.toLowerCase()===nome.toLowerCase()&&c!==oldCat);
  if(dup){errEl.textContent='⚠ Já existe uma categoria com este nome neste tipo.';errEl.style.display='flex';return;}

  try{
    if(oldCat){
      /* Editing — rename the category */
      const idx=tipo.cats.indexOf(oldCat);
      if(idx>=0)tipo.cats[idx]=nome;

      /* Update all items with old category name */
      if(oldCat!==nome){
        for(const item of tipo.itens){
          if(item.cat===oldCat){
            item.cat=nome;
            if(item._docId) await db.collection('itens').doc(item._docId).update({cat:nome});
          }
        }
      }
      toast(`✓ Categoria "${nome}" atualizada!`);
    } else {
      /* Creating a new category */
      tipo.cats.push(nome);
      toast(`✓ Categoria "${nome}" adicionada a ${tipo.nome}!`);
    }

    /* Save updated cats array to Firestore */
    await db.collection('tipos').doc(tipoId).update({cats:tipo.cats});

    closeM('m-categoria');
    rebuildCategorias();
    rebuildEstoque();
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Excluir ── */
let excluindoCat={tipoId:null,cat:null};

function confirmarExcluirCat(tipoId,catNome){
  const tipo=getTipo(tipoId);
  if(!tipo)return;
  excluindoCat={tipoId,cat:catNome};
  const count=tipo.itens.filter(i=>i.cat===catNome).length;
  document.getElementById('del-cat-nome').textContent=`${catNome} (${tipo.icon} ${tipo.nome})`;
  document.getElementById('del-cat-count').textContent=count>0
    ?`⚠ ${count} item(ns) estão nesta categoria. Eles ficarão sem categoria definida.`
    :'Nenhum item está nesta categoria.';
  openM('m-del-cat');
}

async function doExcluirCat(){
  const {tipoId,cat}=excluindoCat;
  if(!tipoId||!cat)return;
  const tipo=getTipo(tipoId);
  if(!tipo)return;

  try{
    /* Remove category from array */
    tipo.cats=tipo.cats.filter(c=>c!==cat);
    await db.collection('tipos').doc(tipoId).update({cats:tipo.cats});

    /* Clear category from items */
    for(const item of tipo.itens){
      if(item.cat===cat){
        item.cat='';
        if(item._docId) await db.collection('itens').doc(item._docId).update({cat:''});
      }
    }

    excluindoCat={tipoId:null,cat:null};
    closeM('m-del-cat');
    closeM('m-categoria');
    rebuildCategorias();
    rebuildEstoque();
    toast(`🗑️ Categoria "${cat}" removida.`);
  }catch(e){
    toast(`⚠ Erro ao excluir: ${e.message}`);
  }
}
