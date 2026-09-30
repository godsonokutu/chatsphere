"use strict";

function encodeConversationCursor({
  sortAt,
  id,
}) {
  const date =
    new Date(sortAt);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new TypeError(
      "Invalid cursor timestamp"
    );
  }

  return Buffer
    .from(
      JSON.stringify({
        v: 1,
        t: date.toISOString(),
        i: String(id),
      }),
      "utf8"
    )
    .toString(
      "base64url"
    );
}

function decodeConversationCursor(
  cursor
) {
  if (
    typeof cursor !== "string" ||
    cursor.length === 0 ||
    cursor.length > 512
  ) {
    throw new TypeError(
      "Invalid conversation cursor"
    );
  }

  let parsed;

  try {
    const decoded =
      Buffer
        .from(
          cursor,
          "base64url"
        )
        .toString(
          "utf8"
        );

    parsed =
      JSON.parse(decoded);
  } catch {
    throw new TypeError(
      "Invalid conversation cursor"
    );
  }

  if (
    parsed?.v !== 1 ||
    typeof parsed?.t !==
      "string" ||
    typeof parsed?.i !==
      "string" ||
    !/^[1-9]\d{0,19}$/.test(
      parsed.i
    )
  ) {
    throw new TypeError(
      "Invalid conversation cursor"
    );
  }

  const sortAt =
    new Date(parsed.t);

  if (
    Number.isNaN(
      sortAt.getTime()
    )
  ) {
    throw new TypeError(
      "Invalid conversation cursor"
    );
  }

  return {
    sortAt,
    id:
      parsed.i,
  };
}

module.exports = {
  encodeConversationCursor,
  decodeConversationCursor,
};