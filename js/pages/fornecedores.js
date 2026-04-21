/* ══════════════════════════════════════════════════
   PAGE: Fornecedores — Cadastro e gestão de fornecedores
══════════════════════════════════════════════════ */

function mkFornecedores(){
  const pg=mkPg('fornecedores');
  pg.innerHTML=fornecedoresHTML();
  return pg;
}

function fornecedoresHTML(){
  return`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:13px;color:var(--ink3)">
          Gerencie os fornecedores cadastrados no sistema.
        </div>
      </div>
      <button class="btn btn-r" onclick="openNovoForn()">+ Novo Fornecedor</button>
    </div>

    <div class="panel">
      <div class="ph">
        <div class="pht">🏢 Fornecedores Cadastrados (${fornecedores.length})</div>
      </div>
      <div class="tw"><table>
        <thead><tr><th>#</th><th>Nome</th><th>Contato</th><th>Observações</th><th style="width:120px">Ações</th></tr></thead>
        <tbody>${fornecedores.length?fornecedores.map((f,i)=>`<tr>
          <td><span class="chip">${i+1}</span></td>
          <td><strong>${f.nome}</strong></td>
          <td style="font-size:12px;color:var(--ink2)">${f.contato||'—'}</td>
          <td style="font-size:12px;color:var(--ink3)">${f.obs||'—'}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-g btn-xs" onclick="openEditForn('${f._docId}')">✏️ Editar</button>
              <button class="btn btn-er btn-xs" onclick="confirmarExcluirForn('${f._docId}')">🗑</button>
            </div>
          </td>
        </tr>`).join(''):'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--ink3)">Nenhum fornecedor cadastrado.</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

function rebuildFornecedores(){
  const pg=document.getElementById('pg-fornecedores');
  if(pg)pg.innerHTML=fornecedoresHTML();
}

/* ═══ Novo Fornecedor ═══ */
function openNovoForn(){
  document.getElementById('nf-title').textContent='Novo Fornecedor';
  document.getElementById('nf-id').value='';
  document.getElementById('nf-nome').value='';
  document.getElementById('nf-contato').value='';
  document.getElementById('nf-obs').value='';
  document.getElementById('nf-err').style.display='none';
  openM('m-novo-forn');
}

/* ═══ Editar Fornecedor ═══ */
function openEditForn(docId){
  const f=fornecedores.find(x=>x._docId===docId);
  if(!f)return;
  document.getElementById('nf-title').textContent='Editar Fornecedor';
  document.getElementById('nf-id').value=f._docId;
  document.getElementById('nf-nome').value=f.nome;
  document.getElementById('nf-contato').value=f.contato||'';
  document.getElementById('nf-obs').value=f.obs||'';
  document.getElementById('nf-err').style.display='none';
  openM('m-novo-forn');
}

/* ═══ Salvar (criar ou editar) ═══ */
async function salvarForn(){
  const errEl=document.getElementById('nf-err');
  errEl.style.display='none';
  const docId=document.getElementById('nf-id').value;
  const nome=document.getElementById('nf-nome').value.trim();
  const contato=document.getElementById('nf-contato').value.trim();
  const obs=document.getElementById('nf-obs').value.trim();

  if(!nome){errEl.textContent='⚠ Informe o nome do fornecedor.';errEl.style.display='flex';return;}

  /* Verificar duplicata */
  const dup=fornecedores.find(f=>f.nome.toLowerCase()===nome.toLowerCase()&&f._docId!==docId);
  if(dup){errEl.textContent='⚠ Já existe um fornecedor com esse nome.';errEl.style.display='flex';return;}

  try{
    if(docId){
      /* Editar */
      await db.collection('fornecedores').doc(docId).update({nome,contato,obs});
      const f=fornecedores.find(x=>x._docId===docId);
      if(f){f.nome=nome;f.contato=contato;f.obs=obs;}
      toast(`✏️ Fornecedor "${nome}" atualizado`);
    }else{
      /* Criar */
      const data={nome,contato,obs};
      const ref=await db.collection('fornecedores').add(data);
      fornecedores.push({_docId:ref.id,...data});
      toast(`✅ Fornecedor "${nome}" cadastrado`);
    }
    closeM('m-novo-forn');
    rebuildFornecedores();
    populateFornSelects();
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}

/* ═══ Excluir ═══ */
let fornExcluirDocId=null;
function confirmarExcluirForn(docId){
  const f=fornecedores.find(x=>x._docId===docId);
  if(!f)return;
  fornExcluirDocId=docId;
  document.getElementById('del-forn-nome').textContent=f.nome;
  openM('m-del-forn');
}

async function doExcluirForn(){
  if(!fornExcluirDocId)return;
  const f=fornecedores.find(x=>x._docId===fornExcluirDocId);
  try{
    await db.collection('fornecedores').doc(fornExcluirDocId).delete();
    fornecedores=fornecedores.filter(x=>x._docId!==fornExcluirDocId);
    closeM('m-del-forn');
    fornExcluirDocId=null;
    rebuildFornecedores();
    populateFornSelects();
    toast(`🗑 Fornecedor "${f?.nome}" excluído`);
  }catch(e){
    toast(`⚠ Erro ao excluir: ${e.message}`);
  }
}
