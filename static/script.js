async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";

    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    });

    const data = await response.json();
    addMessage("bot", data.reply);
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
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
                    <pre><code>${escapedCode}</code></pre>
                </div>
            `;
        })
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/\n/g, "<br>");

    const prefix = sender === "user"
        ? "<b>You :</b> "
        : "<b>GrahamAI :</b> ";

    msg.innerHTML = prefix + formattedText;

    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function copyCode(button) {
    const code = button.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code).then(() => {
        button.textContent = "Copied!";
        setTimeout(() => button.textContent = "Copy", 1500);
    });
}

document.getElementById("messageInput")
    .addEventListener("keydown", e => {
        if (e.key === "Enter") sendMessage();
    });

return `
    <div class="code-block">
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
        <pre><code class="language-js">${escapedCode}</code></pre>
    </div>
`;






