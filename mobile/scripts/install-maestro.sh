#!/usr/bin/env bash
set -euo pipefail
# Official pinned release. Verify the archive before executing its contents.
destination="${RUNNER_TEMP:?}/chatsphere-maestro"
archive="${RUNNER_TEMP}/chatsphere-maestro.zip"
curl --fail --location --retry 3 'https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.11.0/maestro.zip' --output "$archive"
node -e 'const fs=require("fs"),crypto=require("crypto");const actual=crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex");if(actual!=="5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a")throw Error("Maestro checksum mismatch")' "$archive"
mkdir -p "$destination"
unzip -q "$archive" -d "$destination"
binary="$(find "$destination" -type f -path '*/bin/maestro' -print -quit)"
test -n "$binary"
chmod +x "$binary"
dirname "$binary" >> "$GITHUB_PATH"
