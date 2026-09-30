import {
  refreshClient,
} from "./apiClient";

/*
 * Public authentication API.
 *
 * These requests intentionally use refreshClient because it
 * has no response interceptor. That prevents public auth
 * operations from accidentally attempting access-token
 * refreshes or entering refresh loops.
 */

function getResponseData(
  response,
  operationName
) {
  const data =
    response?.data?.data;

  if (
    data === undefined ||
    data === null
  ) {
    throw new Error(
      `${operationName} response did not include data.`
    );
  }

  return data;
}

async function loginAccount({
  email,
  phoneNumber,
  password,
}) {
  const payload = {
    password,
  };

  if (email) {
    payload.email =
      email;
  }

  if (phoneNumber) {
    payload.phoneNumber =
      phoneNumber;
  }

  const response =
    await refreshClient.post(
      "/auth/login",
      payload
    );

  return getResponseData(
    response,
    "Login"
  );
}

async function registerAccount({
  username,
  email,
  phoneNumber,
  password,
}) {
  const payload = {
    username,
    password,
  };

  if (email) {
    payload.email =
      email;
  }

  if (phoneNumber) {
    payload.phoneNumber =
      phoneNumber;
  }

  const response =
    await refreshClient.post(
      "/auth/register",
      payload
    );

  return getResponseData(
    response,
    "Registration"
  );
}

async function verifyAccount({
  email,
  phoneNumber,
  code,
}) {
  const payload = {
    code,
  };

  if (email) {
    payload.email =
      email;
  }

  if (phoneNumber) {
    payload.phoneNumber =
      phoneNumber;
  }

  const response =
    await refreshClient.post(
      "/auth/verify",
      payload
    );

  return getResponseData(
    response,
    "Verification"
  );
}

async function resendVerification({
  email,
  phoneNumber,
}) {
  const payload = {};

  if (email) {
    payload.email =
      email;
  }

  if (phoneNumber) {
    payload.phoneNumber =
      phoneNumber;
  }

  const response =
    await refreshClient.post(
      "/auth/resend-verification",
      payload
    );

  return getResponseData(
    response,
    "Resend verification"
  );
}

export {
  loginAccount,
  registerAccount,
  verifyAccount,
  resendVerification,
};