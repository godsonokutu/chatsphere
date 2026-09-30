const logger =
    require("../config/logger");

const {
    decryptJson
} = require("../utils/encryption");

const notificationOutboxRepository =
    require("../repositories/notificationOutbox.repository");

const {
    sendVerificationEmail
} = require("../services/email.service");


const POLL_INTERVAL_MS = 2000;

let workerRunning = false;


function calculateRetryDelay(
    attemptCount
) {
    const baseDelay = 5000;

    const delay =
        baseDelay *
        Math.pow(
            2,
            Math.max(
                0,
                attemptCount - 1
            )
        );

    return Math.min(
        delay,
        5 * 60 * 1000
    );
}


function classifyDeliveryError(error) {
    if (
        error &&
        typeof error.code === "string"
    ) {
        switch (error.code) {
            case "ETIMEDOUT":
                return "SMTP_TIMEOUT";

            case "ECONNECTION":
            case "ECONNREFUSED":
                return "SMTP_CONNECTION_FAILED";

            case "EAUTH":
                return "SMTP_AUTH_FAILED";

            default:
                return "SMTP_DELIVERY_FAILED";
        }
    }

    return "SMTP_DELIVERY_FAILED";
}


async function processNextJob() {
    const job =
        await notificationOutboxRepository
            .claimNextEmailJob();

    if (!job) {
        return false;
    }

    try {
        const payload =
            decryptJson({
                ciphertext:
                    job.payloadCiphertext,

                iv:
                    job.payloadIv,

                authTag:
                    job.payloadAuthTag,

                keyVersion:
                    job.keyVersion,

                aad:
                    job.aad
            });

        switch (job.template) {
            case "ACCOUNT_VERIFICATION":
                await sendVerificationEmail({
                    recipient:
                        job.recipient,

                    verificationCode:
                        payload.verificationCode
                });

                break;

            default:
                throw new Error(
                    "Unsupported notification template"
                );
        }

        await notificationOutboxRepository
            .markSent(job.id);

        logger.info(
            {
                outboxJobId:
                    String(job.id),

                channel:
                    job.channel,

                template:
                    job.template
            },
            "Outbox notification delivered"
        );

        return true;

    } catch (error) {
        const errorCode =
            classifyDeliveryError(
                error
            );

        const retryDelayMs =
            calculateRetryDelay(
                job.attemptCount
            );

        await notificationOutboxRepository
            .markFailedOrRetry({
                jobId:
                    job.id,

                attemptCount:
                    job.attemptCount,

                maxAttempts:
                    job.maxAttempts,

                errorCode,

                retryDelayMs
            });

        logger.error(
            {
                err: error,

                outboxJobId:
                    String(job.id),

                errorCode
            },
            "Outbox delivery failed"
        );

        return true;
    }
}


async function runWorkerCycle() {
    if (workerRunning) {
        return;
    }

    workerRunning = true;

    try {
        /*
         * Process several jobs per cycle,
         * but don't monopolize the event loop.
         */
        for (
            let processed = 0;
            processed < 10;
            processed += 1
        ) {
            const hadJob =
                await processNextJob();

            if (!hadJob) {
                break;
            }
        }

    } catch (error) {
        logger.error(
            {
                err: error
            },
            "Outbox worker cycle failed"
        );

    } finally {
        workerRunning = false;
    }
}


function startOutboxWorker() {
    logger.info(
        "Notification outbox worker started"
    );

    runWorkerCycle();

    const timer =
        setInterval(
            runWorkerCycle,
            POLL_INTERVAL_MS
        );

    timer.unref?.();
}


module.exports = Object.freeze({
    startOutboxWorker
});