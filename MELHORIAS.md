# MELHORIAS — node_js_backend_nlw5
> **Gerado por análise de código em 2026-10-05** · Stack: Express + Socket.IO + TypeORM/SQLite (NLW5) · Branch: `main`

## Estado da execução · 2026-10-12

- [x] **SEC-01, SEC-02, SEC-03, SEC-04:** namespaces separados, sessão administrativa JWT, sessão de cliente assinada por navegador, validação de dados, rotas administrativas protegidas e renderização segura com `textContent`.
- [x] **SEC-05:** sockets administrativos e de cliente são encerrados no instante da expiração JWT; o cliente limpa a sessão local e solicita novo login/conversa.
- [x] **BUG-01, BUG-02, BUG-03:** configuração TypeORM com caminhos portáveis, banco de teste removido do Git e preservado localmente, identidade administrativa estável e interface corrigida.
- [ ] **TEST-01:** testes automatizados não foram adicionados nem executados nesta tarefa; build, lint, auditoria de dependências e validações de configuração foram usados.
- [ ] **DEVOPS-01:** workflow de CI valida `npm ci`, build e lint em `main`; falta o passo `npm test`, bloqueado junto com TEST-01.
- [x] **DEVOPS-03:** CI estática ampliada a Node 22/24, audit de dependências e validação Compose; runner fixo e actions atuais. A faixa do Node agora coincide com o requisito de TypeORM 1.1.2. Sem testes ou serviços.
- [x] **DEVOPS-02, DOC-01:** imagem multi-stage não-root com `PORT` e healthcheck; porta Compose vinculada a `127.0.0.1`; instruções de configuração/segurança atualizadas.

## 0. Como usar este documento

Cada item segue um contrato fixo de 6 campos:

- **Arquivo:** arquivo(s) lido(s) com suas linhas no repositório `main`;
- **Evidência:** trecho/fato verificado por leitura direta (nada especulado);
- **Impacto:** o que acontece se não corrigir;
- **Mudança:** a correção concreta proposta;
- **Aceite:** condição objetiva de aceite da mudança;
- **Verificação:** comandos `bash` reproduzíveis para confirmar o problema hoje e o estado correto depois.

Severidade: **[P0]** risco de segurança ativo agora · **[P1]** defeito grave (dado exposto/quebra) · **[P2]** dívida de qualidade/processo · **[P3]** cosmético. Prefixos: `SEC` segurança, `BUG` defeito funcional, `TEST` testes, `DEVOPS` infra, `DOC` documentação. Execute as verificações de cada item em ordem; a seção 8 traz a ordem de execução recomendada (waves).

## 1. Diagnóstico executivo

**Bem:**

- Servidor único Express + Socket.IO com páginas `/client` e `/admin` servidas via EJS (`src/http.ts:10-20`) e rotas REST centralizadas (`src/routes.ts:25-32`).
- Persistência com TypeORM + 4 migrations versionadas (`src/DataBase/migrations/`) e repositórios/serviços separados (`src/Repositories/`, `src/Service/`).
- `.dockerignore` (exclui `node_modules`, `.git`, `.env`) e `.gitignore` presentes; Dockerfile baseado em `node:20-alpine` com `npm ci`.
- README extenso (4,3 KB) documentando stack, rotas, eventos e estrutura — inclui alerta honesto sobre o mismatch de caixa de caminhos (`README.md:59`).

**Quebrado:**

- **Autenticação ZERO no WebSocket admin**: `src/webSocket/admin.ts` registra `admin_list_messages_by_user`, `admin_send_message` e `admin_user_in_support` sem `io.use()` nem token — e `admin.ts`/`client.ts` compartilham o **mesmo** `io` default (`src/http.ts:24`), logo qualquer socket de cliente também recebe os handlers `admin_*`.
- **Sem namespaces separados**: a premissa "namespaces admin/client" não existe no código — ambos os arquivos fazem `io.on("connect")` sobre o mesmo servidor importado de `../http`.
- Identidade de atendente = `socket.id` (`admin.ts:26`, `admin.ts:38`) — sem credencial.
- `ormconfig.json` aponta para `./src/database/...` (minúsculo) mas o código está em `src/DataBase/` — quebra em sistemas case-sensitive; o próprio README admite (`README.md:59`).
- Zero testes, zero CI, `docker-compose.yml` inexistente apesar do README mandar `docker compose up --build` (`README.md:10`).

## 2. Tabela de prioridades

| ID | Sev | Área | Esforço | Risco se não corrigir |
|----|-----|------|---------|------------------------|
| SEC-01 | [P0] | Segurança WS | Médio | Qualquer pessoa lê conversas de qualquer cliente |
| SEC-02 | [P1] | Segurança WS | Pequeno | Impersonação por e-mail e vazamento de histórico |
| SEC-03 | [P1] | Segurança Web | Pequeno | XSS armazenado executado na sessão do atendente |
| SEC-04 | [P1] | Segurança REST | Pequeno | Histórico de mensagens exposto por ID sem sessão |
| BUG-01 | [P1] | Infra/Banco | Pequeno | Setup quebra no Linux; dados de teste versionados |
| BUG-02 | [P1] | Segurança WS | Médio | Qualquer socket se passa por atendente |
| BUG-03 | [P2] | Front-end | Pequeno | Mensagens do atendente não exibem data; lista errada |
| TEST-01 | [P2] | Qualidade | Médio | Regressões passam despercebidas |
| DEVOPS-01 | [P2] | Processo | Pequeno | Nada é validado automaticamente no push |
| DEVOPS-02 | [P2] | Docker | Pequeno | Imagem root, roda TS em runtime, `PORT` ignorado |
| DOC-01 | [P2] | Documentação | Pequeno | Instrução de Docker que não funciona; segurança não documentada |

## 3. Segurança

### SEC-01 [P0] WebSocket admin sem autenticação — qualquer socket lê conversas de qualquer usuário

**Arquivo:** `src/webSocket/admin.ts` (linhas 5–43), `src/http.ts` (linha 24), `public/js/admin.js` (linha 1)

**Evidência:** `src/webSocket/admin.ts:5` abre `io.on("connect", ...)` e, dentro, registra `admin_list_messages_by_user` (linha 13) que chama `messagessService.listByUser(user_id)` e devolve **todas** as mensagens via `callback(allMessages)` (linhas 16–17); `admin_send_message` (linha 20) grava mensagem como admin; `admin_user_in_support` (linha 36) assume o atendimento. Não existe `io.use()`, JWT, header ou qualquer middleware — `grep -rn "io.use\|jwt\|token\|auth" src/` não retorna nada. `public/js/admin.js:1` conecta com `const socket = io();` (sem credencial). Além disso, `admin.ts` e `client.ts` importam o mesmo `io` de `src/http.ts:24` (namespace default único) — não há namespaces `admin`/`client` separados, logo um socket aberto pela página de cliente também recebe todos os handlers `admin_*`.

**Impacto:** Qualquer pessoa que alcance a porta 3333 emite `admin_list_messages_by_user` com `{user_id}` arbitrário e lê a conversa completa de qualquer cliente; também pode enviar mensagens em nome do suporte e assumir atendimentos. Violação direta de confidencialidade e integridade do canal de suporte.

**Mudança:** implementar handshake autenticado: (1) separar em namespaces — `io.of("/admin")` para atendente e `io.of("/client")` para cliente; (2) no namespace admin, middleware `io.of("/admin").use((socket, next) => ...)` que valida um token (JWT assinado com segredo do servidor ou token opaco persistido) enviado em `socket.handshake.auth.token` — falha ⇒ `next(new Error("unauthorized"))`; (3) dentro dos handlers `admin_*`, guardar `socket.data.adminId` vindo do token e recusar a operação quando `!socket.data.adminId`; (4) fazer `public/js/admin.js` enviar o token no connect: `io("/admin", { auth: { token } })`.

**Aceite:** Conexão ao namespace admin sem token é rejeitada no handshake; com token inválido, rejeitada; com token válido, os três eventos `admin_*` funcionam e toda resposta identifica o atendente por `socket.data.adminId` (nunca mais `socket.id`). Um socket conectado pelo `/client` não tem acesso a nenhum evento `admin_*`.

**Verificação:**
```bash
# Confirma que hoje NÃO existe autenticação em src/
grep -rn "io.use\|handshake.auth\|jwt" /home/servidor/Git/node_js_backend_nlw5/src/ || echo "SEM AUTH (problema confirmado)"

# Confirma que o cliente admin conecta sem token
grep -n "const socket = io()" /home/servidor/Git/node_js_backend_nlw5/public/js/admin.js

# Após a correção, deve encontrar o middleware e o envio de token:
grep -rn "io.use\|handshake.auth" /home/servidor/Git/node_js_backend_nlw5/src/webSocket/
grep -n "auth:" /home/servidor/Git/node_js_backend_nlw5/public/js/admin.js
```

### SEC-02 [P1] client.ts aceita `email`/`text` sem validação — impersonação e vazamento de histórico

**Arquivo:** `src/webSocket/client.ts` (linhas 15–54, 56–69)

**Evidência:** Em `client_first_access` (linha 15) os parâmetros são apenas castados: `const { text, email } = params as IParams;` (linha 17) — não há checagem de formato de e-mail, tamanho ou presença. Se `usersService.findByEmail(email)` encontrar o usuário (linha 20), o servidor assume aquele `user_id` (linha 31) e devolve o histórico completo: `const allMessages = await messagesService.listByUser(user_id); socket.emit("client_list_all_messages", allMessages);` (linhas 49–50). Em `client_send_to_admin` (linha 56), `socket_admin_id` é aceito direto do payload (linha 57) e usado em `io.to(socket_admin_id)` (linha 64), sem validar que aquele socket é de fato um atendente.

**Impacto:** Bastante conhecer (ou enumerar) um e-mail já cadastrado para emitir `client_first_access` e receber toda a conversa da vítima — hijack de sessão de chat sem senha. `text` sem sanitização alimenta o XSS do SEC-03. `socket_admin_id` arbitrário permite direcionar mensagens a sockets não previstos.

**Mudança:** validar `email` com regex/`validator` e limitar `text` (não vazio, tamanho máx., tipo string) antes de qualquer consulta; provar posse do e-mail (código enviado por e-mail ou sessão persistida em cookie/`localStorage` assinado) antes de devolver `listByUser`; em `client_send_to_admin`, ignorar o `socket_admin_id` do payload e resolver no servidor via `connectionsService.findBySocketId(socket.id)` + `connection.admin_id`.

**Aceite:** Payload sem `email` válido ou sem `text` válido é rejeitado com erro ao cliente; `client_first_access` com e-mail de terceiro não devolve histórico sem prova de posse; mensagens só são roteadas para o `admin_id` registrado na conexão do próprio socket.

**Verificação:**
```bash
# Confirma o cast sem validação
grep -n "params as IParams" /home/servidor/Git/node_js_backend_nlw5/src/webSocket/client.ts

# Confirma devolução do histórico por e-mail enviado pelo próprio cliente
grep -n "listByUser(user_id)" /home/servidor/Git/node_js_backend_nlw5/src/webSocket/client.ts

# Após a correção deve haver validação explícita
grep -rn "email.match\|isEmail\|zod\|yup" /home/servidor/Git/node_js_backend_nlw5/src/webSocket/client.ts
```

### SEC-03 [P1] XSS armazenado: texto/e-mail do cliente injetados via `innerHTML` na tela do atendente

**Arquivo:** `public/js/admin.js` (linhas 51–52, 59, 84, 107–108), `src/webSocket/client.ts` (linhas 45–48)

**Evidência:** O cliente grava `text` cru no banco (`messagesService.create({ text, user_id })` em `client.ts:45-48`) sem sanitização. A tela do atendente injeta valores do servidor direto em `innerHTML`: `createDiv.innerHTML = \`<span>${connection.user.email} </span>\`` e `createDiv.innerHTML += \`<span>${message.text}</span>\`` (`admin.js:51-52`); idem em `admin.js:59` (`${message.text}`), `admin.js:84` e `admin.js:107-108` (`${connection.user.email}`, `${data.message.text}`). O e-mail também é controlado pelo usuário no `client_first_access`, ou seja, ambos os pontos de injeção são atacáveis.

**Impacto:** Um cliente envia `<img src=x onerror=...>` como mensagem ou e-mail; quando o atendente abre o atendimento, o script executa no contexto da página `/admin` — roubo de token (quando o SEC-01 for implementado), ações em nome do atendente e exfiltração da lista de usuários exibida na tela.

**Mudança:** escapar todo dado antes do DOM em `admin.js`: criar `span` com `textContent` em vez de `innerHTML` com template literal, ou usar `Mustache.render` com `{{variável}}` (escapa por padrão, já é usado em `chat.js`). Manter `innerHTML` apenas para markup estático confiável.

**Aceite:** Nenhum `${...}` vindo de servidor é concatenado em `innerHTML` em `public/js/admin.js`; payload `<script>`/`onerror=` vindo do cliente aparece como texto puro na conversa.

**Verificação:**
```bash
# Aponta os pontos de injeção atuais (deve zerar após a correção)
grep -n 'innerHTML.*\${' /home/servidor/Git/node_js_backend_nlw5/public/js/admin.js

# Teste manual: enviar como mensagem do cliente
#   <img src=x onerror="document.title='XSS'">
# e confirmar que o título da página /admin NÃO muda.
```

### SEC-04 [P1] Rotas REST sem qualquer sessão — histórico de mensagens acessível por ID

**Arquivo:** `src/routes.ts` (linhas 25–32), `src/http.ts` (linhas 30–31)

**Evidência:** `routes.ts` declara 6 rotas (`POST /settings`, `GET /settings/:username`, `PUT /settings/:username`, `POST /users`, `POST /messages`, `GET /messages/:id`) sem nenhum middleware de autenticação entre o `Router()` e os controllers; `grep -rn "auth\|token\|jwt" src/` não encontra nada em lugar algum do backend. `src/http.ts:30-31` faz `app.use(express.json()); app.use(routes);` — qualquer chamador anônimo alcança todos os handlers.

**Impacto:** `GET /messages/:id` devolve o histórico de um usuário apenas conhecendo/adivinhando o ID (enumerável, pois `POST /users` retorna IDs); `PUT /settings/:username` permite alterar configurações de atendentes sem sessão.

**Mudança:** adotar um middleware Express de autenticação (JWT/opaque token, o mesmo do SEC-01) aplicado a todas as rotas de leitura/escrita sensíveis (`GET/PUT /settings`, `GET /messages`); manter públicas apenas as rotas estritamente necessárias ao anônimo que inicia o chat (`POST /users`, `POST /messages` com rate limit e validação), documentando a escolha.

**Aceite:** `GET /messages/:id` e `PUT /settings/:username` respondem `401` sem token válido e `200` com token; as rotas mantidas públicas validam payload e têm rate limit.

**Verificação:**
```bash
BASE=http://localhost:3333
# Hoje: responde sem sessão (problema confirmado)
curl -s -o /dev/null -w "%{http_code}\n" $BASE/messages/1
# Após a correção deve retornar 401:
curl -s -o /dev/null -w "%{http_code}\n" $BASE/messages/1   # esperado: 401
```

## 4. Bugs e defeitos funcionais

### BUG-01 [P1] `ormconfig.json` aponta para caminho inexistente em Linux e versiona o SQLite de testes

**Arquivo:** `ormconfig.json` (linhas 2–4), `README.md` (linhas 59, 72), `src/DataBase/index.ts` (linhas 1–3)

**Evidência:** Lido o arquivo completo: `{"type": "sqlite", "database": "./src/database/database.sqlite", "migrations": ["./src/database/migrations/**.ts"], ...}` — caminhos todos em `src/database/` (minúsculo), enquanto o diretório real é `src/DataBase/` (maiúsculo, confirmado por `ls src/`). A chave `synchronize` **não existe** no JSON (grep por `synchronize` no repo não retorna ocorrência; o padrão do TypeORM 0.2 é `false`, portanto não há auto-sync — mas também não há declaração explícita). `src/DataBase/index.ts:1-3` chama `createConnection()` que carrega esse `ormconfig.json` automaticamente. O README admite o problema (`README.md:59`: "em sistemas sensíveis a maiúsculas (Linux) ajuste os caminhos") e informa que `src/DataBase/database.sqlite` está versionado com dados de teste (`README.md:72`).

**Impacto:** Em Linux (incluindo a imagem Docker) os caminhos de `database`/`migrations` não resolvem — `typeorm migration:run` e a conexão falham ou criam um segundo arquivo em local inesperado, dependendo do FS. O SQLite versionado no Git expõe dados de teste e gera diff barulhento a cada execução.

**Mudança:** corrigir `ormconfig.json` para `./src/DataBase/database.sqlite` e `./src/DataBase/migrations/**.ts`; declarar `"synchronize": false` explicitamente; remover `src/DataBase/database.sqlite` do versionamento (adicionar ao `.gitignore`) e manter apenas migrations como fonte do schema.

**Aceite:** `npx typeorm migration:run` cria as tabelas do zero em FS case-sensitive com o repositório recém-clonado; `grep synchronize ormconfig.json` mostra `false` explícito; `git status` não acusa o `.sqlite` como tracked.

**Verificação:**
```bash
cd /home/servidor/Git/node_js_backend_nlw5
# Caminho declarado vs real
grep -o '"database": "[^"]*"' ormconfig.json
ls -d src/database src/DataBase 2>&1   # src/database não existe
# sqlite versionado?
git ls-files | grep -i "\.sqlite$"
# Após a correção:
grep -n '"synchronize"' ormconfig.json   # esperado: false
```

### BUG-02 [P1] Identidade de atendente = `socket.id` — aprovação de suporte sem credencial

**Arquivo:** `src/webSocket/admin.ts` (linhas 26, 38), `src/Service/ConnectionsService.ts` (linhas 51–59)

**Evidência:** `admin.ts:26` grava `admin_id: socket.id` na mensagem e `admin.ts:38` chama `connectionsService.updateAdminId(user_id, socket.id)`, que executa `UPDATE connection SET admin_id = ... WHERE user_id = ...` (`ConnectionsService.ts:51-58`). O valor armazenado é o ID de conexão Socket.IO, que (a) não é uma credencial, (b) muda a cada reconexão, (c) é atribuído a qualquer socket que emita `admin_user_in_support` — hoje sem autenticação nenhuma (SEC-01).

**Impacto:** Qualquer conexão pode "assumir" um atendimento e virar dono da conversa; após reconexão do atendente, o `admin_id` antigo fica órfão na tabela `connection` (socket id de uma sessão morta), quebrando filtros por atendente e mantendo conversas presas a um dono inexistente.

**Mudança:** derivar o admin de uma identidade estável vinda do token (`socket.data.adminId`, ex.: UUID/ID de usuário do atendente) definida no middleware do handshake (SEC-01) e usar esse valor em `admin_id`/`updateAdminId`; adotar ID de atendente persistido (tabela `users`/`admins`) em vez de `socket.id`, guardando o `socket_id` atual apenas como roteamento efêmero.

**Aceite:** `admin_id` persistido em `messages`/`connections` é igual ao ID estável do atendente autenticado, idêntico antes e depois de reconexão; nenhum caminho grava `socket.id` em coluna `admin_id`.

**Verificação:**
```bash
grep -n "admin_id: socket.id" /home/servidor/Git/node_js_backend_nlw5/src/webSocket/admin.ts
grep -n "updateAdminId(user_id, socket.id)" /home/servidor/Git/node_js_backend_nlw5/src/webSocket/admin.ts
# Após a correção (nenhuma ocorrência esperada):
grep -rn "admin_id: socket.id" /home/servidor/Git/node_js_backend_nlw5/src/ || echo OK
```

### BUG-03 [P2] `admin.js`: atribuição onde deveria haver comparação e HTML malformado

**Arquivo:** `public/js/admin.js` (linhas 60–62, 85, 97)

**Evidência:** `admin.js:97` usa atribuição no predicado de busca: `(connection) => (connection.socket_id = data.socket_id)` — sempre atribui e retorna o primeiro item da lista, então mensagens recebidas podem ser anexadas à conversa do usuário errado. `admin.js:60` e `admin.js:85` geram HTML com atributo sem fechamento: `` `<span class="admin_date>` `` — a aspas de abertura nunca é fechada, quebrando a classe/formato da data na mensagem do atendente (mesmo bug nos dois trechos).

**Impacto:** Mensagens do cliente aparecem na janela de atendimento de outro usuário (dados cruzados entre conversas) e as datas das mensagens do atendente não são renderizadas com a classe/style esperados.

**Mudança:** trocar `=` por `===` em `admin.js:97` (e proteger contra `find` retornando `undefined`); corrigir para `` class="admin_date" `` nos trechos das linhas 60 e 85.

**Aceite:** Ao receber `admin_receive_message`, a mensagem é anexada somente ao `div` do usuário correto; o HTML gerado tem atributos `class` bem formados (inspector sem erro de parsing).

**Verificação:**
```bash
grep -n "connection.socket_id = data.socket_id" /home/servidor/Git/node_js_backend_nlw5/public/js/admin.js   # após: ===
grep -n 'class="admin_date>' /home/servidor/Git/node_js_backend_nlw5/public/js/admin.js                      # após: sem saída
```

## 5. Qualidade: testes

### TEST-01 [P2] Repositório sem nenhum teste automatizado

**Arquivo:** `package.json` (scripts linhas 9–13, deps linhas 1–23)

**Evidência:** `package.json` não possui script `"test"` (grep por `"test"` = 0 ocorrências); `devDependencies` contém apenas `@types/*`, `ts-node-dev` e `typescript`; `dependencies` não inclui jest, mocha, vitest, supertest nem afins; `find` por `*.test.*`/`*.spec.*` fora de `node_modules` não retorna arquivos. Existem camadas naturais a testar: `src/Service/*` (regras de negócio) e os handlers em `src/webSocket/*`.

**Impacto:** Qualquer refatoração (incluindo as correções de segurança deste plano) pode quebrar silenciosamente o fluxo cliente↔atendente; sem rede de segurança, regressões só aparecem em uso manual.

**Mudança:** adicionar `vitest` (ou `jest` + `ts-jest`) e `supertest` como devDependencies, criar `npm test` rodando testes unitários de `ConnectionsService`/`MessagesService`/`UsersService` (SQLite em memória `:memory:`) e um teste de integração do handshake Socket.IO, cobrindo ao menos: criação de usuário, primeiro acesso, listagem de mensagens e negação de eventos admin sem token.

**Aceite:** `npm test` existe, roda ≥1 teste por service e termina com exit code 0 em ambiente limpo.

**Verificação:**
```bash
cd /home/servidor/Git/node_js_backend_nlw5
grep -c '"test"' package.json          # hoje: 0 → após: >= 1
find . -path ./node_modules -prune -o \( -name '*.test.*' -o -name '*.spec.*' \) -print | head
npm test                               # após: exit 0
```

## 6. DevOps / Infra

### DEVOPS-01 [P2] Sem pipeline de integração contínua

**Arquivo:** raiz do repositório (`.github/` ausente), `package.json`

**Evidência:** Não existe diretório `.github/` nem arquivos `.gitlab-ci.yml`/`.travis.yml` (verificado por `ls`); o `package.json` sequer tem script `test` (ver TEST-01), ou seja, não há o que um pipeline pudesse validar hoje.

**Impacto:** Pushes na branch `main` entram sem checagem de build (`tsc --noEmit`), lint ou testes — os defeitos deste plano podem ser reintroduzidos sem sinalização.

**Mudança:** criar `.github/workflows/ci.yml` disparando em `push`/`pull_request` para `main` com passos: `npm ci`, `npx tsc --noEmit`, `npm test` (após TEST-01) e — quando existir — build da imagem Docker (`docker build .`).

**Aceite:** Toda PR roda a workflow; falha de type-check ou teste bloqueia o merge (branch protection).

**Verificação:**
```bash
cd /home/servidor/Git/node_js_backend_nlw5
ls .github/workflows/ci.yml 2>&1          # hoje: inexistente
# após: workflow presente e com "npm test"
grep -n "npm test" .github/workflows/ci.yml
```

### DEVOPS-02 [P2] Dockerfile: executa TypeScript em runtime, como root e com `PORT` ignorado

**Arquivo:** `Dockerfile` (linhas 1–8), `src/server.ts` (linha 5), `src/` (busca por `process.env`)

**Evidência:** Lido o `Dockerfile` completo: `FROM node:20-alpine`; `RUN npm ci 2>/dev/null || npm install` (resultado do `npm ci` engessado no build); `COPY . .`; `ENV PORT=3333` + `EXPOSE 3333`; `CMD ["npx", "ts-node", "--transpile-only", "src/server.ts"]` — ou seja, **não há estágio de build**: roda `ts-node` com `--transpile-only` (sem checagem de tipos) em produção. Não há `USER` (container roda como root) nem `HEALTHCHECK`. `ENV PORT=3333` é inerte: `grep -rn "process.env" src/` não retorna nada e `src/server.ts:5` faz `http.listen(3333, ...)` hardcoded. O `.dockerignore` existe e está correto (exclui `node_modules`, `.git`, `.env`).

**Impacto:** Boot mais lento e sem validação de tipos em produção, superfície de escalada como root dentro do container e qualquer valor de `PORT` externo (ex.: ambiente que não aceita 3333) é silenciosamente ignorado — o `EXPOSE`/`ENV` mente sobre o comportamento real.

**Mudança:** multi-stage: etapa de build com `tsc` gerando `dist/`, imagem final copiando `dist/` + `node_modules` de produção e rodando `node dist/server.js`; adicionar `USER node`; fazer `server.ts` ler `const port = Number(process.env.PORT) || 3333`; adicionar `HEALTHCHECK` contra `GET /`; travar o `npm ci` (remover o fallback silencioso com `2>/dev/null`).

**Aceite:** Imagem final não contém `ts-node` nem fontes `.ts`, sobe com `USER node`, `PORT=8080 docker run ...` escuta em 8080 e `docker ps` mostra `healthy`.

**Verificação:**
```bash
cd /home/servidor/Git/node_js_backend_nlw5
grep -n "ts-node\|USER\|HEALTHCHECK" Dockerfile        # hoje: ts-node presente, USER/HEALTHCHECK ausentes
grep -rn "process.env" src/ || echo "PORT ignorado (problema confirmado)"
grep -n "http.listen(3333" src/server.ts
# após:
PORT=8080 docker run --rm -p 8080:8080 <imagem> && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
```

## 7. Documentação

### DOC-01 [P2] README instrui `docker compose up` sem arquivo compose e não documenta o modelo (ausente) de segurança

**Arquivo:** `README.md` (linhas 3–19, 59, 72), raiz do repositório

**Evidência:** `README.md:10` manda rodar `docker compose up --build` como forma recomendada, mas a raiz **não contém** `docker-compose.yml` nem `compose.yaml` (verificado por `ls`) — o comando falha com "no configuration file provided". O README também descreve funcionalidades, stack e rotas (linhas 34–56) porém não menciona que o painel `/admin` e os eventos `admin_*` não têm autenticação, nem lista variáveis de ambiente suportadas (não há `.env.example` e `process.env` não é usado no código). O alerta de caixa de caminho (`README.md:59`) e a nota do SQLite versionado (`README.md:72`) já são bons e devem ser mantidos.

**Impacto:** Novo desenvolvedor segue o passo "recomendado" e falha imediatamente; quem implanta o projeto não tem aviso de que `/admin` é aberto — risco de exposição por desconhecimento.

**Mudança:** adicionar um `docker-compose.yml` mínimo (build do `Dockerfile`, porta 3333, volume para o SQLite) **ou** remover a instrução e documentar `docker build`/`docker run`; criar seção "Segurança" declarando o estado atual (sem auth, projeto de estudo) e os passos do SEC-01; incluir `.env.example` com `PORT` e `JWT_SECRET` quando aplicável.

**Aceite:** `docker compose up --build` sobe o chat a partir do repositório limpo; README contém seção de segurança e de variáveis de ambiente coerentes com o código.

**Verificação:**
```bash
cd /home/servidor/Git/node_js_backend_nlw5
ls docker-compose.yml compose.yaml 2>&1                 # hoje: inexistente
grep -n "docker compose up" README.md                   # instrução presente
grep -in "segurança\|autenticação" README.md || echo "seção de segurança ausente"
# após: compose existe e "docker compose config" valida
docker compose config >/dev/null && echo OK
```

## 8. Ordem de execução (waves)

- **Wave 0 — Emergência (SEC-01, SEC-02, BUG-02):** fechar o WebSocket. Namespaces separados + middleware `io.use` com token no handshake do admin; validação de `email`/`text` no `client_first_access`; `admin_id` derivado do token. É a única wave com bloqueio de release.
- **Wave 1 — Superfície de dados (SEC-03, SEC-04, BUG-01):** escapar `innerHTML` em `admin.js`; middleware de auth nas rotas REST sensíveis; corrigir `ormconfig.json` (caminhos + `synchronize: false` explícito) e desversionar o `.sqlite`.
- **Wave 2 — Qualidade (TEST-01, BUG-03):** setup de testes + testes dos services e do handshake; corrigir `=` vs `===` e o HTML malformado em `admin.js`.
- **Wave 3 — Entrega contínua (DEVOPS-01, DEVOPS-02, DOC-01):** pipeline CI (type-check + testes + build da imagem), Dockerfile multi-stage com `USER`/`PORT`/`HEALTHCHECK`, `docker-compose.yml` + seção de segurança no README.

Cada wave só inicia quando a anterior estiver com todos os itens em "Aceite" cumprido e verificações passando.

## 9. Fora de escopo / riscos

- **Fora de escopo:** reescrita do stack (troca de TypeORM/SQLite/Socket.IO), redesign visual das páginas, multi-tenancy, rate limiting avançado/WAF, migração para PostgreSQL. Endurecimento de TLS/cabeçalhos HTTP (helmet/HSTS) fica para quando houver implantação pública — hoje não há proxy reverso documentado.
- **Riscos do plano:** (1) introduzir token no handshake exige mudança coordenada em `admin.js` — versões de página em cache podem falhar ao conectar, portanto versionar o front junto; (2) exigir auth nas rotas REST pode quebrar clientes que consomem a API — validar uso antes; (3) corrigir o `ormconfig.json` muda o arquivo `.sqlite` efetivamente usado — backup do banco atual antes de rodar migrations; (4) remover o SQLite do Git exige ajustar o `.gitignore` sem apagar o arquivo local de quem já desenvolve.
- **Premissa:** o projeto é declarado como estudo (`README.md:22`), mas está versionado publicamente e pronto para rodar — as correções P0/P1 seguem necessárias mesmo para estudo, para não ensinar o padrão errado.

## 10. Definição de pronto (DoD)

O plano está concluído quando **todos** os itens abaixo forem verdadeiros:

1. `grep -rn "io.use\|handshake.auth" src/webSocket/` encontra o middleware e conectar sem token no namespace admin é rejeitado (SEC-01).
2. `client_first_access` valida `email`/`text` e não devolve histórico sem prova de posse (SEC-02).
3. `grep -n 'innerHTML.*\${' public/js/admin.js` não retorna valores interpolados de dados do servidor (SEC-03).
4. `curl $BASE/messages/1` sem token retorna `401` (SEC-04).
5. `ormconfig.json` aponta para `src/DataBase/`, declara `"synchronize": false` e o `.sqlite` não está trackeado pelo Git (BUG-01).
6. Nenhuma escrita de `admin_id: socket.id` permanece em `src/` (BUG-02).
7. `grep -n "connection.socket_id = data.socket_id"` e `class="admin_date>` não retornam ocorrências (BUG-03).
8. `npm test` existe e termina com exit code 0 (TEST-01).
9. Workflow de CI roda em toda PR com type-check + testes (DEVOPS-01).
10. Imagem final roda sem `ts-node`, como usuário não-root, respeitando `PORT` e com `HEALTHCHECK` (DEVOPS-02).
11. `docker compose up --build` funciona do repositório limpo e o README documenta o modelo de segurança (DOC-01).
12. Todas as verificações bash dos 11 itens retornam o estado "após a correção" e as waves 0–3 estão fechadas.

*Fim do plano. Gerado por leitura direta do código em 2026-10-05 — cada Evidência aponta para linha lida no repositório `main` de `node_js_backend_nlw5`; nenhum arquivo:linha foi inferido.*






