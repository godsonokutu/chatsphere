"use strict";

/*
 * Process-local online connection counts.
 *
 * userId -> number of currently-connected sockets.
 *
 * The rest of the application does NOT access this Map
 * directly. That lets us replace this implementation with
 * Redis when ChatSphere runs multiple API instances.
 */
const connectionCounts = new Map();

function getCount(userId) {
  return (
    connectionCounts.get(
      String(userId)
    ) || 0
  );
}

function addConnection(userId) {
  const key =
    String(userId);

  const previous =
    getCount(key);

  const next =
    previous + 1;

  connectionCounts.set(
    key,
    next
  );

  return {
    previous,
    current: next,

    becameOnline:
      previous === 0,
  };
}

function removeConnection(userId) {
  const key =
    String(userId);

  const previous =
    getCount(key);

  if (previous <= 1) {
    connectionCounts.delete(
      key
    );

    return {
      previous,
      current: 0,

      becameOffline:
        previous > 0,
    };
  }

  const next =
    previous - 1;

  connectionCounts.set(
    key,
    next
  );

  return {
    previous,
    current: next,

    becameOffline: false,
  };
}

function isOnline(userId) {
  return getCount(userId) > 0;
}

module.exports = {
  addConnection,
  removeConnection,
  isOnline,
  getCount,
};