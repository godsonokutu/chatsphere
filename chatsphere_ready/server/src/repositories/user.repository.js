const User = require("../models/User");

const {
  Op,
} = require("sequelize");

const SAFE_USER_ATTRIBUTES = Object.freeze([
    "id",
    "username",
    "email",
    "phoneNumber",
    "emailVerifiedAt",
    "phoneVerifiedAt",
    "status",
    "lastSeenAt",
    "createdAt",
    "updatedAt"
]);

const AUTH_USER_ATTRIBUTES = Object.freeze([
    "id",
    "username",
    "email",
    "phoneNumber",
    "passwordHash",
    "emailVerifiedAt",
    "phoneVerifiedAt",
    "status"
]);

function findById(id, options = {}) {
    return User.findByPk(id, {
        attributes: SAFE_USER_ATTRIBUTES,
        transaction: options.transaction
    });
}

async function findConversationParticipantsByIds(
  userIds,
  options = {}
) {
  return User.findAll({
    where: {
      id: {
        [Op.in]: userIds,
      },

      status: "ACTIVE",
    },

    attributes: [
      "id",
      "username",
      "status",
    ],

    transaction:
      options.transaction,
  });
}

async function findForAuthentication(
  { email, phoneNumber },
  options = {}
) {
  const where = {};

  if (email) {
    where.email = email;
  } else if (phoneNumber) {
    where.phoneNumber = phoneNumber;
  } else {
    return null;
  }

  const queryOptions = {
    where,

    attributes: [
      "id",
      "username",
      "email",
      "phoneNumber",
      "passwordHash",
      "emailVerifiedAt",
      "phoneVerifiedAt",
      "status",
      "createdAt",
    ],

    transaction: options.transaction,
  };

  if (options.lock && options.transaction) {
    queryOptions.lock =
      options.transaction.LOCK.UPDATE;
  }

  return User.findOne(queryOptions);
}

function findByUsername(username, options = {}) {
    return User.findOne({
        where: { username },
        attributes: SAFE_USER_ATTRIBUTES,
        transaction: options.transaction
    });
}

function findByEmail(email, options = {}) {
    return User.findOne({
        where: { email },
        attributes: SAFE_USER_ATTRIBUTES,
        transaction: options.transaction
    });
}

function findByPhoneNumber(phoneNumber, options = {}) {
    return User.findOne({
        where: { phoneNumber },
        attributes: SAFE_USER_ATTRIBUTES,
        transaction: options.transaction
    });
}

function findForAuthenticationByEmail(email, options = {}) {
    return User.scope("withPasswordHash").findOne({
        where: { email },
        attributes: AUTH_USER_ATTRIBUTES,
        transaction: options.transaction
    });
}

function findForAuthenticationByPhoneNumber(
    phoneNumber,
    options = {}
) {
    return User.scope("withPasswordHash").findOne({
        where: { phoneNumber },
        attributes: AUTH_USER_ATTRIBUTES,
        transaction: options.transaction
    });
}

function createUser(userData, options = {}) {
    return User.create(userData, {
        transaction: options.transaction
    });
}

function findRegistrationConflicts(
    {
        username,
        email,
        phoneNumber
    },
    options = {}
) {
    const conditions = [
        { username }
    ];

    if (email) {
        conditions.push({ email });
    }

    if (phoneNumber) {
        conditions.push({ phoneNumber });
    }

    return User.findAll({
        where: {
            [Op.or]: conditions
        },

        attributes: [
            "id",
            "username",
            "email",
            "phoneNumber"
        ],

        transaction: options.transaction
    });
}

async function findAuthStateById(
  userId,
  options = {}
) {
  return User.findOne({
    where: {
      id: userId,
    },

    attributes: [
      "id",
      "username",
      "email",
      "phoneNumber",
      "status",
      "emailVerifiedAt",
      "phoneVerifiedAt",
    ],

    transaction:
      options.transaction,
  });
}

async function findConversationParticipantById(
  userId,
  options = {}
) {
  const queryOptions = {
    where: {
      id: userId,
      status: "ACTIVE",
    },

    attributes: [
      "id",
      "username",
      "status",
    ],

    transaction:
      options.transaction,
  };

  if (
    options.lock &&
    options.transaction
  ) {
    queryOptions.lock =
      options.transaction.LOCK.UPDATE;
  }

  return User.findOne(
    queryOptions
  );
}

async function updateLastSeenAt(
  userId,
  lastSeenAt,
  options = {}
) {
  return User.update(
    {
      lastSeenAt,
    },
    {
      where: {
        id: userId,
      },

      transaction:
        options.transaction,
    }
  );
}

module.exports = Object.freeze({
    findById,
    findByUsername,
    findByEmail,
    findByPhoneNumber,
    findForAuthenticationByEmail,
    findForAuthenticationByPhoneNumber,
    findRegistrationConflicts,
    createUser,
    findForAuthentication,
    findAuthStateById,
    findConversationParticipantById,
    updateLastSeenAt,
    findConversationParticipantsByIds,
});