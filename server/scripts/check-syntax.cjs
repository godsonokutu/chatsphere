"use strict";

const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collect(path) : /\.(js|cjs)$/.test(path) ? [path] : [];
  });
}

const files = ["src", "scripts", "test"].flatMap(collect).sort();
if (!files.length) throw new Error("No server JavaScript files found");
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax validation passed for ${files.length} server JavaScript files.`);
