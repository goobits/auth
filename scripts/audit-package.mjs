import { spawn } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const tempDir = await mkdtemp(join(tmpdir(), "goobits-auth-audit-"));

function run(command, args, options) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			...options,
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
			}
		});
	});
}

try {
	await cp(join(root, "package.json"), join(tempDir, "package.json"));
	await cp(join(root, "pnpm-lock.yaml"), join(tempDir, "pnpm-lock.yaml"));
	await run("pnpm", ["audit", "--prod", "--audit-level", "high"], { cwd: tempDir });
} finally {
	await rm(tempDir, { recursive: true, force: true });
}
