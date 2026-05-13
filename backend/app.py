import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import PyMongoError


app = Flask(__name__)
CORS(app)

mongo_uri = os.environ.get("MONGO_URI", "mongodb://mongo:27017/proyecto_db")
mongo_db_name = os.environ.get("MONGO_DB", "proyecto_db")
client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
db = client[mongo_db_name]
messages = db.messages


def serialize_message(document):
    return {
        "id": str(document["_id"]),
        "name": document.get("name", ""),
        "message": document.get("message", ""),
        "createdAt": document.get("created_at", ""),
    }


@app.get("/api/health")
def health():
    try:
        client.admin.command("ping")
        database_status = "connected"
    except PyMongoError:
        database_status = "unavailable"

    return jsonify(
        {
            "service": "backend-flask",
            "status": "ok",
            "database": database_status,
        }
    )


@app.get("/api/messages")
def list_messages():
    try:
        documents = messages.find().sort("created_at", -1).limit(20)
        return jsonify([serialize_message(document) for document in documents])
    except PyMongoError as error:
        return jsonify({"error": "No fue posible consultar MongoDB", "detail": str(error)}), 500


@app.post("/api/messages")
def create_message():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    message = str(payload.get("message", "")).strip()

    if not name or not message:
        return jsonify({"error": "El nombre y el mensaje son obligatorios"}), 400

    document = {
        "name": name[:80],
        "message": message[:300],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = messages.insert_one(document)
        document["_id"] = result.inserted_id
        return jsonify(serialize_message(document)), 201
    except PyMongoError as error:
        return jsonify({"error": "No fue posible insertar en MongoDB", "detail": str(error)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
