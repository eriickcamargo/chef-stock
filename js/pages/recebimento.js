/* ══════════════════════════════════════════════════
   PAGE: Recebimento — Manual multi-item + XML NF-e
   Features: F1 Modal insumo, F3 Edit/Delete NF,
             F4 Valor calculado, F7 Multi-local,
             F11 Chave de acesso
══════════════════════════════════════════════════ */

let recebItens = []; /* itens adicionados no modo manual */
let xmlNfData = null; /* dados parseados do XML */
let editandoReceb = null; /* docId da NF em edição (F3) */

/* ══════════════════════════════════════
   TABELA DE RECEBIMENTOS (com ações F3)
══════════════════════════════════════ */
function mkReceb(){
  if(SESSION?.role!=='adm') return mkPg('receb');
  const pg=mkPg('receb');
  pg.innerHTML=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
      <button class="btn btn-r" onclick="openReceb()">+ Registrar Recebimento</button>
    </div>
    <div class="panel"><div class="tw receb-table-wrap"><table>
      <thead><tr><th>NF/Ref.</th><th>Fornecedor</th><th>Itens</th><th>Valor</th><th>Destino</th><th>Data/Hora</th><th>Recebedor</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody id="tb-receb">${recebRows()}</tbody>
    </table></div></div>`;
  return pg;
}

function recebRows(){
  return recebimentos.map(r=>`<tr>
    <td data-label="NF/Ref."><span class="chip">${r.ref}</span></td>
    <td data-label="Fornecedor">${r.forn}</td>
    <td data-label="Itens">${r.itens}</td>
    <td data-label="Valor" style="font-family:'DM Mono',monospace">${brl(r.valor)}</td>
    <td data-label="Destino"><span class="bdg bin">${r.dest}</span></td>
    <td data-label="Data/Hora" style="font-family:'DM Mono',monospace;font-size:11px">${r.data}</td>
    <td data-label="Recebedor">${r.rec}</td>
    <td data-label="Status"><span class="bdg bok">✓ Recebido</span></td>
    <td data-label="Ações" style="white-space:nowrap">
      <button class="btn btn-g btn-xs" onclick="openEditReceb('${r._docId}')" title="Editar">✏️</button>
      <button class="btn btn-er btn-xs" onclick="excluirReceb('${r._docId}')" title="Excluir" style="margin-left:4px">🗑️</button>
    </td>
  </tr>`).join('');
}

/* ── F3: Editar NF ── */
let editandoRecebId = null;

function openEditReceb(docId){
  const r=recebimentos.find(x=>x._docId===docId);
  if(!r)return;
  const usada=producoes.some(p=>p.insumos?.some(ins=>ins.recebDocId===docId));
  if(usada){toast('⚠ Esta NF foi utilizada em uma produção e não pode ser editada.');return;}
  if(!r.detalhes || r.detalhes.length===0){
    toast('⚠ Esta nota é muito antiga e não tem os dados detalhados para edição.');return;
  }
  
  editandoRecebId = docId;
  const titleEl = document.getElementById('m-receb-title');
  if(titleEl) titleEl.textContent = '✏️ Editar Recebimento: ' + (r.ref||'');
  
  document.getElementById('r-nf').value=r.ref||'';
  document.getElementById('r-forn').value=r.forn||'';
  document.getElementById('r-dest').value=r.dest||'';
  document.getElementById('r-obs').value=r.obs||'';
  document.getElementById('r-err').style.display='none';
  
  const saveBtn = document.getElementById('receb-btn-save');
  if(saveBtn) saveBtn.textContent = '✓ Salvar Alterações';
  
  const xmlTab = document.getElementById('receb-tab-xml');
  if(xmlTab) xmlTab.style.display = 'none';
  
  /* Clonar detalhes para recebItens */
  recebItens = r.detalhes.map(d => ({
    prodId: String(d.id),
    qtd: parseFloat(d.qtd)||0,
    valor: parseFloat(d.valor)||0,
    validade: d.validade||'',
    distribuicao: d.distribuicao ? JSON.parse(JSON.stringify(d.distribuicao)) : []
  }));
  
  renderRecebItens();
  
  /* Forçar aba manual */
  const tabs=document.querySelectorAll('#m-receb .tabs .tab');
  tabs.forEach(t=>t.classList.remove('on'));
  tabs[0]?.classList.add('on');
  document.getElementById('rm-manual').classList.add('on');
  document.getElementById('rm-xml').classList.remove('on');
  openM('m-receb');
}

/* ── F3: Excluir NF ── */
async function excluirReceb(docId){
  const r=recebimentos.find(x=>x._docId===docId);
  if(!r)return;
  /* Verificar se usada em produção ou solicitação */
  const usadaNaProducao=producoes.some(p=>
    p.insumos?.some(ins=>ins.recebDocId===docId)
  );
  if(usadaNaProducao){
    toast('⚠ Esta NF foi utilizada em uma ficha de produção e não pode ser excluída.');return;
  }
  
  if(!r.detalhes || r.detalhes.length===0){
    if(!confirm(`⚠️ AVISO: Esta nota é antiga e não possui o detalhamento salvo.\nA nota será excluída, mas O ESTOQUE NÃO SERÁ REVERTIDO automaticamente.\n\nDeseja excluir a nota mesmo assim?`)) return;
  } else {
    if(!confirm(`Excluir o recebimento "${r.ref}"?\nO estoque dos itens vinculados será revertido.`)) return;
  }

  try{
    toast('⏳ Revertendo estoque...', 2000);
    const all = getAllItems();
    
    if(r.detalhes && r.detalhes.length>0){
      for(const det of r.detalhes){
        const item = all.find(x=>String(x.id) === String(det.id));
        if(!item) continue;
        
        item.estq = Math.max(0, (item.estq || 0) - (det.qtd || 0));
        
        if(det.distribuicao && det.distribuicao.length>0 && item.distribuicao){
          det.distribuicao.forEach(d => {
            const loc = item.distribuicao.find(x=>x.local === d.local);
            if(loc) loc.qtd = Math.max(0, (loc.qtd || 0) - (d.qtd || 0));
          });
          item.distribuicao = item.distribuicao.filter(x=>x.qtd>0);
        }
        
        if(item._docId) {
          await db.collection('itens').doc(item._docId).update({
            estq: item.estq,
            distribuicao: item.distribuicao || []
          });
        }
      }
    }
    
    await db.collection('recebimentos').doc(docId).delete();
    recebimentos=recebimentos.filter(x=>x._docId!==docId);
    const tb=document.getElementById('tb-receb');if(tb)tb.innerHTML=recebRows();
    if(typeof rebuildEstoque==='function') rebuildEstoque();
    if(typeof updateNotifs==='function') updateNotifs();
    toast(`🗑️ Recebimento ${r.ref} excluído e estoque revertido.`);
  }catch(e){toast('⚠ Erro ao excluir: '+e.message);}
}

/* ── Abrir modal ── */
function openReceb(){
  editandoRecebId = null;
  recebItens=[];
  
  const titleEl = document.getElementById('m-receb-title');
  if(titleEl) titleEl.textContent = 'Registrar Recebimento';
  
  document.getElementById('r-nf').value='';
  document.getElementById('r-obs').value='';
  document.getElementById('r-forn').value='';
  document.getElementById('r-dest').value='';
  document.getElementById('r-err').style.display='none';
  
  const saveBtn = document.getElementById('receb-btn-save');
  if(saveBtn) saveBtn.textContent = '✓ Confirmar Recebimento';
  
  const xmlTab = document.getElementById('receb-tab-xml');
  if(xmlTab) xmlTab.style.display = '';
  
  renderRecebItens();
  addRecebItem(); /* já começa com 1 linha */
  resetXmlMode();
  /* Reset para tab manual */
  const tabs=document.querySelectorAll('#m-receb .tabs .tab');
  tabs.forEach(t=>t.classList.remove('on'));
  tabs[0]?.classList.add('on');
  document.getElementById('rm-manual').classList.add('on');
  document.getElementById('rm-xml').classList.remove('on');
  openM('m-receb');
}

/* ── Tab switch ── */
function recebModo(el, tid){
  const tabs=el.closest('.tabs');
  tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  let s=tabs.nextElementSibling;
  while(s&&s.classList.contains('tp')){s.classList.remove('on');s=s.nextElementSibling;}
  document.getElementById(tid)?.classList.add('on');
}

/* ══════════════════════════════════════════
   MODO MANUAL — Multi-item
══════════════════════════════════════════ */

function buildProdOptions(){
  return '<option value="">Selecione o produto...</option>'+
    `<option value="__novo__" style="font-weight:700;color:var(--ok)">➕ Criar Novo Item</option>`+
    TIPOS.map(t=>
      t.itens.length?`<optgroup label="${t.icon} ${t.nome}">${t.itens.map(i=>{
        const convLabel=i.fatorConversao&&i.fatorConversao>1?` [${i.unCompra||'pct'}→${i.un}]`:'';
        return `<option value="${i.id}" data-un="${i.unCompra||i.un}" data-fator="${i.fatorConversao||1}">${i.nome}${convLabel}</option>`;
      }).join('')}</optgroup>`:''
    ).join('');
}

function addRecebItem(){
  const idx=recebItens.length;
  recebItens.push({prodId:'',qtd:0,valor:0,validade:'',distribuicao:[]});
  renderRecebItens();
}

function removeRecebItem(idx){
  recebItens.splice(idx,1);
  renderRecebItens();
  updateRecebTotals();
}

function renderRecebItens(){
  const list=document.getElementById('r-itens-list');
  if(!list)return;
  const opts=buildProdOptions();
  list.innerHTML=recebItens.map((it,i)=>{
    /* Determinar unidade a exibir */
    const all=getAllItems();
    const itemRef=it.prodId?all.find(x=>String(x.id)===String(it.prodId)):null;
    const fator=itemRef?.fatorConversao||1;
    const unCompra=itemRef?.unCompra||itemRef?.un||'un';
    const unConsumo=itemRef?.un||'un';
    const hasConv=fator>1;
    return `
    <div style="margin-bottom:10px;padding:12px;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2)">
      <div style="display:grid;grid-template-columns:1fr ${hasConv?'100px 120px':''} 100px 120px 120px 32px;gap:8px;align-items:end;margin-bottom:8px">
        <div class="fg" style="margin:0">
          <label class="fl" style="font-size:11px">Produto</label>
          <select class="fc" onchange="onManualProdChange(${i},this.value)" style="font-size:12px">
            ${opts}
          </select>
        </div>
        <div class="fg" style="margin:0">
          <label class="fl" style="font-size:11px">${hasConv?`Qtd. (${unCompra})`:'Qtd.'}</label>
          <input class="fc" type="number" min="0" step="0.001" value="${it.qtd||''}" placeholder="0"
            oninput="recebItens[${i}].qtd=parseFloat(this.value)||0;updateRecebTotals();atualizarContadorDistrib('r',${i})" style="font-size:12px">
          ${hasConv?`<span class="field-hint" style="font-size:10px;color:var(--pr)">= <span id="r-qtd-conv-${i}">${it.qtd?((it.qtd*fator).toFixed(0)):0}</span> ${unConsumo} no estoque</span>`:''}
        </div>
        <div class="fg" style="margin:0">
          <label class="fl" style="font-size:11px">Valor (R$)</label>
          <input class="fc" type="number" min="0" step="0.01" value="${it.valor||''}" placeholder="0,00"
            oninput="recebItens[${i}].valor=parseFloat(this.value)||0;updateRecebTotals()" style="font-size:12px">
        </div>
        <div class="fg" style="margin:0">
          <label class="fl" style="font-size:11px">Validade</label>
          <input class="fc" type="date" value="${it.validade||''}" onchange="recebItens[${i}].validade=this.value" style="font-size:12px">
        </div>
        <button class="btn btn-er btn-xs" onclick="removeRecebItem(${i})" style="margin-bottom:2px" title="Remover">✕</button>
      </div>
      <!-- F7: Distribuição por local -->
      <div style="border-top:1px dashed var(--bdr);padding-top:8px;margin-top:4px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:11px;color:var(--ink3)">📍 Alocar em locais <span id="r-distrib-counter-${i}" style="color:var(--pr);font-weight:600"></span></span>
          <button class="btn btn-g btn-xs" onclick="addDistribLocal('r',${i})">+ Local</button>
        </div>
        <div id="r-distrib-list-${i}"></div>
      </div>
    </div>
  `}).join('');

  /* Selecionar os valores já escolhidos */
  const selects=list.querySelectorAll('select');
  selects.forEach((sel,i)=>{if(recebItens[i]?.prodId)sel.value=recebItens[i].prodId;});

  /* Renderizar distribuição existente */
  recebItens.forEach((_,i)=>renderDistribList('r',i));
  updateRecebTotals();
}

/* ── Handler de Produto Manual ── */
function onManualProdChange(idx, val){
  if(val==='__novo__'){
    openNovoInsumoModal('manual', idx);
    /* reset select back to empty temporarily */
    recebItens[idx].prodId = '';
  }else{
    recebItens[idx].prodId = val;
  }
  updateRecebTotals();
  renderRecebItens();
}

/* ── F7: Distribuição por local ── */
function addDistribLocal(mode,idx){
  const arr=mode==='r'?recebItens:xmlNfData?.itens;
  if(!arr)return;
  const item=arr[idx];
  if(!item.distribuicao)item.distribuicao=[];
  item.distribuicao.push({local:locais.length?locais[0].nome:'',qtd:0});
  renderDistribList(mode,idx);
  atualizarContadorDistrib(mode,idx);
}

function removeDistribLocal(mode,idx,lIdx){
  const arr=mode==='r'?recebItens:xmlNfData?.itens;
  if(!arr)return;
  const item=arr[idx];
  item.distribuicao.splice(lIdx,1);
  renderDistribList(mode,idx);
  atualizarContadorDistrib(mode,idx);
}

function renderDistribList(mode,idx){
  const listEl=document.getElementById(`${mode}-distrib-list-${idx}`);
  if(!listEl)return;
  const arr=mode==='r'?recebItens:xmlNfData?.itens;
  if(!arr)return;
  const item=arr[idx];
  const distrib=item.distribuicao||[];
  const locOpts=locais.map(l=>`<option value="${l.nome}">${l.nome} (${l.setor})</option>`).join('');
  if(!distrib.length){
    listEl.innerHTML='<div style="font-size:11px;color:var(--ink3);padding:2px 0">Sem alocação específica — irá para o local padrão da NF</div>';
    return;
  }
  listEl.innerHTML=distrib.map((d,lIdx)=>`
    <div style="display:grid;grid-template-columns:1fr 100px 28px;gap:6px;align-items:center;margin-bottom:4px">
      <select class="fc" style="font-size:11px" onchange="setDistribLocal('${mode}',${idx},${lIdx},'local',this.value)">
        ${locOpts}
      </select>
      <input class="fc" type="number" min="0" step="0.5" value="${d.qtd||''}" placeholder="Qtd."
        style="font-size:11px" oninput="setDistribLocal('${mode}',${idx},${lIdx},'qtd',parseFloat(this.value)||0);atualizarContadorDistrib('${mode}',${idx})">
      <button class="btn btn-er btn-xs" onclick="removeDistribLocal('${mode}',${idx},${lIdx})" title="Remover">✕</button>
    </div>
  `).join('');
  /* Set select values */
  const sels=listEl.querySelectorAll('select');
  sels.forEach((sel,lIdx)=>{if(distrib[lIdx])sel.value=distrib[lIdx].local;});
}

function setDistribLocal(mode,idx,lIdx,field,val){
  const arr=mode==='r'?recebItens:xmlNfData?.itens;
  if(!arr)return;
  arr[idx].distribuicao[lIdx][field]=val;
}

function atualizarContadorDistrib(mode,idx){
  const counterEl=document.getElementById(`${mode}-distrib-counter-${idx}`);
  if(!counterEl)return;
  const arr=mode==='r'?recebItens:xmlNfData?.itens;
  if(!arr)return;
  const item=arr[idx];
  const qtdTotal=mode==='r'?item.qtd:item.qtd;
  const distrib=item.distribuicao||[];
  const alocado=distrib.reduce((s,d)=>s+(d.qtd||0),0);
  if(!distrib.length){counterEl.textContent='';return;}
  const ok=Math.abs(alocado-qtdTotal)<0.001;
  counterEl.textContent=`(${alocado}/${qtdTotal})`;
  counterEl.style.color=alocado>qtdTotal?'var(--er)':ok?'var(--ok)':'var(--wa)';
}

function updateRecebTotals(){
  const valid=recebItens.filter(it=>it.prodId&&it.qtd>0);
  const total=recebItens.reduce((s,it)=>s+(it.valor||0),0);
  const cnt=document.getElementById('r-total-count');
  const val=document.getElementById('r-total-valor');
  if(cnt)cnt.textContent=valid.length;
  if(val)val.textContent=brl(total);
}

async function doRecebManual(){
  const errEl=document.getElementById('r-err');
  errEl.style.display='none';
  const valid=recebItens.filter(it=>it.prodId&&it.qtd>0);
  if(!valid.length){
    errEl.textContent='⚠ Adicione pelo menos 1 item com produto e quantidade.';
    errEl.style.display='flex';return;
  }

  /* F7: Validar distribuição */
  for(const it of valid){
    if(it.distribuicao&&it.distribuicao.length>0){
      const alocado=it.distribuicao.reduce((s,d)=>s+(d.qtd||0),0);
      if(alocado>it.qtd+0.001){
        errEl.textContent=`⚠ A alocação de um item excede a quantidade disponível na nota (${alocado} > ${it.qtd}).`;
        errEl.style.display='flex';return;
      }
    }
  }

  const ref=document.getElementById('r-nf')?.value||'NF-'+Date.now().toString().slice(-5);
  const forn=document.getElementById('r-forn')?.value||'—';
  const dest=document.getElementById('r-dest')?.value||'—';
  const obs=document.getElementById('r-obs')?.value||'';
  /* F4: valor calculado pelos itens válidos */
  const total=valid.reduce((s,it)=>s+(it.valor||0),0);
  const now=new Date();
  
  let oldR = null;
  if(editandoRecebId) oldR = recebimentos.find(x=>x._docId===editandoRecebId);
  // Se for edição, preserva data/ts originais. Caso contrário gera nova data com ano.
  const data = oldR
    ? oldR.data
    : (now.getDate().toString().padStart(2,'0')+'/'+(now.getMonth()+1).toString().padStart(2,'0')+'/'+now.getFullYear()+' '+now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0'));
  const tsField = oldR ? {} : { ts: firebase.firestore.FieldValue.serverTimestamp() };

  /* Atualizar estoque local + Firestore */
  const all = getAllItems();
  const modifiedItems = new Set();
  
  /* Se for edição, primeiro revertemos o payload antigo na memória */
  if(oldR && oldR.detalhes){
    for(const det of oldR.detalhes){
      const oldItem = all.find(x=>String(x.id)===String(det.id));
      if(!oldItem) continue;
      modifiedItems.add(oldItem);
      oldItem.estq = Math.max(0, (oldItem.estq || 0) - (det.qtd || 0));
      if(det.distribuicao && det.distribuicao.length>0 && oldItem.distribuicao){
        det.distribuicao.forEach(d => {
          const loc = oldItem.distribuicao.find(x=>x.local === d.local);
          if(loc) loc.qtd = Math.max(0, (loc.qtd || 0) - (d.qtd || 0));
        });
        oldItem.distribuicao = oldItem.distribuicao.filter(x=>x.qtd>0);
      }
    }
  }

  /* Agora aplicamos o novo payload na memória */
  for(const it of valid){
    const item = all.find(x=>x.id===parseInt(it.prodId));
    if(item){
      modifiedItems.add(item);
      /* Aplicar fator de conversão: a qtd registrada em recebItens é na unidade de COMPRA */
      const fator = item.fatorConversao||1;
      const qtdConsumo = it.qtd * fator; /* qtd em unidade de consumo/estoque */
      item.estq = (item.estq||0) + qtdConsumo;

      if(it.qtd>0 && it.valor>0){
        /* Custo por unidade de CONSUMO = valor_da_embalagem / (qtd_embalagens * fator) */
        item.custo = round2(it.valor / (it.qtd * fator));
      }

      if(it.distribuicao&&it.distribuicao.length>0){
        if(!item.distribuicao)item.distribuicao=[];
        /* Distribuicao também precisa ser convertida */
        it.distribuicao.forEach(d=>{
          if(!d.qtd)return;
          const dQtdConsumo = d.qtd * fator;
          const existing=item.distribuicao.find(x=>x.local===d.local);
          if(existing)existing.qtd=(existing.qtd||0)+dQtdConsumo;
          else item.distribuicao.push({local:d.local,qtd:dQtdConsumo});
        });
      }
    }
  }

  /* Firestore save para os itens que foram tocados */
  for(const item of modifiedItems){
    if(item._docId){
      await db.collection('itens').doc(item._docId).update({
        estq: item.estq,
        custo: item.custo,
        distribuicao: item.distribuicao || []
      });
    }
  }

  const recebData={
    ref, forn, obs, itens:valid.length, valor:total, dest, data, rec:SESSION.name,
    ...tsField,
    detalhes: valid.map(it => ({ id: it.prodId, qtd: it.qtd, valor: it.valor||0, validade: it.validade||'', distribuicao: it.distribuicao || [] }))
  };
  
  let recebDocId;
  if(editandoRecebId){
    await db.collection('recebimentos').doc(editandoRecebId).update(recebData);
    const rIdx=recebimentos.findIndex(x=>x._docId===editandoRecebId);
    if(rIdx>=0) recebimentos[rIdx]={_docId:editandoRecebId,...recebData};
    recebDocId = editandoRecebId;
    editandoRecebId=null;
    toast(`✓ Recebimento ${ref} editado — ${valid.length} item(ns), estoque ajustado!`);
  } else {
    const docRef=await db.collection('recebimentos').add(recebData);
    recebimentos.unshift({_docId:docRef.id,...recebData});
    recebDocId = docRef.id;
    toast(`✓ Recebimento ${ref} registrado — ${valid.length} item(ns), estoque atualizado!`);
  }

  /* ── F12: Gravar histórico de preços por item ── */
  for(const it of valid){
    const item = all.find(x=>x.id===parseInt(it.prodId));
    if(item&&item._docId&&it.qtd>0&&it.valor>0){
      const fator = item.fatorConversao||1;
      const custoUn = round2(it.valor/(it.qtd*fator));
      salvarPrecoHistorico(item._docId, {fornecedor:forn, valor:custoUn, data, recebDocId});
    }
  }
  
  const tb=document.getElementById('tb-receb');if(tb)tb.innerHTML=recebRows();
  rebuildEstoque();
  updateNotifs();
  closeM('m-receb');
}

/* ══════════════════════════════════════════
   MODO XML — NF-e Parser
══════════════════════════════════════════ */

function resetXmlMode(){
  xmlNfData=null;
  document.getElementById('xml-drop-zone').style.display='';
  document.getElementById('xml-info').style.display='none';
  document.getElementById('xml-file-input').value='';
  document.getElementById('xml-err') && (document.getElementById('xml-err').style.display='none');
}

function handleXmlFile(file){
  if(!file)return;
  if(!file.name.endsWith('.xml')){
    toast('⚠ Selecione um arquivo .xml');return;
  }
  const reader=new FileReader();
  reader.onload=function(e){
    try{ parseNfe(e.target.result); }
    catch(err){ toast('⚠ Erro ao ler XML: '+err.message); }
  };
  reader.readAsText(file);
}

function parseNfe(xmlStr){
  const parser=new DOMParser();
  const doc=parser.parseFromString(xmlStr,'text/xml');

  /* Detectar namespace */
  const ns=doc.documentElement.namespaceURI||'';
  const nsResolver=ns?(tag)=>doc.getElementsByTagNameNS(ns,tag):
                       (tag)=>doc.getElementsByTagName(tag);

  /* Dados do cabeçalho */
  const ide=nsResolver('ide')[0];
  const emit=nsResolver('emit')[0];
  const nNF=ide?getText(ide,'nNF',ns):'';
  const serie=ide?getText(ide,'serie',ns):'';
  const dhEmi=ide?getText(ide,'dhEmi',ns)||getText(ide,'dEmi',ns):'';
  const emitNome=emit?getText(emit,'xNome',ns):'';
  const emitCNPJ=emit?getText(emit,'CNPJ',ns):'';

  /* F11: Chave de acesso */
  const infNFe=nsResolver('infNFe')[0];
  let chNFe='';
  if(infNFe){
    const idAttr=infNFe.getAttribute('Id')||'';
    chNFe=idAttr.replace(/^NFe/,'');
  }
  if(!chNFe){
    const chEl=nsResolver('chNFe')[0];
    if(chEl)chNFe=chEl.textContent.trim();
  }

  /* Itens (det) */
  const dets=nsResolver('det');
  const itens=[];
  for(let i=0;i<dets.length;i++){
    const det=dets[i];
    const prod=ns?det.getElementsByTagNameNS(ns,'prod')[0]:det.getElementsByTagName('prod')[0];
    if(!prod)continue;
    const nome=getText(prod,'xProd',ns);
    const ncm=getText(prod,'NCM',ns);
    const un=getText(prod,'uCom',ns)||getText(prod,'uTrib',ns)||'un';
    const qtd=parseFloat(getText(prod,'qCom',ns)||getText(prod,'qTrib',ns))||0;
    const vUnit=parseFloat(getText(prod,'vUnCom',ns)||getText(prod,'vUnTrib',ns))||0;
    const vTotal=parseFloat(getText(prod,'vProd',ns))||0;
    const cProd=getText(prod,'cProd',ns);
    itens.push({nome,ncm,un:normalizeUn(un),qtd,vUnit,vTotal,cProd,matchId:'',distribuicao:[]});
  }

  /* F4: valor real calculado dos itens (usado após conciliação) */
  const icmsTot=nsResolver('ICMSTot')[0];
  const vNF=icmsTot?parseFloat(getText(icmsTot,'vNF',ns)):itens.reduce((s,i)=>s+i.vTotal,0);

  xmlNfData={nNF,serie,dhEmi,emitNome,emitCNPJ,itens,vNF,chNFe};

  /* Auto-match: tentar encontrar itens no estoque */
  autoMatchXml();

  /* Renderizar */
  renderXmlInfo();
}

function getText(parent,tagName,ns){
  const els=ns?parent.getElementsByTagNameNS(ns,tagName):parent.getElementsByTagName(tagName);
  return els.length?els[0].textContent.trim():'';
}

function normalizeUn(un){
  const n=un.toLowerCase().trim();
  const map={'kg':'kg','kgs':'kg','g':'kg','l':'L','lt':'L','ml':'L','un':'un','und':'un','unid':'un','cx':'cx','pct':'pct','pc':'un','pç':'un','pca':'un'};
  return map[n]||un;
}

function autoMatchXml(){
  if(!xmlNfData)return;
  const all=getAllItems();
  xmlNfData.itens.forEach(xmlItem=>{
    /* Buscar match por nome (fuzzy) */
    const nomeNorm=xmlItem.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    let best=null, bestScore=0;
    all.forEach(item=>{
      const itemNorm=item.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      /* Substring match */
      if(nomeNorm.includes(itemNorm)||itemNorm.includes(nomeNorm)){
        const score=Math.min(nomeNorm.length,itemNorm.length)/Math.max(nomeNorm.length,itemNorm.length);
        if(score>bestScore){bestScore=score;best=item;}
      }
      /* Word overlap */
      const words1=nomeNorm.split(/\s+/);
      const words2=itemNorm.split(/\s+/);
      const overlap=words1.filter(w=>words2.some(w2=>w2.includes(w)||w.includes(w2))).length;
      const wordScore=overlap/Math.max(words1.length,words2.length);
      if(wordScore>bestScore){bestScore=wordScore;best=item;}
    });
    if(best&&bestScore>=0.4) xmlItem.matchId=String(best.id);
  });
}

function renderXmlInfo(){
  if(!xmlNfData)return;
  document.getElementById('xml-drop-zone').style.display='none';
  document.getElementById('xml-info').style.display='';

  const d=xmlNfData;
  const dataFormatada=d.dhEmi?new Date(d.dhEmi).toLocaleDateString('pt-BR'):'—';

  /* F11: Exibir chave de acesso formatada */
  const chaveFormatada=d.chNFe?d.chNFe.replace(/(\d{4})(?=\d)/g,'$1 ').trim():'—';
  const chaveHtml=d.chNFe
    ?`<div style="margin-top:6px;font-size:11px;color:var(--ink3)">🔑 Chave: <span style="font-family:'DM Mono',monospace;font-size:10px;word-break:break-all">${chaveFormatada}</span></div>`
    :'';

  /* Check if supplier exists */
  const nomeNorm=(d.emitNome||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const fornExistente=fornecedores.find(f=>{
    const fNorm=f.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(fNorm===nomeNorm) return true;
    if(d.emitCNPJ && f.cnpj && f.cnpj===d.emitCNPJ) return true;
    if(nomeNorm.length>3 && fNorm.length>3 && (nomeNorm.includes(fNorm)||fNorm.includes(nomeNorm))) return true;
    return false;
  });

  const fornStatus=fornExistente
    ?`<div class="al al-ok" style="margin:10px 0">✅ Fornecedor <strong>"${fornExistente.nome}"</strong> já cadastrado no sistema.</div>`
    :`<div id="xml-forn-register" style="margin:10px 0">
        <div class="al al-wa" style="margin-bottom:8px">⚠️ Fornecedor <strong>"${d.emitNome||'Desconhecido'}"</strong> não encontrado no sistema. Cadastre antes de prosseguir.</div>
        <div style="padding:12px;background:var(--bg);border:1px dashed var(--bdr);border-radius:var(--r2)">
          <div style="font-size:12px;font-weight:600;color:var(--pr);margin-bottom:8px">📝 Cadastrar Fornecedor</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="fg" style="margin:0">
              <label class="fl" style="font-size:10px">Nome *</label>
              <input class="fc" id="xml-forn-nome" style="font-size:12px" value="${d.emitNome||''}">
            </div>
            <div class="fg" style="margin:0">
              <label class="fl" style="font-size:10px">CNPJ</label>
              <input class="fc" id="xml-forn-cnpj" style="font-size:12px" value="${d.emitCNPJ||''}" placeholder="00.000.000/0000-00">
            </div>
            <div class="fg" style="margin:0">
              <label class="fl" style="font-size:10px">Contato</label>
              <input class="fc" id="xml-forn-contato" style="font-size:12px" placeholder="Telefone ou e-mail">
            </div>
            <div class="fg" style="margin:0">
              <label class="fl" style="font-size:10px">Observações</label>
              <input class="fc" id="xml-forn-obs" style="font-size:12px" placeholder="Ex: Distribuidor regional">
            </div>
          </div>
          <div id="xml-forn-err" class="al al-er" style="display:none;margin-top:6px"></div>
          <div style="margin-top:10px;text-align:right">
            <button class="btn btn-r btn-sm" onclick="cadastrarFornNf()">✓ Cadastrar Fornecedor</button>
          </div>
        </div>
      </div>`;

  document.getElementById('xml-header-info').innerHTML=`
    ✅ NF-e importada com sucesso!<br>
    <span style="font-size:12px">
      <strong>NF:</strong> ${d.nNF||'—'} · <strong>Série:</strong> ${d.serie||'—'} ·
      <strong>Emissão:</strong> ${dataFormatada} ·
      <strong>Emitente:</strong> ${d.emitNome||'—'} ${d.emitCNPJ?`(${d.emitCNPJ})`:''}
    </span>
    ${chaveHtml}
    ${fornStatus}`;

  /* Hide items section if supplier not registered */
  const xmlItensSection=document.getElementById('xml-itens-section');
  if(xmlItensSection) xmlItensSection.style.display=fornExistente?'':'none';

  /* Itens match list */
  const all=getAllItems();
  const opts='<option value="">— Sem vínculo —</option>'+
    `<option value="__novo__" style="font-weight:700;color:var(--ok)">➕ Criar Novo Item</option>`+
    TIPOS.map(t=>t.itens.length?`<optgroup label="${t.icon} ${t.nome}">${t.itens.map(i=>`<option value="${i.id}">${i.nome} (${i.estq} ${i.un})</option>`).join('')}</optgroup>`:'').join('');

  /* Tipo options for new item creation — F1 uses modal now */
  const tipoOpts=TIPOS.map(t=>`<option value="${t.id}">${t.icon} ${t.nome}</option>`).join('');

  document.getElementById('xml-itens-match').innerHTML=d.itens.map((it,i)=>`
    <div style="padding:10px 12px;margin-bottom:6px;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2)">
      <div style="display:grid;grid-template-columns:1fr 80px 90px 1fr;gap:8px;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:500">${it.nome}</div>
          <div style="font-size:11px;color:var(--ink3)">${it.cProd?`Cód: ${it.cProd} · `:''}NCM: ${it.ncm||'—'}</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;text-align:center">
          ${it.qtd} ${it.un}
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--ok)">
          ${brl(it.vTotal)}
        </div>
        <div>
          <select class="fc xml-match-sel" data-idx="${i}" style="font-size:12px" onchange="onXmlMatchChange(${i},this.value)">
            ${opts}
          </select>
        </div>
      </div>
      <!-- F1: Banner de novo insumo salvo -->
      <div id="xml-novo-saved-${i}" style="display:none;margin-top:6px">
        <div class="al al-ok" style="font-size:12px;padding:6px 10px">✅ Novo insumo salvo — selecione-o acima para vincular.</div>
      </div>
      <!-- F7: Distribuição por local para cada item XML -->
      <div style="border-top:1px dashed var(--bdr);padding-top:8px;margin-top:8px" id="xml-distrib-section-${i}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:11px;color:var(--ink3)">📍 Alocar em locais <span id="xml-distrib-counter-${i}" style="color:var(--pr);font-weight:600"></span></span>
          <button class="btn btn-g btn-xs" onclick="addDistribLocal('xml',${i})">+ Local</button>
        </div>
        <div id="xml-distrib-list-${i}"></div>
      </div>
    </div>
  `).join('');

  /* Selecionar matches */
  const selects=document.querySelectorAll('.xml-match-sel');
  selects.forEach((sel,i)=>{
    if(d.itens[i].matchId) sel.value=d.itens[i].matchId;
    if(d.itens[i].matchId==='__novo__') onXmlMatchChange(i,'__novo__');
  });

  /* Renderizar distribuições */
  d.itens.forEach((_,i)=>renderDistribList('xml',i));

  document.getElementById('xml-total-count').textContent=d.itens.length;
  /* F4: Mostrar valor total dos itens da NF (não recalculado aqui, é no save) */
  document.getElementById('xml-total-valor').textContent=brl(d.vNF);
}

function onXmlMatchChange(idx, val){
  xmlNfData.itens[idx].matchId=val;
  /* F1: Se "criar novo item", abrir modal em vez de formulário inline */
  if(val==='__novo__'){
    openNovoInsumoModal('xml', idx);
    /* Voltar select para sem vínculo por enquanto (usuário salvará depois) */
    const sel=document.querySelector(`.xml-match-sel[data-idx="${idx}"]`);
    if(sel)sel.value='';
    xmlNfData.itens[idx].matchId='';
  }
}

/* ══════════════════════════════════════════
   F1: Modal de Novo Insumo via conciliação ou manual
══════════════════════════════════════════ */
let novoInsumoModo='xml';
let novoInsumoIdx=-1;

function openNovoInsumoModal(mode, idx){
  novoInsumoModo = mode;
  novoInsumoIdx = idx;
  const tipoOpts=TIPOS.map(t=>`<option value="${t.id}">${t.icon} ${t.nome}</option>`).join('');
  
  const it = mode==='xml' ? xmlNfData?.itens[idx] : null;

  /* Use modal m-novo-insumo-xml */
  document.getElementById('nix-nome').value=it?it.nome:'';
  document.getElementById('nix-un').value=it?it.un:'un';
  document.getElementById('nix-forn').value=mode==='xml'?xmlNfData?.emitNome:'';
  document.getElementById('nix-min').value='0';
  document.getElementById('nix-cat').value='';
  document.getElementById('nix-err').style.display='none';
  /* Populate tipo select */
  document.getElementById('nix-tipo').innerHTML=tipoOpts;
  openM('m-novo-insumo-xml');
}

async function salvarNovoInsumoXml(){
  const errEl=document.getElementById('nix-err');
  errEl.style.display='none';
  const tipoId=document.getElementById('nix-tipo').value;
  const nome=document.getElementById('nix-nome').value.trim();
  const cat=document.getElementById('nix-cat').value.trim();
  const unVal=document.getElementById('nix-un').value;
  const min=parseFloat(document.getElementById('nix-min').value)||0;
  const forn=document.getElementById('nix-forn').value.trim();
  if(!nome){errEl.textContent='⚠ Nome é obrigatório.';errEl.style.display='flex';return;}
  const tipoObj=TIPOS.find(t=>t.id===tipoId);
  if(!tipoObj){errEl.textContent='⚠ Tipo inválido.';errEl.style.display='flex';return;}
  
  const it=novoInsumoModo==='xml' && novoInsumoIdx>=0 ? xmlNfData?.itens[novoInsumoIdx] : null;
  const custoUnit=it&&it.qtd>0?round2(it.vTotal/it.qtd):0;
  const newId=nextGlobalId();
  const itemData={id:newId,nome,cat:cat||tipoObj.cats[0]||'',un:unVal,estq:0,min,custo:custoUnit,tipoId,tipo:tipoObj.nome,forn,local:''};
  try{
    const ref=await db.collection('itens').add(itemData);
    const novoItem={_docId:ref.id,...itemData};
    tipoObj.itens.push(novoItem);
    
    if(novoInsumoModo==='xml'){
      /* Atualizar todos os selects de match com o novo item */
      document.querySelectorAll('.xml-match-sel').forEach(sel=>{
        const newOpt=document.createElement('option');
        newOpt.value=String(newId);
        newOpt.textContent=`${nome} (0 ${unVal})`;
        sel.appendChild(newOpt);
      });
      /* Selecionar o item no select do idx atual */
      if(novoInsumoIdx>=0){
        const sel=document.querySelector(`.xml-match-sel[data-idx="${novoInsumoIdx}"]`);
        if(sel){
          sel.value=String(newId);
          xmlNfData.itens[novoInsumoIdx].matchId=String(newId);
        }
        /* Mostrar banner de confirmação */
        const savedDiv=document.getElementById(`xml-novo-saved-${novoInsumoIdx}`);
        if(savedDiv)savedDiv.style.display='';
      }
    } else {
      /* Modo Manual */
      if(novoInsumoIdx>=0){
        recebItens[novoInsumoIdx].prodId = String(newId);
      }
      renderRecebItens();
    }
    
    closeM('m-novo-insumo-xml');
    toast(`✅ Insumo "${nome}" cadastrado!`);
    if(typeof rebuildEstoque==='function')rebuildEstoque();
  }catch(e){errEl.textContent='⚠ Erro: '+e.message;errEl.style.display='flex';}
}

function updateXmlMatchBadges(){}

async function doRecebXml(){
  if(!xmlNfData||!xmlNfData.itens.length){toast('⚠ Nenhum item encontrado no XML.');return;}
  const errEl=document.getElementById('xml-err');
  errEl.style.display='none';

  const matched=xmlNfData.itens.filter(it=>it.matchId && it.matchId!=='');
  if(!matched.length){
    errEl.textContent='⚠ Vincule ou crie pelo menos 1 item da NF.';
    errEl.style.display='flex';return;
  }

  /* F7: Validar distribuições */
  for(const xmlItem of matched){
    if(xmlItem.distribuicao&&xmlItem.distribuicao.length>0){
      const alocado=xmlItem.distribuicao.reduce((s,d)=>s+(d.qtd||0),0);
      if(alocado>xmlItem.qtd+0.001){
        errEl.textContent=`⚠ Alocação do item "${xmlItem.nome}" excede a quantidade disponível (${alocado} > ${xmlItem.qtd}).`;
        errEl.style.display='flex';return;
      }
    }
  }

  const dest=document.getElementById('xml-dest')?.value||'—';
  const now=new Date();
  const data=now.getDate().toString().padStart(2,'0')+'/'+(now.getMonth()+1).toString().padStart(2,'0')+'/'+now.getFullYear()+' '+now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const tsField = { ts: firebase.firestore.FieldValue.serverTimestamp() };

  let createdCount=0;

  /* Process each matched item */
  for(const xmlItem of matched){
    /* ── Update existing item stock ── */
    const all=getAllItems();
    const item=all.find(x=>x.id===parseInt(xmlItem.matchId));
    if(item){
      /* Aplicar fator de conversão: XML traz qtd na unidade de COMPRA */
      const fator = item.fatorConversao||1;
      const qtdConsumo = xmlItem.qtd * fator;
      item.estq=(item.estq||0)+qtdConsumo;

      /* Update cost based on NF unit price (only if > 0), convertido para custo/un-consumo */
      if(xmlItem.qtd>0 && (xmlItem.vTotal||0)>0){
        item.custo=round2(xmlItem.vTotal/(xmlItem.qtd*fator));
      }

      /* F7: Atualizar distribuição (convertida) */
      if(xmlItem.distribuicao&&xmlItem.distribuicao.length>0){
        if(!item.distribuicao)item.distribuicao=[];
        xmlItem.distribuicao.forEach(d=>{
          if(!d.qtd)return;
          const dQtdConsumo = d.qtd * fator;
          const existing=item.distribuicao.find(x=>x.local===d.local);
          if(existing)existing.qtd=(existing.qtd||0)+dQtdConsumo;
          else item.distribuicao.push({local:d.local,qtd:dQtdConsumo});
        });
        if(item._docId) await db.collection('itens').doc(item._docId).update({estq:item.estq, custo:item.custo, distribuicao:item.distribuicao});
      } else {
        if(item._docId) await db.collection('itens').doc(item._docId).update({estq:item.estq, custo:item.custo});
      }
    }
  }

  const ref='NF-'+(xmlNfData.nNF||Date.now().toString().slice(-5));
  const forn=xmlNfData.emitNome||'Importação XML';

  /* F4: Valor calculado somente pelos itens conciliados */
  const valorConciliado=matched.reduce((s,it)=>s+(it.vTotal||0),0);

  /* F11: Incluir chave de acesso */
  const recebData={
    ref, forn,
    itens:matched.length, valor:valorConciliado,
    dest, data, rec:SESSION.name,
    ...tsField,
    ...(xmlNfData.chNFe?{chNFe:xmlNfData.chNFe}:{}),
    detalhes: matched.map(it => ({ id: it.matchId, qtd: it.qtd, distribuicao: it.distribuicao || [] }))
  };
  const docRef=await db.collection('recebimentos').add(recebData);
  recebimentos.unshift({_docId:docRef.id,...recebData});
  const recebDocId = docRef.id;

  /* ── F12: Gravar histórico de preços por item (XML) ── */
  const allItems2 = getAllItems();
  for(const xmlItem of matched){
    const item = allItems2.find(x=>x.id===parseInt(xmlItem.matchId));
    if(item&&item._docId&&xmlItem.qtd>0&&(xmlItem.vTotal||0)>0){
      const fator = item.fatorConversao||1;
      const custoUn = round2(xmlItem.vTotal/(xmlItem.qtd*fator));
      salvarPrecoHistorico(item._docId, {fornecedor:forn, valor:custoUn, data, recebDocId});
    }
  }

  const tb=document.getElementById('tb-receb');if(tb)tb.innerHTML=recebRows();
  rebuildEstoque();
  updateNotifs();
  closeM('m-receb');

  const msg=createdCount>0
    ?`✅ NF ${ref} importada — ${matched.length} itens (${createdCount} novos criados), estoque atualizado!`
    :`✅ NF ${ref} importada — ${matched.length}/${xmlNfData.itens.length} itens vinculados, estoque atualizado!`;
  toast(msg);
  await logActivity('recebimento', `Recebimento NF ${ref}: ${matched.length} itens${createdCount>0?` (${createdCount} novos)`:''}`);
}

/* ══════════════════════════════════════════
   F12: Salvar Histórico de Preço por Item
══════════════════════════════════════════ */
function salvarPrecoHistorico(itemDocId, {fornecedor, valor, data, recebDocId}){
  /* Fire-and-forget — não bloqueia o fluxo principal */
  try{
    db.collection('itens').doc(itemDocId)
      .collection('precoHistorico')
      .add({
        fornecedor,
        valor,
        data,
        recebDocId,
        ts: firebase.firestore.FieldValue.serverTimestamp()
      });
  }catch(e){
    console.warn('precoHistorico: erro ao salvar', e);
  }
}

/* ══════════════════════════════════════════
   Cadastrar Fornecedor inline via NF
══════════════════════════════════════════ */
async function cadastrarFornNf(){
  const errEl=document.getElementById('xml-forn-err');
  errEl.style.display='none';

  const nome=(document.getElementById('xml-forn-nome')?.value||'').trim();
  const cnpj=(document.getElementById('xml-forn-cnpj')?.value||'').trim();
  const contato=(document.getElementById('xml-forn-contato')?.value||'').trim();
  const obs=(document.getElementById('xml-forn-obs')?.value||'').trim();

  if(!nome){
    errEl.textContent='⚠ Nome do fornecedor é obrigatório.';
    errEl.style.display='flex'; return;
  }

  /* Check duplicate */
  const dup=fornecedores.find(f=>f.nome.toLowerCase()===nome.toLowerCase());
  if(dup){
    errEl.textContent='⚠ Já existe um fornecedor com esse nome.';
    errEl.style.display='flex'; return;
  }

  try{
    const data={nome, contato, obs, cnpj};
    const ref=await db.collection('fornecedores').add(data);
    fornecedores.push({_docId:ref.id,...data});

    /* Update NF emitente name for the rest of the flow */
    if(xmlNfData) xmlNfData.emitNome=nome;

    /* Replace registration form with success message */
    const regDiv=document.getElementById('xml-forn-register');
    if(regDiv) regDiv.innerHTML=`<div class="al al-ok">✅ Fornecedor <strong>"${nome}"</strong> cadastrado com sucesso!</div>`;

    /* Show items section */
    const xmlItensSection=document.getElementById('xml-itens-section');
    if(xmlItensSection) xmlItensSection.style.display='';

    /* Rebuild fornecedores page if exists */
    if(typeof rebuildFornecedores==='function') rebuildFornecedores();
    if(typeof populateFornSelects==='function') populateFornSelects();

    toast(`✅ Fornecedor "${nome}" cadastrado!`);
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}
