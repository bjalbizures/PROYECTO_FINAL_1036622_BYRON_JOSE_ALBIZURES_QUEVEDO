import os
from datetime import datetime, timezone

from bson import ObjectId
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
products = db.products
orders = db.orders

INITIAL_PRODUCTS = [
    {
        "name": "Camisa Oxford",
        "category": "Camisas",
        "price": 189.99,
        "stock": 18,
        "color": "Blanco",
        "sizes": ["S", "M", "L", "XL"],
        "description": "Camisa fresca para uso casual o semi formal.",
    },
    {
        "name": "Jeans clasicos",
        "category": "Pantalones",
        "price": 279.99,
        "stock": 14,
        "color": "Azul",
        "sizes": ["30", "32", "34", "36"],
        "description": "Denim resistente con corte recto.",
    },
    {
        "name": "Sudadera urbana",
        "category": "Abrigos",
        "price": 249.99,
        "stock": 10,
        "color": "Verde",
        "sizes": ["S", "M", "L"],
        "description": "Sudadera suave para clima fresco.",
    },
    {
        "name": "Vestido casual",
        "category": "Vestidos",
        "price": 229.99,
        "stock": 8,
        "color": "Negro",
        "sizes": ["S", "M", "L"],
        "description": "Vestido comodo para salidas de dia.",
    },
]


def seed_products():
    if products.estimated_document_count() == 0:
        products.insert_many(INITIAL_PRODUCTS)


def serialize_product(document):
    return {
        "id": str(document["_id"]),
        "name": document.get("name", ""),
        "category": document.get("category", ""),
        "price": float(document.get("price", 0)),
        "stock": int(document.get("stock", 0)),
        "color": document.get("color", ""),
        "sizes": document.get("sizes", []),
        "description": document.get("description", ""),
    }


def serialize_order(document):
    return {
        "id": str(document["_id"]),
        "customerName": document.get("customer_name", ""),
        "items": document.get("items", []),
        "total": float(document.get("total", 0)),
        "createdAt": document.get("created_at", ""),
    }


@app.get("/api/health")
def health():
    try:
        client.admin.command("ping")
        seed_products()
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


@app.get("/api/live")
def live():
    return jsonify({"service": "backend-flask", "status": "ok"})


@app.get("/api/products")
def list_products():
    try:
        seed_products()
        documents = products.find().sort("category", 1).sort("name", 1)
        return jsonify([serialize_product(document) for document in documents])
    except PyMongoError as error:
        return jsonify({"error": "No fue posible consultar productos", "detail": str(error)}), 500


@app.get("/api/orders")
def list_orders():
    try:
        documents = orders.find().sort("created_at", -1).limit(10)
        return jsonify([serialize_order(document) for document in documents])
    except PyMongoError as error:
        return jsonify({"error": "No fue posible consultar pedidos", "detail": str(error)}), 500


@app.post("/api/orders")
def create_order():
    payload = request.get_json(silent=True) or {}
    customer_name = str(payload.get("customerName", "")).strip()
    requested_items = payload.get("items", [])

    if not customer_name:
        return jsonify({"error": "El nombre del cliente es obligatorio"}), 400

    if not isinstance(requested_items, list) or not requested_items:
        return jsonify({"error": "Debe enviar al menos un producto"}), 400

    product_ids = []
    quantities_by_id = {}
    for item in requested_items:
        product_id = str(item.get("productId", "")).strip()
        quantity = int(item.get("quantity", 0) or 0)
        if not ObjectId.is_valid(product_id) or quantity <= 0:
            return jsonify({"error": "Producto o cantidad invalida"}), 400
        product_ids.append(ObjectId(product_id))
        quantities_by_id[product_id] = quantities_by_id.get(product_id, 0) + quantity

    try:
        product_documents = list(products.find({"_id": {"$in": product_ids}}))
        if len(product_documents) != len(set(quantities_by_id)):
            return jsonify({"error": "Uno o mas productos no existen"}), 404

        order_items = []
        total = 0
        for product in product_documents:
            product_id = str(product["_id"])
            quantity = quantities_by_id[product_id]
            stock = int(product.get("stock", 0))
            if quantity > stock:
                return jsonify({"error": f"Stock insuficiente para {product.get('name')}"}), 400

            price = float(product.get("price", 0))
            subtotal = round(price * quantity, 2)
            total += subtotal
            order_items.append(
                {
                    "productId": product_id,
                    "name": product.get("name", ""),
                    "quantity": quantity,
                    "price": price,
                    "subtotal": subtotal,
                }
            )

        for item in order_items:
            products.update_one(
                {"_id": ObjectId(item["productId"])},
                {"$inc": {"stock": -item["quantity"]}},
            )

        document = {
            "customer_name": customer_name[:80],
            "items": order_items,
            "total": round(total, 2),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = orders.insert_one(document)
        document["_id"] = result.inserted_id
        return jsonify(serialize_order(document)), 201
    except PyMongoError as error:
        return jsonify({"error": "No fue posible registrar el pedido", "detail": str(error)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
