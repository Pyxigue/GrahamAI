from flask import Flask, render_template, request, jsonify, session
from groq import Groq
import os

app = Flask(__name__)
app.secret_key = "s01" 

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
    if "chats" not in session:
        session["chats"] = []
    return render_template("index.html")


@app.get("/api/chats")
def get_chats():
    return jsonify(session.get("chats", []))


@app.post("/api/chats/new")
def new_chat():
    chats = session.get("chats", [])
    chat_id = len(chats) + 1
    chat = {"id": chat_id, "name": "Nouveau chat", "messages": []}
    chats.append(chat)
    session["chats"] = chats
    session.modified = True
    return jsonify(chat)


@app.post("/api/chat")
def chat():
    data = request.json or {}
    chat_id = data.get("chat_id")
    message = data.get("message", "").strip()
    if not message or chat_id is None:
        return jsonify({"error": "Message vide ou chat_id manquant"}), 400

    chats = session.get("chats", [])
    chat = next((c for c in chats if c["id"] == chat_id), None)
    if not chat:
        return jsonify({"error": "Chat introuvable"}), 404

    # Ajouter le message utilisateur
    chat["messages"].append({"sender": "user", "text": message})

    # Renommer le chat si c'est le premier message
    if chat["name"] == "Nouveau chat":
        title_prompt = (
            f"Donne un titre court (moins de 5 mots) pour ce chat basé sur ce message :\n{message}"
        )
        title_completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": BOT_PROMPT},
                {"role": "user", "content": title_prompt},
            ],
        )
        chat["name"] = title_completion.choices[0].message.content.strip()

    recent_msgs = [{"role": "system", "content": BOT_PROMPT}] + [
        {
            "role": "user" if m["sender"] == "user" else "assistant",
            "content": m["text"],
        }
        for m in chat["messages"][-MAX_MESSAGES * 2 :]
    ]

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant", messages=recent_msgs
    )

    reply = completion.choices[0].message.content.strip()

    if reply.lower().startswith("python"):
        reply = reply.split("\n", 1)[-1].strip()

    chat["messages"].append({"sender": "bot", "text": reply})
    session["chats"] = chats
    session.modified = True

    return jsonify({"reply": reply})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
