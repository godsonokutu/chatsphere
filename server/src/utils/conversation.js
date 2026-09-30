"use strict";

function normalizeId(value) {
  const id = String(value);

  if (!/^[1-9]\d*$/.test(id)) {
    throw new TypeError(
      "Invalid user ID"
    );
  }

  return id;
}

function createDirectKey(
  firstUserId,
  secondUserId
) {
  const first =
    normalizeId(firstUserId);

  const second =
    normalizeId(secondUserId);

  if (first === second) {
    throw new TypeError(
      "Direct conversation requires two different users"
    );
  }

  const firstBigInt =
    BigInt(first);

  const secondBigInt =
    BigInt(second);

  if (
    firstBigInt < secondBigInt
  ) {
    return `${first}:${second}`;
  }

  return `${second}:${first}`;
}

module.exports = {
  createDirectKey,
};