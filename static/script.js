let chats = [];
let currentChat = null;

function newChat() {
    const chat = { id: Date.now(), name: "Nouveau chat", messages: [] };
    chats.push(chat);
    currentChat = chat;
    renderChatList();
    renderMessages();
}

function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    chats.forEach(chat => {
        const li = document.createElement("li");
        li.textContent = chat.name;
        if (chat === currentChat) li.classList.add("active");
        li.onclick = () => { currentChat = chat; renderMessages(); renderChatList(); };
        list.appendChild(li);
    });
}

function renderMessages() {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    if (!currentChat) return;
    currentChat.messages.forEach(m => addMessage(m.sender, m.text));
}

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    if (currentChat) currentChat.messages.push({ sender: "user", text });

    input.value = "";

    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    addMessage("bot", data.reply);
    if (currentChat) currentChat.messages.push({ sender: "bot", text: data.reply });
}

function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    let formattedText = text
        .replace(/```([\s\S]+?)```/g, (match, code) => {
            const escapedCode = escapeHTML(code);
            return `
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    <pre><code class="language-js">${escapedCode}</code></pre>
                </div>
            `;
        })
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/\n/g, "<br>");

    const prefix = sender === "user" ? "<b>You :</b> " : "<b>GrahamAI :</b> ";

    msg.innerHTML = prefix + formattedText;
    messagesDiv.appendChild(msg);

    msg.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
}

function copyCode(button) {
    const code = button.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code).then(() => {
        button.textContent = "Copied!";
        setTimeout(() => button.textContent = "Copy", 1500);
    });
}

document.getElementById("messageInput").addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});

newChat();
