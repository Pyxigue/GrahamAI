let currentChat = null;
let chats = [];
let generating = false;

async function loadChats() {
    const res = await fetch("/api/chats");
    chats = await res.json();
    renderChatList();
    if (!currentChat && chats.length > 0) selectChat(chats[0]);
}

async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    if (chat.error) { alert(chat.error); return; }
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
    if (currentChat && currentChat.id === chatId) currentChat = null;
    renderChatList();
    if (currentChat) selectChat(currentChat);
    else showNoChatMessage();
}

function selectChat(chat) {
    currentChat = chat;
    renderChatList();
    if (chat.messages.length === 0) showNoChatMessage();
    else renderMessages(chat.messages);
}

function showNoChatMessage() {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = '<div class="no-chat-msg">Aucun chat sélectionné</div>';
}

function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    chats.forEach(chat => {
        const li = document.createElement("li");
        li.className = currentChat && chat.id === currentChat.id ? "active" : "";
        const titleSpan = document.createElement("span");
        titleSpan.textContent = chat.name;
        li.appendChild(titleSpan);
        li.onclick = () => selectChat(chat);
        const delBtn = document.createElement("button");
        delBtn.innerHTML = "🗑";
        delBtn.className = "delete-btn";
        delBtn.onclick = e => { e.stopPropagation(); deleteChat(chat.id); };
        li.appendChild(delBtn);
        list.appendChild(li);
    });
}

function renderMessages(messages) {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    messages.forEach(m => addMessage(m.sender, m.text));
}

async function sendMessage() {
    if (generating) return;
    let chat = currentChat;
    if (!chat) chat = await newChat();
    if (chat.messages.length >= 30) { alert("Limite de 30 messages atteinte"); return; }

    const input = document.getElementById("messageInput");
    let text = input.value.trim();
    if (!text) return;
    input.value = "";
    chat.messages.push({ sender: "user", text });
    addMessage("user", text);

    generating = true;
    toggleInput(true);

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, message: text })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); generating = false; toggleInput(false); return; }

    await addMessageProgressive("bot", data.reply);
    chat.messages.push({ sender: "bot", text: data.reply });
    if (chat.name === "Nouveau chat") progressiveRenameChat(chat);

    generating = false;
    toggleInput(false);
}

function toggleInput(disable) {
    const input = document.getElementById("messageInput");
    const btn = document.getElementById("sendBtn");
    input.disabled = disable;
    btn.disabled = disable;
}

function cleanMessage(text) {
    text = text.replace(/^python\s*#?/i, "");
    text = text.replace(/^\s*(#|\*|-|\+)\s*/gm, "");
    text = text.replace(/\r\n|\r/g, "\n");
    return text;
}

function formatMessage(text) {
    const parts = text.split(/(```[\s\S]+?```)/g);
    let formatted = "";
    parts.forEach(part => {
        if (part.startsWith("```") && part.endsWith("```")) {
            let code = part.slice(3, -3);
            const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            formatted += `<div class="code-block">
                            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                            <pre><code>${escaped}</code></pre>
                          </div>`;
        } else {
            formatted += part.replace(/\n/g, "<br>");
        }
    });
    return formatted;
}

function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;
    text = cleanMessage(text);
    const prefix = sender === "user" ? "<b>You :</b> " : "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + formatMessage(text);
    messagesDiv.appendChild(msg);
    msg.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function addMessageProgressive(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;
    const prefix = "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + `<div class="progress-text"><pre><code></code></pre></div>`;
    messagesDiv.appendChild(msg);

    const codeBlock = msg.querySelector("pre code");
    text = cleanMessage(text);
    let i = 0;

    while (i <= text.length) {
        codeBlock.innerHTML = text.slice(0, i).replace(/\n/g, "<br>");
        msg.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        let speed = Math.max(5, 20 - Math.floor(i / 10)); // plus long, plus lent
        await new Promise(r => setTimeout(r, speed));
        i++;
    }
}

function copyCode(btn) {
    const code = btn.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1500);
    });
}

function progressiveRenameChat(chat) {
    let name = chat.name;
    let i = 0;
    const li = [...document.getElementById("chatList").children].find(el => el.classList.contains("active"));
    const interval = setInterval(() => {
        if (i > name.length) clearInterval(interval);
        if (li) li.querySelector("span").textContent = name.slice(0, i);
        i++;
    }, 50);
}

const input = document.getElementById("messageInput");
input.addEventListener("keydown", e => {
    if (generating) e.preventDefault();
    if (e.key === "Enter" && !e.shiftKey && !generating) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById("newChatBtn").addEventListener("click", newChat);
document.getElementById("sendBtn").addEventListener("click", sendMessage);

loadChats();
