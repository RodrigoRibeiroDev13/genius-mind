# 🧠 Genius Mind

Um criador de mapas mentais interativo e moderno construído com **HTML, CSS, JavaScript** e integrado com **Firebase (Firestore & Authentication)**.

## 🚀 Funcionalidades

- **Criação e Edição de Nós:** Adiciona tópicos filhos (`Tab`) e irmãos (`Enter`), edita textos com duplo clique e arrasta os nós livremente pelo canvas (`Drag & Drop`).
- **Geração por IA:** Cria mapas mentais estruturados automaticamente a partir de um tema introduzido.
- **Partilha Exclusiva:** Guarda o mapa no Firebase Firestore e gera um link único (`?map=...`) para partilha instantânea.
- **Autenticação:** Sistema de início de sessão e registo de utilizadores via Firebase.
- **Exportação Multiformato:** Baixa os teus mapas em JSON, Markdown (`.md`), Imagem (`.png`), Vetor (`.svg`), PDF e Word (`.docx`).

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Base de Dados & Auth:** Firebase SDK v10.8.0 (Firestore & Auth)
- **Exportação:** html2canvas, jsPDF
