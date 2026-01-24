let currentChat = null;
let chats = [];
let isGenerating = false;

// ---------------- INIT ----------------
async function loadChats() {
    const res = await fetch("/api/chats");
    chats = await res.json();
    renderChatList();
    if (!currentChat && chats.length > 0) selectChat(chats[0]);
}

// ---------------- CHAT CRUD ----------------
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
    currentChat = chats[0] || null;
    renderChatList();
    if (currentChat) renderMessages(currentChat.messages);
}

function selectChat(chat) {
    currentChat = chat;
    renderChatList();
    renderMessages(chat.messages);
}

// ---------------- RENDER ----------------
function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    chats.forEach(chat => {
        const li = document.createElement("li");
        li.className = currentChat && chat.id === currentChat.id ? "active" : "";
        li.innerHTML = `<span>${chat.name}</span>`;
        li.onclick = () => selectChat(chat);

        const del = document.createElement("button");
        del.textContent = "🗑";
        del.className = "delete-btn";
        del.onclick = e => { e.stopPropagation(); deleteChat(chat.id); };

        li.appendChild(del);
        list.appendChild(li);
    });
}

function renderMessages(messages) {
    const div = document.getElementById("messages");
    div.innerHTML = "";
    messages.forEach(m => addMessage(m.sender, m.text));
}

// ---------------- SEND MESSAGE ----------------
async function sendMessage() {
    if (isGenerating) return;

    let chat = currentChat;
    if (!chat) chat = await newChat();

    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    addMessage("user", text);
    chat.messages.push({ sender: "user", text });

    isGenerating = true;
    input.disabled = true;
    sendBtn.disabled = true;

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, message: text })
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    await addMessageProgressive("bot", data.reply);
    chat.messages.push({ sender: "bot", text: data.reply });

    renderChatList();

    isGenerating = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
}

// ---------------- MESSAGE DISPLAY ----------------
function addMessage(sender, text) {
    const div = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    msg.innerHTML = `<b>${sender === "user" ? "You" : "GrahamAI"} :</b> ${formatMessage(text)}`;
    div.appendChild(msg);
    div.scrollTo({ top: div.scrollHeight, behavior: "smooth" });
}

async function addMessageProgressive(sender, text) {
    const div = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message bot";
    msg.innerHTML = "<b>GrahamAI :</b> <span class='progress'></span>";
    div.appendChild(msg);

    const span = msg.querySelector(".progress");
    let i = 0;

    while (i <= text.length) {
        span.innerHTML = formatMessage(text.slice(0, i));
        div.scrollTop = div.scrollHeight;

        const delay = Math.max(5, 40 - Math.floor(text.length / 20));
        await new Promise(r => setTimeout(r, delay));
        i++;
    }
}

// ---------------- MARKDOWN + CODE ----------------
function formatMessage(text) {
    let html = "";
    let inCode = false;
    let buffer = "";

    for (let line of text.split("\n")) {
        if (line.startsWith("```")) {
            if (!inCode) {
                inCode = true;
                buffer = "";
                html += `
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    <pre><code>`;
            } else {
                inCode = false;
                html += escapeHtml(buffer) + "</code></pre></div>";
            }
            continue;
        }

        if (inCode) {
            buffer += line + "\n";
        } else {
            html += parseMarkdown(line) + "<br>";
        }
    }

    if (inCode) {
        html += escapeHtml(buffer) + "</code></pre></div>";
    }

    return html;
}

function parseMarkdown(text) {
    return text
        .replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>")
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/\*(.+?)\*/g, "<i>$1</i>");
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function copyCode(btn) {
    let code = btn.parentElement.querySelector("code").innerText;
    code = code.replace(/^\w+\n/, "");
    navigator.clipboard.writeText(code);
}

// ---------------- EVENTS ----------------
const input = document.getElementById("messageInput");
input.addEventListener("keydown", e => {
    if (isGenerating) return;
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("newChatBtn").onclick = newChat;

loadChats();
