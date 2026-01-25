let currentChat = null;
let chats = [];
let typingInterval = null;
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
    messagesDiv.innerHTML = "";
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
    let chat = currentChat;
    if (!chat) {
        chat = await newChat();
    }
    if (chat.messages.length >= 30) { alert("Limite de 30 messages atteinte"); return; }

    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";

    addMessage("user", text);
    chat.messages.push({ sender: "user", text });

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, message: text })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }

    await addMessageProgressive("bot", data.reply);
    chat.messages.push({ sender: "bot", text: data.reply });

    if (data.chat_name && chat.name !== data.chat_name) {
        chat.name = data.chat_name;
        renderChatList();
    }



    if (chat.name === "Nouveau chat") progressiveRenameChat(chat);
}


function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;

    text = cleanMessage(text);

    const formatted = formatMessage(text);
    const prefix = sender === "user" ? "<b>You :</b> " : "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + formatted;

    messagesDiv.appendChild(msg);
    msg.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


async function addMessageProgressive(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const msg = document.createElement("div");
    msg.className = "message " + sender;
    const prefix = "<b>GrahamAI :</b> ";
    msg.innerHTML = prefix + "<span class='progress-text'></span>";
    messagesDiv.appendChild(msg);

    const span = msg.querySelector(".progress-text");

    text = cleanMessage(text);

    let i = 0;
    while (i <= text.length) {
        span.innerHTML = formatMessage(text.slice(0, i));
        msg.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        i++;
        await new Promise(r => setTimeout(r, 15));
    }
}


function cleanMessage(text) {
    text = text.replace(/^python\s*#?/i, "");
    text = text.replace(/^[#*]\s*/gm, ""); 
    text = text.replace(/\r\n|\r/g, "\n");
    return text;
}

function formatMessage(text) {
    const parts = text.split(/(```[\s\S]+?```)/g);
    let formatted = "";

    parts.forEach(part => {
        if (part.startsWith("```") && part.endsWith("```")) {
            let code = part.slice(3, -3);

            code = code.replace(/^\s*[a-zA-Z0-9#+.-]+\s*\n/, "");

            const escaped = code
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            formatted += `
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    <pre><code>${escaped}</code></pre>
                </div>
            `;
        } else {
            formatted += part.replace(/\n/g, "<br>");
        }
    });

    return formatted;
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
    const li = [...document.getElementById("chatList").children].find(
        el => el.textContent.startsWith(chat.name) || el.classList.contains("active")
    );
    const interval = setInterval(() => {
        if (i > name.length) clearInterval(interval);
        if (li) li.querySelector("span").textContent = name.slice(0, i);
        i++;
    }, 50);
}

function setSendingState(isTyping) {
    isAITyping = isTyping;

    const btn = document.getElementById("sendBtn");
    btn.disabled = isTyping;
    btn.classList.toggle("disabled", isTyping);
}


const input = document.getElementById("messageInput");
input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        if (isAITyping) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        sendMessage();
    }
});


input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
});


document.getElementById("newChatBtn").addEventListener("click", newChat);


loadChats();





