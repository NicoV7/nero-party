import { existsSync, copyFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";

const root = new URL("..", import.meta.url);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureEnvFile(target, example) {
  if (existsSync(new URL(target, root))) return;
  copyFileSync(new URL(example, root), new URL(target, root));
  console.log(`Created ${target} from ${example}`);
}

ensureEnvFile(".env", ".env.example");
ensureEnvFile("frontend/.env", "frontend/.env.example");

console.log("Preparing local SQLite schema...");
run("npm", ["--prefix", "backend", "run", "prisma:push"]);

console.log("Starting Nero Party locally...");
const dev = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

dev.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

