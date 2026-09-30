"use strict";

const express =
  require("express");

const helmet =
  require("helmet");

const cookieParser =
  require("cookie-parser");

const cors =
  require("cors");

const http =
  require("http");

const {
  initializeSocket,
} = require("./sockets");

const userRoutes =
  require("./routes/user.routes");

const logger =
  require("./config/logger");

const env =
  require("./config/env");

const sequelize =
  require("./config/db");

const {
  startOutboxWorker,
} = require("./workers/outbox.worker");

const requestLogger =
  require("./middleware/requestLogger");

const errorHandler =
  require("./middleware/errorHandler");

const healthRoutes =
  require("./routes/health.routes");

const authRoutes =
  require("./routes/auth.routes");

const conversationRoutes =
  require("./routes/conversation.routes");





// ==========================================
// EXPRESS APPLICATION
// ==========================================

const app =
  express();

// ==========================================
// SECURITY HEADERS
// ==========================================

app.disable(
  "x-powered-by"
);

app.use(
  helmet()
);

// ==========================================
// HTTP SERVER
//
// Express and Socket.io share the same
// underlying HTTP server.
// ==========================================

const httpServer =
  http.createServer(app);

// ==========================================
// SOCKET.IO
// ==========================================

initializeSocket(
  httpServer
);

// ==========================================
// REQUEST LOGGING
// ==========================================

app.use(
  requestLogger
);

// ==========================================
// CORS
//
// Credentials are required because our
// refresh token is stored in an HttpOnly
// cookie.
//
// Do not replace CLIENT_ORIGIN with "*".
// ==========================================

app.use(
  cors({
    origin:
      env.CLIENT_ORIGIN,

    credentials:
      true,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
    ],
  })
);

// ==========================================
// REQUEST BODY
//
// Keep this relatively small.
//
// Chat text payloads do not require a
// large JSON body. Future media/file
// uploads should use a separate upload
// mechanism rather than increasing this.
// ==========================================

app.use(
  express.json({
    limit: "100kb",
  })
);

// ==========================================
// COOKIE PARSER
//
// Required for:
// chatsphere_refresh HttpOnly cookie
// ==========================================

app.use(
  cookieParser()
);

// ==========================================
// ROUTES
// ==========================================

app.use(
  "/api",
  healthRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/conversations",
  conversationRoutes
);

app.use(
  "/api/users",
  userRoutes
);

// ==========================================
// ERROR HANDLER
//
// Must remain after routes.
// ==========================================

app.use(
  errorHandler
);

// ==========================================
// SERVER STARTUP
// ==========================================

async function startServer() {
  try {
    // Fail startup if database
    // connectivity is unavailable.
    await sequelize.authenticate();

    httpServer.listen(
      env.PORT,
      () => {
        logger.info(
          {
            port:
              env.PORT,

            clientOrigin:
              env.CLIENT_ORIGIN,
          },
          "Server started"
        );

        /*
         * Start notification outbox
         * processing only after the API
         * server has started successfully.
         */
        startOutboxWorker();
      }
    );
  } catch (error) {
    logger.fatal(
      {
        err: error,
      },
      "Server startup failed"
    );

    process.exit(1);
  }
}

startServer();