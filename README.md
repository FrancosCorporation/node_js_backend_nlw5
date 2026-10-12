# Chat de suporte · NLW 5

Backend de atendimento em tempo real com Express, Socket.IO, TypeORM e SQLite. O projeto foi atualizado para uma execução local com credenciais administrativas geradas por instalação, conversas de cliente retomáveis por sessão e painel de atendente autenticado.

## Requisitos

- Node.js 22.13 ou mais recente na linha 22, ou Node.js 24.11 ou mais recente na linha 24; npm 9 ou mais recente;
- Docker Engine com Compose v2, se preferir rodar em container.

## Começar com Docker

O primeiro comando cria `.env` com segredo JWT, usuário e senha aleatórios e prepara o diretório privado do banco. Guarde as credenciais locais; o arquivo `.env` não deve ser enviado ao Git.

```bash
make init
make up
```

Abra <http://localhost:3333/client> para o cliente e <http://localhost:3333/admin> para o painel. Para ver as credenciais geradas, consulte o arquivo `.env` local em um terminal privado. Para parar e remover o container:

```bash
make down
```

O SQLite fica em `database/chat.sqlite`, fora do histórico do Git. O volume mantém o banco após a remoção do container. O container usa usuário `node`, filesystem somente leitura e permissões Linux reduzidas. A porta do host é vinculada a `127.0.0.1`; coloque o proxy HTTPS no mesmo host se precisar publicar o chat.

## Rodar localmente

```bash
make init
npm ci
npm run dev
```

O servidor usa `http://127.0.0.1:3333`. `npm run build` gera `dist/`; depois use `npm start`. O caminho do banco pode ser alterado por `DATABASE_PATH`.

## Experiência do cliente

O cliente informa o e-mail e a primeira mensagem. Cada navegador recebe um ID aleatório de sessão e um token assinado guardado no `localStorage`; a sessão pode ser retomada no mesmo navegador. O e-mail identifica a conversa para o atendente, mas não concede acesso a conversas antigas. Se o armazenamento do navegador for apagado, é necessário iniciar uma nova conversa. O banco legado é preservado e os históricos antigos continuam disponíveis no painel do atendente.

## Autenticação e segurança

- O painel `/admin` exige o usuário e a senha gerados em `.env`.
- O namespace Socket.IO `/admin` e as rotas administrativas usam JWT com expiração; os sockets são desconectados quando o token expira. `/client` e `/admin` são namespaces separados.
- Apenas a leitura de `GET /settings/:username` é pública para que a interface cliente verifique se o suporte está ativo.
- Texto, e-mail e outros valores do cliente são inseridos no DOM como texto; a política CSP bloqueia scripts inline e conteúdo externo.
- O sistema valida entradas, aplica limites para tentativas de login e eventos de chat, e limita requisições JSON a 32 KB.
- Use HTTPS atrás de um proxy confiável ao publicar o serviço na internet. Faça backup regular do diretório `database/`.

## Rotas REST

| Rota                      | Acesso            | Descrição                                             |
| ------------------------- | ----------------- | ----------------------------------------------------- |
| `POST /admin/session`     | Público, limitado | Gera token de atendente com usuário e senha de `.env` |
| `GET /settings/:username` | Público           | Informa se o chat está disponível                     |
| `POST /settings`          | Atendente         | Cria configuração de chat                             |
| `PUT /settings/:username` | Atendente         | Atualiza disponibilidade                              |
| `POST /users`             | Atendente         | Cadastra usuário legado                               |
| `POST /messages`          | Atendente         | Registra mensagem administrativa                      |
| `GET /messages/:id`       | Atendente         | Lista histórico por ID de usuário                     |
| `GET /health`             | Público           | Retorna estado do banco e do servidor                 |

Envie rotas administrativas com `Authorization: Bearer <token>`. O token é obtido por `POST /admin/session` com JSON `{ "username": "...", "password": "..." }`.

## Eventos Socket.IO

- Cliente em `/client`: `client_first_access`, `client_resume`, `client_send_to_admin`, `client_list_all_messages`, `client_session`, `client_message_sent`, `admin_send_to_client`.
- Atendente em `/admin`: `admin_list_all_users`, `admin_user_in_support`, `admin_list_messages_by_user`, `admin_send_message`, `admin_receive_message`.
- A autenticação administrativa é enviada no handshake como `auth: { token }`. Mensagens são roteadas pelo servidor usando a sessão e a conversa associadas ao socket.

## Configuração

`make init` gera os valores secretos automaticamente. Variáveis suportadas:

| Variável         | Padrão / regra          | Uso                                                              |
| ---------------- | ----------------------- | ---------------------------------------------------------------- |
| `HOST`           | `127.0.0.1`             | Endereço de escuta; Compose define `0.0.0.0` dentro do container |
| `PORT`           | `3333`                  | Porta HTTP e Socket.IO                                           |
| `JWT_SECRET`     | gerado; mínimo 32 bytes | Assinatura de sessões                                            |
| `ADMIN_ID`       | UUID v4 gerado          | Identidade estável do atendente                                  |
| `ADMIN_USERNAME` | gerado                  | Login do painel                                                  |
| `ADMIN_PASSWORD` | gerado; mínimo 20 bytes | Senha do painel                                                  |
| `DATABASE_PATH`  | `database/chat.sqlite`  | Arquivo SQLite                                                   |

## Qualidade

```bash
npm run build
npm run lint
npm audit
docker compose config
```

O workflow do GitHub Actions executa instalação limpa, audit de dependências, build TypeScript e lint em Node 22/24 em `push` e pull request para `main`.

## Licença

MIT — consulte [LICENSE](LICENSE).
