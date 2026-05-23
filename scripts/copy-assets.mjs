import { mkdir, readdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const ASSET_DIRS = [
  {
    srcDir: join(root, "src", "ui"),
    patterns: [".svelte", ".css"],
    outSubdir: join("ui"),
  },
];

const OUT_DIRS = [join(root, "dist", "node"), join(root, "dist", "worker")];

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function copyDirFiltered({ srcDir, patterns, outSubdir }) {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const outDir of OUT_DIRS) {
    await ensureDir(join(outDir, outSubdir));
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = entry.name.slice(entry.name.lastIndexOf("."));
    if (!patterns.includes(ext)) continue;
    const from = join(srcDir, entry.name);
    for (const outDir of OUT_DIRS) {
      const to = join(outDir, outSubdir, entry.name);
      await copyFile(from, to);
    }
  }
}

// Convert the TypeScript barrel at src/ui/index.ts into a runtime-loadable
// barrel: keep raw .svelte imports (loaders process them downstream) and
// rewrite the .js extension to point at the emitted auth-store output.
async function buildUiBarrelFromSource() {
  const source = await readFile(join(root, "src", "ui", "index.ts"), "utf8");
  // No transformation needed today — .svelte imports stay raw and the
  // .js import already matches the emitted output filename. Strip any
  // TypeScript-only `type` re-exports if they're ever added later.
  return source.replace(/^export type .*;\n/gm, "");
}

for (const dir of ASSET_DIRS) {
  // eslint-disable-next-line no-await-in-loop
  await copyDirFiltered(dir);
}

const uiBarrel = await buildUiBarrelFromSource();
for (const outDir of OUT_DIRS) {
  // eslint-disable-next-line no-await-in-loop
  await writeFile(join(outDir, "ui", "index.js"), uiBarrel);
}
