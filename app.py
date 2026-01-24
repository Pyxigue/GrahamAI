from flask import Flask, render_template, request, jsonify, session
from groq import Groq
import os

app = Flask(__name__)
app.secret_key = "secret"  

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("ERREUR: GROQ_API_KEY manquant")

client = Groq(api_key=GROQ_API_KEY)

BOT_PROMPT = (
    "Tu es GrahamAI, une IA intelligente et utile développée par Pablo Koussa Diaz. "
    "Réponds clairement et simplement."
)

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

    if "conversation" not in session:
        session["conversation"] = [{"role": "system", "content": BOT_PROMPT}]
    
    session["conversation"].append({"role": "user", "content": message})

    recent_messages = [session["conversation"][0]] + session["conversation"][-MAX_MESSAGES*2:]

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=recent_messages
    )

    reply = completion.choices[0].message.content
    session["conversation"].append({"role": "assistant", "content": reply})
    session.modified = True

    return jsonify({"reply": reply})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
