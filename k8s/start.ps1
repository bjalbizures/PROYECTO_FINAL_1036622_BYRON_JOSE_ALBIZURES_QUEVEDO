$ErrorActionPreference = "Stop"

$namespace = "proyecto-1036622"
$context = kubectl config current-context
$localContexts = @("docker-desktop", "minikube")

if (($localContexts -notcontains $context) -and (-not $context.StartsWith("kind-"))) {
  throw "Refusing to deploy to Kubernetes context '$context'. Switch kubectl to docker-desktop, minikube, or a kind-* local context first."
}

$frontendImage = "proyecto-1036622-frontend:local"
$backendImage = "proyecto-1036622-backend:local"

if ($env:K8S_IMAGE_REGISTRY) {
  $registry = $env:K8S_IMAGE_REGISTRY.TrimEnd("/")
  $frontendImage = "$registry/proyecto-1036622-frontend:local"
  $backendImage = "$registry/proyecto-1036622-backend:local"
  Write-Host "Using registry images under $registry."
} else {
  Write-Host "Using local images. Set K8S_IMAGE_REGISTRY for a remote cluster such as AKS."
}

docker build --tag $frontendImage --file frontend/Dockerfile frontend
docker build --tag $backendImage --file backend/Dockerfile backend

if ($env:K8S_IMAGE_REGISTRY) {
  docker push $frontendImage
  docker push $backendImage
}

kubectl apply -f k8s/namespace.yaml
kubectl create secret tls frontend-tls `
  --namespace $namespace `
  --cert frontend/certs/localhost.crt `
  --key frontend/certs/localhost.key `
  --dry-run=client `
  -o yaml | kubectl apply -f -

kubectl apply -f k8s
kubectl set image deployment/backend backend=$backendImage --namespace $namespace
kubectl set image deployment/frontend frontend=$frontendImage --namespace $namespace
kubectl rollout status statefulset/mongo --namespace $namespace --timeout=120s
kubectl rollout status deployment/backend --namespace $namespace --timeout=120s
kubectl rollout status deployment/frontend --namespace $namespace --timeout=120s

Write-Host ""
Write-Host "Frontend Service:"
kubectl get service/frontend --namespace $namespace
