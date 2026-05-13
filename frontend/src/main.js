import { createApp } from "vue";
import "./style.css";

const apiBase = "/api";

createApp({
  data() {
    return {
      status: "verificando",
      database: "verificando",
      name: "Byron",
      message: "",
      messages: [],
      error: "",
      saving: false,
    };
  },
  mounted() {
    this.loadStatus();
    this.loadMessages();
  },
  methods: {
    async loadStatus() {
      try {
        const response = await fetch(`${apiBase}/health`);
        const data = await response.json();
        this.status = data.status;
        this.database = data.database;
      } catch {
        this.status = "sin conexion";
        this.database = "desconocida";
      }
    },
    async loadMessages() {
      try {
        const response = await fetch(`${apiBase}/messages`);
        this.messages = await response.json();
      } catch {
        this.error = "No se pudieron cargar los mensajes.";
      }
    },
    async saveMessage() {
      this.error = "";
      this.saving = true;

      try {
        const response = await fetch(`${apiBase}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: this.name, message: this.message }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "No se pudo guardar el mensaje.");
        }

        this.message = "";
        await this.loadMessages();
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
          <p class="eyebrow">Virtualizacion 2026</p>
          <h1>Proyecto Final - 1036622 Byron Jose Albizures Quevedo</h1>
          <p class="summary">Frontend Vue, API Flask y MongoDB comunicados por una red interna de Docker.</p>
        </div>
        <div class="status-panel">
          <span>Backend: {{ status }}</span>
          <span>MongoDB: {{ database }}</span>
        </div>
      </section>

      <section class="workspace">
        <form class="composer" @submit.prevent="saveMessage">
          <label>
            Nombre
            <input v-model="name" maxlength="80" required />
          </label>
          <label>
            Mensaje
            <textarea v-model="message" maxlength="300" rows="4" required></textarea>
          </label>
          <button type="submit" :disabled="saving">{{ saving ? "Guardando..." : "Guardar en MongoDB" }}</button>
          <p class="error" v-if="error">{{ error }}</p>
        </form>

        <div class="messages">
          <h2>Mensajes guardados</h2>
          <article v-for="item in messages" :key="item.id">
            <strong>{{ item.name }}</strong>
            <p>{{ item.message }}</p>
            <small>{{ item.createdAt }}</small>
          </article>
          <p class="empty" v-if="messages.length === 0">Aun no hay datos guardados.</p>
        </div>
      </section>
    </main>
  `,
}).mount("#app");
