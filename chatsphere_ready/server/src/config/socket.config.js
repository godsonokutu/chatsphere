"use strict";

const env = require("./env");

module.exports = Object.freeze({
  cors: {
    origin: env.CLIENT_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },

  // Prevent unexpectedly large socket payloads.
  // Our text messages are only up to 4 KB anyway.
  maxHttpBufferSize: 100 * 1024,

  pingInterval: 25000,
  pingTimeout: 20000,

  allowEIO3: false,
});