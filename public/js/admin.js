const loginPanel = document.querySelector("#admin_login");
const workspace = document.querySelector("#admin_workspace");
const loginForm = document.querySelector("#admin_login_form");
const loginStatus = document.querySelector("#login_status");
const pageStatus = document.querySelector("#page_status");
const listUsers = document.querySelector("#list_users");
const supports = document.querySelector("#supports");

let socket;
let connectionsUsers = [];
let activeUserId = null;

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("status_error", isError);
}

function setAuthenticated(authenticated) {
  loginPanel.hidden = authenticated;
  workspace.hidden = !authenticated;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function appendMessage(container, { author, text, date, type }) {
  const message = document.createElement("article");
  message.className = type;

  const authorLabel = document.createElement("span");
  authorLabel.className = "message_author";
  authorLabel.textContent = author;

  const content = document.createElement("span");
  content.className = "message_text";
  content.textContent = text;

  const timestamp = document.createElement("time");
  timestamp.className = "admin_date";
  const parsedDate = new Date(date);
  if (!Number.isNaN(parsedDate.getTime()))
    timestamp.dateTime = parsedDate.toISOString();
  timestamp.textContent = formatDate(date);

  message.append(authorLabel, content, timestamp);
  container.append(message);
  container.scrollTop = container.scrollHeight;
}

function renderConnections(connections) {
  connectionsUsers = Array.isArray(connections) ? connections : [];
  listUsers.replaceChildren();

  if (connectionsUsers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty_state";
    empty.textContent = "Nenhuma conversa aguardando atendimento.";
    listUsers.append(empty);
    return;
  }

  connectionsUsers.forEach((connection) => {
    const item = document.createElement("article");
    item.className = "user_card";

    const email = document.createElement("span");
    email.className = "email";
    email.textContent = connection.user?.email ?? "E-mail indisponível";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn_atd";
    button.dataset.userId = connection.user_id;
    button.textContent = connection.admin_id
      ? "Continuar atendimento"
      : "Atender conversa";

    item.append(email, button);
    listUsers.append(item);
  });
}

function openConversation(connection) {
  activeUserId = connection.user_id;
  supports.replaceChildren();

  const panel = document.createElement("section");
  panel.className = "support_panel";
  panel.setAttribute("aria-labelledby", "active_conversation_title");

  const title = document.createElement("h2");
  title.id = "active_conversation_title";
  title.textContent = `Atendimento de ${connection.user?.email ?? "cliente"}`;

  const messages = document.createElement("div");
  messages.className = "admin_list_messages";
  messages.id = `allMessages${connection.user_id}`;
  messages.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "admin_send_message";
  form.id = `send_form_${connection.user_id}`;

  const input = document.createElement("input");
  input.type = "text";
  input.id = `send_message_${connection.user_id}`;
  input.name = "message";
  input.maxLength = 2000;
  input.placeholder = "Escreva uma resposta";
  input.setAttribute("aria-label", "Mensagem para o cliente");
  input.required = true;

  const send = document.createElement("button");
  send.type = "submit";
  send.className = "btn_send";
  send.textContent = "Enviar";

  form.append(input, send);
  panel.append(title, messages, form);
  supports.append(panel);
  setStatus(pageStatus, "Conversa aberta.");

  socket.emit(
    "admin_user_in_support",
    { user_id: connection.user_id },
    (result) => {
      if (result?.error) {
        setStatus(pageStatus, result.error, true);
        return;
      }

      socket.emit(
        "admin_list_messages_by_user",
        { user_id: connection.user_id },
        (history) => {
          if (activeUserId !== connection.user_id) return;
          messages.replaceChildren();
          history.forEach((message) => {
            const fromClient = message.admin_id === null;
            appendMessage(messages, {
              author: fromClient ? connection.user.email : "Atendente",
              text: message.text,
              date: message.created_at,
              type: fromClient ? "admin_message_client" : "admin_message_admin",
            });
          });
        },
      );
    },
  );
}

function connectAdmin(token) {
  socket?.disconnect();
  socket = io("/admin", { auth: { token } });

  socket.on("connect", () => {
    setAuthenticated(true);
    setStatus(pageStatus, "Conectado ao atendimento.");
  });

  socket.on("connect_error", (error) => {
    setAuthenticated(false);
    if (/token|autentica|atendente/i.test(error.message))
      sessionStorage.removeItem("admin_token");
    setStatus(
      loginStatus,
      "Sessão inválida ou indisponível. Entre novamente.",
      true,
    );
  });

  socket.on("chat_error", ({ error }) => setStatus(pageStatus, error, true));
  socket.on("admin_list_all_users", renderConnections);

  socket.on("admin_receive_message", ({ connection, message }) => {
    const known = connectionsUsers.some(
      (item) => item.user_id === connection.user_id,
    );
    if (!known) renderConnections([...connectionsUsers, connection]);
    if (activeUserId !== connection.user_id) return;
    const messageList = document.getElementById(
      `allMessages${connection.user_id}`,
    );
    if (!messageList) return;
    appendMessage(messageList, {
      author: connection.user?.email ?? "Cliente",
      text: message.text,
      date: message.created_at,
      type: "admin_message_client",
    });
  });

  socket.on("admin_message_sent", ({ user_id, message }) => {
    if (activeUserId !== user_id) return;
    const messageList = document.getElementById(`allMessages${user_id}`);
    if (!messageList) return;
    appendMessage(messageList, {
      author: "Atendente",
      text: message.text,
      date: message.created_at,
      type: "admin_message_admin",
    });
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus(loginStatus, "Validando acesso…");

  try {
    const response = await fetch("/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loginForm.elements.username.value,
        password: loginForm.elements.password.value,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível entrar.");

    sessionStorage.setItem("admin_token", body.token);
    loginForm.reset();
    connectAdmin(body.token);
  } catch (error) {
    setStatus(loginStatus, error.message || "Não foi possível entrar.", true);
  } finally {
    submit.disabled = false;
  }
});

listUsers.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-user-id]");
  if (!button || !socket?.connected) return;
  const connection = connectionsUsers.find(
    (item) => item.user_id === button.dataset.userId,
  );
  if (connection) openConversation(connection);
});

supports.addEventListener("submit", (event) => {
  const form = event.target.closest('form[id^="send_form_"]');
  if (!form) return;
  event.preventDefault();
  const input = form.elements.message;
  const text = input.value.trim();
  if (!text || !activeUserId || !socket?.connected) return;
  socket.emit("admin_send_message", { user_id: activeUserId, text });
  input.value = "";
});

document.querySelector("#admin_logout").addEventListener("click", () => {
  sessionStorage.removeItem("admin_token");
  socket?.disconnect();
  setAuthenticated(false);
  listUsers.replaceChildren();
  supports.replaceChildren();
  setStatus(loginStatus, "Sessão encerrada.");
});

const savedToken = sessionStorage.getItem("admin_token");
if (savedToken) connectAdmin(savedToken);
