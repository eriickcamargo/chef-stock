/* ══════════════════════════════════════════════════
   AUTH — Login, Logout e Sessão (Firebase Auth)
   ChefStock — Gosto Paraense
══════════════════════════════════════════════════ */

/* ── Login ── */
async function doLogin(){
  const email = document.getElementById('lg-user').value.trim().toLowerCase();
  const pass  = document.getElementById('lg-pass').value;
  const errEl = document.getElementById('lg-err');
  errEl.style.display='none';

  /* Accept username or email — if no '@', append @chefstock.app */
  const fullEmail = email.includes('@') ? email : email+'@chefstock.app';

  try {
    await auth.signInWithEmailAndPassword(fullEmail, pass);
    /* onAuthStateChanged will call startApp */
  } catch(e) {
    console.error('Login error:', e.code, e.message);
    errEl.textContent = '⚠ Usuário ou senha incorretos.';
    errEl.style.display = 'flex';
    document.getElementById('lg-pass').value = '';
    document.getElementById('lg-pass').focus();
    setTimeout(()=> errEl.style.display='none', 4000);
  }
}

/* ── Logout ── */
function logout(){
  stopOrderListener();
  auth.signOut();
  SESSION = null;
  document.getElementById('login').style.display = 'flex';
  document.getElementById('app').classList.remove('on');
  document.getElementById('lg-user').value = '';
  document.getElementById('lg-pass').value = '';
}

/* ── Start App (after auth) ── */
async function startApp(user){
  /* Fetch user profile from Firestore */
  const doc = await db.collection('usuarios').doc(user.uid).get();
  if(!doc.exists){
    alert('Usuário não encontrado no sistema. Contacte o administrador.');
    auth.signOut(); return;
  }
  const u = doc.data();
  SESSION = Object.freeze({ uid: user.uid, user: u.user||'', role: u.role, name: u.nome, icon: u.icon||'👤', email: user.email });

  const cfg = CFG[SESSION.role];
  if(!cfg){ alert('Perfil inválido.'); auth.signOut(); return; }

  document.getElementById('login').style.display = 'none';
  document.getElementById('app').classList.add('on');
  document.documentElement.style.setProperty('--rc', cfg.rc);
  document.documentElement.style.setProperty('--rb', cfg.rb);
  document.documentElement.style.setProperty('--rbr', cfg.rbr);
  document.getElementById('tb-em').style.color = 'var(--rc)';
  document.getElementById('tb-pill').innerHTML = `${SESSION.icon} ${cfg.label}`;
  document.getElementById('tb-user').textContent = SESSION.name;
  /* Atualiza visibilidade da busca global (somente admins) */
  if(typeof syncGlobalSearchBtn === 'function') syncGlobalSearchBtn();

  /* Load all data from Firestore */
  await loadAllData();

  buildPages(); buildNav(); updateNotifs(); rebuildDash();
  startOrderListener();

  /* Load Telegram config in background — must not block the loading overlay */
  loadTelegramConfig().catch(e => console.warn('Telegram config error:', e));
}

/* ── Auto-login listener ── */
let authReady = false;
auth.onAuthStateChanged(async (user) => {
  try {
    if(user){
      await startApp(user);
    } else {
      if(authReady){
        document.getElementById('login').style.display = 'flex';
        document.getElementById('app').classList.remove('on');
      }
    }
  } catch(e) {
    console.error('startApp error:', e);
  } finally {
    authReady = true;
    /* Always hide loading overlay, even if startApp throws */
    const lo = document.getElementById('loading-overlay');
    if(lo) lo.style.display = 'none';
  }
});

