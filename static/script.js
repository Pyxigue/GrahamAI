let currentChatId = null;
let generating = false;

async function fetchChats() {
    const res = await fetch("/api/chats");
    return await res.json();
}

async function loadChats(selectId = null) {
    const chats = await fetchChats();
    renderChatList(chats);

    if (selectId) {
        const chat = chats.find(c => c.id === selectId);
        if (chat) selectChat(chat);
        return;
    }

    if (!currentChatId && chats.length > 0) {
        selectChat(chats[0]);
    }

    if (!chats.length) {
        showNoChat();
    }
}

function renderChatList(chats) {
    const list = document.getElementById("chatList");
    list.innerHTML = "";

    chats.forEach(chat => {
        const li = document.createElement("li");
        if (chat.id === currentChatId) li.classList.add("active");

        const title = document.createElement("span");
        title.textContent = chat.name;
        li.appendChild(title);

        li.onclick = () => selectChat(chat);

        const del = document.createElement("button");
        del.className = "delete-btn";
        del.textContent = "🗑";
        del.onclick = e => {
            e.stopPropagation();
            deleteChat(chat.id);
        };

        li.appendChild(del);
        list.appendChild(li);
    });
}

function selectChat(chat) {
    currentChatId = chat.id;
    renderMessages(chat.messages);
    loadChats(chat.id);
}

function showNoChat() {
    document.getElementById("messages").innerHTML =
        `<div class="no-chat-msg">Écris un message pour démarrer</div>`;
}

function renderMessages(messages) {
    const div = document.getElementById("messages");
    div.innerHTML = "";
    messages.forEach(m => renderMessage(m.sender, m.text));
}

async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    if (chat.error) return alert(chat.error);
    loadChats(chat.id);
}

async function deleteChat(id) {
    await fetch("/api/chats/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id })
    });
    currentChatId = null;
    loadChats();
}

async function sendMessage() {
    if (generating) return;

    const input = document.getElementById("messageInput");
    const btn = document.getElementById("sendBtn");
    const text = input.value.trim();
    if (!text) return;

    if (!currentChatId) {
        await newChat();
        return sendMessage();
    }

    generating = true;
    btn.disabled = true;

    renderMessage("user", text);
    input.value = "";

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: currentChatId, message: text })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
        generating = false;
        btn.disabled = false;
        return;
    }

    renderMessage("bot", data.reply);

    generating = false;
    btn.disabled = false;

    loadChats(currentChatId);
}

function clean(text) {
    return text
        .replace(/^python\s*/i, "")
        .replace(/\r\n|\r/g, "\n");
}

function renderMessage(sender, text) {
    const container = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    text = clean(text);

    const blocks = text.split(/(```[\s\S]+?```)/g);
    let html = "";

    for (const block of blocks) {
        if (block.startsWith("```")) {
            const code = block
                .slice(3, -3)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            html += `
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    <pre><code>${code}</code></pre>
                </div>
            `;
        } else {
            html += block.replace(/\n/g, "<br>");
        }
    }

    msg.innerHTML =
        (sender === "user" ? "<b>You :</b> " : "<b>GrahamAI :</b> ") + html;

    container.appendChild(msg);
    msg.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
    container.scrollTop = container.scrollHeight;
}

function copyCode(btn) {
    const code = btn.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code);
}

document.getElementById("sendBtn").onclick = sendMessage;

document.getElementById("messageInput").addEventListener("keydown", e => {
    if (generating && e.key === "Enter") e.preventDefault();
    if (e.key === "Enter" && !e.shiftKey && !generating) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById("newChatBtn").onclick = newChat;

loadChats();
