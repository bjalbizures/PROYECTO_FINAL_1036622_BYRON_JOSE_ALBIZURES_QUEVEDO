$ErrorActionPreference = "Stop"

$namespace = "proyecto-1036622"

kubectl scale deployment/frontend deployment/backend --replicas=0 --namespace $namespace
kubectl scale statefulset/mongo --replicas=0 --namespace $namespace
