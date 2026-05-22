import { createApp } from "vue";
import "./style.css";

const apiBase = "/api";

createApp({
  data() {
    return {
      status: "verificando",
      database: "verificando",
      products: [],
      orders: [],
      cart: [],
      customerName: "Byron",
      error: "",
      success: "",
      saving: false,
      loadingProducts: true,
      loadingOrders: true,
      productsError: "",
      ordersError: "",
    };
  },
  computed: {
    cartTotal() {
      return this.cart.reduce((total, item) => total + item.price * item.quantity, 0);
    },
    cartCount() {
      return this.cart.reduce((total, item) => total + item.quantity, 0);
    },
    backendAvailable() {
      return this.status === "ok" && this.database === "connected";
    },
    storeUnavailable() {
      return Boolean(this.productsError)
        || this.status === "sin conexion"
        || this.database === "unavailable";
    },
  },
  mounted() {
    this.loadStatus();
    this.loadProducts();
    this.loadOrders();
  },
  methods: {
    money(value) {
      return new Intl.NumberFormat("es-GT", {
        style: "currency",
        currency: "GTQ",
      }).format(value);
    },
    async loadStatus() {
      try {
        const response = await fetch(`${apiBase}/health`);
        const data = await this.readJson(response, "No se pudo consultar el estado del backend.");
        this.status = data.status;
        this.database = data.database;
      } catch {
        this.status = "sin conexion";
        this.database = "desconocida";
      }
    },
    async loadProducts() {
      this.loadingProducts = true;
      this.productsError = "";

      try {
        const response = await fetch(`${apiBase}/products`);
        const products = await this.readJson(response, "No se pudo cargar el catalogo.");
        this.products = Array.isArray(products) ? products : [];
      } catch {
        this.products = [];
        this.productsError = "El catalogo no esta disponible porque la API no respondio.";
      } finally {
        this.loadingProducts = false;
      }
    },
    async loadOrders() {
      this.loadingOrders = true;
      this.ordersError = "";

      try {
        const response = await fetch(`${apiBase}/orders`);
        const orders = await this.readJson(response, "No se pudieron cargar los pedidos.");
        this.orders = Array.isArray(orders) ? orders : [];
      } catch {
        this.orders = [];
        this.ordersError = "Los pedidos recientes no estan disponibles.";
      } finally {
        this.loadingOrders = false;
      }
    },
    async readJson(response, fallbackMessage) {
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || fallbackMessage);
      }

      return data;
    },
    async retryLoads() {
      this.error = "";
      await Promise.all([this.loadStatus(), this.loadProducts(), this.loadOrders()]);
    },
    addToCart(product) {
      this.error = "";
      this.success = "";
      const current = this.cart.find((item) => item.productId === product.id);

      if (current) {
        if (current.quantity >= product.stock) {
          this.error = "No hay mas stock disponible para esta prenda.";
          return;
        }
        current.quantity += 1;
        return;
      }

      this.cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock,
      });
    },
    removeFromCart(productId) {
      this.cart = this.cart.filter((item) => item.productId !== productId);
    },
    changeQuantity(item, amount) {
      const nextQuantity = item.quantity + amount;
      if (nextQuantity < 1) {
        this.removeFromCart(item.productId);
        return;
      }
      if (nextQuantity <= item.stock) {
        item.quantity = nextQuantity;
      }
    },
    async checkout() {
      this.error = "";
      this.success = "";
      this.saving = true;

      try {
        if (!this.backendAvailable) {
          throw new Error("El pedido no se puede registrar mientras la API no este disponible.");
        }

        const response = await fetch(`${apiBase}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: this.customerName,
            items: this.cart.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          }),
        });

        const data = await this.readJson(response, "No se pudo registrar el pedido.");

        this.cart = [];
        this.success = `Pedido registrado por ${this.money(data.total)}.`;
        await this.loadProducts();
        await this.loadOrders();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.saving = false;
      }
    },
  },
  template: `
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Ecommerce de ropa</p>
          <h1>Moda 1036622</h1>
          <p class="summary">Catalogo sencillo de prendas conectado a una API Flask y MongoDB en Docker.</p>
        </div>
        <div class="status-panel">
          <span :class="backendAvailable ? 'status-ok' : 'status-alert'">Backend: {{ status }}</span>
          <span :class="database === 'connected' ? 'status-ok' : 'status-alert'">MongoDB: {{ database }}</span>
          <span>Carrito: {{ cartCount }} prendas</span>
        </div>
      </section>

      <section class="service-alert" v-if="storeUnavailable">
        <div>
          <strong>La tienda no pudo cargar sus datos.</strong>
          <p>Revisa que el backend y MongoDB esten disponibles y vuelve a intentar.</p>
        </div>
        <button type="button" @click="retryLoads">Reintentar</button>
      </section>

      <section class="store-layout">
        <div class="catalog">
          <div class="section-title">
            <h2>Catalogo</h2>
            <p>{{ products.length }} productos disponibles</p>
          </div>

          <div class="catalog-state" v-if="loadingProducts">
            Cargando catalogo...
          </div>

          <div class="catalog-state catalog-error" v-else-if="productsError">
            <strong>{{ productsError }}</strong>
            <button type="button" @click="retryLoads">Reintentar</button>
          </div>

          <div class="catalog-state" v-else-if="products.length === 0">
            No hay productos disponibles.
          </div>

          <article class="product-card" v-for="product in products" :key="product.id">
            <div class="product-media">
              <span>{{ product.category }}</span>
            </div>
            <div class="product-body">
              <div>
                <h3>{{ product.name }}</h3>
                <p>{{ product.description }}</p>
              </div>
              <div class="meta">
                <span>{{ product.color }}</span>
                <span>Tallas: {{ product.sizes.join(", ") }}</span>
                <span>Stock: {{ product.stock }}</span>
              </div>
              <div class="product-actions">
                <strong>{{ money(product.price) }}</strong>
                <button type="button" @click="addToCart(product)" :disabled="product.stock === 0">
                  {{ product.stock === 0 ? "Agotado" : "Agregar" }}
                </button>
              </div>
            </div>
          </article>
        </div>

        <aside class="cart-panel">
          <h2>Carrito</h2>

          <label>
            Cliente
            <input v-model="customerName" maxlength="80" required />
          </label>

          <div class="cart-list" v-if="cart.length">
            <article class="cart-item" v-for="item in cart" :key="item.productId">
              <div>
                <strong>{{ item.name }}</strong>
                <small>{{ money(item.price) }} c/u</small>
              </div>
              <div class="quantity">
                <button type="button" @click="changeQuantity(item, -1)">-</button>
                <span>{{ item.quantity }}</span>
                <button type="button" @click="changeQuantity(item, 1)">+</button>
              </div>
            </article>
          </div>

          <p class="empty" v-else>Selecciona una prenda para iniciar el pedido.</p>

          <div class="total-row">
            <span>Total</span>
            <strong>{{ money(cartTotal) }}</strong>
          </div>

          <button type="button" class="checkout" @click="checkout" :disabled="saving || cart.length === 0 || !backendAvailable">
            {{ saving ? "Registrando..." : "Registrar pedido" }}
          </button>

          <p class="error" v-if="error">{{ error }}</p>
          <p class="success" v-if="success">{{ success }}</p>

          <div class="orders">
            <h2>Pedidos recientes</h2>
            <p class="empty" v-if="loadingOrders">Cargando pedidos...</p>
            <p class="error" v-else-if="ordersError">{{ ordersError }}</p>
            <p class="empty" v-else-if="orders.length === 0">Aun no hay pedidos recientes.</p>
            <article v-for="order in orders" :key="order.id">
              <strong>{{ order.customerName }}</strong>
              <small>{{ money(order.total) }} - {{ order.items.length }} productos</small>
            </article>
          </div>
        </aside>
      </section>
    </main>
  `,
}).mount("#app");
