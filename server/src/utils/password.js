const argon2 = require("argon2");

const PASSWORD_HASH_OPTIONS = Object.freeze({
    type: argon2.argon2id,

    memoryCost: 64 * 1024, // 64 MiB
    timeCost: 3,
    parallelism: 1,

    hashLength: 32
});

async function hashPassword(password) {
    return argon2.hash(
        password,
        PASSWORD_HASH_OPTIONS
    );
}
async function verifyPassword(password, passwordHash) {
  if (
    typeof password !== "string" ||
    typeof passwordHash !== "string"
  ) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}


function needsRehash(passwordHash) {
    return argon2.needsRehash(
        passwordHash,
        PASSWORD_HASH_OPTIONS
    );
}



module.exports = Object.freeze({
    hashPassword,
    verifyPassword,
    needsRehash
});