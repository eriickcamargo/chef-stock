/* ══════════════════════════════════════════════════
   PAGE: Locais de Armazenamento — CRUD (Admin only)
   Agrupados por Setor (Cozinha / Trailer)
══════════════════════════════════════════════════ */

function mkLocais(){
  const pg=mkPg('locais');
  pg.innerHTML=locaisHTML();
  return pg;
}

function locaisHTML(){
  const cozinha=locais.filter(l=>l.setor==='Cozinha'||!l.setor);
  const trailer=locais.filter(l=>l.setor==='Trailer');

  return`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink3)">
        Gerencie os locais de armazenamento por setor (Cozinha / Trailer).
      </div>
      <button class="btn btn-r" onclick="openNovoLocal()">+ Novo Local</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px;text-align:center">
        <div class="kl">🍳 Cozinha</div>
        <div class="kv" style="font-size:22px">${cozinha.length}</div>
        <div class="ks">locais</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px;text-align:center">
        <div class="kl">🚌 Trailer</div>
        <div class="kv" style="font-size:22px">${trailer.length}</div>
        <div class="ks">locais</div>
      </div></div>
    </div>

    <div class="panel" style="margin-bottom:16px">
      <div class="ph"><div class="pht">🍳 Cozinha</div></div>
      <div class="tw"><table>
        <thead><tr>
          <th>Nome do Local</th>
          <th style="width:120px">Itens Vinculados</th>
          <th style="width:120px">Ações</th>
        </tr></thead>
        <tbody>${renderLocaisRows(cozinha)}</tbody>
      </table></div>
      ${!cozinha.length?'<div class="empty" style="padding:20px 0"><div style="font-size:12px;color:var(--ink3)">Nenhum local na cozinha</div></div>':''}
    </div>

    <div class="panel">
      <div class="ph"><div class="pht">🚌 Trailer</div></div>
      <div class="tw"><table>
        <thead><tr>
          <th>Nome do Local</th>
          <th style="width:120px">Itens Vinculados</th>
          <th style="width:120px">Ações</th>
        </tr></thead>
        <tbody>${renderLocaisRows(trailer)}</tbody>
      </table></div>
      ${!trailer.length?'<div class="empty" style="padding:20px 0"><div style="font-size:12px;color:var(--ink3)">Nenhum local no trailer</div></div>':''}
    </div>

    ${!locais.length?`<div class="empty" style="padding:40px 0"><div class="ei" style="font-size:32px">📍</div><div>Nenhum local cadastrado. Clique em "+ Novo Local" para começar.</div></div>`:''}`;
}

function renderLocaisRows(list){
  const allItems=getAllItems();
  return list.map(l=>{
    const count=allItems.filter(i=>(i.local||'')===l.nome).length;
    const setorIcon=l.setor==='Trailer'?'🚌':'🍳';
    return`<tr>
      <td><strong>📍 ${l.nome}</strong></td>
      <td style="text-align:center"><span class="chip">${count}</span></td>
      <td><div style="display:flex;gap:4px">
        <button class="btn btn-ok btn-xs" onclick="openEditLocal('${l._docId}')">✏️ Editar</button>
        <button class="btn btn-er btn-xs" onclick="confirmarExcluirLocal('${l._docId}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function rebuildLocais(){
  const pg=document.getElementById('pg-locais');if(pg)pg.innerHTML=locaisHTML();
}

/* ── Novo local ── */
function openNovoLocal(){
  document.getElementById('lc-id').value='';
  document.getElementById('lc-nome').value='';
  document.getElementById('lc-setor').value='Cozinha';
  document.getElementById('lc-err').style.display='none';
  document.getElementById('lc-title').textContent='📍 Novo Local de Armazenamento';
  document.getElementById('btn-lc-del').style.display='none';
  openM('m-local');
}

/* ── Editar local ── */
function openEditLocal(docId){
  const local=locais.find(l=>l._docId===docId);
  if(!local)return;
  document.getElementById('lc-id').value=docId;
  document.getElementById('lc-nome').value=local.nome;
  document.getElementById('lc-setor').value=local.setor||'Cozinha';
  document.getElementById('lc-err').style.display='none';
  document.getElementById('lc-title').textContent='✏️ Editar Local';
  document.getElementById('btn-lc-del').style.display='';
  openM('m-local');
}

/* ── Salvar (criar ou editar) ── */
async function salvarLocal(){
  const errEl=document.getElementById('lc-err');
  errEl.style.display='none';

  const docId=document.getElementById('lc-id').value;
  const nome=document.getElementById('lc-nome').value.trim();
  const setor=document.getElementById('lc-setor').value;

  if(!nome){errEl.textContent='⚠ Nome é obrigatório.';errEl.style.display='flex';return;}

  /* Check duplicate */
  const dup=locais.find(l=>l.nome.toLowerCase()===nome.toLowerCase()&&l._docId!==docId);
  if(dup){errEl.textContent='⚠ Já existe um local com este nome.';errEl.style.display='flex';return;}

  try{
    if(docId){
      /* Editar — also update items with old name */
      const old=locais.find(l=>l._docId===docId);
      const oldNome=old?.nome;
      await db.collection('locais').doc(docId).update({nome, setor});
      const idx=locais.findIndex(l=>l._docId===docId);
      if(idx>=0){locais[idx].nome=nome;locais[idx].setor=setor;}

      /* Update references in items if name changed */
      if(oldNome && oldNome!==nome){
        const allItems=getAllItems();
        for(const item of allItems){
          if(item.local===oldNome){
            item.local=nome;
            if(item._docId) await db.collection('itens').doc(item._docId).update({local:nome});
          }
        }
      }
      toast(`✓ "${nome}" atualizado!`);
    } else {
      /* Criar */
      const ref=await db.collection('locais').add({nome, setor});
      locais.push({_docId:ref.id, nome, setor});
      toast(`✓ "${nome}" adicionado!`);
    }
    closeM('m-local');
    rebuildLocais();
    populateLocalSelects();
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Excluir ── */
let excluindoLocalId=null;

function confirmarExcluirLocal(docId){
  const local=locais.find(l=>l._docId===docId);
  if(!local)return;
  excluindoLocalId=docId;
  const allItems=getAllItems();
  const count=allItems.filter(i=>(i.local||'')===local.nome).length;
  document.getElementById('del-lc-nome').textContent=local.nome;
  document.getElementById('del-lc-count').textContent=count>0
    ?`⚠ ${count} item(ns) estão vinculados a este local. O campo "local" deles ficará vazio.`
    :'Nenhum item está vinculado a este local.';
  openM('m-del-local');
}

async function doExcluirLocal(){
  if(!excluindoLocalId)return;
  const local=locais.find(l=>l._docId===excluindoLocalId);
  const nome=local?.nome||'Local';
  try{
    await db.collection('locais').doc(excluindoLocalId).delete();
    locais=locais.filter(l=>l._docId!==excluindoLocalId);
    excluindoLocalId=null;
    closeM('m-del-local');
    closeM('m-local');
    rebuildLocais();
    populateLocalSelects();
    toast(`🗑️ "${nome}" removido.`);
  }catch(e){
    toast(`⚠ Erro ao excluir: ${e.message}`);
  }
}

/* ── Populate all local selects dynamically ── */
function populateLocalSelects(){
  const selects=document.querySelectorAll('.local-select');
  selects.forEach(sel=>{
    const current=sel.value;
    /* Group by setor */
    const coz=locais.filter(l=>l.setor!=='Trailer');
    const trl=locais.filter(l=>l.setor==='Trailer');
    let html='';
    if(coz.length){
      html+=`<optgroup label="🍳 Cozinha">`;
      coz.forEach(l=>{html+=`<option${l.nome===current?' selected':''}>${l.nome}</option>`;});
      html+=`</optgroup>`;
    }
    if(trl.length){
      html+=`<optgroup label="🚌 Trailer">`;
      trl.forEach(l=>{html+=`<option${l.nome===current?' selected':''}>${l.nome}</option>`;});
      html+=`</optgroup>`;
    }
    sel.innerHTML=html;
    if(current && !locais.find(l=>l.nome===current)){
      sel.innerHTML+=`<option selected>${current}</option>`;
    }
  });
}
