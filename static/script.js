let currentChat = null;

async function loadChats() {
    const res = await fetch("/api/chats");
    const chats = await res.json();
    renderChatList(chats);
    if (chats.length > 0) {
        selectChat(chats[0]);
    }
}


async function newChat() {
    const res = await fetch("/api/chats/new", { method: "POST" });
    const chat = await res.json();
    loadChats(); 
    selectChat(chat);
}

// sélectionner un chat
function selectChat(chat) {
    currentChat = chat;
    renderMessages(chat.messages);
}


function renderChatList(chats) {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    chats.forEach(chat => {
        const li = document.createElement("li");
        li.textContent = chat.name;
        if (currentChat && chat.id === currentChat.id) li.classList.add("active");
        li.onclick = () => selectChat(chat);
        list.appendChild(li);
    });
}


function renderMessages(messages) {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    messages.forEach(m => addMessage(m.sender, m.text));
}


async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text || !currentChat) return;

    addMessage("user", text);
    input.value = "";

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ chat_id: currentChat.id, message: text })
    });
    const data = await res.json();
    addMessage("bot", data.reply);
    loadChats();
}

function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    let formattedText = text
        .replace(/```([\s\S]+?)```/g, (match, code) => {
            const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    <pre><code class="language-js">${escaped}</code></pre>
                </div>
            `;
        })
        .replace(/\n/g, "<br>"); 

    const prefix = sender === "user" ? "<b>You :</b> " : "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + formattedText;
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
