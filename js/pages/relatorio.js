/* ══════════════════════════════════════════════════
   PAGE: Relatório — Estoque por Local
   (Uses TIPOS registry for item collection)
══════════════════════════════════════════════════ */

function mkRelatorio(){
  const pg=mkPg('relatorio');
  /* Itens que possuem local (tipos com campo local ativado) */
  const all=TIPOS.filter(t=>t.campos.local).flatMap(t=>t.itens);
  const locMap={};all.forEach(i=>{if(!locMap[i.local])locMap[i.local]=[];locMap[i.local].push(i);});
  const defaultColors=['#1c4585','#2d6142','#7a5f00','#5c4033','#6b2fa0','#b5651d','#2e4057','#8b0000'];
  const locC={};Object.keys(locMap).forEach((l,i)=>{locC[l]=defaultColors[i%defaultColors.length];});
  const crit=all.filter(i=>nvl(i.estq,i.min)==='e').length;
  const low=all.filter(i=>nvl(i.estq,i.min)==='w').length;
  const val=all.reduce((s,i)=>s+i.estq*i.custo,0);
  pg.innerHTML=`
    <div style="display:flex;gap:10px;margin-bottom:18px;align-items:flex-end;flex-wrap:wrap">
      <div class="fg" style="min-width:155px"><label class="fl">Local</label>
        <select class="fc"><option value="">Todos os locais</option>${Object.keys(locMap).map(l=>`<option>${l}</option>`).join('')}</select></div>
      <div class="fg" style="min-width:130px"><label class="fl">Nível</label>
        <select class="fc"><option>Todos</option><option>Crítico</option><option>Baixo</option><option>Normal</option></select></div>
      <button class="btn btn-g" onclick="window.print()">🖨 Imprimir</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px"><div class="kl">Total de Itens</div><div class="kv" style="font-size:22px">${all.length}</div></div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px"><div class="kl">Críticos / Baixos</div><div class="kv" style="font-size:22px;color:var(--er)">${crit+low}</div><div class="ks">${crit} críticos, ${low} baixos</div></div></div>
      <div class="panel" style="margin:0"><div class="pb" style="padding:14px 16px"><div class="kl">Valor em Estoque</div><div class="kv" style="font-size:22px">${brl(val)}</div></div></div>
    </div>
    <div class="lgrid">
      ${Object.entries(locMap).map(([loc,items])=>`
        <div class="lc">
          <div class="lh"><div class="ld" style="background:${locC[loc]||'#888'}"></div><div class="ln">${loc}</div><span style="font-size:11px;color:var(--ink3)">${items.length} itens</span></div>
          ${items.map(i=>`<div class="li">
            <div style="flex:1;font-size:13px">${i.nome}</div>
            <div class="sb" style="width:55px"><div class="sf sf${nvl(i.estq,i.min)}" style="width:${npct(i.estq,i.min)}%"></div></div>
            <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--ink2);min-width:56px;text-align:right">${i.estq} ${i.un}</div>
          </div>`).join('')}
          <div class="lif">Valor est.: <strong>${brl(items.reduce((s,i)=>s+i.estq*i.custo,0))}</strong></div>
        </div>`).join('')}
    </div>`;
  return pg;
}
