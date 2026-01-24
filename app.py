from flask import Flask, render_template, request, jsonify, session
from groq import Groq
import os

app = Flask(__name__)
app.secret_key = "un_secret_super_secret"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("ERREUR: GROQ_API_KEY manquant")

client = Groq(api_key=GROQ_API_KEY)
BOT_PROMPT = "Tu es GrahamAI, une IA LLMintelligente qui assiste les utilisateurs, tu es développée par Pablo Koussa Diaz. Tu réponds de manière claire et direct."

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

    chat["messages"].append({"sender": "user", "text": message})

    if chat["name"] == "Nouveau chat":
        chat["name"] = message[:20] + ("..." if len(message) > 20 else "")

    recent_msgs = [{"role": "system", "content": BOT_PROMPT}] + \
                  [{"role": "user" if m["sender"]=="user" else "assistant", "content": m["text"]} 
                   for m in chat["messages"][-MAX_MESSAGES*2:]]

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=recent_msgs
    )

    reply = completion.choices[0].message.content
    if reply.lower().startswith("python"):
        reply = reply.split("\n", 1)[-1]

    chat["messages"].append({"sender": "bot", "text": reply})
    session["chats"] = chats
    session.modified = True

    return jsonify({"reply": reply})
