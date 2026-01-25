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

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat.id, message: text })
        });
        const data = await res.json();

        if (data.chat_name && chat.name !== data.chat_name) {
            chat.name = data.chat_name;
            const li = [...document.getElementById("chatList").children]
                .find(el => el.classList.contains("active"));
            if (li) li.querySelector("span").textContent = chat.name;
        }

        await addMessageProgressive("bot", data.reply);
        chat.messages.push({ sender: "bot", text: data.reply });
    } catch (error) {
        alert("Erreur lors de l'envoi du message. Veuillez réessayer.");
    }

    setSendingState(false);
}

function addMessage(sender, text) {
    const div = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;
    const prefix = sender === "user" ? "You" : "GrahamAI";
    msg.innerHTML = `<span class="sender">${prefix}:</span> <span class="content">${formatMessage(text)}</span>`;
    div.appendChild(msg);
    msg.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
    div.scrollTop = div.scrollHeight;
}

async function addMessageProgressive(sender, text, chat = currentChat) {
    const messagesDiv = document.getElementById("messages");
    text = cleanMessage(text);

    const codeMatch = text.match(/```[\s\S]+?```/);
    let beforeCode = codeMatch ? text.slice(0, codeMatch.index) : text;
    let codeBlock = codeMatch ? codeMatch[0] : null;

    const li = chat ? [...document.getElementById("chatList").children]
        .find(el => el.classList.contains("active")) : null;

    if (beforeCode.trim()) {
        const msg = document.createElement("div");
        msg.className = "message " + sender;
        const prefix = sender === "user" ? "You" : "GrahamAI";
        msg.innerHTML = `<span class="sender">${prefix}:</span> <span class="progress-text"></span>`;
        messagesDiv.appendChild(msg);

        const span = msg.querySelector(".progress-text");

        for (let i = 0; i <= beforeCode.length; i++) {
            span.innerHTML = formatMessage(beforeCode.slice(0, i));
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            if (chat && li) {
                const newName = beforeCode.slice(0, 20) || "Nouveau chat";
                li.querySelector("span").textContent = newName;
            }
            await new Promise(r => setTimeout(r, 15));
        }

        if (chat && li) {
            chat.name = beforeCode.trim().slice(0, 20);
            li.querySelector("span").textContent = chat.name;
        }
    }

    if (codeBlock) addMessage(sender, codeBlock);

    const afterCode = codeMatch ? text.slice(codeMatch.index + codeBlock.length) : "";
    if (afterCode.trim()) addMessage(sender, afterCode);
}

function cleanMessage(text) {
    return text.replace(/\r\n|\r/g, "\n");
}

function formatMessage(text) {
    text = text.replace(/```([\s\S]+?)```/g, (m, code) => {
        code = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<div class="code-block"><button class="copy-btn" onclick="copyCode(this)">Copy</button><pre><code>${code}</code></pre></div>`;
    });
    text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^\*\n]+)\*\*/g, "<b>$1</b>");
    text = text.replace(/\*([^\*\n]+)\*/g, "<i>$1</i>");
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    text = text.replace(/^\* (.+)$/gm, "<li>$1</li>");
    if (text.includes("<li>")) text = `<ul>${text}</ul>`;
    return text.replace(/\n/g, "<br>");
}

function copyCode(btn) {
    const code = btn.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code);
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy", 1500);
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
