import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import { moduleFederationShared } from "@iobroker/gui-components/modulefederation.admin.config";
import { readFileSync } from "node:fs";

export default defineConfig({
	plugins: [
		federation({
			name: "AnomalyDetectionAdmin",
			filename: "customComponents.js",
			manifest: true,
			exposes: {
				"./Components": "./src/Components.tsx",
			},
			remotes: {},
			shared: moduleFederationShared(JSON.parse(readFileSync("./package.json", "utf8"))),
		}),
		react(),
	],
	build: {
		outDir: "../admin/custom",
		emptyOutDir: true,
		target: "chrome89",
	},
});
