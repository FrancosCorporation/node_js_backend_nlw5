const sessionStorageKey = "support_chat_session";
const startForm = document.querySelector("#start_chat_form");
const chatPanel = document.querySelector("#chat_in_support");
const helpPanel = document.querySelector("#chat_help");
const messages = document.querySelector("#messages");
const conversationStatus = document.querySelector("#conversation_status");
const startStatus = document.querySelector("#start_status");
const supportButton = document.querySelector("#btn_support");

let socket;
let sessionEmail = "";

function setStatus(message, isError = false, inStartForm = false) {
  const status = inStartForm ? startStatus : conversationStatus;
  status.textContent = message;
  status.classList.toggle("status_error", isError);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function appendMessage({ email, text, date, fromAdmin }) {
  const article = document.createElement("article");
  article.className = fromAdmin ? "chat_message admin" : "chat_message client";

  const author = document.createElement("span");
  author.className = "message_author";
  author.textContent = fromAdmin ? "Atendente" : email;

  const content = document.createElement("span");
  content.className = "message_text";
  content.textContent = text;

  article.append(author, content);
  if (date) {
    const timestamp = document.createElement("time");
    const parsedDate = new Date(date);
    if (!Number.isNaN(parsedDate.getTime()))
      timestamp.dateTime = parsedDate.toISOString();
    timestamp.textContent = formatDate(date);
    article.append(timestamp);
  }
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

function showConversation() {
  helpPanel.hidden = true;
  chatPanel.hidden = false;
  chatPanel.querySelector("#message_user").focus();
}

function showStartForm() {
  chatPanel.hidden = true;
  helpPanel.hidden = false;
}

function connectClient(token, firstAccess) {
  socket?.disconnect();
  socket = io("/client", { auth: token ? { token } : {}, autoConnect: false });

  socket.on("connect", () => {
    if (firstAccess) {
      socket.emit(
        "client_first_access",
        {
          email: startForm.elements.email.value,
          text: startForm.elements.text.value,
        },
        (result) => {
          if (result?.error) {
            setStatus(result.error, true, true);
            socket.disconnect();
            showStartForm();
          }
        },
      );
    } else {
      socket.emit("client_resume");
    }
  });

  socket.on("connect_error", (error) => {
    if (!firstAccess) {
      localStorage.removeItem(sessionStorageKey);
      setStatus("Sua sessão expirou. Inicie uma nova conversa.", true, true);
      showStartForm();
    } else {
      setStatus(error.message || "Não foi possível conectar.", true, true);
    }
  });

  socket.on("client_session", (session) => {
    localStorage.setItem(sessionStorageKey, session.token);
    sessionEmail = session.email;
    showConversation();
    setStatus("Conectado ao suporte.");
  });

  socket.on("client_list_all_messages", (history) => {
    messages.replaceChildren();
    history.forEach((message) =>
      appendMessage({
        email: sessionEmail,
        text: message.text,
        date: message.created_at,
        fromAdmin: message.admin_id !== null,
      }),
    );
    showConversation();
  });

  socket.on("client_message_sent", (message) =>
    appendMessage({
      email: sessionEmail,
      text: message.text,
      date: message.created_at,
      fromAdmin: false,
    }),
  );

  socket.on("admin_send_to_client", ({ message }) =>
    appendMessage({
      email: "Atendente",
      text: message.text,
      date: message.created_at,
      fromAdmin: true,
    }),
  );

  socket.on("chat_error", ({ error }) => setStatus(error, true));
  socket.connect();
}

startForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = startForm.elements.email.value.trim();
  const text = startForm.elements.text.value.trim();
  if (!email || !text) {
    setStatus("Informe seu e-mail e conte como podemos ajudar.", true, true);
    return;
  }
  messages.replaceChildren();
  connectClient("", true);
  showConversation();
});

document
  .querySelector("#send_message_form")
  .addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.message;
    const text = input.value.trim();
    if (!text || !socket?.connected) return;
    socket.emit("client_send_to_admin", { text });
    input.value = "";
  });

document.querySelector("#chat_close").addEventListener("click", () => {
  chatPanel.hidden = true;
  supportButton.hidden = false;
});

supportButton.addEventListener("click", () => {
  if (localStorage.getItem(sessionStorageKey)) {
    connectClient(localStorage.getItem(sessionStorageKey), false);
    showConversation();
  } else {
    showStartForm();
  }
  supportButton.hidden = true;
});

document.querySelector("#start_cancel").addEventListener("click", () => {
  showStartForm();
  supportButton.hidden = false;
});

document.querySelector("#message_help").addEventListener("input", (event) => {
  document.querySelector("#charac_remaining").textContent = String(
    250 - event.target.value.length,
  );
});

fetch("/settings/admin")
  .then((response) =>
    response.ok
      ? response.json()
      : Promise.reject(new Error("Configuração indisponível.")),
  )
  .then((setting) => {
    supportButton.hidden = !setting.chat;
  })
  .catch(() => {
    supportButton.hidden = false;
  });

if (localStorage.getItem(sessionStorageKey)) {
  supportButton.hidden = true;
  connectClient(localStorage.getItem(sessionStorageKey), false);
}
