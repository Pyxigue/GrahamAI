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

function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");

    const msg = document.createElement("div");
    msg.className = "message " + sender;


    let formattedText = text
        .replace(/```([\s\S]+?)```/g, function(match, code) {
            return `
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                    ${code}
                </div>
            `;
        })
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/_(.+?)_/g, '<i>$1</i>');

    const prefix = sender === "user" ? "You : " : "GrahamAI : ";
    msg.innerHTML = prefix + formattedText;

    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function copyCode(button) {
    const codeBlock = button.parentElement;
    const code = codeBlock.innerText.replace("Copy", "");
    navigator.clipboard.writeText(code.trim()).then(() => {
        button.textContent = "Copied!";
        setTimeout(() => button.textContent = "Copy", 1500);
    });
}


