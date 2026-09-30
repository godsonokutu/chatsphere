const { Op } = require("sequelize");

const sequelize =
    require("../config/db");

const NotificationOutbox =
    require("../models/NotificationOutbox");


function createJob(data, options = {}) {
    return NotificationOutbox.create(
        data,
        {
            transaction: options.transaction
        }
    );
}


function findById(id, options = {}) {
    return NotificationOutbox.findByPk(
        id,
        {
            transaction: options.transaction
        }
    );
}


/**
 * Atomically claims one email job.
 *
 * Multiple workers can execute this method because
 * the selected row is locked inside the transaction.
 */
async function claimNextEmailJob() {
    return sequelize.transaction(
        async (transaction) => {
            const job =
                await NotificationOutbox.findOne({
                    where: {
                        channel: "EMAIL",
                        status: "PENDING",

                        availableAt: {
                            [Op.lte]: new Date()
                        }
                    },

                    order: [
                        ["availableAt", "ASC"],
                        ["id", "ASC"]
                    ],

                    transaction,

                    lock:
                        transaction.LOCK.UPDATE,

                    skipLocked: true
                });

            if (!job) {
                return null;
            }

            if (
                job.attemptCount >=
                job.maxAttempts
            ) {
                job.status = "FAILED";
                job.lockedAt = null;

                await job.save({
                    fields: [
                        "status",
                        "lockedAt"
                    ],
                    transaction
                });

                return null;
            }

            job.status = "PROCESSING";

            job.lockedAt =
                new Date();

            job.attemptCount += 1;

            await job.save({
                fields: [
                    "status",
                    "lockedAt",
                    "attemptCount"
                ],
                transaction
            });

            return job;
        }
    );
}


async function markSent(
    jobId,
    options = {}
) {
    return NotificationOutbox.update(
        {
            status: "SENT",
            sentAt: new Date(),
            lockedAt: null,
            lastErrorCode: null
        },
        {
            where: {
                id: jobId,
                status: "PROCESSING"
            },

            transaction:
                options.transaction
        }
    );
}


async function markFailedOrRetry({
    jobId,
    attemptCount,
    maxAttempts,
    errorCode,
    retryDelayMs
}) {
    const permanentlyFailed =
        attemptCount >= maxAttempts;

    return NotificationOutbox.update(
        {
            status:
                permanentlyFailed
                    ? "FAILED"
                    : "PENDING",

            lockedAt: null,

            lastErrorCode:
                errorCode,

            availableAt:
                permanentlyFailed
                    ? new Date()
                    : new Date(
                          Date.now() +
                              retryDelayMs
                      )
        },
        {
            where: {
                id: jobId,
                status: "PROCESSING"
            }
        }
    );
}

async function findMessageById(
  messageId,
  options = {}
) {
  return Message.findByPk(
    messageId,
    {
      transaction:
        options.transaction,
    }
  );
}

async function findReceipt(
  messageId,
  userId,
  options = {}
) {
  return MessageReceipt.findOne({
    where: {
      messageId,
      userId,
    },

    transaction:
      options.transaction,
  });
}

async function markDelivered(
  messageId,
  userId,
  deliveredAt = new Date(),
  options = {}
) {
  return MessageReceipt.update(
    {
      deliveredAt,
    },
    {
      where: {
        messageId,
        userId,
        deliveredAt: null,
      },

      transaction:
        options.transaction,
    }
  );
}


module.exports = Object.freeze({
    createJob,
    findById,
    claimNextEmailJob,
    markSent,
    markFailedOrRetry,
    findMessageById,
    findReceipt,
    markDelivered,
});