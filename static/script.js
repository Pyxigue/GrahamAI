const userId = "web_user_" + Math.floor(Math.random() * 10000000);

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";

    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, user_id: userId })
    });

    const data = await response.json();
    addMessage("bot", data.reply);
}

function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");

    const msg = document.createElement("div");
    msg.className = "message " + sender;
    msg.textContent = (sender === "user" ? "You : " : "GrahamAI : ") + text;

    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
