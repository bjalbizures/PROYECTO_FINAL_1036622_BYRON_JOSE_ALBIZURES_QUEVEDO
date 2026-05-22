const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

const namespace = "proyecto-1036622";
const preferredLocalContexts = ["docker-desktop", "minikube"];

function run(command, args, options = {}) {
  let stdio = "inherit";

  if (options.captureStdout) {
    stdio = ["inherit", "pipe", "inherit"];
  } else if (options.input) {
    stdio = ["pipe", "inherit", "inherit"];
  }

  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio,
    input: options.input,
  });

  if (result.error) {
    throw new Error(`No se pudo ejecutar ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

function read(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });

  if (result.error) {
    throw new Error(`No se pudo ejecutar ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

function isLocalContext(context) {
  return preferredLocalContexts.includes(context) || context.startsWith("kind-");
}

function pickLocalContext(contexts) {
  const requestedContext = process.env.K8S_LOCAL_CONTEXT;

  if (requestedContext) {
    if (!contexts.includes(requestedContext)) {
      throw new Error(`El contexto local solicitado '${requestedContext}' no existe en kubectl.`);
    }

    if (!isLocalContext(requestedContext)) {
      throw new Error(
        `El contexto solicitado '${requestedContext}' no es local. Usa docker-desktop, minikube o un contexto kind-*.`,
      );
    }

    return requestedContext;
  }

  return preferredLocalContexts.find((context) => contexts.includes(context))
    ?? contexts.find((context) => context.startsWith("kind-"));
}

function readEnvFile(path) {
  const values = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separator = trimmedLine.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separator).trim();
    let value = trimmedLine.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function requireEnvValue(values, name) {
  const value = process.env[name] || values[name];

  if (!value) {
    throw new Error(`Falta ${name} en .env.`);
  }

  return value;
}

try {
  const currentContext = read("kubectl", ["config", "current-context"]);
  const contexts = read("kubectl", ["config", "get-contexts", "-o", "name"]).split(/\r?\n/).filter(Boolean);
  const localContext = isLocalContext(currentContext) ? currentContext : pickLocalContext(contexts);

  if (!localContext) {
    throw new Error(
      `No se encontro un contexto Kubernetes local para reemplazar '${currentContext}'. Configura docker-desktop, minikube o kind antes de desplegar.`,
    );
  }

  if (localContext !== currentContext) {
    console.log(`Cambiando kubectl de '${currentContext}' al contexto local '${localContext}'.`);
    run("kubectl", ["config", "use-context", localContext]);
  } else {
    console.log(`Usando contexto Kubernetes local '${localContext}'.`);
  }

  const env = readEnvFile(".env");
  const mongoUser = requireEnvValue(env, "MONGO_USER");
  const mongoPassword = requireEnvValue(env, "MONGO_PASSWORD");
  const mongoDb = requireEnvValue(env, "MONGO_DB");
  const mongoUri = `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPassword)}@mongo:27017/${encodeURIComponent(mongoDb)}?authSource=admin`;
  const registry = process.env.K8S_IMAGE_REGISTRY?.replace(/\/+$/, "");
  const imagePrefix = registry ? `${registry}/` : "";
  const frontendImage = `${imagePrefix}proyecto-1036622-frontend:local`;
  const backendImage = `${imagePrefix}proyecto-1036622-backend:local`;

  console.log(
    registry
      ? `Usando imagenes bajo el registry ${registry}.`
      : "Usando imagenes locales. Define K8S_IMAGE_REGISTRY si tambien necesitas publicarlas en un registry.",
  );

  run("docker", ["build", "--tag", frontendImage, "--file", "frontend/Dockerfile", "frontend"]);
  run("docker", ["build", "--tag", backendImage, "--file", "backend/Dockerfile", "backend"]);

  if (registry) {
    run("docker", ["push", frontendImage]);
    run("docker", ["push", backendImage]);
  }

  run("kubectl", ["apply", "-f", "k8s/namespace.yaml"]);

  const mongoConfig = run(
    "kubectl",
    [
      "create",
      "configmap",
      "proyecto-config",
      "--namespace",
      namespace,
      `--from-literal=mongo-db=${mongoDb}`,
      "--dry-run=client",
      "-o",
      "yaml",
    ],
    { captureStdout: true },
  );
  run("kubectl", ["apply", "-f", "-"], { input: mongoConfig });

  const mongoSecret = run(
    "kubectl",
    [
      "create",
      "secret",
      "generic",
      "mongo-auth",
      "--namespace",
      namespace,
      `--from-literal=username=${mongoUser}`,
      `--from-literal=password=${mongoPassword}`,
      `--from-literal=uri=${mongoUri}`,
      "--dry-run=client",
      "-o",
      "yaml",
    ],
    { captureStdout: true },
  );
  run("kubectl", ["apply", "-f", "-"], { input: mongoSecret });

  const tlsSecret = run(
    "kubectl",
    [
      "create",
      "secret",
      "tls",
      "frontend-tls",
      "--namespace",
      namespace,
      "--cert",
      "frontend/certs/localhost.crt",
      "--key",
      "frontend/certs/localhost.key",
      "--dry-run=client",
      "-o",
      "yaml",
    ],
    { captureStdout: true },
  );
  run("kubectl", ["apply", "-f", "-"], { input: tlsSecret });

  run("kubectl", ["apply", "-f", "k8s"]);
  run("kubectl", ["set", "image", "deployment/backend", `backend=${backendImage}`, "--namespace", namespace]);
  run("kubectl", ["set", "image", "deployment/frontend", `frontend=${frontendImage}`, "--namespace", namespace]);
  run("kubectl", ["rollout", "restart", "deployment/backend", "--namespace", namespace]);
  run("kubectl", ["rollout", "restart", "deployment/frontend", "--namespace", namespace]);
  run("kubectl", ["rollout", "status", "statefulset/mongo", "--namespace", namespace, "--timeout=120s"]);
  run("kubectl", ["rollout", "status", "deployment/backend", "--namespace", namespace, "--timeout=120s"]);
  run("kubectl", ["rollout", "status", "deployment/frontend", "--namespace", namespace, "--timeout=120s"]);

  console.log("\nFrontend Service:");
  run("kubectl", ["get", "service/frontend", "--namespace", namespace]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
