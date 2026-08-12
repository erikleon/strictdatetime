import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "strictdatetime-package-"));

// On Windows npm and tsc are .cmd shims, which execFileSync refuses to spawn without a shell.
// Both are Node programs, so their entry scripts run through the current node binary on every
// platform instead. npm sets npm_execpath to its own CLI when it runs a package script.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is unset. Run this through npm, for example `npm run test:package`.");
}
const tscCli = join(root, "node_modules/typescript/bin/tsc");

function run(command, args, cwd = root) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NPM_CONFIG_CACHE: join(temporary, "npm-cache") },
  });
}

try {
  const packed = JSON.parse(
    run(process.execPath, [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", temporary]),
  );
  const tarball = join(temporary, packed[0].filename);
  const stat = packed[0];
  if (stat.size > 100 * 1024) throw new Error(`Packed package exceeds 100 KiB: ${stat.size}`);

  const esmGzip = gzipSync(readFileSync(join(root, "dist/index.js"))).byteLength;
  if (esmGzip > 25 * 1024) throw new Error(`ESM gzip exceeds 25 KiB: ${esmGzip}`);

  const consumer = join(temporary, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { strictdatetime: `file:${tarball}` },
    }),
  );
  run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-package-lock", "--no-audit"],
    consumer,
  );

  writeFileSync(
    join(consumer, "esm.mjs"),
    'import { parseInstant, toInstantString } from "strictdatetime";\nif (toInstantString(parseInstant("2026-08-10T12:00:00Z")) !== "2026-08-10T12:00:00.000Z") process.exit(1);\n',
  );
  writeFileSync(
    join(consumer, "cjs.cjs"),
    'const { parseInstant, toInstantString } = require("strictdatetime");\nif (toInstantString(parseInstant("2026-08-10T12:00:00Z")) !== "2026-08-10T12:00:00.000Z") process.exit(1);\n',
  );
  writeFileSync(
    join(consumer, "types.ts"),
    'import { parseInstant, type Instant } from "strictdatetime";\nconst value: Instant = parseInstant("2026-08-10T12:00:00Z");\nvoid value;\n',
  );
  run(process.execPath, ["esm.mjs"], consumer);
  run(process.execPath, ["cjs.cjs"], consumer);
  run(
    process.execPath,
    [tscCli, "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext", "types.ts"],
    consumer,
  );

  process.stdout.write(
    `Package smoke tests passed (${stat.size} byte tarball, ${esmGzip} byte gzip ESM).\n`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
