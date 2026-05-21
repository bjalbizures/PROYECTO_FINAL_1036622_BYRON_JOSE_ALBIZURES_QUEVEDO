# Proyecto Final Virtualizacion 2026 - 1036622 Byron Jose Albizures Quevedo

Ecommerce sencillo de venta de ropa construido con arquitectura de microservicios:

- `frontend`: tienda Vue servida por Nginx con HTTP y HTTPS.
- `backend`: API REST en Flask para productos y pedidos.
- `mongo`: base de datos MongoDB interna, sin puertos expuestos al host.

## Estructura

```text
.
├── docker-compose.yml
├── .env
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
├── backend/
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
└── database/
    └── init/
```

## Ejecucion

`npm start` levanta la aplicacion completa con Docker. Durante el `--build`, el Dockerfile del frontend instala sus dependencias Node y el Dockerfile del backend instala sus dependencias Python dentro de las imagenes.

Para levantar la aplicacion completa:

```bash
npm start
```

`npm start` crea `.env` desde `env.example` si todavia no existe y luego levanta frontend, backend y MongoDB con Docker Compose.

Accesos:

- Frontend HTTP: `http://localhost`
- Frontend HTTPS: `https://localhost`
- Backend directo: `http://localhost:5000/api/health`

MongoDB no se expone al exterior. Solo el backend se conecta usando el nombre de servicio `mongo`.

## Scripts desde la raiz

```bash
npm run setup
npm start
npm run start:detached
npm stop
npm run logs
```

- `setup` crea el `.env` local desde `env.example` si hace falta.
- `start` levanta todo el proyecto con Docker Compose.
- `start:detached` lo levanta en segundo plano.
- `stop` detiene los contenedores.
- `logs` muestra la salida de los servicios levantados.

## Pruebas y validacion

```bash
docker ps
curl http://localhost:5000/api/health
curl http://localhost/api/products
```

Desde el navegador se puede agregar ropa al carrito y registrar un pedido. Ese flujo valida:

- Usuario -> Frontend Vue
- Frontend -> Backend Flask por `/api`
- Backend -> MongoDB por nombre de servicio `mongo`
- Consulta de productos
- Insercion de pedidos
- Actualizacion de stock

## Seguridad basica aplicada

- Las credenciales estan en `.env`, no dentro del codigo Flask.
- MongoDB no tiene `ports`, por lo tanto no queda expuesto al host.
- Los contenedores se comunican por una red personalizada de Docker.
- El frontend usa proxy Nginx para llamar al backend por nombre de servicio.
- Se usan imagenes oficiales: `node`, `nginx`, `python` y `mongo`.
- Solo se exponen los puertos necesarios: 80, 443 y 5000.

## Riesgos identificados

- El archivo `.env` contiene credenciales y debe protegerse si el proyecto se sube a un repositorio.
- El certificado HTTPS incluido es local/autofirmado, por lo que el navegador puede mostrar advertencia.
- Para produccion se deberian usar secretos administrados, certificados validos y reglas de firewall.
- El backend esta expuesto en el puerto 5000 para pruebas; en produccion podria quedar solo interno detras de Nginx.

## Endpoints principales

- `GET /api/health`: valida conexion con MongoDB.
- `GET /api/products`: lista prendas disponibles.
- `GET /api/orders`: lista pedidos recientes.
- `POST /api/orders`: registra un pedido con `customerName` e `items`.

## Reflexion final

Separar los servicios es importante porque cada componente puede desarrollarse, escalarse y corregirse de forma independiente. Si la base de datos se expone al exterior, aumenta el riesgo de accesos no autorizados, fuga de informacion o borrado de datos. Docker facilita esta arquitectura porque permite definir servicios, redes, volumenes y variables de entorno de forma reproducible. Para llevarlo a la nube se podria publicar cada imagen en un registro y desplegarla en una plataforma como Kubernetes, ECS, Cloud Run o maquinas virtuales con Docker Compose, agregando secretos, monitoreo y HTTPS real.
