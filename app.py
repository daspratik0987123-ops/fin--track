import json
import os
import secrets
import threading
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from itsdangerous import URLSafeTimedSerializer, BadSignature
from werkzeug.security import generate_password_hash, check_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, "data.json")
KEY_FILE = os.path.join(BASE, "secret.key")
TOKEN_AGE = 60 * 60 * 24 * 30  # 30 din

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # profile photo ke liye
lock = threading.Lock()


# ---------- Secret key (token sign karne ke liye) ----------
def get_secret():
    if not os.path.exists(KEY_FILE):
        with open(KEY_FILE, "w") as f:
            f.write(secrets.token_hex(32))
    with open(KEY_FILE) as f:
        return f.read().strip()


SECRET_KEY = os.environ.get("SECRET_KEY") or get_secret()

serializer = URLSafeTimedSerializer(SECRET_KEY)


# ---------- JSON file database ----------
def read_db():
    if not os.path.exists(DATA_FILE):
        return {"users": {}}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"users": {}}


def write_db(db):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DATA_FILE)


# ---------- Login check ----------
def current_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        return serializer.loads(header[7:], max_age=TOKEN_AGE)
    except BadSignature:
        return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        username = current_user()
        if not username:
            return jsonify(error="Please login again."), 401
        return fn(username, *args, **kwargs)
    return wrapper


# ---------- Pages ----------
@app.route("/")
def home():
    if os.path.exists(os.path.join(BASE, "static", "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify(message="Fin Track API is running successfully!"), 200


# ---------- Auth ----------
@app.post("/api/register")
def register():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip().lower()
    password = str(body.get("password", ""))

    if not username or len(password) < 4:
        return jsonify(error="Username required and password must be at least 4 characters."), 400

    with lock:
        db = read_db()
        if username in db["users"]:
            return jsonify(error="This username is already taken."), 409
        db["users"][username] = {
            "password": generate_password_hash(password),
            "transactions": [],
            "udhaar": [],
            "savings": {"totalSaved": 0, "savedDates": {}, "noSpendDates": [], "auditDates": []},
            "profile": {"photo": "", "theme": "mint"},
        }
        write_db(db)

    return jsonify(token=serializer.dumps(username), username=username)


@app.post("/api/login")
def login():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip().lower()
    password = str(body.get("password", ""))

    user = read_db()["users"].get(username)
    if not user or not check_password_hash(user["password"], password):
        return jsonify(error="Wrong username or password."), 401

    return jsonify(token=serializer.dumps(username), username=username)


@app.post("/api/password")
@login_required
def change_password(username):
    body = request.get_json(silent=True) or {}
    password = str(body.get("password", ""))
    if len(password) < 4:
        return jsonify(error="Password must be at least 4 characters."), 400

    with lock:
        db = read_db()
        if username not in db["users"]:
            return jsonify(error="Please login again."), 401
        db["users"][username]["password"] = generate_password_hash(password)
        write_db(db)
    return jsonify(ok=True)


# ---------- User data ----------
@app.get("/api/data")
@login_required
def get_data(username):
    user = read_db()["users"].get(username)
    if not user:
        return jsonify(error="Please login again."), 401
    return jsonify(
        transactions=user.get("transactions", []),
        udhaar=user.get("udhaar", []),
        savings=user.get("savings", {"totalSaved": 0, "savedDates": {}, "noSpendDates": [], "auditDates": []}),
        profile=user.get("profile", {"photo": "", "theme": "mint"}),
    )


@app.put("/api/data")
@login_required
def save_data(username):
    body = request.get_json(silent=True) or {}

    with lock:
        db = read_db()
        user = db["users"].get(username)
        if not user:
            return jsonify(error="Please login again."), 401

        if isinstance(body.get("transactions"), list):
            user["transactions"] = body["transactions"]
        if isinstance(body.get("udhaar"), list):
            user["udhaar"] = body["udhaar"]
        if isinstance(body.get("savings"), dict):
            user["savings"] = body["savings"]
        if isinstance(body.get("profile"), dict):
            user["profile"] = body["profile"]

        write_db(db)
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(debug=True)