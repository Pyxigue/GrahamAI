from flask import Flask, render_template, request, jsonify, session
from groq import Groq
import os
import re

app = Flask(__name__)
app.secret_key = "s01_secret_key"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("ERREUR: GROQ_API_KEY manquant")

client = Groq(api_key=GROQ_API_KEY)

BOT_PROMPT = (
    "Tu es GrahamAI, une IA LLM intelligente et tu dois assister les utilisateurs."
    "Tu es développée par l'entreprise : Graham. Réponds clairement et droit au but.\n"
    "Voici la team Graham :\n"
    "Pablo Koussa Diaz : Fondateur et Lead Développeur\n"
    "Stéphane Quétin : Co-Fondateur et Lead Designer\n"
    "Léon Lévy : Community Manager\n"
    "Répond toujours dans la langue du message de l'utilisateur. Identifie la langue automatiquement."
)

MAX_CHATS = 60
MAX_MESSAGES_PER_CHAT = 30

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
    if len(chats) >= MAX_CHATS:
        return jsonify({"error": f"Limite atteinte ({MAX_CHATS} chats)"}), 400

    chat_id = len(chats) + 1
    chat = {"id": chat_id, "name": "Nouveau chat", "messages": []}
    chats.append(chat)
    session["chats"] = chats
    session.modified = True
    return jsonify(chat)

@app.post("/api/chats/delete")
def delete_chat():
    data = request.json or {}
    chat_id = data.get("chat_id")
    chats = session.get("chats", [])
    chats = [c for c in chats if c["id"] != chat_id]
    session["chats"] = chats
    session.modified = True
    return jsonify({"success": True})

def clean_title(text):
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    words = text.split()
    return " ".join(words[:5]).capitalize() if words else "Nouveau chat"

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

    if len(chat["messages"]) >= MAX_MESSAGES_PER_CHAT:
        return jsonify({"error": f"Limite de {MAX_MESSAGES_PER_CHAT} messages atteinte"}), 400

    chat["messages"].append({"sender": "user", "text": message})

    if chat["name"] == "Nouveau chat":
        title_prompt = (
            "Donne uniquement un titre court (5 mots max), sans ponctuation, "
            "sans phrase, basé sur ce message :\n"
            f"{message}"
        )

        title_completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": BOT_PROMPT + "\nNe donne que le titre. Aucun commentaire."
                },
                {"role": "user", "content": title_prompt}
            ]
        )

        raw_title = title_completion.choices[0].message.content.strip()
        chat["name"] = clean_title(raw_title)

    recent_msgs = [
        {
            "role": "system",
            "content": BOT_PROMPT
            + "\nNe mentionne jamais la détection de langue."
            + "\nNe parle pas de ton raisonnement."
            + "\nRépond directement."
        }
    ] + [
        {
            "role": "user" if m["sender"] == "user" else "assistant",
            "content": m["text"]
        }
        for m in chat["messages"]
    ]

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=recent_msgs
    )

    reply = completion.choices[0].message.content.strip()
    reply = reply.replace("\r\n", "\n").replace("\r", "\n")
    reply = re.sub(r"^je détecte.*\n?", "", reply, flags=re.IGNORECASE)

    chat["messages"].append({"sender": "bot", "text": reply})
    session["chats"] = chats
    session.modified = True

    return jsonify({
        "reply": reply,
        "chat_name": chat["name"]
    })






