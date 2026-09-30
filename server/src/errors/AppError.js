class AppError extends Error {
    constructor({
        code,
        statusCode,
        publicMessage,
        internalMessage,
        publicDetails = null,
        isOperational = true,
        cause
    }) {
        super(internalMessage || publicMessage, { cause });

        this.name = this.constructor.name;

        this.code = code;
        this.statusCode = statusCode;

        this.publicMessage = publicMessage;
        this.publicDetails = publicDetails;

        this.isOperational = isOperational;

        Error.captureStackTrace?.(
            this,
            this.constructor
        );
    }
}

module.exports = AppError;