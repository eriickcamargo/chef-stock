/* ══════════════════════════════════════════════════
   PAGE: Cardápio — Lista de pratos produzidos
   CRUD completo com Firestore
══════════════════════════════════════════════════ */

function mkCardapio(){
  const pg=mkPg('cardapio');
  pg.innerHTML=cardapioHTML();
  return pg;
}

function cardapioHTML(){
  const canEdit=SESSION.role==='adm'||SESSION.role==='coz';
  return`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink3)">
        Lista de pratos e itens produzidos pelo Gosto Paraense. Estes itens aparecerão na ficha de produção.
      </div>
      <div style="display:flex;gap:8px">
        ${canEdit?`<button class="btn btn-r" onclick="openNovoCardapio()">+ Novo Item do Cardápio</button>`:''}
      </div>
    </div>

    <div style="margin-bottom:14px">
      <input class="fc" style="width:280px" placeholder="🔍 Buscar no cardápio..." oninput="filtCardapio(this.value)">
    </div>

    <div class="panel"><div class="tw"><table>
      <thead><tr>
        <th>Nome do Prato</th>
        <th>Categoria</th>
        <th>Un. Medida</th>
        ${canEdit?'<th>Ações</th>':''}
      </tr></thead>
      <tbody id="tb-cardapio">${renderCardapioRows(canEdit)}</tbody>
    </table></div></div>

    ${!cardapio.length?`<div class="empty" style="padding:40px 0"><div class="ei" style="font-size:32px">🍽️</div><div>Nenhum item no cardápio. Clique em "+ Novo Item" para começar.</div></div>`:''}`;
}

function renderCardapioRows(canEdit){
  if(!canEdit) canEdit=SESSION.role==='adm'||SESSION.role==='coz';
  return cardapio.map(item=>`<tr data-search="${item.nome.toLowerCase()}">
    <td><strong>${item.nome}</strong></td>
    <td><span class="chip">${item.categoria||'—'}</span></td>
    <td>${item.un||'porção'}</td>
    ${canEdit?`<td><div style="display:flex;gap:4px">
      <button class="btn btn-ok btn-xs" onclick="openEditCardapio('${item._docId}')">✏️ Editar</button>
      <button class="btn btn-er btn-xs" onclick="confirmarExcluirCardapio('${item._docId}')">🗑️</button>
    </div></td>`:''}
  </tr>`).join('');
}

function rebuildCardapio(){
  const pg=document.getElementById('pg-cardapio');if(pg)pg.innerHTML=cardapioHTML();
}

function filtCardapio(query){
  const q=query.trim().toLowerCase();
  const rows=document.querySelectorAll('#tb-cardapio tr');
  rows.forEach(r=>{
    const match=r.dataset.search?.includes(q);
    r.style.display=match||!q?'':'none';
  });
}

/* ── Novo item do cardápio ── */
function openNovoCardapio(){
  document.getElementById('cd-id').value='';
  document.getElementById('cd-nome').value='';
  document.getElementById('cd-cat').value='';
  document.getElementById('cd-un').value='porção';
  document.getElementById('cd-err').style.display='none';
  document.getElementById('cd-title').textContent='🍽️ Novo Item do Cardápio';
  document.getElementById('btn-cd-del').style.display='none';
  openM('m-cardapio');
}

/* ── Editar item do cardápio ── */
function openEditCardapio(docId){
  const item=cardapio.find(c=>c._docId===docId);
  if(!item)return;
  document.getElementById('cd-id').value=docId;
  document.getElementById('cd-nome').value=item.nome;
  document.getElementById('cd-cat').value=item.categoria||'';
  document.getElementById('cd-un').value=item.un||'porção';
  document.getElementById('cd-err').style.display='none';
  document.getElementById('cd-title').textContent='✏️ Editar Item do Cardápio';
  document.getElementById('btn-cd-del').style.display=SESSION.role==='adm'?'':'none';
  openM('m-cardapio');
}

/* ── Salvar (criar ou editar) ── */
async function salvarCardapio(){
  const errEl=document.getElementById('cd-err');
  errEl.style.display='none';

  const docId=document.getElementById('cd-id').value;
  const nome=document.getElementById('cd-nome').value.trim();
  const categoria=document.getElementById('cd-cat').value.trim();
  const un=document.getElementById('cd-un').value;

  if(!nome){errEl.textContent='⚠ Nome é obrigatório.';errEl.style.display='flex';return;}

  const data={nome,categoria,un};

  try{
    if(docId){
      /* Editar */
      await db.collection('cardapio').doc(docId).update(data);
      const idx=cardapio.findIndex(c=>c._docId===docId);
      if(idx>=0){
        const old=cardapio[idx];
        cardapio[idx]={...old,...data};
        /* Sync stock item name if it changed */
        if(old.estoqueDocId && old.nome !== nome){
          await db.collection('itens').doc(old.estoqueDocId).update({nome});
          const stockItem=getAllItems().find(i=>i._docId===old.estoqueDocId);
          if(stockItem) stockItem.nome=nome;
        }
      }
      toast(`✓ "${nome}" atualizado!`);
    } else {
      /* Criar — also create a stock item */
      /* Find or create "Pratos" tipo */
      let tipoPratos = TIPOS.find(t => t.nome === 'Pratos' || t.id === 'pratos');
      if(!tipoPratos){
        /* Auto-create Pratos tipo */
        const tipoData = {
          id: 'pratos',
          nome: 'Pratos',
          icon: '🍽️',
          un: 'porção',
          campos: { local: true, forn: false, venda: false, val: false },
          cats: []
        };
        const tipoRef = await db.collection('tipos').add(tipoData);
        tipoPratos = { _docId: tipoRef.id, ...tipoData, itens: [] };
        TIPOS.push(tipoPratos);
      }

      /* Create the stock item for this cardápio product */
      const newId = nextGlobalId();
      const itemData = {
        id: newId,
        nome,
        cat: categoria || '',
        tipo: 'Prato',
        tipoId: tipoPratos.id,
        un: un || 'porção',
        estq: 0,
        min: 0,
        custo: 0,
        local: '',
        forn: '',
        val: '',
      };
      const itemRef = await db.collection('itens').add(itemData);
      tipoPratos.itens.push({ _docId: itemRef.id, ...itemData });

      /* Save cardápio item with link to stock item */
      data.estoqueDocId = itemRef.id;
      const ref=await db.collection('cardapio').add(data);
      cardapio.push({_docId:ref.id,...data});

      toast(`✓ "${nome}" adicionado ao cardápio e ao estoque!`);
    }
    closeM('m-cardapio');
    rebuildCardapio();
    rebuildEstoque();
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Excluir ── */
let excluindoCardapioId=null;

function confirmarExcluirCardapio(docId){
  const item=cardapio.find(c=>c._docId===docId);
  if(!item)return;
  excluindoCardapioId=docId;
  document.getElementById('del-cd-nome').textContent=item.nome;
  openM('m-del-cardapio');
}

async function doExcluirCardapio(){
  if(!excluindoCardapioId)return;
  const item=cardapio.find(c=>c._docId===excluindoCardapioId);
  const nome=item?.nome||'Item';
  try{
    await db.collection('cardapio').doc(excluindoCardapioId).delete();
    cardapio=cardapio.filter(c=>c._docId!==excluindoCardapioId);
    excluindoCardapioId=null;
    closeM('m-del-cardapio');
    closeM('m-cardapio');
    rebuildCardapio();
    toast(`🗑️ "${nome}" removido do cardápio.`);
  }catch(e){
    toast(`⚠ Erro ao excluir: ${e.message}`);
  }
}
