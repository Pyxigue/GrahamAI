let currentChat = null;
let chats = [];
let isAITyping = false;
let typingToken = 0;

/* =========================
   Utils
========================= */

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function cleanMessage(text) {
    return text.replace(/\r\n|\r/g, "\n");
}

function createInfinityLoader() {
    const span = document.createElement("span");
    span.className = "infinity";
    span.textContent = "♾️";
    return span;
}

/* =========================
   Typing animations
========================= */

function typeTextProgressive(el, text, speed = 40) {
    el.textContent = "";
    let i = 0;
    const interval = setInterval(() => {
        el.textContent += text[i++];
        if (i >= text.length) clearInterval(interval);
    }, speed);
}

let currentTitleInterval = null;
function updateChatTitleProgressive(title) {
    const el = document.getElementById("chatTitle");
    if (!el) return;

    clearInterval(currentTitleInterval);
    el.textContent = "";

    let i = 0;
    currentTitleInterval = setInterval(() => {
        el.textContent += title[i++];
        if (i >= title.length) clearInterval(currentTitleInterval);
    }, 50);
}

/* =========================
   Chats
========================= */

async function loadChats() {
    const res = await fetch("/api/chats");
    chats = await res.json();

    chats.forEach(c => {
        if (!c.name?.trim()) c.name = "Nouveau chat";
    });

    renderChatList();
    if (!currentChat && chats.length) selectChat(chats[0]);
}

async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    if (chat.error) return alert(chat.error);

    chat.name ||= "Nouveau chat";
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
    if (currentChat?.id === chatId) currentChat = null;

    renderChatList();
    chats.length ? selectChat(chats[0]) : clearMessages();
}

function selectChat(chat) {
    typingToken++;
    currentChat = chat;
    renderChatList();
    renderMessages(chat.messages);
    updateChatTitleProgressive(chat.name);
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
        del.onclick = e => {
            e.stopPropagation();
            deleteChat(chat.id);
        };

        li.appendChild(del);
        list.appendChild(li);
    });
}

/* =========================
   Messages
========================= */

function clearMessages() {
    document.getElementById("messages").innerHTML = "";
}

function renderMessages(messages = []) {
    clearMessages();
    messages.forEach(m => addMessage(m.sender, m.text));
}

function addMessage(sender, text) {
    const div = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = `message ${sender}`;
    msg.innerHTML = `<span class="content">${formatMessage(text)}</span>`;
    div.appendChild(msg);

    msg.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
    div.scrollTop = div.scrollHeight;
}

/* =========================
   Progressive AI message
========================= */

async function addMessageProgressive(sender, rawText) {
    const messagesDiv = document.getElementById("messages");
    const text = cleanMessage(rawText);

    const msg = document.createElement("div");
    msg.className = `message ${sender}`;

    const content = document.createElement("span");
    content.className = "content";

    const loader = createInfinityLoader();
    msg.appendChild(content);
    msg.appendChild(loader);
    messagesDiv.appendChild(msg);

    let i = 0;
    let inCode = false;
    let codeBlock = null;

    while (i < text.length) {
        if (text.slice(i, i + 3) === "```") {
            inCode = !inCode;
            i += 3;

            if (inCode) {
                const pre = document.createElement("pre");
                const code = document.createElement("code");
                pre.appendChild(code);
                content.appendChild(pre);
                codeBlock = code;
            } else {
                codeBlock = null;
            }
            continue;
        }

        const char = text[i++];
        if (inCode && codeBlock) {
            codeBlock.textContent += char;
        } else {
            content.textContent += char;
        }

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        await sleep(45); // ⬅ vitesse token-by-token (modifiable)
    }

    loader.remove();
    msg.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
}

/* =========================
   Markdown / Code rendering
========================= */

function formatMessage(text) {
    const blocks = [];

    text = text.replace(/```(\w+)?\n([\s\S]+?)```/g, (_, lang, code) => {
        blocks.push({
            lang: lang || "text",
            code: escapeHTML(code)
        });
        return `___BLOCK_${blocks.length - 1}___`;
    });

    text = escapeHTML(text)
        .replace(/\n/g, "<br>");

    text = text.replace(/___BLOCK_(\d+)___/g, (_, i) => {
        const b = blocks[i];
        return `
<div class="code-block">
    <span class="code-lang">${b.lang}</span>
    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
    <pre><code class="language-${b.lang}">${b.code}</code></pre>
</div>`;
    });

    return text;
}

function copyCode(btn) {
    const code = btn.parentElement.querySelector("code")?.innerText;
    if (!code) return;

    navigator.clipboard.writeText(code);
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy", 1500);
}

/* =========================
   Sending
========================= */

async function sendMessage() {
    if (isAITyping) return;

    const chat = currentChat || await newChat();
    const input = document.getElementById("messageInput");

    let text = input.value.trim();
    if (!text) return;

    // auto wrap HTML
    if (/<[a-z][\s\S]*>/i.test(text)) {
        text = `\`\`\`html\n${text}\n\`\`\``;
    }

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
    await addMessageProgressive("bot", data.reply);

    chat.messages.push({ sender: "bot", text: data.reply });
    setSendingState(false);
}

function setSendingState(state) {
    isAITyping = state;
    document.getElementById("sendBtn").disabled = state;
}

/* =========================
   Events
========================= */

const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.onclick = sendMessage;
document.getElementById("newChatBtn").onclick = newChat;

loadChats();
