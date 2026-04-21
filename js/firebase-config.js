/* ══════════════════════════════════════════════════
   FIREBASE — Configuração e Inicialização
   ChefStock — Gosto Paraense
══════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyBHCoJMO9ydImRHm9NGyMO1QW-j4O045k4",
  authDomain: "chefstock-gosto-paraense-247ff.firebaseapp.com",
  projectId: "chefstock-gosto-paraense-247ff",
  storageBucket: "chefstock-gosto-paraense-247ff.firebasestorage.app",
  messagingSenderId: "257649760057",
  appId: "1:257649760057:web:f9fe2f02576a0d8f53bae8"
};

firebase.initializeApp(firebaseConfig);

const db   = firebase.firestore();
const auth = firebase.auth();
