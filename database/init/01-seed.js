db = db.getSiblingDB("proyecto_db");

db.products.insertMany([
  {
    name: "Camisa Oxford",
    category: "Camisas",
    price: 189.99,
    stock: 18,
    color: "Blanco",
    sizes: ["S", "M", "L", "XL"],
    description: "Camisa fresca para uso casual o semi formal."
  },
  {
    name: "Jeans clasicos",
    category: "Pantalones",
    price: 279.99,
    stock: 14,
    color: "Azul",
    sizes: ["30", "32", "34", "36"],
    description: "Denim resistente con corte recto."
  },
  {
    name: "Sudadera urbana",
    category: "Abrigos",
    price: 249.99,
    stock: 10,
    color: "Verde",
    sizes: ["S", "M", "L"],
    description: "Sudadera suave para clima fresco."
  },
  {
    name: "Vestido casual",
    category: "Vestidos",
    price: 229.99,
    stock: 8,
    color: "Negro",
    sizes: ["S", "M", "L"],
    description: "Vestido comodo para salidas de dia."
  }
]);
