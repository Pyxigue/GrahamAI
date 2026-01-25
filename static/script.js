let currentChat = null;
let chats = [];
let isAITyping = false;


async function loadChats() {
    const res = await fetch("/api/chats");
    chats = await res.json();
    renderChatList();
    if (!currentChat && chats.length > 0) selectChat(chats[0]);
}

async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    if (chat.error) return alert(chat.error);
    chats.push(chat);
    renderChatList();
    selectChat(chat);
    return chat;
}

async function deleteChat(chatId) {
    if (!confirm("Supprimer ce chat ?")) return;
    await fetch("/api/chats/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId })
    });
    chats = chats.filter(c => c.id !== chatId);
    if (currentChat?.id === chatId) currentChat = null;
    renderChatList();
    if (chats.length > 0) selectChat(chats[0]);
    else clearMessages();
}

function selectChat(chat) {
    currentChat = chat;
    renderChatList();
    renderMessages(chat.messages);
}

function clearMessages() {
    document.getElementById("messages").innerHTML = "";
}



function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";

    chats.forEach(chat => {
        const li = document.createElement("li");
        li.className = currentChat?.id === chat.id ? "active" : "";

        const span = document.createElement("span");
        span.textContent = chat.name;
        li.appendChild(span);

        li.onclick = () => selectChat(chat);

        const del = document.createElement("button");
        del.textContent = "🗑";
        del.className = "delete-btn";
        del.onclick = e => {
            e.stopPropagation();
            deleteChat(chat.id);
        };

        li.appendChild(del);
        list.appendChild(li);
    });
}

function renderMessages(messages) {
    const div = document.getElementById("messages");
    div.innerHTML = "";
    if (!messages || messages.length === 0) return;
    messages.forEach(m => addMessage(m.sender, m.text));
}


async function sendMessage() {
    if (isAITyping) return;

    let chat = currentChat;
    if (!chat) chat = await newChat();

    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    setSendingState(true);

    addMessage("user", text);
    chat.messages.push({ sender: "user", text });

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, message: text })
    });

    const data = await res.json();

    await addMessageProgressive("bot", data.reply, chat); 
    chat.messages.push({ sender: "bot", text: data.reply });

    setSendingState(false);
}




function addMessage(sender, text) {
    const div = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    text = cleanMessage(text);
    const prefix = sender === "user" ? "<b>You :</b> " : "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + formatMessage(text);

    div.appendChild(msg);
    msg.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
    div.scrollTop = div.scrollHeight;
}

async function addMessageProgressive(sender, text, chat = null) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;
    const prefix = "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + "<span class='progress-text'></span>";
    messagesDiv.appendChild(msg);

    const span = msg.querySelector(".progress-text");

    text = cleanMessage(text);
    let i = 0;

    const li = chat ? [...document.getElementById("chatList").children].find(
        el => el.classList.contains("active")
    ) : null;

    while (i <= text.length) {
        span.innerHTML = formatMessage(text.slice(0, i));
        msg.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        if (chat && li) {
            li.querySelector("span").textContent = text.slice(0, i) || "Nouveau chat";
        }

        i++;
        await new Promise(r => setTimeout(r, 15));
    }

    if (chat && li && text.trim().length > 0) {
        chat.name = text.trim().slice(0, 20);
        li.querySelector("span").textContent = chat.name;
    }
}




function cleanMessage(text) {
    return text
        .replace(/^python\s*#?/i, "")
        .replace(/^[#*]\s*/gm, "")
        .replace(/\r\n|\r/g, "\n");
}

function formatMessage(text) {
    const parts = text.split(/(```[\s\S]+?```)/g);
    let out = "";

    parts.forEach(p => {
        if (p.startsWith("```")) {
            let code = p.slice(3, -3).replace(/^\s*[a-zA-Z0-9#+.-]+\s*\n/, "");
            code = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            out += `
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    <pre><code>${code}</code></pre>
                </div>`;
        } else {
            out += p.replace(/\n/g, "<br>");
        }
    });

    return out;
}

function copyCode(btn) {
    const code = btn.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code);
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy", 1500);
}

function progressiveRenameChat(chat) {
    const li = [...document.getElementById("chatList").children].find(
        el => el.querySelector("span").textContent === chat.name
    );

    if (!li) return;

    const span = li.querySelector("span");
    let i = 0;

    const interval = setInterval(() => {
        span.textContent = chat.name.slice(0, i++);
        if (i > chat.name.length) clearInterval(interval);
    }, 40);
}


function setSendingState(state) {
    isAITyping = state;
    const btn = document.getElementById("sendBtn");
    btn.disabled = state;
    btn.classList.toggle("disabled", state);
}


const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!isAITyping) sendMessage();
  }
});

sendBtn.addEventListener("click", () => {
  if (!isAITyping) sendMessage();
});

document.getElementById("newChatBtn").onclick = newChat;

loadChats();




