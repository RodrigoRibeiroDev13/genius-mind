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

let nodes = [
    { id: 'node-root', text: 'Meu Mapa Estratégico', x: 5000, y: 5000, parent: null, color: '#FF5E00' }
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

let nodesLayer, connectionsLayer, canvasStage, canvasWrapper, zoomLabel, nodeToolbar, mapTitleInput, toastEl;

window.onload = () => {
    nodesLayer = document.getElementById('nodesLayer');
    connectionsLayer = document.getElementById('connectionsLayer');
    canvasStage = document.getElementById('canvasStage');
    canvasWrapper = document.getElementById('canvasWrapper');
    zoomLabel = document.getElementById('zoomLabel');
    nodeToolbar = document.getElementById('nodeToolbar');
    mapTitleInput = document.getElementById('mapTitle');
    toastEl = document.getElementById('toast');

    initAuth();
    initCanvasInteractions();
    initToolbarActions();
    initDownloadMenu();
    initAIAndFiles();
    initMyMapsModal();
    loadMapFromURL();
    
    centerOnNode('node-root');
    render();
};

function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

// Renderização Geral de Nós e Linhas Dinâmicas (SVG)
function render() {
    if (!nodesLayer || !connectionsLayer) return;
    nodesLayer.innerHTML = '';
    connectionsLayer.innerHTML = '';

    // 1. Desenhar Linhas de Conexão SVG em tempo real baseadas na posição exata dos nós
    nodes.forEach(node => {
        if (node.parent) {
            const parent = nodes.find(n => n.id === node.parent);
            if (parent) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const x1 = parent.x + 100;
                const y1 = parent.y + 30;
                const x2 = node.x + 100;
                const y2 = node.y + 30;
                const curve = `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`;
                
                line.setAttribute('d', curve);
                line.setAttribute('stroke', node.color || '#334155');
                line.setAttribute('stroke-width', '3.5');
                line.setAttribute('fill', 'none');
                connectionsLayer.appendChild(line);
            }
        }
    });

    // 2. Desenhar Nós Interativos
    nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = `map-node ${node.id === selectedNodeId ? 'selected' : ''}`;
        if (node.id === 'node-root') el.classList.add('root-node');
        el.id = node.id;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.style.borderColor = node.color || '#334155';
        el.textContent = node.text;

        // Clique simples para selecionar o nó e exibir a barra flutuante
        el.addEventListener('click', (e) => {
            selectedNodeId = node.id;
            updateNodeToolbar();
            render();
            e.stopPropagation();
        });

        // Duplo clique aciona diretamente a edição fiável
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            abrirEditorTexto(node.id);
        });

        // Arrastar Nó (Drag & Drop com atualização fluída das linhas em tempo real)
        el.addEventListener('mousedown', (e) => {
            selectedNodeId = node.id;
            draggingNodeId = node.id;
            
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

// Função de edição de texto 100% fiável por prompt/input controlado
function abrirEditorTexto(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const novoTexto = prompt("Editar texto do subtópico:", node.text);
    if (novoTexto !== null) {
        node.text = novoTexto.trim() || 'Sem título';
        render();
        showToast('Texto atualizado com sucesso!');
    }
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
                render(); // Recalcula as linhas SVG em tempo real à medida que arrastas!
            }
        }
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        draggingNodeId = null;
    });

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
        if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }, { passive: false });

    document.getElementById('btnZoomIn').onclick = () => { scale = Math.min(scale * 1.2, 2.5); applyTransform(); zoomLabel.textContent = `${Math.round(scale * 100)}%`; };
    document.getElementById('btnZoomOut').onclick = () => { scale = Math.max(scale / 1.2, 0.3); applyTransform(); zoomLabel.textContent = `${Math.round(scale * 100)}%`; };
    document.getElementById('btnZoomReset').onclick = () => { scale = 1; applyTransform(); zoomLabel.textContent = '100%'; centerOnNode('node-root'); };
}

function applyTransform() {
    canvasStage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function centerOnNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const wrapperW = canvasWrapper.clientWidth || window.innerWidth;
    const wrapperH = canvasWrapper.clientHeight || window.innerHeight;
    panX = wrapperW / 2 - node.x;
    panY = wrapperH / 2 - node.y;
    applyTransform();
}

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
        nodeToolbar.style.top = `${rect.top - wrapperRect.top - 55}px`;
        nodeToolbar.style.left = `${rect.left - wrapperRect.left + (rect.width / 2) - 130}px`;
        nodeToolbar.classList.remove('hidden');
    }
}

function initToolbarActions() {
    // Botão "Editar" na barra flutuante agora chama a função de edição de texto com segurança
    document.getElementById('btnEditNodeText').onclick = () => {
        if (selectedNodeId) {
            abrirEditorTexto(selectedNodeId);
        }
    };

    document.getElementById('btnAddChild').onclick = () => {
        if (!selectedNodeId) return;
        const parent = nodes.find(n => n.id === selectedNodeId);
        const newId = 'node-' + Date.now();
        nodes.push({
            id: newId,
            text: 'Novo Subtópico',
            x: parent.x + 260,
            y: parent.y + (Math.random() * 120 - 60),
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
            y: node.y + 110,
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
            nodes = [{ id: 'node-root', text: 'Meu Mapa Estratégico', x: 5000, y: 5000, parent: null, color: '#FF5E00' }];
            mapTitleInput.value = 'Meu Mapa Estratégico';
            selectedNodeId = null;
            centerOnNode('node-root');
            render();
        }
    };

    document.getElementById('btnAutoLayout').onclick = () => {
        const root = nodes.find(n => !n.parent);
        if (!root) return;
        root.x = 5000;
        root.y = 5000;
        
        const children = nodes.filter(n => n.parent === root.id);
        children.forEach((child, idx) => {
            child.x = root.x + 320;
            child.y = root.y + (idx - children.length / 2) * 140;
        });
        render();
        showToast('Mapa auto-organizado!');
    };

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
        showToast('Link copiado!');
    };
}

// Gestão de "Meus Mapas" com opção de Excluir 🗑️
function initMyMapsModal() {
    const modal = document.getElementById('myMapsModal');
    const btn = document.getElementById('btnMyMaps');
    const closeBtn = document.getElementById('closeMyMapsModal');
    const listContainer = document.getElementById('savedMapsList');

    btn.onclick = async () => {
        const user = auth.currentUser;
        if (!user) {
            showToast('Faça login para aceder aos seus mapas.');
            document.getElementById('authModal').classList.remove('hidden');
            return;
        }

        modal.classList.remove('hidden');
        listContainer.innerHTML = '<p style="color:var(--gm-muted); text-align:center;">A carregar mapas...</p>';

        try {
            const snapshot = await db.collection('maps').where('owner', '==', user.uid).get();
            if (snapshot.empty) {
                listContainer.innerHTML = '<p style="color:var(--gm-muted); text-align:center; padding: 20px;">Ainda não tem mapas salvos.</p>';
                return;
            }

            listContainer.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const mapId = docSnap.id;

                const item = document.createElement('div');
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--gm-border);';
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = data.title || 'Sem título';
                titleSpan.style.cssText = 'color: #fff; font-weight: 600; cursor: pointer; flex: 1;';
                titleSpan.onclick = () => {
                    nodes = data.nodes || nodes;
                    mapTitleInput.value = data.title || 'Meu Mapa';
                    centerOnNode('node-root');
                    render();
                    modal.classList.add('hidden');
                    showToast('Mapa carregado!');
                };

                const actionsDiv = document.createElement('div');
                actionsDiv.style.cssText = 'display: flex; gap: 8px;';

                const openBtn = document.createElement('button');
                openBtn.textContent = 'Abrir';
                openBtn.className = 'btn btn-primary';
                openBtn.style.cssText = 'padding: 4px 10px; font-size: 0.75rem;';
                openBtn.onclick = titleSpan.onclick;

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '🗑️ Excluir';
                deleteBtn.className = 'btn btn-outline';
                deleteBtn.style.cssText = 'padding: 4px 10px; font-size: 0.75rem; border-color: #ef4444; color: #ef4444;';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm(`Deseja excluir o mapa "${data.title || 'Sem título'}"?`)) {
                        try {
                            await db.collection('maps').doc(mapId).delete();
                            showToast('Mapa excluído com sucesso!');
                            btn.click();
                        } catch (err) {
                            showToast('Erro ao excluir: ' + err.message);
                        }
                    }
                };

                actionsDiv.appendChild(openBtn);
                actionsDiv.appendChild(deleteBtn);
                item.appendChild(titleSpan);
                item.appendChild(actionsDiv);
                listContainer.appendChild(item);
            });
        } catch (err) {
            listContainer.innerHTML = '<p style="color:#ef4444; text-align:center;">Erro ao carregar mapas.</p>';
        }
    };

    closeBtn.onclick = () => modal.classList.add('hidden');
}

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
                centerOnNode('node-root');
                render();
                showToast('Mapa carregado com sucesso!');
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Menus de Download
function initDownloadMenu() {
    document.querySelectorAll('#downloadMenu button').forEach(btn => {
        btn.onclick = async () => {
            const format = btn.getAttribute('data-format');
            if (format === 'json') {
                const blob = new Blob([JSON.stringify({ title: mapTitleInput.value, nodes }, null, 2)], { type: 'application/json' });
                downloadBlob(blob, `${mapTitleInput.value}.json`);
                showToast('Download JSON concluído!');
            } else if (format === 'md') {
                const md = nodes.map(n => `- ${n.text}`).join('\n');
                const blob = new Blob([md], { type: 'text/markdown' });
                downloadBlob(blob, `${mapTitleInput.value}.md`);
                showToast('Download Markdown concluído!');
            } else if (format === 'svg') {
                const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000">${connectionsLayer.innerHTML}${nodesLayer.innerHTML}</svg>`;
                const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                downloadBlob(blob, `${mapTitleInput.value}.svg`);
                showToast('Download SVG concluído!');
            } else if (format === 'png' || format === 'pdf') {
                showToast('A gerar documento...');
                const canvas = await html2canvas(nodesLayer, { backgroundColor: '#0f172a', scale: 2 });
                if (format === 'png') {
                    const link = document.createElement('a');
                    link.download = `${mapTitleInput.value}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                    showToast('Download PNG concluído!');
                } else {
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                    pdf.save(`${mapTitleInput.value}.pdf`);
                    showToast('Download PDF concluído!');
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
                showToast('Download Word (.docx) concluído!');
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

function initAIAndFiles() {
    document.getElementById('btnGenerateAI').onclick = () => {
        const promptText = document.getElementById('aiPromptInput').value.trim();
        if (!promptText) return;
        
        nodes = [
            { id: 'node-root', text: promptText, x: 5000, y: 5000, parent: null, color: '#FF5E00' },
            { id: 'n-1', text: 'Conceito Inicial', x: 5300, y: 4900, parent: 'node-root', color: '#38BDF8' },
            { id: 'n-2', text: 'Aplicações Práticas', x: 5300, y: 5000, parent: 'node-root', color: '#4ADE80' },
            { id: 'n-3', text: 'Próximos Passos', x: 5300, y: 5100, parent: 'node-root', color: '#A855F7' }
        ];
        centerOnNode('node-root');
        render();
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
                        nodes.push({ id, text: line.trim(), x: 5300, y: 4900 + (idx * 90), parent: lastId, color: '#38BDF8' });
                        lastId = id;
                    });
                }
                centerOnNode('node-root');
                render();
                showToast('Ficheiro importado com sucesso!');
            } catch (err) {
                showToast('Erro ao ler o ficheiro.');
            }
        };
        reader.readAsText(file);
    };
}

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
                await auth.createUserWithEmailProvider ? null : auth.createUserWithEmailAndPassword(email, pass);
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
