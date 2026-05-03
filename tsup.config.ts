import { defineConfig, type Options } from "tsup";
import { join } from "node:path";

function rewritePlugin(rewrites: Array<{ from: RegExp; to: (path: string) => string }>) {
	return {
		name: "rewrite-plugin",
		setup(build: any) {
			build.onResolve({ filter: /.*/ }, (args: any) => {
				for (const rule of rewrites) {
					if (rule.from.test(args.path)) {
						const next = rule.to(args.path);
						if (next.startsWith(".")) {
							return { path: join(args.resolveDir, next) };
						}
						return { path: next };
					}
				}
				return null;
			});
		},
	};
}

const entries = [
	"src/index.ts",
	"src/adapters/index.ts",
	"src/adapters/database/index.ts",
	"src/adapters/session/index.ts",
	"src/adapters/oauth-token/index.ts",
	"src/adapters/drizzle/index.ts",
	"src/adapters/verification-token/index.ts",
	"src/adapters/magic-link/index.ts",
	"src/adapters/webauthn/index.ts",
	"src/providers/index.ts",
	"src/handlers/index.ts",
	"src/login-context/index.ts",
	"src/utils/index.ts",
	"src/client/index.ts",
	"src/types/index.ts",
	"src/testing/index.ts",
	"src/mfa/index.ts",
	"src/ui/index.ts",
	"src/security/index.ts",
	"src/errors/index.ts",
];

const common: Options = {
	entry: entries,
	format: ["esm"],
	target: "es2022",
	splitting: false,
	sourcemap: true,
	treeshake: true,
	clean: false,
	skipNodeModulesBundle: true,
};

export default defineConfig([
	{
		...common,
		outDir: "dist/node",
		esbuildPlugins: [
			rewritePlugin([
				{
					from: /(^|\/)password\.ts$/,
					to: (p) => p.replace(/password\.ts$/, "password.node.ts"),
				},
			]),
		],
	},
	{
		...common,
		outDir: "dist/worker",
		esbuildPlugins: [
			rewritePlugin([
				{
					from: /(^|\/)webauthn\.ts$/,
					to: (p) => p.replace(/webauthn\.ts$/, "webauthn.worker.ts"),
				},
			]),
		],
	},
]);
