let chats = [];
let currentChatId = null;
let isGenerating = false;

async function loadChats(selectFirst = false) {
    const res = await fetch("/api/chats");
    chats = await res.json();

    if (selectFirst && chats.length > 0) {
        currentChatId = chats[0].id;
    }

    renderChatList();
    renderCurrentChat();
}

function getCurrentChat() {
    return chats.find(c => c.id === currentChatId) || null;
}

async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    currentChatId = chat.id;
    await loadChats();
}

function selectChat(id) {
    currentChatId = id;
    renderChatList();
    renderCurrentChat();
}

function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";

    chats.forEach(chat => {
        const li = document.createElement("li");
        li.textContent = chat.name;
        if (chat.id === currentChatId) li.classList.add("active");
        li.onclick = () => selectChat(chat.id);
        list.appendChild(li);
    });
}

function renderCurrentChat() {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";

    const chat = getCurrentChat();
    if (!chat) {
        messagesDiv.innerHTML = `<div class="no-chat-msg">Écris un message pour démarrer</div>`;
        return;
    }

    chat.messages.forEach(m => {
        const div = document.createElement("div");
        div.className = "message " + m.sender;
        div.textContent = m.text;
        messagesDiv.appendChild(div);
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage() {
    if (isGenerating) return;

    let chat = getCurrentChat();

    if (!chat) {
        await newChat();
        chat = getCurrentChat();
    }

    if (chat.messages.length >= 30) {
        alert("Limite de 30 messages atteinte");
        return;
    }

    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    isGenerating = true;
    lockUI(true);

    const messagesDiv = document.getElementById("messages");
    const userMsg = document.createElement("div");
    userMsg.className = "message user";
    userMsg.textContent = text;
    messagesDiv.appendChild(userMsg);

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, message: text })
    });

    const data = await res.json();

    isGenerating = false;
    lockUI(false);

    if (data.error) {
        alert(data.error);
        return;
    }

    await loadChats();
}

function lockUI(state) {
    document.getElementById("sendBtn").disabled = state;
}

document.getElementById("sendBtn").onclick = sendMessage;

document.getElementById("messageInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

loadChats(true);
