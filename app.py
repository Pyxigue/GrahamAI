from flask import Flask, render_template, request, jsonify
from groq import Groq
import os


app = Flask(__name__)


GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("ERREUR")

client = Groq(api_key=GROQ_API_KEY)

BOT_PROMPT = (
    "Tu es GrahamAI, une IA intelligente et utile développée par Pablo Koussa Diaz. "
    "Réponds clairement et simplement."
)

conversation = [
    {"role": "system", "content": BOT_PROMPT}
]

MAX_MESSAGES = 5 



@app.route("/")
def index():
    return render_template("index.html")

@app.post("/api/chat")
def chat():
    data = request.json or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Message vide"}), 400

    conversation.append({"role": "user", "content": message})

    recent_messages = (
        [conversation[0]] + conversation[-MAX_MESSAGES * 2 :]
    )

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=recent_messages
    )

    reply = completion.choices[0].message.content


    conversation.append({"role": "assistant", "content": reply})

    return jsonify({"reply": reply})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

