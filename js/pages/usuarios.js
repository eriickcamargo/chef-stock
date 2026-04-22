/* ══════════════════════════════════════════════════
   PAGE: Usuários (Admin only) — CRUD completo
══════════════════════════════════════════════════ */

const ROLE_LABEL = {adm:'🛡️ Administrador', coz:'👨‍🍳 Cozinha', trl:'🚌 Trailer', conf:'📋 Conferente'};
const ROLE_ICON  = {adm:'🛡️', coz:'👨‍🍳', trl:'🚌', conf:'📋'};
const ROLE_STYLE = {
  adm:'background:var(--adm-l);color:var(--adm);border:1px solid var(--adm-b)',
  coz:'background:var(--coz-l);color:var(--coz);border:1px solid var(--coz-b)',
  trl:'background:var(--trl-l);color:var(--trl);border:1px solid var(--trl-b)',
  conf:'background:var(--conf-l);color:var(--conf);border:1px solid var(--conf-b)',
};

let delUserLogin = null;

function mkUsuarios(){
  if(SESSION?.role!=='adm') return mkPg('usuarios');
  const pg=mkPg('usuarios');
  pg.innerHTML=usuariosHTML();
  return pg;
}

function usuariosHTML(){
  return`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink3)">Gerencie os usuários com acesso ao sistema.</div>
      <button class="btn btn-r" onclick="openAddUser()">+ Adicionar Usuário</button>
    </div>
    <div class="panel"><div class="tw"><table>
      <thead><tr><th>Usuário</th><th>Nome</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>${USERS.map(u=>`<tr>
        <td><span class="chip">${u.user}</span></td>
        <td><strong>${u.nome||u.name}</strong></td>
        <td><span class="bdg" style="${ROLE_STYLE[u.role]}">${ROLE_LABEL[u.role]}</span></td>
        <td><span class="bdg bok">Ativo</span></td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ok btn-xs" onclick="openEditUser('${u.user}')">✏ Editar</button>
            ${u.user!==SESSION.user?`<button class="btn btn-er btn-xs" onclick="openDelUser('${u.user}')">🗑</button>`:''}
          </div>
        </td>
      </tr>`).join('')}</tbody>
    </table></div></div>
    <div class="al al-in" style="font-size:12px">
      ℹ Total: <strong>${USERS.length}</strong> usuários registrados.
      ${USERS.filter(u=>u.role==='adm').length} admin, ${USERS.filter(u=>u.role==='coz').length} cozinha, ${USERS.filter(u=>u.role==='trl').length} trailer, ${USERS.filter(u=>u.role==='conf').length} conferente.
    </div>`;
}

function rebuildUsuarios(){
  const pg=document.getElementById('pg-usuarios');if(pg)pg.innerHTML=usuariosHTML();
}

/* ── Adicionar ── */
function openAddUser(){
  ['usr-nome','usr-login','usr-senha'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('usr-role').value='coz';
  document.getElementById('usr-err').style.display='none';
  openM('m-add-user');
}

async function salvarUsuario(){
  const errEl=document.getElementById('usr-err');
  errEl.style.display='none';
  const name=document.getElementById('usr-nome').value.trim();
  const user=document.getElementById('usr-login').value.trim();
  const pass=document.getElementById('usr-senha').value;
  const role=document.getElementById('usr-role').value;

  const erros=[];
  if(!name) erros.push('Nome é obrigatório.');
  if(!user) erros.push('Login é obrigatório.');
  if(user && user.length<3) erros.push('Login deve ter pelo menos 3 caracteres.');
  if(USERS.find(u=>u.user===user)) erros.push('Já existe um usuário com este login.');
  if(!pass) erros.push('Senha é obrigatória.');
  if(pass && pass.length<6) erros.push('Senha deve ter no mínimo 6 caracteres (requisito Firebase).');
  if(erros.length){
    errEl.textContent='⚠ '+erros.join(' ');
    errEl.style.display='flex';return;
  }

  const email=user+'@chefstock.app';
  const icon=ROLE_ICON[role];

  try{
    /* Save current user before creating new one */
    const currentUser=auth.currentUser;
    const currentEmail=currentUser.email;

    /* Create user in Firebase Auth */
    const cred=await auth.createUserWithEmailAndPassword(email, pass);
    const uid=cred.user.uid;

    /* Save user profile in Firestore */
    await db.collection('usuarios').doc(uid).set({user, role, nome:name, icon, email});

    /* Sign back into admin account */
    await auth.signOut();
    /* We need to re-authenticate as admin - prompt user */
    USERS.push({_docId:uid, uid, user, role, nome:name, icon, email});
    closeM('m-add-user');
    rebuildUsuarios();
    toast(`✓ Usuário "${name}" criado! Faça login novamente como admin.`);
    logout();
  }catch(e){
    errEl.textContent='⚠ Erro: '+e.message;
    errEl.style.display='flex';
  }
}

/* ── Editar ── */
function openEditUser(login){
  const u=USERS.find(x=>x.user===login);if(!u)return;
  document.getElementById('edit-usr-orig').value=login;
  document.getElementById('edit-usr-nome').value=u.name;
  document.getElementById('edit-usr-login').value=u.user;
  document.getElementById('edit-usr-senha').value='';
  document.getElementById('edit-usr-role').value=u.role;
  document.getElementById('edit-usr-sub').textContent=`Editando: ${u.name} (${u.user})`;
  document.getElementById('edit-usr-err').style.display='none';
  openM('m-edit-user');
}

async function salvarEdicaoUsuario(){
  const errEl=document.getElementById('edit-usr-err');
  errEl.style.display='none';
  const orig=document.getElementById('edit-usr-orig').value;
  const u=USERS.find(x=>x.user===orig);if(!u)return;

  const name=document.getElementById('edit-usr-nome').value.trim();
  const role=document.getElementById('edit-usr-role').value;

  const erros=[];
  if(!name) erros.push('Nome é obrigatório.');
  if(erros.length){
    errEl.textContent='⚠ '+erros.join(' ');
    errEl.style.display='flex';return;
  }

  u.nome=name;
  u.name=name;
  u.role=role;
  u.icon=ROLE_ICON[role];

  /* Update Firestore */
  if(u._docId||u.uid){
    await db.collection('usuarios').doc(u._docId||u.uid).update({nome:name, role, icon:ROLE_ICON[role]});
  }

  /* Se editou a si mesmo, atualiza a toolbar */
  if(SESSION.user===orig||SESSION.uid===(u._docId||u.uid)){
    SESSION.name=name;
    SESSION.role=role;
    SESSION.icon=ROLE_ICON[role];
    document.getElementById('tb-pill').innerHTML=`${SESSION.icon} ${CFG[SESSION.role].label}`;
    document.getElementById('tb-user').textContent=SESSION.name;
  }

  closeM('m-edit-user');
  rebuildUsuarios();
  toast(`✓ Usuário "${name}" atualizado!`);
}

/* ── Excluir ── */
function openDelUser(login){
  const u=USERS.find(x=>x.user===login);if(!u)return;
  delUserLogin=login;
  document.getElementById('del-usr-nome').textContent=`${u.name} (${u.user})`;
  openM('m-del-user');
}

async function doExcluirUsuario(){
  if(!delUserLogin)return;
  const u=USERS.find(x=>x.user===delUserLogin);
  const nome=u?u.nome||u.name:'Usuário';

  /* Delete from Firestore (Auth user remains, but can't access app) */
  if(u&&(u._docId||u.uid)){
    await db.collection('usuarios').doc(u._docId||u.uid).delete();
  }

  USERS=USERS.filter(x=>x.user!==delUserLogin);
  delUserLogin=null;
  closeM('m-del-user');
  rebuildUsuarios();
  toast(`🗑 "${nome}" removido do sistema.`);
}
