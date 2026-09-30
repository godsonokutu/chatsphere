const crypto = require("crypto");
const pinoHttp = require("pino-http");

const logger = require("../config/logger");

const REQUEST_ID_PATTERN =
    /^[A-Za-z0-9._-]{8,100}$/;

function getRequestId(req, res) {
    const incoming =
        req.headers["x-request-id"];

    const requestId =
        typeof incoming === "string" &&
        REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : crypto.randomUUID();

    res.setHeader(
        "X-Request-Id",
        requestId
    );

    return requestId;
}

const requestLogger = pinoHttp({
    logger,

    genReqId: getRequestId,

    serializers: {
        req(req) {
            return {
                id: req.id,
                method: req.method,
                path: req.url
                    ? req.url.split("?")[0]
                    : undefined,
                remoteAddress:
                    req.socket?.remoteAddress
            };
        },

        res(res) {
            return {
                statusCode: res.statusCode
            };
        }
    },

    customLogLevel(req, res, error) {
        if (
            error ||
            res.statusCode >= 500
        ) {
            return "error";
        }

        if (res.statusCode >= 400) {
            return "warn";
        }

        return "info";
    }
});

module.exports = requestLogger;