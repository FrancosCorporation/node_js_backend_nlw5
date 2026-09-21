# node_js_backend_nlw5

## 🐳 Instalação e Execução (Docker) — recomendado

### Pré-requisitos
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose

### Rodar com Docker
```bash
docker compose up --build
```


### Sem Docker (local)
```bash
npm install
npm start
```
Servicos necessarios (local): sqlite


**Projeto de estudo** — back-end de um chat de atendimento (suporte) construído com Node.js, TypeORM e Socket.IO durante a Next Level Week 5 da Rocketseat, trilha Node.js, em abril de 2021.

![TypeScript](https://img.shields.io/badge/TypeScript-4-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat&logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat&logo=socket.io&logoColor=white)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)
![Status](https://img.shields.io/badge/status-projeto%20de%20estudo-blue)

## Sobre

Exercício de estudo que implementa o back-end do chat da NLW 5: um cliente inicia a conversa informando o e-mail, escolhe um atendente disponível e troca mensagens em tempo real via WebSocket. Inclui configurações do atendente, cadastro de usuários, histórico de mensagens e duas interfaces HTML prontas (cliente e admin) servidas pela própria API.

## Funcionalidades

Comprovadas pelo código:

- Rotas REST em `src/routes.ts`:
  - `POST /settings`, `GET /settings/:username`, `PUT /settings/:username` — preferências do atendente (`src/Controllers/SettingsController.ts`);
  - `POST /users` — cadastro por e-mail (`src/Controllers/UsersControllers.ts`);
  - `POST /messages`, `GET /messages/:id` — envio e listagem de mensagens (`src/Controllers/MessagesController.ts`);
- Interfaces `/client` e `/admin` renderizando os HTMLs de `public/` com EJS (`src/http.ts`);
- WebSocket com Socket.IO (`src/webSocket/client.ts`, `src/webSocket/admin.ts`):
  - cliente: `client_first_access`, `client_list_all_messages`, `client_send_to_admin`;
  - admin: `admin_list_all_users`, `admin_list_messages_by_user`, `admin_send_message`, `admin_user_in_support`;
- Persistência com TypeORM + SQLite e 4 migrations: `settings`, `users`, `messages`, `connections` (`src/DataBase/migrations/`);
- Front-end estático do chat (HTML/CSS/JS + imagens) em `public/`.

## Stack

- **Node.js + Express 4** com **TypeScript**
- **Socket.IO 4** (+ `socket.io-client`)
- **TypeORM 0.2** + **SQLite** (`sqlite3`)
- **EJS** para servir as páginas do chat
- **uuid**, **reflect-metadata**, **ts-node-dev**

## Como rodar

Requer configuração de ambiente. O `ormconfig.json` aponta para `./src/database/...` (minúsculo), mas o código versionado está em `src/DataBase/` (maiúsculo) — em sistemas sensíveis a maiúsculas (Linux) ajuste os caminhos do `ormconfig.json` antes de rodar.

```bash
yarn install
yarn typeorm migration:run   # cria as tabelas no SQLite (após ajustar o caminho)
yarn dev                     # sobe o servidor em http://localhost:3333
```

Páginas prontas:

- Cliente: `http://localhost:3333/client`
- Atendente: `http://localhost:3333/admin`

O banco `src/DataBase/database.sqlite` está versionado com dados de teste do estudo.

## Estrutura do projeto

```
.
├── ormconfig.json
└── src/
│   ├── Controllers/       # Settings, Users, Messages
│   ├── DataBase/          # conexão, migrations e SQLite
│   ├── Repositories/      # repositórios TypeORM
│   ├── Service/           # regras de negócio
│   ├── entities/          # Setting, User, Message, Connection
│   ├── webSocket/         # eventos client.ts / admin.ts
│   ├── http.ts            # Express + Socket.IO + views
│   ├── routes.ts
│   └── server.ts
└── public/
    ├── html/              # client.html e admin.html
    ├── css/               # styles.css
    ├── js/                # chat.js e admin.js
    └── images/            # ícones do chat
```

## Observações

- As pastas misturam PascalCase e lowercase (`Controllers`, `Service`, `DataBase`) porque fazem parte do histórico do estudo; foram mantidas como estão.
- Os arquivos HTML/CSS/JS do cliente são os originais do evento, com comentários em português.

## Licença

MIT — veja [LICENSE](LICENSE).
