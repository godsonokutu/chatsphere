# Mobile dependency review — 21 October 2026

`npm audit --json` after installing the two SDK-matched native config modules
reported 18 affected dependency entries (15 high, 3 moderate). This is not a
claim of 18 separate exploitable application flaws: npm propagates an advisory
through parent packages. No audit exception or suppression was added.

The underlying advisories reviewed were:

- `braces <=3.0.3`: deeply nested pattern stack exhaustion,
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- `node-forge <=1.4.0`: RSA signature verification handling,
  [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- `uuid <11.1.1`: buffer bounds in v3/v5/v6,
  [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

The installed paths are Expo CLI/code-signing tooling (`node-forge`), Metro's
file-pattern tooling (`braces` through `micromatch`), and Expo config's `xcode`
project generator (`uuid@7.0.3`). The inspected xcode generator calls `uuid.v4`
without a supplied output buffer. ChatSphere's mobile session/message code does
not import these modules; it uses `expo-crypto` for client message UUIDs and
the platform's TLS and secure storage. These observations limit the known
exposure but do not prove the entire toolchain or app is vulnerability-free.

The registry's latest braces (3.0.3) and node-forge (1.4.0) were still in the
reported ranges at inspection. npm's suggested force fix included downgrading
Expo to 44 and React Native to 0.72, which would break this SDK 57 project.
Those downgrades and unverified major overrides were not applied. Reassess
patched SDK/tooling releases and these advisories before production release.

Native preview builds use only this repository's own source/sample data and
generated test signing material. Do not expose Metro or build tools as public
services or process untrusted projects with this toolchain.
