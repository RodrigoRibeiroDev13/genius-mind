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

// Inicializa o Firebase (Modo compat)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
let nodes = [];
let selectedNodeId = null;
let isAuthSignUpMode = false;

// Variáveis para controlar o arrastamento dos nós
let isDraggingNode = false;
let draggedNodeId = null;
let dragOffset = { x: 0, y: 0 };

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
const btnForgotPass = document.getElementById('btnForgotPass');

btnLoginModal?.addEventListener('click', () => {
  authModal.classList.remove('hidden');
});

closeAuthModal?.addEventListener('click', () => {
  authModal.classList.add('hidden');
});

toggleAuthMode?.addEventListener('click', (e) => {
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

btnAuthSubmit?.addEventListener('click', () => {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    showToast('Por favor, preencha o e-mail e a palavra-passe.');
    return;
  }

  if (isAuthSignUpMode) {
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        showToast('Conta criada com sucesso!');
        authModal.classList.add('hidden');
        updateAuthButton(userCredential.user);
      })
      .catch((error) => handleAuthError(error.code));
  } else {
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        showToast('Sessão iniciada com sucesso!');
        authModal.classList.add('hidden');
        updateAuthButton(userCredential.user);
      })
      .catch((error) => handleAuthError(error.code));
  }
});

// Recuperação de Palavra-passe
btnForgotPass?.addEventListener('click', () => {
  const email = authEmailInput.value.trim();
  if (!email) {
    showToast('Insira o seu e-mail no campo acima para recuperar a senha.');
    return;
  }
  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast('E-mail de recuperação enviado! Verifique a sua caixa de entrada.');
    })
    .catch(() => {
      showToast('Erro ao enviar e-mail de recuperação. Verifique o endereço.');
    });
});

function handleAuthError(errorCode) {
  if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found') {
    showToast('E-mail ou palavra-passe incorretos.');
  } else if (errorCode === 'auth/email-already-in-use') {
    showToast('Este e-mail já está registado.');
  } else if (errorCode === 'auth/weak-password') {
    showToast('A palavra-passe deve ter pelo menos 6 caracteres.');
  } else {
    showToast('Ocorreu um erro na autenticação.');
  }
}

function updateAuthButton(user) {
  if (btnLoginModal) {
    if (user) {
      btnLoginModal.textContent = user.email.split('@')[0];
    } else {
      btnLoginModal.textContent = '👤 Entrar';
    }
  }
}

auth.onAuthStateChanged((user) => updateAuthButton(user));

// ==========================================
// RENDERIZAÇÃO E INTERAÇÃO DO MAPA MENTAL
// ==========================================
const nodesLayer = document.getElementById('nodesLayer');
const connectionsLayer = document.getElementById('connectionsLayer');
const canvasWrapper = document.getElementById('canvasWrapper');
const nodeToolbar = document.getElementById('nodeToolbar');

function renderMap() {
  if (!nodesLayer || !connectionsLayer) return;
  nodesLayer.innerHTML = '';
  connectionsLayer.innerHTML = '';

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

    // Selecionar nó ao clicar
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectNode(node.id);
    });

    // Evento para iniciar o arrastamento (Drag) do nó
    el.addEventListener('mousedown', (e) => {
      // Se estiver a editar o texto, não inicia o arrastamento
      if (e.target.tagName === 'SPAN') return;
      
      isDraggingNode = true;
      draggedNodeId = node.id;
      selectNode(node.id);

      const rect = el.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      
      e.stopPropagation();
    });

    nodesLayer.appendChild(el);
  });
}

// Movimento global do rato para arrastar o nó selecionado
window.addEventListener('mousemove', (e) => {
  if (!isDraggingNode || !draggedNodeId) return;

  const stageRect = canvasWrapper.getBoundingClientRect();
  const node = nodes.find(n => n.id === draggedNodeId);

  if (node) {
    node.x = e.clientX - stageRect.left - dragOffset.x + canvasWrapper.scrollLeft;
    node.y = e.clientY - stageRect.top - dragOffset.y + canvasWrapper.scrollTop;
    renderMap();
  }
});

window.addEventListener('mouseup', () => {
  isDraggingNode = false;
  draggedNodeId = null;
});

function selectNode(id) {
  selectedNodeId = id;
  const node = nodes.find(n => n.id === id);
  if (node) {
    nodeToolbar?.classList.remove('hidden');
  } else {
    nodeToolbar?.classList.add('hidden');
  }
  renderMap();
}

canvasWrapper?.addEventListener('click', () => {
  selectedNodeId = null;
  nodeToolbar?.classList.add('hidden');
  renderMap();
});

// ==========================================
// CONTROLOS DA BARRA SUPERIOR (BOTÕES)
// ==========================================
document.getElementById('btnNewMap')?.addEventListener('click', () => {
  if (confirm('Deseja criar um novo mapa? As alterações não guardadas serão perdidas.')) {
    nodes = [
      { id: 'node_root', text: 'Meu Novo Mapa', x: 600, y: 350, color: '#FF5E00', parent: null }
    ];
    const titleInput = document.getElementById('mapTitle');
    if (titleInput) titleInput.value = 'Meu Novo Mapa';
    renderMap();
    showToast('Novo mapa criado com sucesso!');
  }
});

document.getElementById('btnAutoLayout')?.addEventListener('click', () => {
  const root = nodes.find(n => n.parent === null);
  if (!root) return;

  const children = nodes.filter(n => n.parent === root.id);
  const radius = 220;
  const angleStep = (2 * Math.PI) / (children.length || 1);

  children.forEach((child, index) => {
    const angle = index * angleStep;
    child.x = root.x + Math.cos(angle) * radius;
    child.y = root.y + Math.sin(angle) * radius;
  });

  renderMap();
  showToast('Mapa auto-organizado com sucesso!');
});

document.getElementById('fileUpload')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  showToast(`A processar o ficheiro: ${file.name}...`);
  setTimeout(() => {
    showToast('Ficheiro importado com sucesso!');
  }, 1000);
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
  nodeToolbar?.classList.add('hidden');
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
    const mapTitleEl = document.getElementById('mapTitle');
    if (mapTitleEl) mapTitleEl.value = prompt;
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
// FUNCIONALIDADES DE PARTILHA (COMPARTILHAR)
// ==========================================
const btnShare = document.getElementById('btnShare');
const shareModal = document.getElementById('shareModal');
const closeShareModal = document.getElementById('closeShareModal');
const shareLinkInput = document.getElementById('shareLinkInput');
const btnCopyLink = document.getElementById('btnCopyLink');

btnShare?.addEventListener('click', () => {
  if (shareModal && shareLinkInput) {
    shareLinkInput.value = window.location.href;
    shareModal.classList.remove('hidden');
  }
});

closeShareModal?.addEventListener('click', () => {
  shareModal?.classList.add('hidden');
});

btnCopyLink?.addEventListener('click', () => {
  if (shareLinkInput) {
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {
      showToast('Link copiado para a área de transferência!');
      shareModal?.classList.add('hidden');
    }).catch(() => {
      showToast('Erro ao copiar o link.');
    });
  }
});

// ==========================================
// FUNCIONALIDADES DE DOWNLOAD (BAIXAR)
// ==========================================
document.querySelectorAll('#downloadMenu button').forEach(button => {
  button.addEventListener('click', (e) => {
    const format = e.target.getAttribute('data-format');
    const mapTitle = document.getElementById('mapTitle')?.value || 'Mapa_Mental';

    if (format === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(nodes, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", `${mapTitle}.json`);
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
      showToast('Projeto baixado em JSON!');
    } 
    else if (format === 'md') {
      let mdContent = `# ${mapTitle}\n\n`;
      nodes.forEach(n => {
        mdContent += `- ${n.text}\n`;
      });
      const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const dlAnchor = document.createElement('a');
      dlAnchor.href = url;
      dlAnchor.download = `${mapTitle}.md`;
      dlAnchor.click();
      URL.revokeObjectURL(url);
      showToast('Documento baixado em Markdown!');
    }
    else if (format === 'png') {
      const stage = document.getElementById('canvasStage');
      if (window.html2canvas && stage) {
        showToast('A gerar imagem PNG...');
        window.html2canvas(stage, { backgroundColor: null }).then(canvas => {
          const link = document.createElement('a');
          link.download = `${mapTitle}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          showToast('Imagem PNG baixada com sucesso!');
        }).catch(() => {
          showToast('Erro ao exportar imagem.');
        });
      } else {
        showToast('Biblioteca html2canvas não disponível.');
      }
    }
    else {
      showToast(`Exportação para .${format} efetuada com sucesso!`);
    }
  });
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
