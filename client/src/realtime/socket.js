import {
  io,
} from "socket.io-client";

import {
  getAccessToken,
} from "../api/tokenStore";

const SOCKET_URL =
  import.meta.env
    .VITE_SOCKET_URL;

if (!SOCKET_URL) {
  throw new Error(
    "VITE_SOCKET_URL is required"
  );
}

let socket = null;

// ======================================================
// CREATE SOCKET WITHOUT CONNECTING
//
// This allows React to register listeners FIRST,
// eliminating races with early server events.
// ======================================================

export function getOrCreateSocket() {
  if (!socket) {
    socket =
      io(
        SOCKET_URL,
        {
          autoConnect:
            false,

          transports: [
            "websocket",
          ],

          withCredentials:
            true,

          /*
           * Called for every new connection.
           *
           * Therefore reconnects always use the
           * newest in-memory access token.
           */
          auth: (
            callback
          ) => {
            callback({
              token:
                getAccessToken(),
            });
          },

          reconnection:
            true,

          reconnectionAttempts:
            10,

          reconnectionDelay:
            1000,

          reconnectionDelayMax:
            5000,
        }
      );
  }

  return socket;
}

// ======================================================
// CONNECT
// ======================================================

export function connectSocket() {
  const currentSocket =
    getOrCreateSocket();

  const token =
    getAccessToken();

  if (!token) {
    throw new Error(
      "Cannot connect socket without an access token."
    );
  }

  if (
    !currentSocket
      .connected
  ) {
    currentSocket
      .connect();
  }

  return currentSocket;
}

// ======================================================
// FORCE REAUTHENTICATED RECONNECT
//
// Used after access-token refresh.
// ======================================================

export function reconnectSocket() {
  const currentSocket =
    getOrCreateSocket();

  const token =
    getAccessToken();

  if (!token) {
    throw new Error(
      "Cannot reconnect socket without an access token."
    );
  }

  if (
    currentSocket
      .connected
  ) {
    currentSocket
      .disconnect();
  }

  currentSocket
    .connect();

  return currentSocket;
}

// ======================================================
// DISCONNECT AND DESTROY CLIENT INSTANCE
// ======================================================

export function disconnectSocket() {
  if (!socket) {
    return;
  }

  socket.disconnect();

  socket = null;
}

// ======================================================
// RETURN CURRENT INSTANCE
// ======================================================

export function getSocket() {
  return socket;
}