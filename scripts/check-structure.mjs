import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const workspaces = [];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(file);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
  }));
  return files.flat();
}

for (const group of ["apps", "packages"]) {
  for (const entry of await readdir(path.join(root, group), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(root, group, entry.name);
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    workspaces.push({ directory, manifest, group });
  }
}

const names = new Set(workspaces.map(({ manifest }) => manifest.name));
for (const { directory, manifest, group } of workspaces) {
  const declared = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
  for (const target of Object.values(manifest.exports ?? {})) {
    if (typeof target !== "string") continue;
    try { await access(path.resolve(directory, target)); }
    catch { errors.push(`${manifest.name}: missing export target ${target}`); }
  }
  const files = await filesIn(path.join(directory, "src"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["']([^"']+)["']/g);
    for (const [, specifier] of imports) {
      const label = path.relative(root, file);
      if (specifier.startsWith("@repo/")) {
        const dependency = specifier.split("/").slice(0, 2).join("/");
        if (!names.has(dependency)) errors.push(`${label}: unknown workspace ${dependency}`);
        if (dependency !== manifest.name && !declared[dependency]) errors.push(`${label}: undeclared dependency ${dependency}`);
      }
      if (group === "packages" && specifier.startsWith("@/")) {
        errors.push(`${label}: shared packages cannot depend on an app alias (${specifier})`);
      }
      if (specifier.startsWith(".")) {
        const resolved = path.resolve(path.dirname(file), specifier);
        const owner = workspaces.find((workspace) => resolved.startsWith(workspace.directory + path.sep));
        if (owner && owner.directory !== directory) {
          errors.push(`${label}: import ${owner.manifest.name} through its public package exports`);
        }
      }
    }
  }
}

for (const app of ["teacher-web", "student-web"]) {
  const css = await readFile(path.join(root, "apps", app, "src/app/globals.css"), "utf8");
  for (const shared of ["ui", "classroom"]) {
    if (!css.includes(`@source "../../../../packages/${shared}/src";`)) {
      errors.push(`${app}: missing Tailwind source for @repo/${shared}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Structure checks passed for ${workspaces.length} workspaces.`);
}
