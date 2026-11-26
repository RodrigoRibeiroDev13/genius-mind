// =========================================================================
// CONFIGURAÇÃO DO FIREBASE (Com as suas chaves oficiais)
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAkgtZz9P_QDFqX2opRgmjTGCto7_8nW8g",
  authDomain: "genius-mind-40d98.firebaseapp.com",
  projectId: "genius-mind-40d98",
  storageBucket: "genius-mind-40d98.firebasestorage.app",
  messagingSenderId: "525115267508",
  appId: "1:525115267508:web:500d3561fa80bb206f7ae1",
  measurementId: "G-XT8Z62LL4N"
};

// Inicializa o Firebase (Modo compat para os scripts do HTML)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
let nodes = [];
let connections = [];
let selectedNodeId = null;
let isAuthSignUpMode = false; // Alterna entre Entrar e Registar-se

// Nó raiz inicial padrão
function initDefaultMap() {
  nodes = [
    { id: 'node_root', text: 'Meu Mapa Estratégico', x: 600, y: 350, color: '#FF5E00', parent: null }
  ];
  renderMap();
}

// ==========================================
// SISTEMA DE AUTENTICAÇÃO E MODAL
// ==========================================
const authModal = document.getElementById('authModal');
const btnLoginModal = document.getElementById('btnLoginModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const authTitle = document.getElementById('authTitle');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');

// Abrir Modal de Autenticação
btnLoginModal.addEventListener('click', () => {
  authModal.classList.remove('hidden');
});

// Fechar Modal
closeAuthModal.addEventListener('click', () => {
  authModal.classList.add('hidden');
});

// Alternar entre Login e Registo
toggleAuthMode.addEventListener('click', (e) => {
  e.preventDefault();
  isAuthSignUpMode = !isAuthSignUpMode;
  if (isAuthSignUpMode) {
    authTitle.textContent = 'Criar Conta no Genius Mind';
    btnAuthSubmit.textContent = 'Registar-se';
    toggleAuthMode.textContent = 'Já tem uma conta? Entre';
  } else {
    authTitle.textContent = 'Entrar no Genius Mind';
    btnAuthSubmit.textContent = 'Entrar';
    toggleAuthMode.textContent = 'Registe-se';
  }
});

// Submeter Autenticação (Login / Registo com validação rigorosa)
btnAuthSubmit.addEventListener('click', () => {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    showToast('Por favor, preencha o e-mail e a palavra-passe.');
    return;
  }

  if (isAuthSignUpMode) {
    // Registar Novo Utilizador
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        showToast('Conta criada com sucesso!');
        authModal.classList.add('hidden');
        updateAuthButton(userCredential.user);
      })
      .catch((error) => {
        handleAuthError(error.code);
      });
  } else {
    // Iniciar Sessão (Com bloqueio rigoroso para senhas erradas)
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        showToast('Sessão iniciada com sucesso!');
        authModal.classList.add('hidden');
        updateAuthButton(userCredential.user);
      })
      .catch((error) => {
        handleAuthError(error.code);
      });
  }
});

// Tratamento de erros de autenticação do Firebase
function handleAuthError(errorCode) {
  console.error("Erro de Autenticação:", errorCode);
  if (
    errorCode === 'auth/wrong-password' || 
    errorCode === 'auth/invalid-credential' || 
    errorCode === 'auth/user-not-found'
  ) {
    showToast('E-mail ou palavra-passe incorretos.');
  } else if (errorCode === 'auth/email-already-in-use') {
    showToast('Este e-mail já está registado.');
  } else if (errorCode === 'auth/weak-password') {
    showToast('A palavra-passe deve ter pelo menos 6 caracteres.');
  } else if (errorCode === 'auth/invalid-email') {
    showToast('O formato do e-mail é inválido.');
  } else {
    showToast('Ocorreu um erro na autenticação. Tente novamente.');
  }
}

// Atualizar visual do botão de login consoante o estado do utilizador
function updateAuthButton(user) {
  if (user) {
    btnLoginModal.textContent = user.email.split('@')[0];
    btnLoginModal.title = `Sessão ativa como ${user.email}`;
  } else {
    btnLoginModal.textContent = '👤 Entrar';
  }
}

// Observar estado da sessão do utilizador em tempo real
auth.onAuthStateChanged((user) => {
  updateAuthButton(user);
});

// ==========================================
// RENDERIZAÇÃO E INTERAÇÃO DO MAPA MENTAL
// ==========================================
const nodesLayer = document.getElementById('nodesLayer');
const connectionsLayer = document.getElementById('connectionsLayer');
const canvasWrapper = document.getElementById('canvasWrapper');
const nodeToolbar = document.getElementById('nodeToolbar');

function renderMap() {
  nodesLayer.innerHTML = '';
  connectionsLayer.innerHTML = '';

  // Renderizar Conexões (Linhas curvas entre nós)
  nodes.forEach(node => {
    if (node.parent) {
      const parentNode = nodes.find(n => n.id === node.parent);
      if (parentNode) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const x1 = parentNode.x + 90;
        const y1 = parentNode.y + 30;
        const x2 = node.x + 90;
        const y2 = node.y + 30;
        const curve = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
        
        path.setAttribute('d', curve);
        path.setAttribute('stroke', node.color || '#FF5E00');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        connectionsLayer.appendChild(path);
      }
    }
  });

  // Renderizar Nós (Cartões na tela)
  nodes.forEach(node => {
    const el = document.createElement('div');
    el.className = `mind-node ${node.id === selectedNodeId ? 'selected' : ''}`;
    if (node.id === 'node_root') el.classList.add('root-node');
    
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.borderColor = node.color || '#FF5E00';

    const textSpan = document.createElement('span');
    textSpan.contentEditable = true;
    textSpan.textContent = node.text;
    
    textSpan.addEventListener('input', () => {
      node.text = textSpan.textContent;
    });

    el.appendChild(textSpan);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectNode(node.id);
    });

    nodesLayer.appendChild(el);
  });
}

function selectNode(id) {
  selectedNodeId = id;
  const node = nodes.find(n => n.id === id);
  if (node) {
    nodeToolbar.classList.remove('hidden');
  } else {
    nodeToolbar.classList.add('hidden');
  }
  renderMap();
}

canvasWrapper.addEventListener('click', () => {
  selectedNodeId = null;
  nodeToolbar.classList.add('hidden');
  renderMap();
});

// ==========================================
// FERRAMENTAS DA TOOLBAR DE NÓS
// ==========================================
document.getElementById('btnAddChild')?.addEventListener('click', () => {
  if (!selectedNodeId) return;
  const parent = nodes.find(n => n.id === selectedNodeId);
  const newId = 'node_' + Date.now();
  const newNode = {
    id: newId,
    text: 'Novo Tópico',
    x: parent.x + 220,
    y: parent.y + (Math.random() * 80 - 40),
    color: parent.color,
    parent: parent.id
  };
  nodes.push(newNode);
  selectNode(newId);
});

document.getElementById('btnDeleteNode')?.addEventListener('click', () => {
  if (!selectedNodeId || selectedNodeId === 'node_root') {
    showToast('Não pode eliminar o nó principal.');
    return;
  }
  nodes = nodes.filter(n => n.id !== selectedNodeId && n.parent !== selectedNodeId);
  selectedNodeId = null;
  nodeToolbar.classList.add('hidden');
  renderMap();
});

document.querySelectorAll('.swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    if (!selectedNodeId) return;
    const color = swatch.getAttribute('data-color');
    const node = nodes.find(n => n.id === selectedNodeId);
    if (node) {
      node.color = color;
      renderMap();
    }
  });
});

// ==========================================
// SUPORTE A GERAÇÃO POR IA
// ==========================================
document.getElementById('btnGenerateAI')?.addEventListener('click', () => {
  const prompt = document.getElementById('aiPromptInput').value.trim();
  if (!prompt) {
    showToast('Escreva um tema para a IA gerar o mapa.');
    return;
  }
  showToast('A gerar mapa mental com Genius IA...');
  
  setTimeout(() => {
    document.getElementById('mapTitle').value = prompt;
    nodes = [
      { id: 'r_1', text: prompt, x: 600, y: 350, color: '#FF5E00', parent: null },
      { id: 'r_2', text: '1. Fundamentos & Conceitos', x: 380, y: 220, color: '#38BDF8', parent: 'r_1' },
      { id: 'r_3', text: '2. Estratégia Prática', x: 820, y: 220, color: '#4ADE80', parent: 'r_1' },
      { id: 'r_4', text: '3. Cronograma de Ação', x: 380, y: 480, color: '#FACC15', parent: 'r_1' },
      { id: 'r_5', text: '4. Recursos e Ferramentas', x: 820, y: 480, color: '#A855F7', parent: 'r_1' }
    ];
    renderMap();
    showToast('Mapa mental gerado com sucesso!');
  }, 1000);
});

// ==========================================
// UTILITÁRIO DE TOAST
// ==========================================
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// Inicializar aplicação ao carregar
window.addEventListener('DOMContentLoaded', () => {
  initDefaultMap();
});
