from flask import Flask, render_template, request, jsonify
from groq import Groq
import os


GROQ_API_KEY = "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"
MEMOIRE_TAILLE = 5
BOT_PERSONNALITE = (
    "Tu es GrahamAI, une IA amicale, drôle et concise. "
    "Tu es développée par Pablo Koussa Diaz qui a créé ton modèle."
)

client = Groq(api_key=GROQ_API_KEY)
memoire_utilisateurs = {}

# -----------------------------
# LOGIQUE DE MÉMOIRE
# -----------------------------
def generer_prompt(user_id, message):
    contexte = memoire_utilisateurs.get(user_id, [])
    contexte_str = "\n".join(contexte[-MEMOIRE_TAILLE:])

    prompt = (
        f"{BOT_PERSONNALITE}\n"
        f"Historique récent de la conversation :\n{contexte_str}\n\n"
        f"Message actuel : {message}\n"
        "Réponds naturellement."
    )
    return prompt


def ask_ai(user_id, message):
    if user_id not in memoire_utilisateurs:
        memoire_utilisateurs[user_id] = []

    memoire_utilisateurs[user_id].append(message)

    prompt = generer_prompt(user_id, message)

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )
    
    return completion.choices[0].message.content


app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/chat")
def api_chat():
    data = request.json
    user_id = data.get("user_id", "visiteur")  
    message = data.get("message", "")

    reply = ask_ai(user_id, message)

    return jsonify({"reply": reply})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
