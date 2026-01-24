let currentChat = null;
let chats = [];

async function loadChats() {
    const res = await fetch("/api/chats");
    chats = await res.json();
    renderChatList();
    if (!currentChat && chats.length > 0) {
        selectChat(chats[0]);
    } else if (!currentChat) {
        showNoChatMessage();
    }
}

async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    if (chat.error) { alert(chat.error); return; }
    chats.push(chat);
    renderChatList();
    selectChat(chat);
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
    if (chat.messages.length === 0) {
        showNoChatMessage();
    } else {
        renderMessages(chat.messages);
    }
}

function showNoChatMessage() {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = '<div class="no-chat-msg">Choisir ou créer un chat</div>';
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
        delBtn.onclick = (e) => { e.stopPropagation(); deleteChat(chat.id); };
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
    if (!currentChat) { alert("Sélectionne un chat ou crée-en un"); return; }
    if (currentChat.messages.length >= 30) { alert("Limite de 30 messages atteinte"); return; }

    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";

    addMessage("user", text);
    currentChat.messages.push({ sender: "user", text });

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: currentChat.id, message: text })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }

    addMessage("bot", data.reply);
    currentChat.messages.push({ sender: "bot", text: data.reply });
}

function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    text = text.replace(/^python\s*#?/i, "").replace(/\r\n|\r/g, "\n");

    const parts = text.split(/(```[\s\S]+?```)/g);
    let formatted = "";
    parts.forEach(part => {
        if (part.startsWith("```") && part.endsWith("```")) {
            let code = part.slice(3, -3); // retirer ```
            const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            formatted += `<div class="code-block">
                            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                            <pre><code>${escaped}</code></pre>
                          </div>`;
        } else {
            formatted += part.replace(/\n/g, "<br>");
        }
    });

    const prefix = sender === "user" ? "<b>You :</b> " : "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + formatted;

    messagesDiv.appendChild(msg);

    msg.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function copyCode(btn) {
    const code = btn.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1500);
    });
}

document.getElementById("messageInput").addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});
document.getElementById("newChatBtn").addEventListener("click", newChat);

loadChats();
