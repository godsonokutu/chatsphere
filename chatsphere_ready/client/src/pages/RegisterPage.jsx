import {
  useState,
} from "react";

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  registerAccount,
} from "../api/authApi";

import {
  useAuth,
} from "../auth/useAuth";

import "./AuthPage.css";
import "./RegisterPage.css";

const PENDING_VERIFICATION_KEY =
  "chatsphere_pending_verification";

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.5 18.5 3 21l1.25-4.75A8.45 8.45 0 0 1 3 11.8C3 6.94 7.03 3 12 3s9 3.94 9 8.8-4.03 8.8-9 8.8a9.2 9.2 0 0 1-4.5-1.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M8 10.75h8M8 14h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="9"
        cy="6"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M3.5 15c.45-3.15 2.25-4.75 5.5-4.75S14.05 11.85 14.5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="4"
        width="13"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="m3.5 5 5.5 4 5.5-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="2.5"
        width="8"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M8 13h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="8"
        width="11"
        height="7"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M6 8V5.75a3 3 0 0 1 6 0V8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon({
  visible,
}) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />

        <circle
          cx="12"
          cy="12"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m4 4 16 16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M10.6 6.15A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.7 3.35M6.2 7.3A15.4 15.4 0 0 0 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="auth-submit-arrow"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12h14M14 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Brand() {
  return (
    <div className="auth-brand">
      <span className="auth-brand-logo">
        <ChatIcon />
      </span>

      <span className="auth-brand-name">
        ChatSphere
      </span>
    </div>
  );
}

function getErrorMessage(
  error
) {
  return (
    error.response?.data
      ?.error?.message ||
    error.response?.data
      ?.message ||
    "Unable to create your account. Please try again."
  );
}

function getServerFieldErrors(
  error
) {
  const details =
    error.response?.data
      ?.error?.details ||
    error.response?.data
      ?.details ||
    {};

  const normalized = {};

  for (
    const [key, value]
    of Object.entries(details)
  ) {
    if (Array.isArray(value)) {
      normalized[key] =
        value[0] || "";
    } else if (
      typeof value === "string"
    ) {
      normalized[key] =
        value;
    }
  }

  return normalized;
}

export function RegisterPage() {
  const {
    isAuthenticated,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    identityType,
    setIdentityType,
  ] =
    useState("email");

  const [
    username,
    setUsername,
  ] =
    useState("");

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    phoneNumber,
    setPhoneNumber,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] =
    useState(false);

  const [
    fieldErrors,
    setFieldErrors,
  ] =
    useState({});

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  if (isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  function clearFieldError(
    field
  ) {
    setFieldErrors(
      (current) => {
        if (!current[field]) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[field];

        return next;
      }
    );

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function selectIdentityType(
    type
  ) {
    if (isSubmitting) {
      return;
    }

    setIdentityType(type);

    setFieldErrors(
      (current) => ({
        ...current,
        email: "",
        phoneNumber: "",
      })
    );

    setErrorMessage("");
  }

  function validateForm() {
    const errors = {};

    const cleanUsername =
      username.trim();

    if (!cleanUsername) {
      errors.username =
        "Username is required.";
    } else if (
      cleanUsername.length >
      30
    ) {
      errors.username =
        "Username cannot exceed 30 characters.";
    }

    if (
      identityType ===
      "email"
    ) {
      const cleanEmail =
        email.trim();

      if (!cleanEmail) {
        errors.email =
          "Email address is required.";
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
          .test(cleanEmail)
      ) {
        errors.email =
          "Enter a valid email address.";
      }
    } else {
      if (
        !phoneNumber.trim()
      ) {
        errors.phoneNumber =
          "Phone number is required.";
      }
    }

    if (!password) {
      errors.password =
        "Password is required.";
    }

    if (!confirmPassword) {
      errors.confirmPassword =
        "Confirm your password.";
    } else if (
      password !==
      confirmPassword
    ) {
      errors.confirmPassword =
        "Passwords do not match.";
    }

    setFieldErrors(errors);

    return (
      Object.keys(errors)
        .length === 0
    );
  }

  function buildPayload() {
    const payload = {
      username:
        username.trim(),

      password,
    };

    if (
      identityType ===
      "email"
    ) {
      payload.email =
        email
          .trim()
          .toLowerCase();
    } else {
      payload.phoneNumber =
        phoneNumber.trim();
    }

    return payload;
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      !validateForm()
    ) {
      return;
    }

    setErrorMessage("");

    setIsSubmitting(true);

    try {
      const payload =
        buildPayload();

      const result =
        await registerAccount(
          payload
        );

      const pendingVerification = {
        username:
          result?.username ||
          payload.username,

        email:
          result?.email ||
          payload.email ||
          null,

        phoneNumber:
          result?.phoneNumber ||
          payload.phoneNumber ||
          null,

        identityType,

        verificationChannel:
          result
            ?.verificationChannel ||
          (
            identityType ===
            "email"
              ? "EMAIL"
              : "SMS"
          ),

        createdAt:
          Date.now(),
      };

      /*
       * We store only the pending identity.
       *
       * Passwords and verification codes
       * are never written to storage.
       */
      try {
        sessionStorage.setItem(
          PENDING_VERIFICATION_KEY,
          JSON.stringify(
            pendingVerification
          )
        );
      } catch {
        /*
         * Navigation state below remains
         * sufficient for the current tab
         * even if sessionStorage is blocked.
         */
      }

      navigate(
        "/verify",
        {
          state:
            pendingVerification,
        }
      );
    } catch (error) {
      const serverFieldErrors =
        getServerFieldErrors(
          error
        );

      if (
        Object.keys(
          serverFieldErrors
        ).length
      ) {
        setFieldErrors(
          (current) => ({
            ...current,
            ...serverFieldErrors,
          })
        );
      }

      setErrorMessage(
        getErrorMessage(
          error
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const identityValue =
    identityType === "email"
      ? email
      : phoneNumber;

  const formDisabled =
    isSubmitting ||
    !username.trim() ||
    !identityValue.trim() ||
    !password ||
    !confirmPassword;

  return (
    <main className="auth-page auth-register-page">
      <section
        className="auth-shell"
        aria-label="Create ChatSphere account"
      >
        <aside
          className="auth-hero"
          aria-label="About ChatSphere registration"
        >
          <Brand />

          <div className="auth-hero-content auth-register-hero-content">
            <div className="auth-kicker">
              <span className="auth-kicker-dot" />

              Secure onboarding
            </div>

            <h1 className="auth-hero-title">
              One account.
              <br />
              Every conversation.
            </h1>

            <p className="auth-hero-description">
              Create your ChatSphere identity,
              verify it securely, and pick up
              conversations from any device.
            </p>

            <div className="auth-onboarding-features">
              <article className="auth-onboarding-feature">
                <strong>
                  Identity
                </strong>

                <span>
                  Choose email or phone
                </span>
              </article>

              <article className="auth-onboarding-feature">
                <strong>
                  Verify
                </strong>

                <span>
                  Confirm ownership
                </span>
              </article>

              <article className="auth-onboarding-feature">
                <strong>
                  Connect
                </strong>

                <span>
                  Start messaging
                </span>
              </article>
            </div>
          </div>

          <p className="auth-hero-footer">
            © 2026 ChatSphere
            <span aria-hidden="true">
              {" • "}
            </span>
            Private by design
          </p>
        </aside>

        <section className="auth-form-region">
          <div className="auth-mobile-brand">
            <Brand />
          </div>

          <div className="auth-card auth-register-card">
            <header className="auth-form-header">
              <p className="auth-form-eyebrow">
                Create account
              </p>

              <h2 className="auth-form-title">
                Join ChatSphere
              </h2>

              <p className="auth-form-subtitle">
                Create your identity,
                then verify it before
                signing in.
              </p>
            </header>

            <form
              className="auth-register-form"
              onSubmit={
                handleSubmit
              }
              noValidate
            >
              <div className="auth-field">
                <label
                  className="auth-label"
                  htmlFor="register-username"
                >
                  Username
                </label>

                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <UserIcon />
                  </span>

                  <input
                    className="auth-input"
                    id="register-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    maxLength={30}
                    placeholder="Choose a username"
                    value={username}
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      fieldErrors
                        .username
                        ? "true"
                        : undefined
                    }
                    aria-describedby={
                      fieldErrors
                        .username
                        ? "register-username-error"
                        : undefined
                    }
                    onChange={
                      (event) => {
                        setUsername(
                          event.target
                            .value
                        );

                        clearFieldError(
                          "username"
                        );
                      }
                    }
                  />
                </div>

                {fieldErrors
                  .username && (
                  <p
                    className="auth-field-error"
                    id="register-username-error"
                  >
                    {
                      fieldErrors
                        .username
                    }
                  </p>
                )}
              </div>

              <div
                className="auth-identity-tabs"
                role="tablist"
                aria-label="Registration identity"
              >
                <button
                  className={
                    identityType ===
                    "email"
                      ? "auth-identity-tab auth-identity-tab--active"
                      : "auth-identity-tab"
                  }
                  type="button"
                  role="tab"
                  aria-selected={
                    identityType ===
                    "email"
                  }
                  disabled={
                    isSubmitting
                  }
                  onClick={() =>
                    selectIdentityType(
                      "email"
                    )
                  }
                >
                  Email
                </button>

                <button
                  className={
                    identityType ===
                    "phone"
                      ? "auth-identity-tab auth-identity-tab--active"
                      : "auth-identity-tab"
                  }
                  type="button"
                  role="tab"
                  aria-selected={
                    identityType ===
                    "phone"
                  }
                  disabled={
                    isSubmitting
                  }
                  onClick={() =>
                    selectIdentityType(
                      "phone"
                    )
                  }
                >
                  Phone
                </button>
              </div>

              {identityType ===
              "email" ? (
                <div className="auth-field">
                  <label
                    className="auth-label"
                    htmlFor="register-email"
                  >
                    Email address
                  </label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <MailIcon />
                    </span>

                    <input
                      className="auth-input"
                      id="register-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck="false"
                      placeholder="you@example.com"
                      value={email}
                      disabled={
                        isSubmitting
                      }
                      aria-invalid={
                        fieldErrors
                          .email
                          ? "true"
                          : undefined
                      }
                      onChange={
                        (event) => {
                          setEmail(
                            event.target
                              .value
                          );

                          clearFieldError(
                            "email"
                          );
                        }
                      }
                    />
                  </div>

                  {fieldErrors
                    .email && (
                    <p className="auth-field-error">
                      {
                        fieldErrors
                          .email
                      }
                    </p>
                  )}
                </div>
              ) : (
                <div className="auth-field">
                  <label
                    className="auth-label"
                    htmlFor="register-phone"
                  >
                    Phone number
                  </label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <PhoneIcon />
                    </span>

                    <input
                      className="auth-input"
                      id="register-phone"
                      name="phoneNumber"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+233 24 123 4567"
                      value={
                        phoneNumber
                      }
                      disabled={
                        isSubmitting
                      }
                      aria-invalid={
                        fieldErrors
                          .phoneNumber
                          ? "true"
                          : undefined
                      }
                      onChange={
                        (event) => {
                          setPhoneNumber(
                            event.target
                              .value
                          );

                          clearFieldError(
                            "phoneNumber"
                          );
                        }
                      }
                    />
                  </div>

                  {fieldErrors
                    .phoneNumber && (
                    <p className="auth-field-error">
                      {
                        fieldErrors
                          .phoneNumber
                      }
                    </p>
                  )}
                </div>
              )}

              <div className="auth-field">
                <label
                  className="auth-label"
                  htmlFor="register-password"
                >
                  Password
                </label>

                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <LockIcon />
                  </span>

                  <input
                    className="auth-input auth-input-password"
                    id="register-password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    value={password}
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      fieldErrors
                        .password
                        ? "true"
                        : undefined
                    }
                    onChange={
                      (event) => {
                        setPassword(
                          event.target
                            .value
                        );

                        clearFieldError(
                          "password"
                        );

                        clearFieldError(
                          "confirmPassword"
                        );
                      }
                    }
                  />

                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    aria-pressed={
                      showPassword
                    }
                    disabled={
                      isSubmitting
                    }
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current
                      )
                    }
                  >
                    <EyeIcon
                      visible={
                        showPassword
                      }
                    />
                  </button>
                </div>

                {fieldErrors
                  .password && (
                  <p className="auth-field-error">
                    {
                      fieldErrors
                        .password
                    }
                  </p>
                )}
              </div>

              <div className="auth-field">
                <label
                  className="auth-label"
                  htmlFor="register-confirm-password"
                >
                  Confirm password
                </label>

                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <LockIcon />
                  </span>

                  <input
                    className="auth-input auth-input-password"
                    id="register-confirm-password"
                    name="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={
                      confirmPassword
                    }
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      fieldErrors
                        .confirmPassword
                        ? "true"
                        : undefined
                    }
                    onChange={
                      (event) => {
                        setConfirmPassword(
                          event.target
                            .value
                        );

                        clearFieldError(
                          "confirmPassword"
                        );
                      }
                    }
                  />

                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmed password"
                        : "Show confirmed password"
                    }
                    aria-pressed={
                      showConfirmPassword
                    }
                    disabled={
                      isSubmitting
                    }
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) =>
                          !current
                      )
                    }
                  >
                    <EyeIcon
                      visible={
                        showConfirmPassword
                      }
                    />
                  </button>
                </div>

                {fieldErrors
                  .confirmPassword && (
                  <p className="auth-field-error">
                    {
                      fieldErrors
                        .confirmPassword
                    }
                  </p>
                )}
              </div>

              {errorMessage && (
                <div
                  className="auth-alert"
                  role="alert"
                  aria-live="polite"
                >
                  {errorMessage}
                </div>
              )}

              <button
                className="auth-submit"
                type="submit"
                disabled={
                  formDisabled
                }
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="auth-spinner"
                      aria-hidden="true"
                    />

                    <span>
                      Creating account...
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Create account
                    </span>

                    <ArrowIcon />
                  </>
                )}
              </button>
            </form>

            <p className="auth-switch auth-register-switch">
              <span>
                Already have an account?
              </span>

              <Link
                className="auth-switch-link"
                to="/login"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}