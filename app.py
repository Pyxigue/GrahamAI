from flask import Flask, render_template, request, jsonify, session
from groq import Groq
import os

app = Flask(__name__)
app.secret_key = "s01"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("ERREUR: GROQ_API_KEY manquant")

client = Groq(api_key=GROQ_API_KEY)
BOT_PROMPT = "Tu es GrahamAI, une IA LLM intelligente et tu dois assister les utilisateurs, tu es développée par Pablo Koussa Diaz. Réponds clairement et droit au but. "

MAX_MESSAGES = 5
MAX_CHATS = 30  

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

    chat["messages"].append({"sender": "user", "text": message})

    if chat["name"] == "Nouveau chat":
        title_prompt = f"Donne un titre de moins de 5 mots pour ce chat basé sur ce message:\n{message}"
        title_completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "system","content": BOT_PROMPT},{"role":"user","content":title_prompt}]
        )
        chat["name"] = title_completion.choices[0].message.content.strip()

    recent_msgs = [{"role": "system", "content": BOT_PROMPT}] + [
        {"role": "user" if m["sender"]=="user" else "assistant", "content": m["text"]}
        for m in chat["messages"][-MAX_MESSAGES*2:]
    ]

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant", messages=recent_msgs
    )
    reply = completion.choices[0].message.content.strip()

    reply = reply.lstrip("python\n").replace("\r\n", "\n").replace("\r", "\n")

    chat["messages"].append({"sender": "bot", "text": reply})
    session["chats"] = chats
    session.modified = True
    return jsonify({"reply": reply})
