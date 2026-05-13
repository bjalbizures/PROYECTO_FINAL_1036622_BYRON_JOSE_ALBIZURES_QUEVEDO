db = db.getSiblingDB("proyecto_db");

db.messages.insertOne({
  name: "Sistema",
  message: "MongoDB inicializado correctamente desde Docker.",
  created_at: new Date().toISOString()
});
