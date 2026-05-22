# Proyecto Final Virtualizacion 2026 - 1036622 Byron Jose Albizures Quevedo

Ecommerce sencillo de venta de ropa desplegado sobre Kubernetes:

- `frontend`: tienda Vue servida por Nginx con HTTP y HTTPS.
- `backend`: API REST en Flask para productos y pedidos.
- `mongo`: base de datos MongoDB interna con volumen persistente.

## Estructura

```text
.
|-- k8s/
|   |-- backend.yaml
|   |-- frontend.yaml
|   |-- mongo.yaml
|   `-- namespace.yaml
|-- scripts/
|   |-- k8s-start.cjs
|   `-- k8s-stop.cjs
|-- frontend/
|   |-- Dockerfile
|   |-- nginx.conf
|   `-- src/
|-- backend/
|   |-- Dockerfile
|   |-- app.py
|   `-- requirements.txt
|-- docker-compose.yml
`-- database/
    `-- init/
```

## Ejecucion

Requisitos locales:

- Node.js y npm para ejecutar los comandos de la raiz.
- Docker para construir las imagenes del frontend y backend.
- Kubernetes local habilitado en `docker-desktop`, `minikube` o `kind`.
- `npm start` y `npm stop` funcionan en Windows y macOS porque ejecutan scripts de Node.

Antes de desplegar puedes revisar los contextos disponibles:

```bash
kubectl config get-contexts
```

`scripts/k8s-start.cjs` cambia `kubectl` a un contexto local antes de aplicar recursos. Si el contexto actual es remoto, prefiere `docker-desktop`, luego `minikube` y luego un contexto `kind-*`; si no encuentra ninguno, cancela el despliegue.

Para elegir explicitamente un contexto local disponible:

```bash
K8S_LOCAL_CONTEXT="docker-desktop" npm start
```

`npm start` construye imagenes locales, crea la configuracion y el `Secret` de MongoDB desde `.env`, aplica los manifiestos de `k8s/`, crea el `Secret` TLS del frontend desde `frontend/certs/` y espera los rollouts. El flujo funciona directo con Kubernetes de Docker Desktop porque usa las imagenes construidas por el Docker local.

```bash
npm start
```

Las variables `MONGO_DB`, `MONGO_USER` y `MONGO_PASSWORD` deben existir en `.env`. MongoDB usa esas credenciales al inicializar su volumen por primera vez; si cambian despues de crear el PVC local, se debe actualizar el usuario dentro de MongoDB o reinicializar ese volumen de forma controlada.

`npm start` siempre aplica recursos al cluster local seleccionado. Si tambien necesitas publicar las imagenes en un registry, el script puede hacerlo cuando Docker ya tiene sesion iniciada en ese registry:

```powershell
$env:K8S_IMAGE_REGISTRY = "mi-registry.example.com"
npm start
```

En macOS o Linux la variable se define asi:

```bash
K8S_IMAGE_REGISTRY="mi-registry.example.com" npm start
```

En Minikube tambien se pueden cargar las imagenes locales al cluster antes de aplicar los manifiestos.

Accesos en Kubernetes local con LoadBalancer disponible:

- Frontend HTTP: `http://localhost`
- Frontend HTTPS: `https://localhost`

En un cluster remoto desplegado por un flujo separado, revisa el `EXTERNAL-IP` del Service `frontend`:

```bash
npm run status
```

MongoDB y el backend se exponen solo como `ClusterIP`. Nginx recibe `/api` desde el frontend y lo reenvia al Service `backend` dentro de Kubernetes.

## Scripts desde la raiz

```bash
npm start
npm stop
npm run status
npm run logs
```

- `start` construye las imagenes, aplica Kubernetes y reinicia backend/frontend para tomar la configuracion e imagenes locales nuevas.
- `stop` escala frontend, backend y MongoDB a cero sin borrar el PVC de MongoDB.
- `status` muestra Pods, Services y PVC del namespace `proyecto-1036622`.
- `logs` sigue los logs del backend.

## Kubernetes

- `namespace.yaml` aisla los recursos en `proyecto-1036622`.
- `mongo.yaml` crea un `StatefulSet`, un Service interno y un PVC de `1Gi`.
- `backend.yaml` crea el Deployment Flask y un Service interno llamado `backend`.
- `frontend.yaml` crea el Deployment Nginx y un Service `LoadBalancer` para HTTP y HTTPS.
- `k8s-start.cjs` crea el `ConfigMap` `proyecto-config` y el `Secret` `mongo-auth` desde `.env`, y el `Secret` `frontend-tls` desde los certificados locales antes de aplicar los recursos.
- `k8s-start.cjs` reinicia los Deployments `backend` y `frontend` en cada arranque para que lean los `Secrets`, `ConfigMaps` e imagenes locales actuales. No borra ni reinicializa el PVC de MongoDB.

Las imagenes locales del backend y frontend usan `imagePullPolicy: IfNotPresent`. Para Kubernetes de Docker Desktop se reutilizan las imagenes que construye `npm start`; en otro cluster los nodos deben poder obtenerlas desde el registry configurado.

## Pruebas y validacion

```bash
kubectl get pods,services,pvc -n proyecto-1036622
curl http://localhost/api/health
curl http://localhost/api/products
```

Desde el navegador se puede agregar ropa al carrito y registrar un pedido. Ese flujo valida:

- Usuario -> Frontend Vue
- Frontend -> Backend Flask por `/api`
- Backend -> MongoDB por el Service `mongo`
- Consulta de productos
- Insercion de pedidos
- Actualizacion de stock

## Seguridad basica aplicada

- Las credenciales de MongoDB se leen desde `.env` y se cargan en un `Secret` de Kubernetes durante `npm start`, no quedan escritas en los manifiestos.
- MongoDB no usa NodePort ni LoadBalancer, por lo tanto queda interno al cluster.
- El frontend usa proxy Nginx para llamar al backend por nombre de Service.
- El certificado local se monta como `Secret` TLS en el Pod del frontend.
- Se usan imagenes oficiales: `node`, `nginx`, `python` y `mongo`.
- Solo el Service del frontend se expone con LoadBalancer para HTTP y HTTPS.

## Riesgos identificados

- `.env` contiene credenciales locales y esta excluido de Git; en un despliegue real se deben administrar con un gestor de secretos.
- El certificado HTTPS incluido es local/autofirmado, por lo que el navegador puede mostrar advertencia.
- Para produccion se deberian usar secretos administrados, certificados validos y reglas de firewall.
- Un cluster remoto requiere imagenes publicadas en un registry accesible para sus nodos.

## Endpoints principales

- `GET /api/health`: valida conexion con MongoDB.
- `GET /api/live`: responde sin consultar MongoDB para la sonda de vida del backend.
- `GET /api/products`: lista prendas disponibles.
- `GET /api/orders`: lista pedidos recientes.
- `POST /api/orders`: registra un pedido con `customerName` e `items`.

## Reflexion final

Separar los servicios es importante porque cada componente puede desarrollarse, escalarse y corregirse de forma independiente. Si la base de datos se expone al exterior, aumenta el riesgo de accesos no autorizados, fuga de informacion o borrado de datos. Kubernetes facilita esta arquitectura porque define Deployments, Services, Secrets y almacenamiento persistente de forma declarativa. Para llevarlo a la nube se deben publicar las imagenes, administrar secretos, agregar monitoreo y usar HTTPS valido.
