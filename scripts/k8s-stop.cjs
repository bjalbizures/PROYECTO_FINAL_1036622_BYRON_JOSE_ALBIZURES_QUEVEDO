const { spawnSync } = require("node:child_process");

const namespace = "proyecto-1036622";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    throw new Error(`No se pudo ejecutar ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  run("kubectl", [
    "scale",
    "deployment/frontend",
    "deployment/backend",
    "--replicas=0",
    "--namespace",
    namespace,
  ]);
  run("kubectl", ["scale", "statefulset/mongo", "--replicas=0", "--namespace", namespace]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
