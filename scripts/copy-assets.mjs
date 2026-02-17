import { mkdir, readdir, copyFile } from "node:fs/promises";
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

for (const dir of ASSET_DIRS) {
  // eslint-disable-next-line no-await-in-loop
  await copyDirFiltered(dir);
}

