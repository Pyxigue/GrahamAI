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


@app.route("/")
def index():
    return render_template("index.html")

@app.post("/api/chat")
def chat():
    data = request.json or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Message vide"}), 400

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": BOT_PROMPT},
            {"role": "user", "content": message}
        ]
    )

    reply = completion.choices[0].message.content

    return jsonify({"reply": reply})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
