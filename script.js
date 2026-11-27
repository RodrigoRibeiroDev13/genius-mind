// Configuração do Firebase (Compat Mode)
const firebaseConfig = {
  apiKey: "AIzaSyAkgtZz9P_QDFqX2opRgmjTGCto7_8nW8g",
  authDomain: "genius-mind-40d98.firebaseapp.com",
  projectId: "genius-mind-40d98",
  storageBucket: "genius-mind-40d98.firebasestorage.app",
  messagingSenderId: "525115267508",
  appId: "1:525115267508:web:500d3561fa80bb206f7ae1",
  measurementId: "G-XT8Z62LL4N"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Estado Global
let nodes = [
    { id: 'node-root', text: 'Ideia Principal', x: 5000, y: 5000, parent: null, color: '#FF5E00' }
];
let selectedNodeId = null;
let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;
let draggingNodeId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Elementos DOM
const nodesLayer = document.getElementById('nodesLayer');
const connectionsLayer = document.getElementById('connectionsLayer');
const canvasStage = document.getElementById('canvasStage');
const canvasWrapper = document.getElementById('canvasWrapper');
const zoomLabel = document.getElementById('zoomLabel');
const nodeToolbar = document.getElementById('nodeToolbar');
const mapTitleInput = document.getElementById('mapTitle');
const toastEl = document.getElementById('toast');

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initCanvasInteractions();
    initToolbarActions();
    initDownloadMenu();
    initAIAndFiles();
    loadMapFromURL();
    render();
    centerOnNode('node-root', true);
});

// Nó raiz inicial padrão posicionado no centro do mundo virtual
function initDefaultMap() {
    nodes = [
        { id: 'node-root', text: 'Meu Mapa Estratégico', x: 5000, y: 5000, parent: null, color: '#FF5E00' }
    ];
    render();
    centerOnNode('node-root', true);
}

// Mensagens Toast
function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

// Renderização Geral
function render() {
    nodesLayer.innerHTML = '';
    connectionsLayer.innerHTML = '';

    // Desenhar Linhas
    nodes.forEach(node => {
        if (node.parent) {
            const parent = nodes.find(n => n.id === node.parent);
            if (parent) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', parent.x + 80);
                line.setAttribute('y1', parent.y + 30);
                line.setAttribute('x2', node.x + 80);
                line.setAttribute('y2', node.y + 30);
                line.setAttribute('stroke', node.color || '#334155');
                line.setAttribute('stroke-width', '2.5');
                connectionsLayer.appendChild(line);
            }
        }
    });

    // Desenhar Nós
    nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = `map-node ${node.id === selectedNodeId ? 'selected' : ''}`;
        if (node.id === 'node-root') el.classList.add('root-node');
        el.id = node.id;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.style.borderColor = node.color || '#334155';
        el.textContent = node.text;

        // Duplo clique para editar texto diretamente
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            el.contentEditable = true;
            el.focus();
        });

        el.addEventListener('blur', () => {
            el.contentEditable = false;
            node.text = el.textContent.trim() || 'Sem título';
            render();
        });

        // Seleção e Arrastar Nó (Drag & Drop fluído)
        el.addEventListener('mousedown', (e) => {
            if (el.contentEditable === 'true') return;
            selectedNodeId = node.id;
            draggingNodeId = node.id;
            
            // Corrige o offset considerando o zoom ativo do stage
            const stageRect = canvasStage.getBoundingClientRect();
            dragOffsetX = (e.clientX - stageRect.left) / scale - node.x;
            dragOffsetY = (e.clientY - stageRect.top) / scale - node.y;
            
            updateNodeToolbar();
            render();
            e.stopPropagation();
        });

        nodesLayer.appendChild(el);
    });

    updateNodeToolbar();
}

// Movimentação do Canvas (Pan & Zoom)
function initCanvasInteractions() {
    canvasWrapper.addEventListener('mousedown', (e) => {
        if (e.target === canvasWrapper || e.target === canvasStage || e.target === connectionsLayer) {
            isPanning = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            selectedNodeId = null;
            render();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            applyTransform();
        } else if (draggingNodeId) {
            const node = nodes.find(n => n.id === draggingNodeId);
            if (node) {
                const stageRect = canvasStage.getBoundingClientRect();
                node.x = (e.clientX - stageRect.left) / scale - dragOffsetX;
                node.y = (e.clientY - stageRect.top) / scale - dragOffsetY;
                render();
            }
        }
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        draggingNodeId = null;
    });

    // Zoom centralizado
    canvasWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const oldScale = scale;
        if (e.deltaY < 0) {
            scale = Math.min(scale * zoomFactor, 2.5);
        } else {
            scale = Math.max(scale / zoomFactor, 0.3);
        }

        const rect = canvasWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        panX = mouseX - (mouseX - panX) * (scale / oldScale);
        panY = mouseY - (mouseY - panY) * (scale / oldScale);

        applyTransform();
        zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }, { passive: false });

    document.getElementById('btnZoomIn').onclick = () => { scale = Math.min(scale * 1.2, 2.5); applyTransform(); zoomLabel.textContent = `${Math.round(scale * 100)}%`; };
    document.getElementById('btnZoomOut').onclick = () => { scale = Math.max(scale / 1.2, 0.3); applyTransform(); zoomLabel.textContent = `${Math.round(scale * 100)}%`; };
    document.getElementById('btnZoomReset').onclick = () => { scale = 1; panX = 0; panY = 0; applyTransform(); zoomLabel.textContent = '100%'; centerOnNode('node-root', true); };
}

function applyTransform() {
    canvasStage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function centerOnNode(nodeId, smooth = false) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const wrapperW = canvasWrapper.clientWidth;
    const wrapperH = canvasWrapper.clientHeight;
    panX = wrapperW / 2 - node.x;
    panY = wrapperH / 2 - node.y;
    applyTransform();
}

// Barra de Ações do Nó
function updateNodeToolbar() {
    if (!selectedNodeId) {
        nodeToolbar.classList.add('hidden');
        return;
    }
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) {
        nodeToolbar.classList.add('hidden');
        return;
    }
    const el = document.getElementById(node.id);
    if (el) {
        const rect = el.getBoundingClientRect();
        const wrapperRect = canvasWrapper.getBoundingClientRect();
        nodeToolbar.style.top = `${rect.top - wrapperRect.top - 50}px`;
        nodeToolbar.style.left = `${rect.left - wrapperRect.left + (rect.width / 2) - 100}px`;
        nodeToolbar.classList.remove('hidden');
    }
}

function initToolbarActions() {
    document.getElementById('btnAddChild').onclick = () => {
        if (!selectedNodeId) return;
        const parent = nodes.find(n => n.id === selectedNodeId);
        const newId = 'node-' + Date.now();
        nodes.push({
            id: newId,
            text: 'Novo Subtópico',
            x: parent.x + 220,
            y: parent.y + (Math.random() * 100 - 50),
            parent: parent.id,
            color: parent.color
        });
        selectedNodeId = newId;
        render();
    };

    document.getElementById('btnAddSibling').onclick = () => {
        if (!selectedNodeId) return;
        const node = nodes.find(n => n.id === selectedNodeId);
        const newId = 'node-' + Date.now();
        nodes.push({
            id: newId,
            text: 'Novo Tópico',
            x: node.x,
            y: node.y + 90,
            parent: node.parent,
            color: node.color
        });
        selectedNodeId = newId;
        render();
    };

    document.getElementById('btnDeleteNode').onclick = () => {
        if (!selectedNodeId || selectedNodeId === 'node-root') {
            showToast('Não é possível excluir o nó raiz.');
            return;
        }
        nodes = nodes.filter(n => n.id !== selectedNodeId && n.parent !== selectedNodeId);
        selectedNodeId = null;
        nodeToolbar.classList.add('hidden');
        render();
    };

    document.querySelectorAll('.swatch').forEach(btn => {
        btn.onclick = () => {
            if (!selectedNodeId) return;
            const color = btn.getAttribute('data-color');
            const node = nodes.find(n => n.id === selectedNodeId);
            if (node) {
                node.color = color;
                render();
            }
        };
    });

    document.getElementById('btnNewMap').onclick = () => {
        if (confirm('Criar um novo mapa apagará o atual não guardado. Continuar?')) {
            nodes = [{ id: 'node-root', text: 'Nova Ideia', x: 5000, y: 5000, parent: null, color: '#FF5E00' }];
            mapTitleInput.value = 'Meu Mapa Estratégico';
            selectedNodeId = null;
            render();
            centerOnNode('node-root', true);
        }
    };

    // Auto-Organizar nós de forma simples em árvore
    document.getElementById('btnAutoLayout').onclick = () => {
        const root = nodes.find(n => !n.parent);
        if (!root) return;
        root.x = 5000;
        root.y = 5000;
        
        const children = nodes.filter(n => n.parent === root.id);
        children.forEach((child, idx) => {
            child.x = root.x + 300;
            child.y = root.y + (idx - children.length / 2) * 120;
        });
        render();
        showToast('Mapa auto-organizado!');
    };

    // Salvar no Sistema / Firestore
    document.getElementById('btnSave').onclick = async () => {
        const user = auth.currentUser;
        if (!user) {
            showToast('Faça login para salvar na nuvem.');
            document.getElementById('authModal').classList.remove('hidden');
            return;
        }
        try {
            const mapId = 'map_' + Date.now();
            await db.collection('maps').doc(mapId).set({
                title: mapTitleInput.value,
                nodes: nodes,
                owner: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Mapa salvo com sucesso!');
        } catch (err) {
            showToast('Erro ao salvar: ' + err.message);
        }
    };

    // Partilhar
    document.getElementById('btnShare').onclick = async () => {
        const mapId = 'map_' + Date.now();
        await db.collection('maps').doc(mapId).set({
            title: mapTitleInput.value,
            nodes: nodes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const shareUrl = `${window.location.origin}${window.location.pathname}?map=${mapId}`;
        document.getElementById('shareLinkInput').value = shareUrl;
        document.getElementById('shareModal').classList.remove('hidden');
    };

    document.getElementById('closeShareModal').onclick = () => document.getElementById('shareModal').classList.add('hidden');
    document.getElementById('btnCopyLink').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('shareLinkInput').value);
        showToast('Link copiado para a área de transferência!');
    };
}

// Carregar por URL (?map=...)
async function loadMapFromURL() {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get('map');
    if (mapId) {
        try {
            const doc = await db.collection('maps').doc(mapId).get();
            if (doc.exists) {
                const data = doc.data();
                nodes = data.nodes || nodes;
                mapTitleInput.value = data.title || 'Mapa Partilhado';
                render();
                showToast('Mapa carregado com sucesso!');
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Menus de Download e Exportação Otimizada (Recortada)
function initDownloadMenu() {
    document.querySelectorAll('#downloadMenu button').forEach(btn => {
        btn.onclick = async () => {
            const format = btn.getAttribute('data-format');
            if (format === 'json') {
                const blob = new Blob([JSON.stringify({ title: mapTitleInput.value, nodes }, null, 2)], { type: 'application/json' });
                downloadBlob(blob, `${mapTitleInput.value}.json`);
            } else if (format === 'md') {
                const md = nodes.map(n => `- ${n.text}`).join('\n');
                const blob = new Blob([md], { type: 'text/markdown' });
                downloadBlob(blob, `${mapTitleInput.value}.md`);
            } else if (format === 'png' || format === 'pdf') {
                showToast('A gerar documento recortado...');
                const canvas = await html2canvas(nodesLayer, { backgroundColor: '#0f172a', scale: 2 });
                if (format === 'png') {
                    const link = document.createElement('a');
                    link.download = `${mapTitleInput.value}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                } else {
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                    pdf.save(`${mapTitleInput.value}.pdf`);
                }
            } else if (format === 'docx') {
                const { Document, Packer, Paragraph, TextRun } = window.docx;
                const doc = new Document({
                    sections: [{
                        children: [
                            new Paragraph({ children: [new TextRun({ text: mapTitleInput.value, bold: true, size: 32 })] }),
                            ...nodes.map(n => new Paragraph({ children: [new TextRun({ text: `• ${n.text}`, size: 24 })] }))
                        ]
                    }]
                });
                const blob = await Packer.toBlob(doc);
                downloadBlob(blob, `${mapTitleInput.value}.docx`);
            }
        };
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Leitura de Arquivos e IA simulada
function initAIAndFiles() {
    document.getElementById('btnGenerateAI').onclick = () => {
        const prompt = document.getElementById('aiPromptInput').value.trim();
        if (!prompt) return;
        
        nodes = [
            { id: 'node-root', text: prompt, x: 5000, y: 5000, parent: null, color: '#FF5E00' },
            { id: 'n-1', text: 'Conceito Inicial', x: 5250, y: 4900, parent: 'node-root', color: '#38BDF8' },
            { id: 'n-2', text: 'Aplicações Práticas', x: 5250, y: 5000, parent: 'node-root', color: '#4ADE80' },
            { id: 'n-3', text: 'Próximos Passos', x: 5250, y: 5100, parent: 'node-root', color: '#A855F7' }
        ];
        render();
        centerOnNode('node-root', true);
        showToast('Mapa gerado com sucesso!');
    };

    document.getElementById('fileUpload').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(event.target.result);
                    nodes = data.nodes || data;
                } else {
                    const lines = event.target.result.split('\n').filter(l => l.trim() !== '');
                    nodes = [{ id: 'node-root', text: file.name, x: 5000, y: 5000, parent: null, color: '#FF5E00' }];
                    let lastId = 'node-root';
                    lines.forEach((line, idx) => {
                        const id = 'node-' + idx;
                        nodes.push({ id, text: line.trim(), x: 5250, y: 4900 + (idx * 80), parent: lastId, color: '#38BDF8' });
                        lastId = id;
                    });
                }
                render();
                centerOnNode('node-root', true);
                showToast('Ficheiro importado com sucesso!');
            } catch (err) {
                showToast('Erro ao ler o ficheiro.');
            }
        };
        reader.readAsText(file);
    };
}

// Autenticação e Logout
function initAuth() {
    const authModal = document.getElementById('authModal');
    const btnLoginModal = document.getElementById('btnLoginModal');
    const btnLogout = document.getElementById('btnLogout');
    const btnAuthSubmit = document.getElementById('btnAuthSubmit');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const authTitle = document.getElementById('authTitle');
    let isRegistering = false;

    btnLoginModal.onclick = () => authModal.classList.remove('hidden');
    document.getElementById('closeAuthModal').onclick = () => authModal.classList.add('hidden');

    toggleAuthMode.onclick = (e) => {
        e.preventDefault();
        isRegistering = !isRegistering;
        authTitle.textContent = isRegistering ? 'Criar Conta no Genius Mind' : 'Entrar no Genius Mind';
        btnAuthSubmit.textContent = isRegistering ? 'Registar' : 'Entrar';
        toggleAuthMode.textContent = isRegistering ? 'Entrar' : 'Registe-se';
    };

    btnAuthSubmit.onclick = async () => {
        const email = authEmail.value;
        const pass = authPassword.value;
        try {
            if (isRegistering) {
                await auth.createUserWithEmailAndPassword(email, pass);
                showToast('Conta criada com sucesso!');
            } else {
                await auth.signInWithEmailAndPassword(email, pass);
                showToast('Sessão iniciada com sucesso!');
            }
            authModal.classList.add('hidden');
        } catch (err) {
            showToast('Erro: ' + err.message);
        }
    };

    btnLogout.onclick = async () => {
        await auth.signOut();
        showToast('Sessão terminada.');
    };

    document.getElementById('btnForgotPass').onclick = async () => {
        const email = authEmail.value;
        if (!email) {
            showToast('Insira o seu e-mail primeiro.');
            return;
        }
        try {
            await auth.sendPasswordResetEmail(email);
            showToast('E-mail de recuperação enviado!');
        } catch (e) {
            showToast('Erro: ' + e.message);
        }
    };

    auth.onAuthStateChanged(user => {
        if (user) {
            btnLoginModal.classList.add('hidden');
            btnLogout.classList.remove('hidden');
            btnLogout.textContent = `🚪 Sair (${user.email.split('@')[0]})`;
        } else {
            btnLoginModal.classList.remove('hidden');
            btnLogout.classList.add('hidden');
        }
    });
}
