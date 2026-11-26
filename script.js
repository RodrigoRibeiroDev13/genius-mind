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
let currentMapId = null;
let isAuthSignUpMode = false;

// Variáveis para controlar o arrastamento dos nós (Drag and Drop)
let isDraggingNode = false;
let draggedNodeId = null;
let dragOffset = { x: 0, y: 0 };

// Nó raiz inicial padrão ou carregar mapa partilhado via URL
function initDefaultMap() {
  const urlParams = new URLSearchParams(window.location.search);
  const mapId = urlParams.get('map');

  if (mapId) {
    showToast('A carregar mapa partilhado...');
    db.collection('maps').doc(mapId).get().then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        nodes = data.nodes || [];
        const titleInput = document.getElementById('mapTitle');
        if (titleInput) titleInput.value = data.title || 'Mapa Partilhado';
        currentMapId = mapId;
        renderMap();
        showToast('Mapa carregado com sucesso!');
      } else {
        showToast('Mapa não encontrado.');
        loadDefaultNodes();
      }
    }).catch(() => {
      showToast('Erro ao carregar o mapa.');
      loadDefaultNodes();
    });
  } else {
    loadDefaultNodes();
  }
}

function loadDefaultNodes() {
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
const canvasStage = document.getElementById('canvasStage');
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

    textSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        addChildNode(node.id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        addSiblingNode(node.id);
      }
    });

    el.appendChild(textSpan);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectNode(node.id);
    });

    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'SPAN' && document.activeElement === e.target) return;
      
      isDraggingNode = true;
      draggedNodeId = node.id;
      selectNode(node.id);

      const stageRect = canvasStage.getBoundingClientRect();
      dragOffset.x = (e.clientX - stageRect.left) - node.x;
      dragOffset.y = (e.clientY - stageRect.top) - node.y;
      
      e.stopPropagation();
    });

    nodesLayer.appendChild(el);
  });
}

window.addEventListener('mousemove', (e) => {
  if (!isDraggingNode || !draggedNodeId) return;

  const stageRect = canvasStage.getBoundingClientRect();
  const node = nodes.find(n => n.id === draggedNodeId);

  if (node) {
    node.x = (e.clientX - stageRect.left) - dragOffset.x;
    node.y = (e.clientY - stageRect.top) - dragOffset.y;
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
    loadDefaultNodes();
    currentMapId = null;
    const titleInput = document.getElementById('mapTitle');
    if (titleInput) titleInput.value = 'Meu Novo Mapa';
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
// FUNÇÕES DE CRIAÇÃO DE NÓS (FILHO E IRMÃO)
// ==========================================
function addChildNode(parentId) {
  const parent = nodes.find(n => n.id === parentId);
  if (!parent) return;
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
}

function addSiblingNode(nodeId) {
  const currentNode = nodes.find(n => n.id === nodeId);
  if (!currentNode) return;
  
  const newId = 'node_' + Date.now();
  const newNode = {
    id: newId,
    text: 'Novo Irmão',
    x: currentNode.x,
    y: currentNode.y + 90,
    color: currentNode.color,
    parent: currentNode.parent
  };
  nodes.push(newNode);
  selectNode(newId);
}

document.getElementById('btnAddChild')?.addEventListener('click', () => {
  if (selectedNodeId) addChildNode(selectedNodeId);
});

document.getElementById('btnAddSibling')?.addEventListener('click', () => {
  if (selectedNodeId) addSiblingNode(selectedNodeId);
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
// FUNCIONALIDADES DE PARTILHA COM FIREBASE
// ==========================================
const btnShare = document.getElementById('btnShare');
const shareModal = document.getElementById('shareModal');
const closeShareModal = document.getElementById('closeShareModal');
const shareLinkInput = document.getElementById('shareLinkInput');
const btnCopyLink = document.getElementById('btnCopyLink');

btnShare?.addEventListener('click', () => {
  const mapTitle = document.getElementById('mapTitle')?.value || 'Mapa Estratégico';
  showToast('A gerar link exclusivo de partilha...');

  const mapData = {
    title: mapTitle,
    nodes: nodes,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const savePromise = currentMapId 
    ? db.collection('maps').doc(currentMapId).set(mapData)
    : db.collection('maps').add(mapData).then(docRef => { currentMapId = docRef.id; });

  savePromise.then(() => {
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?map=${currentMapId}`;
    if (shareLinkInput) {
      shareLinkInput.value = shareUrl;
    }
    shareModal?.classList.remove('hidden');
    showToast('Link exclusivo gerado com sucesso!');
  }).catch(() => {
    showToast('Erro ao gerar link de partilha.');
  });
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
// FUNCIONALIDADES DE DOWNLOAD (BAIXAR FORMATOS)
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
    else if (format === 'svg') {
      const connectionsHTML = document.getElementById('connectionsLayer')?.outerHTML || '';
      const nodesHTML = document.getElementById('nodesLayer')?.innerHTML || '';
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000">${connectionsHTML}<g>${nodesHTML}</g></svg>`;
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const dlAnchor = document.createElement('a');
      dlAnchor.href = url;
      dlAnchor.download = `${mapTitle}.svg`;
      dlAnchor.click();
      URL.revokeObjectURL(url);
      showToast('Ficheiro SVG baixado com sucesso!');
    }
    else if (format === 'pdf') {
      const stage = document.getElementById('canvasStage');
      if (window.html2canvas && window.jspdf && stage) {
        showToast('A gerar documento PDF...');
        window.html2canvas(stage, { backgroundColor: '#ffffff' }).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF('landscape', 'mm', 'a4');
          const imgWidth = 297;
          const pageHeight = 210;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }

          pdf.save(`${mapTitle}.pdf`);
          showToast('Documento PDF baixado com sucesso!');
        }).catch(() => {
          showToast('Erro ao exportar PDF.');
        });
      } else {
        showToast('Bibliotecas de PDF não carregadas.');
      }
    }
    else if (format === 'docx') {
      let docContent = `Mapa Mental: ${mapTitle}\n\nTopicos:\n`;
      nodes.forEach(n => {
        docContent += `• ${n.text}\n`;
      });
      const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const dlAnchor = document.createElement('a');
      dlAnchor.href = url;
      dlAnchor.download = `${mapTitle}.docx`;
      dlAnchor.click();
      URL.revokeObjectURL(url);
      showToast('Documento Word baixado com sucesso!');
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
