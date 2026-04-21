/* ══════════════════════════════════════════════════
   CRUD — Cadastrar, Editar e Excluir itens
   (Driven by TIPOS registry)
══════════════════════════════════════════════════ */

/* ──────────────────────────────────────────
   HELPERS: Conversão de embalagem
────────────────────────────────────────── */

/* Formata número de forma compacta (ex: 497, 0.5, 1000) */
function fmtFator(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
}

/* — Cadastro — */
function cadToggleConv(on) {
  document.getElementById('cad-conv-group').style.display = on ? '' : 'none';
  cadUpdateConvPreview();
  /* Atualizar label e hint do custo */
  const lbl = document.getElementById('cad-custo-label');
  const hint = document.getElementById('cad-custo-hint');
  if (on) {
    const compra = document.getElementById('cad-un-compra')?.value || 'pct';
    if (lbl) lbl.innerHTML = `Custo por ${compra} (R$) <span class="req-mark">*</span>`;
    if (hint) hint.textContent = 'O sistema calcula automaticamente o custo por unidade de consumo';
  } else {
    if (lbl) lbl.innerHTML = 'Custo unitário (R$) <span class="req-mark">*</span>';
    if (hint) hint.textContent = 'Custo por unidade de consumo';
  }
}

function cadUpdateConvPreview() {
  const on = document.getElementById('cad-usa-conv')?.checked;
  const fator = parseFloat(document.getElementById('cad-fator')?.value) || 0;
  const consumo = document.getElementById('cad-un')?.value || 'g';
  const compra = document.getElementById('cad-un-compra')?.value || 'pct';
  const custo = parseFloat(document.getElementById('cad-custo')?.value) || 0;

  /* Hint labels */
  const hintUn = document.getElementById('cad-fator-hint-un');
  const hintCp = document.getElementById('cad-fator-hint-compra');
  if (hintUn) hintUn.textContent = consumo;
  if (hintCp) hintCp.textContent = compra;

  /* Preview box */
  const prev = document.getElementById('cad-conv-preview');
  if (!prev) return;
  if (on && fator > 0) {
    document.getElementById('cpv-compra').textContent = compra;
    document.getElementById('cpv-fator').textContent = fmtFator(fator);
    document.getElementById('cpv-consumo').textContent = consumo;
    const custoBase = custo > 0 ? ` — custo/σ: R$ ${round2(custo / fator).toFixed(4).replace('.', ',')}` : '';
    prev.querySelector('strong + strong + strong').nextSibling && (prev.childNodes[prev.childNodes.length-1].textContent = custoBase);
    prev.style.display = '';
  } else {
    prev.style.display = 'none';
  }

  /* Estq hint */
  const estqHint = document.getElementById('cad-estq-hint');
  if (estqHint) estqHint.textContent = on ? `Em ${consumo}` : `Em unidades de consumo (${consumo})`;

  /* Custo label */
  cadToggleConvLabel(on, compra);
}

function cadToggleConvLabel(on, compra) {
  const lbl = document.getElementById('cad-custo-label');
  const hint = document.getElementById('cad-custo-hint');
  if (!lbl || !hint) return;
  if (on) {
    lbl.innerHTML = `Custo por embalagem/ão (R$) <span class="req-mark">*</span>`;
    hint.textContent = 'Custo total de 1 ' + (compra || 'pct') + '. O sistema calcula o custo por g/ml automaticamente.';
  } else {
    lbl.innerHTML = 'Custo unitário (R$) <span class="req-mark">*</span>';
    hint.textContent = 'Custo por unidade de consumo';
  }
}

/* — Edição — */
function editToggleConv(on) {
  document.getElementById('edit-conv-group').style.display = on ? '' : 'none';
  editUpdateConvPreview();
}

function editUpdateConvPreview() {
  const on = document.getElementById('edit-usa-conv')?.checked;
  const fator = parseFloat(document.getElementById('edit-fator')?.value) || 0;
  const consumo = document.getElementById('edit-un')?.value || 'g';
  const compra = document.getElementById('edit-un-compra')?.value || 'pct';

  const hintCp = document.getElementById('edit-fator-hint-compra');
  if (hintCp) hintCp.textContent = compra;

  const prev = document.getElementById('edit-conv-preview');
  if (!prev) return;
  if (on && fator > 0) {
    document.getElementById('epv-compra').textContent = compra;
    document.getElementById('epv-fator').textContent = fmtFator(fator);
    document.getElementById('epv-consumo').textContent = consumo;
    prev.style.display = '';
  } else {
    prev.style.display = 'none';
  }
}

/* ── Cadastro ── */
function openCadastro(){
  ['cad-nome','cad-estq','cad-min','cad-custo','cad-venda','cad-fator'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  document.getElementById('cad-un').value='kg';
  document.getElementById('cad-un-compra').value='pct';
  document.getElementById('cad-usa-conv').checked=false;
  document.getElementById('cad-conv-group').style.display='none';
  document.getElementById('cad-conv-preview').style.display='none';
  document.getElementById('cad-local').value=locais.length?locais[0].nome:'';
  document.getElementById('cad-forn').value='';
  document.getElementById('cad-val').value='';
  document.getElementById('cad-err').style.display='none';
  /* Reset custo label */
  cadToggleConvLabel(false, 'pct');

  /* Gerar radio buttons dinamicamente */
  const area=document.getElementById('cad-tipos-area');
  area.innerHTML=TIPOS.map((t,i)=>`
    <input type="radio" name="cad-tipo" id="cad-t-${t.id}" class="tipo-radio" value="${t.id}" ${i===0?'checked':''} onchange="cadTipoChange()">
    <label for="cad-t-${t.id}">${t.icon} ${t.nome}</label>
  `).join('');

  cadTipoChange();
  openM('m-cadastro');
}

function cadTipoChange(){
  const tipoId=document.querySelector('input[name="cad-tipo"]:checked')?.value;
  const tipo=getTipo(tipoId);
  if(!tipo)return;

  /* Show/hide campos baseado no tipo */
  document.getElementById('cad-venda-group').style.display=tipo.campos.venda?'':'none';
  document.getElementById('cad-val-group').style.display=tipo.campos.val?'':'none';
  document.getElementById('cad-local-group').style.display=tipo.campos.local?'':'none';

  /* Unidade padrão */
  document.getElementById('cad-un').value=tipo.un;

  /* Categorias dinâmicas */
  const catSel=document.getElementById('cad-cat');
  catSel.innerHTML='<option value="">Selecione...</option>'+
    tipo.cats.map(c=>`<option>${c}</option>`).join('');
}

async function salvarCadastro(){
  const errEl=document.getElementById('cad-err');
  errEl.style.display='none';
  const tipoId=document.querySelector('input[name="cad-tipo"]:checked')?.value;
  const tipo=getTipo(tipoId);
  if(!tipo){errEl.textContent='⚠ Selecione um tipo.';errEl.style.display='flex';return;}

  const nome=document.getElementById('cad-nome').value.trim();
  const cat=document.getElementById('cad-cat').value;
  const un=document.getElementById('cad-un').value; /* unidade de consumo */
  const estq=parseFloat(document.getElementById('cad-estq').value)||0;
  const min=parseFloat(document.getElementById('cad-min').value)||0;

  /* Conversão de embalagem */
  const usaConv=document.getElementById('cad-usa-conv')?.checked||false;
  const unCompra=usaConv?(document.getElementById('cad-un-compra')?.value||un):un;
  const fatorConversao=usaConv?(parseFloat(document.getElementById('cad-fator')?.value)||1):1;

  /* Custo: se usaConv, o usuário digita o custo por embalagem; convertemos para custo/un-consumo */
  const custoBruto=round2(document.getElementById('cad-custo').value);
  const custo=usaConv&&fatorConversao>1?round2(custoBruto/fatorConversao):custoBruto;

  const erros=[];
  if(!nome)erros.push('Nome do item é obrigatório.');
  if(!cat)erros.push('Selecione uma categoria.');
  if(estq<0)erros.push('Quantidade inicial não pode ser negativa.');
  if(min<0)erros.push('Estoque mínimo não pode ser negativo.');
  if(custoBruto<=0)erros.push('Informe o custo unitário.');
  if(usaConv&&fatorConversao<=0)erros.push('Informe o fator de conversão.');
  if(erros.length){
    errEl.textContent='⚠ '+erros.join(' ');
    errEl.style.display='flex';return;
  }

  const item = { id:nextGlobalId(), nome, cat, un, estq, min, custo, tipoId };

  /* Persist conversão */
  if(usaConv && fatorConversao>1){
    item.unCompra=unCompra;
    item.fatorConversao=fatorConversao;
  }

  if(tipo.campos.local) item.local=document.getElementById('cad-local').value;
  if(tipo.campos.forn) item.forn=document.getElementById('cad-forn').value||null;
  if(tipo.campos.val) item.val=document.getElementById('cad-val').value||null;
  if(tipo.campos.venda) item.venda=parseFloat(document.getElementById('cad-venda').value)||0;

  try{
    const docRef = await db.collection('itens').add(item);
    item._docId = docRef.id;
    tipo.itens.push(item);
    closeM('m-cadastro');
    rebuildEstoque();
    updateNotifs();
    const convInfo=usaConv&&fatorConversao>1?` (⊗1 ${unCompra} = ${fmtFator(fatorConversao)} ${un})`:'';
    toast(`✓ "${nome}" cadastrado como ${tipo.nome}!${convInfo}`);
  }catch(e){
    errEl.textContent='⚠ Erro ao salvar: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Edição ── */
function openEditar(id, grupoId){
  const tipo=getTipo(grupoId);
  if(!tipo)return;
  const item=tipo.itens.find(x=>x.id===id);
  if(!item)return;
  editando={id,grupo:grupoId};

  document.getElementById('edit-badge-tipo').textContent=`${tipo.icon} ${tipo.nome}`;
  document.getElementById('edit-subtitle').textContent=`Editando: ${item.nome}`;
  document.getElementById('edit-err').style.display='none';

  document.getElementById('edit-id').value=id;
  document.getElementById('edit-grupo').value=grupoId;
  document.getElementById('edit-nome').value=item.nome;
  document.getElementById('edit-un').value=item.un||'un';
  document.getElementById('edit-estq').value=item.estq;
  document.getElementById('edit-min').value=item.min;
  document.getElementById('edit-custo').value=item.custo||0;
  document.getElementById('edit-venda').value=item.venda||'';
  document.getElementById('edit-val').value=item.val||'';

  /* Populate tipo selector */
  const tipoSel=document.getElementById('edit-tipo-sel');
  tipoSel.innerHTML=TIPOS.map(t=>`<option value="${t.id}"${t.id===grupoId?' selected':''}>${t.icon} ${t.nome}</option>`).join('');

  /* Categorias dinâmicas para edição */
  const catSel=document.getElementById('edit-cat');
  catSel.innerHTML=tipo.cats.map(c=>`<option${c===item.cat?' selected':''}>${c}</option>`).join('');

  /* Mostrar/ocultar campos */
  document.getElementById('edit-local-wrap').style.display=tipo.campos.local?'':'none';
  document.getElementById('edit-forn-wrap').style.display=tipo.campos.forn?'':'none';
  document.getElementById('edit-venda-wrap').style.display=tipo.campos.venda?'':'none';
  document.getElementById('edit-val-wrap').style.display=tipo.campos.val?'':'none';

  if(tipo.campos.local) document.getElementById('edit-local').value=item.local||'Estoque Seco';
  if(tipo.campos.forn) document.getElementById('edit-forn').value=item.forn||'';

  /* Popula campos de conversão */
  const usaConv=!!(item.unCompra && item.fatorConversao && item.fatorConversao>1);
  document.getElementById('edit-usa-conv').checked=usaConv;
  document.getElementById('edit-conv-group').style.display=usaConv?'':'none';
  if(usaConv){
    document.getElementById('edit-un-compra').value=item.unCompra||'pct';
    document.getElementById('edit-fator').value=item.fatorConversao||'';
  } else {
    document.getElementById('edit-fator').value='';
  }
  editUpdateConvPreview();

  updateEditNivelPreview();

  if(tipo.campos.venda) updateEditMargem();
  else document.getElementById('edit-margem-info').textContent='';

  editTab(document.querySelector('#m-editar .modal-tab'),'et-info');
  document.getElementById('btn-excluir').style.display=SESSION.role==='adm'?'':'none';

  openM('m-editar');
}

function onEditTipoChange(){
  const newTipoId=document.getElementById('edit-tipo-sel').value;
  const newTipo=getTipo(newTipoId);
  if(!newTipo) return;

  /* Update badge */
  document.getElementById('edit-badge-tipo').textContent=`${newTipo.icon} ${newTipo.nome}`;

  /* Refresh categories for new tipo */
  const catSel=document.getElementById('edit-cat');
  const currentCat=catSel.value;
  catSel.innerHTML=newTipo.cats.map(c=>`<option${c===currentCat?' selected':''}>${c}</option>`).join('');

  /* Update hidden grupo field */
  document.getElementById('edit-grupo').value=newTipoId;

  /* Show/hide campos based on new tipo */
  document.getElementById('edit-local-wrap').style.display=newTipo.campos.local?'':'none';
  document.getElementById('edit-forn-wrap').style.display=newTipo.campos.forn?'':'none';
  document.getElementById('edit-venda-wrap').style.display=newTipo.campos.venda?'':'none';
  document.getElementById('edit-val-wrap').style.display=newTipo.campos.val?'':'none';

  /* Update unit default */
  if(newTipo.un) document.getElementById('edit-un').value=newTipo.un;
}

function editTab(el,tid){
  document.querySelectorAll('#m-editar .modal-tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('#m-editar .modal-tp').forEach(t=>t.classList.remove('on'));
  document.getElementById(tid)?.classList.add('on');
  if(tid==='et-estq')updateEditNivelPreview();
  if(tid==='et-fin')updateEditMargem();
}

function updateEditNivelPreview(){
  const estq=parseFloat(document.getElementById('edit-estq')?.value)||0;
  const min=parseFloat(document.getElementById('edit-min')?.value)||0;
  const un=document.getElementById('edit-un')?.value||'';
  const prev=document.getElementById('edit-nivel-preview');
  if(prev) prev.innerHTML=`${sb(estq,min)}
    <span style="font-size:12px;color:var(--ink3);margin-left:8px">${estq} ${un} em estoque · mínimo ${min} ${un}</span>`;
}

function updateEditMargem(){
  const custo=parseFloat(document.getElementById('edit-custo')?.value)||0;
  const venda=parseFloat(document.getElementById('edit-venda')?.value)||0;
  const el=document.getElementById('edit-margem-info');
  if(!el)return;
  if(custo>0&&venda>0){
    const margem=((venda-custo)/venda*100).toFixed(1);
    const lucro=brl(venda-custo);
    el.innerHTML=`<span style="color:var(--ok)">Margem de lucro: <strong>${margem}%</strong></span> &nbsp;·&nbsp; Lucro por unidade: <strong>${lucro}</strong>`;
  } else {
    el.textContent='Preencha custo e preço de venda para ver a margem.';
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('edit-estq')?.addEventListener('input',updateEditNivelPreview);
  document.getElementById('edit-min')?.addEventListener('input',updateEditNivelPreview);
  document.getElementById('edit-custo')?.addEventListener('input',updateEditMargem);
  document.getElementById('edit-venda')?.addEventListener('input',updateEditMargem);
});

async function salvarEdicao(){
  if(!editando)return;
  const errEl=document.getElementById('edit-err');errEl.style.display='none';
  const oldTipo=getTipo(editando.grupo);
  if(!oldTipo)return;
  const idx=oldTipo.itens.findIndex(x=>x.id===editando.id);
  if(idx<0)return;

  const newTipoId=document.getElementById('edit-tipo-sel').value;
  const newTipo=getTipo(newTipoId);
  if(!newTipo){errEl.textContent='⚠ Tipo de estoque inválido.';errEl.style.display='flex';return;}

  const nome=document.getElementById('edit-nome').value.trim();
  const estq=parseFloat(document.getElementById('edit-estq').value)||0;
  const min=parseFloat(document.getElementById('edit-min').value)||0;
  const custo=round2(document.getElementById('edit-custo').value);

  const erros=[];
  if(!nome)erros.push('Nome é obrigatório.');
  if(estq<0)erros.push('Quantidade não pode ser negativa.');
  if(min<0)erros.push('Mínimo não pode ser negativo.');
  if(custo<0)erros.push('Custo não pode ser negativo.');
  if(erros.length){errEl.textContent='⚠ '+erros.join(' ');errEl.style.display='flex';return;}

  const updated={
    ...oldTipo.itens[idx],
    nome,
    cat:document.getElementById('edit-cat').value||oldTipo.itens[idx].cat,
    un:document.getElementById('edit-un').value||oldTipo.itens[idx].un,
    estq, min, custo,
    tipoId:newTipoId,
    tipo:newTipo.nome,
  };

  /* Conversão de embalagem */
  const usaConv=document.getElementById('edit-usa-conv')?.checked;
  const fatorConversao=parseFloat(document.getElementById('edit-fator')?.value)||0;
  const unCompra=document.getElementById('edit-un-compra')?.value||updated.un;
  if(usaConv&&fatorConversao>1){
    updated.unCompra=unCompra;
    updated.fatorConversao=fatorConversao;
  } else {
    delete updated.unCompra;
    delete updated.fatorConversao;
  }

  if(newTipo.campos.venda) updated.venda=parseFloat(document.getElementById('edit-venda').value)||updated.venda||0;
  if(newTipo.campos.local) updated.local=document.getElementById('edit-local')?.value||updated.local||'';
  if(newTipo.campos.forn) updated.forn=document.getElementById('edit-forn')?.value||updated.forn||'';
  if(newTipo.campos.val) updated.val=document.getElementById('edit-val')?.value||updated.val||'';

  /* Sanitize object for Firestore to avoid "undefined" field crashes */
  Object.keys(updated).forEach(k => { if(updated[k] === undefined) delete updated[k]; });

  try{
    const docId=oldTipo.itens[idx]._docId;
    if(docId){
      const {_docId, ...data} = updated;
      await db.collection('itens').doc(docId).update(data);
    }

    /* Move item between tipos if changed */
    if(newTipoId !== editando.grupo){
      oldTipo.itens.splice(idx,1);
      newTipo.itens.push(updated);
      toast(`✓ "${nome}" movido de ${oldTipo.icon} ${oldTipo.nome} → ${newTipo.icon} ${newTipo.nome}!`);
    } else {
      oldTipo.itens[idx]=updated;
      toast(`✓ "${nome}" atualizado com sucesso!`);
    }

    closeM('m-editar');
    rebuildEstoque();
    updateNotifs();
    editando=null;
  }catch(e){
    errEl.textContent='⚠ Erro ao salvar: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Exclusão (Admin) ── */
function confirmarExclusao(){
  if(!editando)return;
  const tipo=getTipo(editando.grupo);
  const item=tipo?.itens.find(x=>x.id===editando.id);
  document.getElementById('excl-nome').textContent=item?item.nome:'—';
  openM('m-excluir');
}

async function doExcluir(){
  if(!editando)return;
  const tipo=getTipo(editando.grupo);
  if(!tipo)return;
  const idx=tipo.itens.findIndex(x=>x.id===editando.id);
  const nome=tipo.itens[idx]?.nome||'Item';
  const docId=tipo.itens[idx]?._docId;
  if(docId) await db.collection('itens').doc(docId).delete();
  if(idx>=0)tipo.itens.splice(idx,1);
  closeM('m-excluir');closeM('m-editar');
  rebuildEstoque();updateNotifs();
  toast(`🗑 "${nome}" removido do estoque.`);
  editando=null;
}

/* ── Criar Novo Tipo ── */
function openNovoTipo(){
  ['nt-nome','nt-icon','nt-un','nt-cats'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('nt-icon').value='📦';
  document.getElementById('nt-un').value='un';
  document.getElementById('nt-local').checked=true;
  document.getElementById('nt-forn').checked=false;
  document.getElementById('nt-venda').checked=false;
  document.getElementById('nt-val').checked=true;
  document.getElementById('nt-err').style.display='none';
  openM('m-novo-tipo');
}

async function salvarNovoTipo(){
  const errEl=document.getElementById('nt-err');
  errEl.style.display='none';
  const nome=document.getElementById('nt-nome').value.trim();
  const icon=document.getElementById('nt-icon').value.trim()||'📦';
  const un=document.getElementById('nt-un').value.trim()||'un';
  const catsStr=document.getElementById('nt-cats').value.trim();

  const erros=[];
  if(!nome)erros.push('Nome do tipo é obrigatório.');
  if(nome.length<2)erros.push('Nome deve ter pelo menos 2 caracteres.');
  const id=nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_');
  if(TIPOS.find(t=>t.id===id))erros.push('Já existe um tipo com este nome.');
  if(!catsStr)erros.push('Informe ao menos uma categoria.');
  if(erros.length){errEl.textContent='⚠ '+erros.join(' ');errEl.style.display='flex';return;}

  const cats=catsStr.split(',').map(c=>c.trim()).filter(Boolean);

  const tipoData={
    id, nome, icon, un,
    campos:{
      local:document.getElementById('nt-local').checked,
      forn:document.getElementById('nt-forn').checked,
      venda:document.getElementById('nt-venda').checked,
      val:document.getElementById('nt-val').checked,
    },
    cats,
  };

  try{
    await db.collection('tipos').doc(id).set(tipoData);
    TIPOS.push({...tipoData, itens:[]});
    closeM('m-novo-tipo');
    rebuildEstoque();
    toast(`✓ Tipo "${nome}" criado! Agora cadastre itens neste tipo.`);
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Editar Tipo ── */
let editandoTipoId=null;

function openEditTipo(tipoId){
  const tipo=getTipo(tipoId);
  if(!tipo)return;
  editandoTipoId=tipoId;

  document.getElementById('et-orig-id').value=tipoId;
  document.getElementById('et-sub').textContent=`Editando: ${tipo.icon} ${tipo.nome}`;
  document.getElementById('et-nome').value=tipo.nome;
  document.getElementById('et-icon').value=tipo.icon;
  document.getElementById('et-un').value=tipo.un;
  document.getElementById('et-cats').value=tipo.cats.join(', ');

  document.getElementById('et-local').checked=!!tipo.campos.local;
  document.getElementById('et-forn').checked=!!tipo.campos.forn;
  document.getElementById('et-venda').checked=!!tipo.campos.venda;
  document.getElementById('et-val').checked=!!tipo.campos.val;

  document.getElementById('et-err').style.display='none';

  /* Show delete button only for admin */
  document.getElementById('btn-excluir-tipo').style.display=SESSION.role==='adm'?'':'none';

  openM('m-edit-tipo');
}

async function salvarEdicaoTipo(){
  const errEl=document.getElementById('et-err');
  errEl.style.display='none';
  if(!editandoTipoId)return;

  const tipo=getTipo(editandoTipoId);
  if(!tipo)return;

  const nome=document.getElementById('et-nome').value.trim();
  const icon=document.getElementById('et-icon').value.trim()||'📦';
  const un=document.getElementById('et-un').value.trim()||'un';
  const catsStr=document.getElementById('et-cats').value.trim();

  const erros=[];
  if(!nome)erros.push('Nome do tipo é obrigatório.');
  if(nome.length<2)erros.push('Nome deve ter pelo menos 2 caracteres.');
  if(!catsStr)erros.push('Informe ao menos uma categoria.');
  if(erros.length){errEl.textContent='⚠ '+erros.join(' ');errEl.style.display='flex';return;}

  const cats=catsStr.split(',').map(c=>c.trim()).filter(Boolean);
  const campos={
    local:document.getElementById('et-local').checked,
    forn:document.getElementById('et-forn').checked,
    venda:document.getElementById('et-venda').checked,
    val:document.getElementById('et-val').checked,
  };

  try{
    await db.collection('tipos').doc(tipo._docId).update({nome, icon, un, cats, campos});

    tipo.nome=nome;
    tipo.icon=icon;
    tipo.un=un;
    tipo.cats=cats;
    tipo.campos=campos;

    closeM('m-edit-tipo');
    rebuildEstoque();
    toast(`✓ Tipo "${nome}" atualizado!`);
    editandoTipoId=null;
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Excluir Tipo ── */
function confirmarExcluirTipo(){
  if(!editandoTipoId)return;
  const tipo=getTipo(editandoTipoId);
  if(!tipo)return;
  document.getElementById('del-tipo-nome').textContent=`${tipo.icon} ${tipo.nome}`;
  document.getElementById('del-tipo-count').textContent=`Este tipo possui ${tipo.itens.length} item(ns) cadastrado(s).`;
  openM('m-del-tipo');
}

async function doExcluirTipo(){
  if(!editandoTipoId)return;
  const tipo=getTipo(editandoTipoId);
  if(!tipo)return;
  const nome=tipo.nome;

  try{
    /* Delete all items of this type from Firestore */
    for(const item of tipo.itens){
      if(item._docId) await db.collection('itens').doc(item._docId).delete();
    }

    /* Delete the type document */
    await db.collection('tipos').doc(tipo._docId).delete();

    /* Remove from local array */
    const idx=TIPOS.findIndex(t=>t.id===editandoTipoId);
    if(idx>=0)TIPOS.splice(idx,1);

    editandoTipoId=null;
    closeM('m-del-tipo');
    closeM('m-edit-tipo');
    rebuildEstoque();
    updateNotifs();
    toast(`🗑️ Tipo "${nome}" e todos os seus itens foram removidos.`);
  }catch(e){
    toast(`⚠ Erro ao excluir: ${e.message}`);
  }
}

