import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  resendVerification,
  verifyAccount,
} from "../api/authApi";

import "./AuthPage.css";
import "./VerifyAccountPage.css";

const PENDING_VERIFICATION_KEY =
  "chatsphere_pending_verification";

const RESEND_COOLDOWN_SECONDS = 60;

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

function ArrowIcon() {
  return (
    <svg className="auth-submit-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      <span className="auth-brand-name">ChatSphere</span>
    </div>
  );
}

function getStoredVerification() {
  try {
    const raw = sessionStorage.getItem(PENDING_VERIFICATION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.email && !parsed?.phoneNumber) return null;

    return parsed;
  } catch {
    return null;
  }
}

function maskEmail(email) {
  if (!email) return "";

  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const firstCharacter = localPart?.[0] || "";
  return `${firstCharacter}•••••@${domain}`;
}

function maskPhone(phoneNumber) {
  if (!phoneNumber) return "";

  const clean = phoneNumber.replace(/\s+/g, "");
  const lastFour = clean.slice(-4);
  return `••••••${lastFour}`;
}

function getErrorMessage(error, fallback) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    fallback
  );
}

function getRetryAfterSeconds(error) {
  const value =
    error.response?.data?.error?.details?.retryAfterSeconds ??
    error.response?.data?.details?.retryAfterSeconds ??
    error.response?.data?.error?.retryAfterSeconds;

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;

  return Math.ceil(number);
}

export function VerifyAccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  const [verification, setVerification] = useState(() => {
    return location.state || getStoredVerification();
  });

  const [digits, setDigits] = useState(Array(6).fill(""));
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [cooldown, setCooldown] = useState(() => {
    const createdAt = verification?.createdAt;

    if (!createdAt) {
      return RESEND_COOLDOWN_SECONDS;
    }

    const elapsed = Math.floor((Date.now() - Number(createdAt)) / 1000);

    return Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
  });

  useEffect(() => {
    if (!verification) return;

    try {
      sessionStorage.setItem(
        PENDING_VERIFICATION_KEY,
        JSON.stringify(verification)
      );
    } catch {
      // Current navigation state remains usable.
    }
  }, [verification]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldown]);

  const identityPayload = useMemo(() => {
    if (verification?.email) {
      return { email: verification.email };
    }

    if (verification?.phoneNumber) {
      return { phoneNumber: verification.phoneNumber };
    }

    return null;
  }, [verification]);

  const maskedIdentity = useMemo(() => {
    if (verification?.email) {
      return maskEmail(verification.email);
    }

    return maskPhone(verification?.phoneNumber);
  }, [verification]);

  if (!verification || !identityPayload) {
    return <Navigate to="/register" replace />;
  }

  function clearMessages() {
    if (errorMessage) {
      setErrorMessage("");
    }

    if (successMessage && !verificationComplete) {
      setSuccessMessage("");
    }
  }

  function updateDigit(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);

    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    clearMessages();

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(event, index) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event) {
    const text = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!text) return;

    event.preventDefault();

    const next = Array(6).fill("");

    text.split("").forEach((digit, index) => {
      next[index] = digit;
    });

    setDigits(next);
    clearMessages();

    inputRefs.current[Math.min(text.length, 6) - 1]?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting || verificationComplete) return;

    const code = digits.join("");

    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("Enter the complete 6-digit verification code.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const result = await verifyAccount({
        ...identityPayload,
        code,
      });

      if (result?.verified !== true) {
        throw new Error(
          "Verification response did not confirm the account."
        );
      }

      setVerificationComplete(true);
      setSuccessMessage(
        "Account verified successfully. Redirecting you to sign in..."
      );

      try {
        sessionStorage.removeItem(PENDING_VERIFICATION_KEY);
      } catch {
        // Safe to continue.
      }

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (error) {
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();

      setErrorMessage(
        getErrorMessage(
          error,
          "Unable to verify this code. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (isResending || cooldown > 0 || verificationComplete) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsResending(true);

    try {
      await resendVerification(identityPayload);

      const updated = {
        ...verification,
        createdAt: Date.now(),
      };

      setVerification(updated);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setDigits(Array(6).fill(""));

      setSuccessMessage(
        "If verification is required, a new code has been sent."
      );

      window.requestAnimationFrame(() => {
        inputRefs.current[0]?.focus();
      });
    } catch (error) {
      const retryAfter = getRetryAfterSeconds(error);

      if (retryAfter) {
        setCooldown(retryAfter);
      }

      setErrorMessage(
        getErrorMessage(
          error,
          "Unable to resend the verification code."
        )
      );
    } finally {
      setIsResending(false);
    }
  }

  function handleChangeIdentity() {
    try {
      sessionStorage.removeItem(PENDING_VERIFICATION_KEY);
    } catch {
      // Continue navigation.
    }

    navigate("/register", { replace: true });
  }

  const codeComplete = digits.every((digit) => /^\d$/.test(digit));

  const submitDisabled =
    isSubmitting || verificationComplete || !codeComplete;

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-label="Verify ChatSphere account">
        <aside
          className="auth-hero"
          aria-label="ChatSphere account verification"
        >
          <Brand />

          <div className="auth-hero-content">
            <div className="auth-kicker">
              <span className="auth-kicker-dot" />
              Account verification
            </div>

            <h1 className="auth-hero-title">
              Verify once.
              <br />
              Chat everywhere.
            </h1>

            <p className="auth-hero-description">
              A six-digit code protects account ownership before your first
              sign-in.
            </p>

            <div className="auth-onboarding-features">
              <article className="auth-onboarding-feature">
                <strong>6 digits</strong>
                <span>Short-lived code</span>
              </article>

              <article className="auth-onboarding-feature">
                <strong>5 tries</strong>
                <span>Attempt protection</span>
              </article>

              <article className="auth-onboarding-feature">
                <strong>10 min</strong>
                <span>Expiry window</span>
              </article>
            </div>
          </div>

          <p className="auth-hero-footer">
            © 2026 ChatSphere
            <span aria-hidden="true">{" • "}</span>
            Private by design
          </p>
        </aside>

        <section className="auth-form-region">
          <div className="auth-mobile-brand">
            <Brand />
          </div>

          <div className="auth-verify-card">
            <header className="auth-form-header">
              <p className="auth-form-eyebrow">Verify account</p>

              <h2 className="auth-form-title">Enter your 6-digit code</h2>

              <p className="auth-form-subtitle">
                We sent a verification code to <strong>{maskedIdentity}</strong>.
              </p>
            </header>

            <div className="auth-verify-callout">
              Code expires in 10 minutes{" • "}Maximum 5 attempts
            </div>

            <form
              className="auth-verify-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <label className="auth-otp-label">Verification code</label>

              <div className="auth-otp-grid" onPaste={handlePaste}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(node) => {
                      inputRefs.current[index] = node;
                    }}
                    className="auth-otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={digit}
                    disabled={isSubmitting || verificationComplete}
                    aria-label={`Verification digit ${index + 1}`}
                    aria-invalid={errorMessage ? "true" : undefined}
                    onChange={(event) =>
                      updateDigit(index, event.target.value)
                    }
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  />
                ))}
              </div>

              {errorMessage && (
                <div
                  className="auth-alert auth-verify-error"
                  role="alert"
                  aria-live="polite"
                >
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div
                  className="auth-verify-success"
                  role="status"
                  aria-live="polite"
                >
                  {successMessage}
                </div>
              )}

              <button
                className="auth-submit"
                type="submit"
                disabled={submitDisabled}
              >
                {isSubmitting ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify account</span>
                    <ArrowIcon />
                  </>
                )}
              </button>
            </form>

            <div className="auth-verify-resend">
              <span>Didn&apos;t get the code?</span>

              {cooldown > 0 ? (
                <span>
                  Resend in 00:{String(cooldown).padStart(2, "0")}
                </span>
              ) : (
                <button
                  className="auth-resend-button"
                  type="button"
                  disabled={isResending || verificationComplete}
                  onClick={handleResend}
                >
                  {isResending ? "Sending..." : "Resend code"}
                </button>
              )}
            </div>

            <button
              className="auth-change-identity"
              type="button"
              disabled={verificationComplete}
              onClick={handleChangeIdentity}
            >
              Use a different email or phone
            </button>

            <p className="auth-switch">
              <Link className="auth-switch-link" to="/login">
                Back to sign in
              </Link>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
