const AppError = require("../errors/AppError");
const ERROR_CODES = require("../errors/errorCodes");
const logger = require("../config/logger");

function errorHandler(error, req, res, next) {
    const log = req.log || logger;

    const isOperational =
        error instanceof AppError &&
        error.isOperational === true;

    if (!isOperational) {
        log.error(
            {
                err: error,
                requestId: req.id
            },
            "Unexpected application error"
        );

        return res.status(500).json({
            success: false,
            code:
                ERROR_CODES.SYSTEM
                    .INTERNAL_SERVER_ERROR,
            message: "Something went wrong",
            requestId: req.id
        });
    }

    log.warn(
        {
            err: error,
            code: error.code,
            statusCode: error.statusCode,
            requestId: req.id
        },
        "Operational application error"
    );

    const response = {
        success: false,
        code: error.code,
        message: error.publicMessage,
        requestId: req.id
    };

    if (error.publicDetails !== null) {
        response.details =
            error.publicDetails;
    }

    return res
        .status(error.statusCode)
        .json(response);
}

module.exports = errorHandler;