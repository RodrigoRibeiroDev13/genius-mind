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

// Inicializar o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentMapId = null;
let userPermission = "edit"; // 'edit' ou 'view'

// Paleta oficial e Estado Inicial
const BRANCH_COLORS = ["#FACC15", "#38BDF8", "#4ADE80", "#A855F7", "#FF7B00"];
let nodes = [
  { id: "root", parentId: null, text: "Genius Mind", x: 1000, y: 650, color: "#FF5E00", isRoot: true },
  { id: "n1", parentId: "root", text: "Ideias & Projetos", x: 740, y: 520, color: "#38BDF8" },
  { id: "n2", parentId: "root", text: "Planejamento", x: 1000, y: 440, color: "#FACC15" }
];

let selectedNodeId = "root";
let pan = { x: -350, y: -250 };
let zoom = 1;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let draggedNode = null;

// Elementos DOM principais
const canvasWrapper = document.getElementById("canvasWrapper");
const canvasStage = document.getElementById("canvasStage");
const nodesLayer = document.getElementById("nodesLayer");
const connectionsLayer = document.getElementById("connectionsLayer");
const nodeToolbar = document.getElementById("nodeToolbar");

async function init() {
  // Observar estado da autenticação no Firebase
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    updateAuthUI();
  });

  // Verificar se abriu um mapa via URL (ex: ?map=ID_DO_DOCUMENTO)
  const urlParams = new URLSearchParams(window.location.search);
  const mapIdParam = urlParams.get("map");

  if (mapIdParam) {
    await loadMapFromFirebase(mapIdParam);
  } else {
    centerView();
    render();
  }

  setupEvents();
}

function updateAuthUI() {
  const btnLogin = document.getElementById("btnLoginModal");
  if (currentUser) {
    btnLogin.textContent = `👤 ${currentUser.email.split("@")[0]}`;
    btnLogin.title = "Clique para terminar sessão";
    btnLogin.onclick = async () => {
      await auth.signOut();
      showToast("Sessão terminada.");
      window.location.href = window.location.pathname;
    };
  } else {
    btnLogin.textContent = "👤 Entrar";
    btnLogin.onclick = () => document.getElementById("authModal").classList.remove("hidden");
  }
}

// Salvar Mapa no Firestore
async function saveMapToFirebase() {
  if (!currentUser) {
    showToast("Inicie sessão para guardar os seus mapas na nuvem!");
    document.getElementById("authModal").classList.remove("hidden");
    return;
  }

  const title = document.getElementById("mapTitle").value || "Mapa Sem Título";
  const mapData = { title, nodes, ownerId: currentUser.id, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

  try {
    if (currentMapId) {
      await db.collection("maps").doc(currentMapId).update(mapData);
      showToast("Mapa guardado na nuvem com sucesso!");
    } else {
      const docRef = await db.collection("maps").add({
        ...mapData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      currentMapId = docRef.id;
      window.history.replaceState({}, "", `?map=${currentMapId}`);
      showToast("Novo mapa criado e guardado!");
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao guardar o mapa.");
  }
}

// Carregar Mapa do Firestore
async function loadMapFromFirebase(id) {
  showToast("A carregar mapa...");
  try {
    const doc = await db.collection("maps").doc(id).get();
    if (!doc.exists) {
      showToast("Mapa não encontrado.");
      return;
    }

    const data = doc.data();
    currentMapId = doc.id;
    document.getElementById("mapTitle").value = data.title;
    nodes = data.nodes || nodes;

    // Verificar permissões (se não for o dono, pode visualizar ou editar conforme a regra definida)
    if (currentUser && data.ownerId !== currentUser.id) {
      userPermission = "edit"; // Ou restrito, dependendo da sua preferência de partilha
    } else if (!currentUser) {
      userPermission = "view"; // Visitantes sem sessão apenas visualizam
      showToast("Modo de Visualização: Inicie sessão para editar.");
      document.querySelector(".ai-prompt-bar").style.display = "none";
      nodeToolbar.style.display = "none";
    }

    centerView();
    render();
    showToast("Mapa carregado com sucesso!");
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar o mapa.");
  }
}

// Sistema de Partilha por URL
function openShareModal() {
  if (!currentMapId) {
    showToast("Guarde o mapa na nuvem antes de partilhar!");
    saveMapToFirebase().then(() => { if (currentMapId) openShareModal(); });
    return;
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?map=${currentMapId}`;
  document.getElementById("shareLinkInput").value = shareUrl;
  document.getElementById("shareModal").classList.remove("hidden");
}

// Renderização dos Nós e Funções de Tela
function render() {
  canvasStage.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  document.getElementById("zoomLabel").textContent = `${Math.round(zoom * 100)}%`;

  // Desenhar conexões
  connectionsLayer.innerHTML = "";
  nodes.forEach(node => {
    if (!node.parentId) return;
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent) return;

    const dx = node.x - parent.x;
    const pathData = `M ${parent.x} ${parent.y} C ${parent.x + dx * 0.5} ${parent.y}, ${node.x - dx * 0.5} ${node.y}, ${node.x} ${node.y}`;
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", node.color || "#94A3B8");
    path.setAttribute("stroke-width", "3.5");
    path.setAttribute("stroke-linecap", "round");
    connectionsLayer.appendChild(path);
  });

  // Desenhar Nós
  nodesLayer.innerHTML = "";
  nodes.forEach(node => {
    const el = document.createElement("div");
    el.className = `mind-node ${node.isRoot ? "root-node" : ""} ${node.id === selectedNodeId ? "selected" : ""}`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.textContent = node.text;

    if (!node.isRoot) {
      el.style.backgroundColor = node.color || "#FFFFFF";
      el.style.color = isLightColor(node.color) ? "#1F1916" : "#FFFFFF";
    }

    if (userPermission === "edit") {
      el.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        selectNode(node.id);
        if (el.getAttribute("contenteditable") !== "true") {
          draggedNode = { node, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y };
        }
      });

      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        el.setAttribute("contenteditable", "true");
        el.focus();
        document.execCommand("selectAll", false, null);
      });

      el.addEventListener("blur", () => {
        el.removeAttribute("contenteditable");
        node.text = el.textContent.trim() || "Tópico";
        render();
        saveMapToFirebase(); // Guarda automaticamente ao alterar
      });
    }

    nodesLayer.appendChild(el);
  });

  updateToolbar();
}

function isLightColor(hex) {
  if (!hex) return true;
  return ["#FACC15", "#4ADE80", "#38BDF8", "#FFFFFF"].includes(hex.toUpperCase());
}

function selectNode(id) {
  selectedNodeId = id;
  render();
}

function updateToolbar() {
  if (selectedNodeId && userPermission === "edit") {
    nodeToolbar.classList.remove("hidden");
  } else {
    nodeToolbar.classList.add("hidden");
  }
}

function addChildNode(parentId, customText = "Novo Tópico") {
  if (userPermission !== "edit") return;
  const parent = nodes.find(n => n.id === parentId) || nodes[0];
  const siblings = nodes.filter(n => n.parentId === parent.id);
  const dist = parent.isRoot ? 240 : 190;
  const dir = parent.x < nodes[0].x ? -1 : 1;

  const newNode = {
    id: "n_" + Date.now() + Math.random().toString(36).slice(2, 5),
    parentId: parent.id,
    text: customText,
    x: parent.x + (parent.isRoot ? Math.cos(siblings.length * 1.1) * dist : dir * dist),
    y: parent.y + (parent.isRoot ? Math.sin(siblings.length * 1.1) * dist : (siblings.length - 0.5) * 75),
    color: parent.isRoot ? BRANCH_COLORS[siblings.length % BRANCH_COLORS.length] : parent.color
  };

  nodes.push(newNode);
  selectedNodeId = newNode.id;
  render();
  saveMapToFirebase();
}

function centerView() {
  const root = nodes.find(n => n.isRoot) || { x: 1000, y: 650 };
  pan.x = window.innerWidth / 2 - root.x * zoom;
  pan.y = window.innerHeight / 2 - root.y * zoom + 20;
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

// Configuração de Eventos de Autenticação e Modais
function setupEvents() {
  const authModal = document.getElementById("authModal");
  document.getElementById("closeAuthModal").onclick = () => authModal.classList.add("hidden");
  
  let isSignUp = false;
  document.getElementById("toggleAuthMode").onclick = (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    document.getElementById("authTitle").textContent = isSignUp ? "Criar Conta no Genius Mind" : "Entrar no Genius Mind";
    document.getElementById("btnAuthSubmit").textContent = isSignUp ? "Registar" : "Entrar";
    document.getElementById("toggleAuthMode").textContent = isSignUp ? "Já tenho uma conta" : "Registe-se";
  };

  document.getElementById("btnAuthSubmit").onclick = async () => {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    try {
      if (isSignUp) {
        await auth.createUserWithEmailAndPassword(email, password);
        showToast("Conta criada com sucesso!");
        authModal.classList.add("hidden");
      } else {
        await auth.signInWithEmailAndPassword(email, password);
        showToast("Sessão iniciada com sucesso!");
        authModal.classList.add("hidden");
        window.location.reload();
      }
    } catch (err) {
      showToast("Erro: " + err.message);
    }
  };

  // Eventos de movimento (Pan/Zoom)
  canvasWrapper.addEventListener("mousedown", (e) => {
    if (e.target === canvasWrapper || e.target === canvasStage) {
      isPanning = true;
      panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      selectedNodeId = null;
      render();
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (isPanning) {
      pan.x = e.clientX - panStart.x;
      pan.y = e.clientY - panStart.y;
      canvasStage.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    } else if (draggedNode && userPermission === "edit") {
      draggedNode.node.x = draggedNode.origX + (e.clientX - draggedNode.startX) / zoom;
      draggedNode.node.y = draggedNode.origY + (e.clientY - draggedNode.startY) / zoom;
      render();
    }
  });

  window.addEventListener("mouseup", () => {
    if (draggedNode && userPermission === "edit") saveMapToFirebase();
    isPanning = false;
    draggedNode = null;
  });

  canvasWrapper.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    zoom = Math.min(Math.max(0.35, zoom + delta), 2);
    render();
  }, { passive: false });

  document.getElementById("btnShare").onclick = openShareModal;
  document.getElementById("closeShareModal").onclick = () => document.getElementById("shareModal").classList.add("hidden");
  document.getElementById("btnCopyLink").onclick = () => {
    const input = document.getElementById("shareLinkInput");
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast("Link copiado para a área de transferência!");
  };

  document.getElementById("btnZoomIn").onclick = () => { zoom = Math.min(2, zoom + 0.15); render(); };
  document.getElementById("btnZoomOut").onclick = () => { zoom = Math.max(0.35, zoom - 0.15); render(); };
  document.getElementById("btnZoomReset").onclick = () => { zoom = 1; centerView(); render(); };
}

init();
