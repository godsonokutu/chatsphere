import { useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/useAuth";

import "./AuthPage.css";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function IdentityIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
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

function LockIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
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

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6v5c0 4.6 2.85 8.15 7 10 4.15-1.85 7-5.4 7-10V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m9.5 12 1.7 1.7 3.5-3.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m13.5 2-8 11h6L10.5 22l8-12h-6l1-8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="9"
        cy="8"
        r="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.5 19c.3-3.5 2.3-5.5 5.5-5.5s5.2 2 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M15 6a2.5 2.5 0 1 1 0 5M16.2 13.6c2.7.3 4.1 2.1 4.3 4.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
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

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  function clearError() {
    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function buildCredentials() {
  const normalizedIdentifier = identifier.trim();

  if (normalizedIdentifier.includes("@")) {
    return {
      email: normalizedIdentifier.toLowerCase(),
      password,
    };
  }

  return {
    phoneNumber: normalizedIdentifier,
    password,
  };
}

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await login(buildCredentials());

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          error.response?.data?.error?.message ||
          "Unable to sign in. Please check your details and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const formDisabled =
    isSubmitting || !identifier.trim() || !password;

  return (
    <main className="auth-page">
      <section
        className="auth-shell"
        aria-label="ChatSphere sign in"
      >
        <aside
          className="auth-hero"
          aria-label="About ChatSphere"
        >
          <Brand />

          <div className="auth-hero-content">
            <div className="auth-kicker">
              <span className="auth-kicker-dot" />
              Real-time communication
            </div>

            <h1 className="auth-hero-title">
              Conversations that move with you.
            </h1>

            <p className="auth-hero-description">
              Connect instantly, stay in sync across
              conversations, and communicate with confidence
              wherever you are.
            </p>

            <div className="auth-feature-list">
              <article className="auth-feature">
                <span className="auth-feature-icon">
                  <BoltIcon />
                </span>
                <div>
                  <h3 className="auth-feature-title">
                    Real-time
                  </h3>
                  <p className="auth-feature-text">
                    Instant delivery
                  </p>
                </div>
              </article>

              <article className="auth-feature">
                <span className="auth-feature-icon">
                  <UsersIcon />
                </span>
                <div>
                  <h3 className="auth-feature-title">
                    Together
                  </h3>
                  <p className="auth-feature-text">
                    Direct and group chat
                  </p>
                </div>
              </article>

              <article className="auth-feature">
                <span className="auth-feature-icon">
                  <ShieldCheckIcon />
                </span>
                <div>
                  <h3 className="auth-feature-title">
                    Protected
                  </h3>
                  <p className="auth-feature-text">
                    Secure sessions
                  </p>
                </div>
              </article>
            </div>

            <div className="auth-trust-pill">
              <span className="auth-trust-dot" />
              Built for secure, persistent messaging
            </div>
          </div>

          <p className="auth-hero-footer">
            © 2026 ChatSphere
            <span aria-hidden="true"> • </span>
            Private by design
          </p>
        </aside>

        <section className="auth-form-region">
          <div className="auth-mobile-brand">
            <Brand />
          </div>

          <div className="auth-card">
            <header className="auth-form-header">
              <p className="auth-form-eyebrow">
                Welcome back
              </p>

              <h2 className="auth-form-title">
                Sign in to ChatSphere
              </h2>

              <p className="auth-form-subtitle">
                Continue your conversations securely across
                every device.
              </p>
            </header>

            <div className="auth-security-callout">
              <ShieldCheckIcon />
              <span>
                Your session is protected with secure
                authentication.
              </span>
            </div>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="auth-field">
                <label
                  className="auth-label"
                  htmlFor="identifier"
                >
                  Email or phone
                </label>

                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <IdentityIcon />
                  </span>

                  <input
                    className="auth-input"
                    id="identifier"
                    name="identifier"
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="Email or phone number"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      clearError();
                    }}
                    disabled={isSubmitting}
                    aria-invalid={
                      errorMessage ? "true" : undefined
                    }
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label
                  className="auth-label"
                  htmlFor="password"
                >
                  Password
                </label>

                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <LockIcon />
                  </span>

                  <input
                    className="auth-input auth-input-password"
                    id="password"
                    name="password"
                    type={
                      showPassword ? "text" : "password"
                    }
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearError();
                    }}
                    disabled={isSubmitting}
                    aria-invalid={
                      errorMessage ? "true" : undefined
                    }
                    required
                  />

                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => {
                      setShowPassword(
                        (current) => !current
                      );
                    }}
                    disabled={isSubmitting}
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
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
                disabled={formDisabled}
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="auth-spinner"
                      aria-hidden="true"
                    />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowIcon />
                  </>
                )}
              </button>
            </form>

            <p className="auth-switch">
              <span>New to ChatSphere?</span>
              <Link
                className="auth-switch-link"
                to="/register"
              >
                Create account
              </Link>
            </p>

            <p className="auth-microcopy">
              Fast. Secure. Synced.
            </p>

            <p className="auth-mobile-security">
              <ShieldCheckIcon />
              <span>
                Protected by ChatSphere security.
              </span>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
