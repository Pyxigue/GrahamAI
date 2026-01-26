let currentChat = null;
let chats = [];
let isAITyping = false;
let typingToken = 0;

function typeTextProgressive(el, text, speed = 40) {
    el.textContent = "";
    let i = 0;
    const interval = setInterval(() => {
        el.textContent += text[i];
        i++;
        if (i >= text.length) clearInterval(interval);
    }, speed);
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function createInfinityLoader() {
    const span = document.createElement("span");
    span.className = "infinity";
    span.textContent = "• • •";
    return span;
}



async function loadChats() {
    const res = await fetch("/api/chats");
    chats = await res.json();

    chats.forEach(c => {
        if (!c.name || c.name.trim() === "") c.name = "Nouveau chat";
    });

    renderChatList();
    if (!currentChat && chats.length > 0) selectChat(chats[0]);
}

async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    if (chat.error) return alert(chat.error);

    chat.name ||= "Nouveau chat";
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
    chats.length ? selectChat(chats[0]) : clearMessages();
}

function selectChat(chat) {
    typingToken++;
    currentChat = chat;
    renderChatList();
    renderMessages(chat.messages);
    updateChatTitleProgressive(chat.name || "Nouveau chat");
}

let currentTitleInterval = null;
function updateChatTitleProgressive(title) {
    const el = document.getElementById("chatTitle");
    if (!el) return;

    if (currentTitleInterval) clearInterval(currentTitleInterval);
    el.textContent = "";

    let i = 0;
    currentTitleInterval = setInterval(() => {
        el.textContent += title[i];
        i++;
        if (i >= title.length) clearInterval(currentTitleInterval);
    }, 50);
}

function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";

    chats.forEach(chat => {
        const li = document.createElement("li");
        li.className = currentChat?.id === chat.id ? "active" : "";

        const span = document.createElement("span");
        li.appendChild(span);

        if (chat.animateName) {
            typeTextProgressive(span, chat.name);
            chat.animateName = false;
        } else {
            span.textContent = chat.name;
        }

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

function clearMessages() {
    document.getElementById("messages").innerHTML = "";
}

function renderMessages(messages) {
    const div = document.getElementById("messages");
    div.innerHTML = "";
    messages?.forEach(m => addMessage(m.sender, m.text));
}

async function sendMessage() {
    if (isAITyping) return;
    let chat = currentChat || await newChat();

    const input = document.getElementById("messageInput");
    let text = input.value.trim();
    if (!text) return;

    if (/<[^>]+>/.test(text)) {
        text = "```html\n" + text + "\n```";
    }

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
            chat.animateName = true;
            renderChatList();
            updateChatTitleProgressive(chat.name);
        }

        await addMessageProgressive("bot", data.reply);
        chat.messages.push({ sender: "bot", text: data.reply });

    } catch (err) {
        alert("Erreur API : " + err.message);
    }

    setSendingState(false);
}

function addMessage(sender, text) {
    const div = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;
    const prefix = sender === "user" ? "" : "";
    msg.innerHTML = `<span class="sender">${prefix}</span> <span class="content">${formatMessage(text)}</span>`;
    div.appendChild(msg);
    msg.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
    div.scrollTop = div.scrollHeight;
}

async function addMessageProgressive(sender, text) {
    const messagesDiv = document.getElementById("messages");
    text = cleanMessage(text);

    const msg = document.createElement("div");
    msg.className = "message " + sender;

    const content = document.createElement("span");
    content.className = "content";

    const loader = createInfinityLoader();

    msg.appendChild(content);
    msg.appendChild(loader);
    messagesDiv.appendChild(msg);

    let i = 0;
    while (i < text.length) {
        content.textContent += text[i];
        i++;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        await new Promise(r => setTimeout(r, 35));
    }

    loader.remove();
    content.innerHTML = formatMessage(text);

    msg.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function cleanMessage(text) {
    return text.replace(/\r\n|\r/g, "\n");
}

function formatMessage(text) {
    const codeBlocks = [];

    text = text.replace(/```(\w+)?\n([\s\S]+?)```/g, (m, lang, code) => {
        codeBlocks.push({ lang: lang || "code", code });
        return `___CODEBLOCK_${codeBlocks.length - 1}___`;
    });

    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^\*\n]+)\*\*/g, "<b>$1</b>");
    text = text.replace(/\*([^\*\n]+)\*/g, "<i>$1</i>");
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    text = text.replace(/^\* (.+)$/gm, "<li>$1</li>");
    if (text.includes("<li>")) text = `<ul>${text}</ul>`;
    text = text.replace(/\n/g, "<br>");

    text = text.replace(/___CODEBLOCK_(\d+)___/g, (m, index) => {
        const { lang, code } = codeBlocks[index];

        const escapedCode = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        return `<div class="code-block">
            <span class="code-lang">${lang}</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
            <pre><code class="language-${lang}">${escapedCode}</code></pre>
        </div>`;
    });

    return text;
}

function copyCode(btn) {
    const codeElement = btn.parentElement.querySelector("code");
    if (!codeElement) return;

    let codeText = codeElement.innerText.trim();
    navigator.clipboard.writeText(codeText).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1500);
    }).catch(err => {
        console.error("Erreur lors de la copie:", err);
        alert("Impossible de copier le code.");
    });
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




