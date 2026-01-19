from flask import Flask, render_template, request, jsonify, redirect, session
from groq import Groq
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json

app = Flask(__name__)
app.secret_key = "database"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

USERS_FILE = "users.json"
MEMOIRE_TAILLE = 5

BOT_PERSONNALITE = (
    "Tu es GrahamAI, une IA intelligente et naturelle développée par Pablo Koussa Diaz. "
    "Tu aides l'utilisateur de manière claire et amicale."
)

memoire_utilisateurs = {}


def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=4)

def generer_prompt(user_id, message):
    contexte = memoire_utilisateurs.get(user_id, [])
    contexte_str = "\n".join(contexte[-MEMOIRE_TAILLE:])

    return f"""
{BOT_PERSONNALITE}

Historique récent :
{contexte_str}

Message utilisateur :
{message}

Réponds naturellement.
"""

def ask_ai(user_id, message):
    memoire_utilisateurs.setdefault(user_id, []).append(message)

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": generer_prompt(user_id, message)}]
    )

    return completion.choices[0].message.content


@app.route("/", methods=["GET"])
def index():
    if "user" not in session:
        return redirect("/login")
    return render_template("index.html", user=session["user"])

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]

        users = load_users()
        if email in users and check_password_hash(users[email]["password"], password):
            session["user"] = email
            return redirect("/")

        return render_template("login.html", error="Identifiants incorrects")

    return render_template("login.html")

@app.route("/register", methods=["POST"])
def register():
    email = request.form["email"]
    password = request.form["password"]

    users = load_users()
    if email in users:
        return render_template("login.html", error="Compte déjà existant")

    users[email] = {
        "password": generate_password_hash(password)
    }
    save_users(users)

    session["user"] = email
    return redirect("/")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

@app.post("/api/chat")
def api_chat():
    if "user" not in session:
        return jsonify({"error": "Non autorisé"}), 403

    data = request.json
    message = data.get("message", "")
    reply = ask_ai(session["user"], message)

    return jsonify({"reply": reply})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
