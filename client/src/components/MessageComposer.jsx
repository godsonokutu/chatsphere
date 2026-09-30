import {
  useEffect,
  useRef,
  useState,
} from "react";

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 11.5 20 4.5l-4.7 15-4.1-5.1-5 2.4 1.5-5.3H3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="m7.7 11.5 7.6-3.6-4.1 6.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AttachmentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MessageComposer({
  onSend,
  disabled,
}) {
  const textareaRef =
    useRef(null);

  const [
    content,
    setContent,
  ] =
    useState("");

  const [
    isSending,
    setIsSending,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  // ====================================================
  // AUTO-RESIZE TEXTAREA
  // ====================================================

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height =
      "auto";

    const nextHeight =
      Math.min(
        textarea.scrollHeight,
        140
      );

    textarea.style.height =
      `${nextHeight}px`;

    textarea.style.overflowY =
      textarea.scrollHeight >
      140
        ? "auto"
        : "hidden";
  }, [
    content,
  ]);

  // ====================================================
  // SUBMIT
  // ====================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    const trimmed =
      content.trim();

    if (
      !trimmed ||
      isSending ||
      disabled
    ) {
      return;
    }

    setErrorMessage("");
    setIsSending(true);

    try {
      await onSend(
        trimmed
      );

      setContent("");
    } catch (error) {
      setErrorMessage(
        error?.message ||
        "Unable to send message."
      );
    } finally {
      setIsSending(false);
    }
  }

  // ====================================================
  // KEYBOARD
  //
  // Enter       = send
  // Shift+Enter = newline
  // ====================================================

  function handleKeyDown(
    event
  ) {
    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      event.currentTarget
        .form
        ?.requestSubmit();
    }
  }

  function handleChange(
    event
  ) {
    setContent(
      event.target.value
    );

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  const canSend =
    !disabled &&
    !isSending &&
    Boolean(
      content.trim()
    );

  return (
    <form
      className="message-composer"
      onSubmit={
        handleSubmit
      }
    >
      {errorMessage && (
        <div
          className="composer-error"
          role="alert"
          aria-live="polite"
        >
          {errorMessage}
        </div>
      )}

      <div className="composer-row">
        {/*
         * Visual placeholder for future attachment
         * support.
         *
         * It remains disabled until backend/file
         * handling is implemented so ChatSphere
         * does not expose a fake action.
         */}
        <button
          className="composer-attachment-button"
          type="button"
          disabled
          aria-label="Attachments are not available yet"
          title="Attachments are not available yet"
        >
          <AttachmentIcon />
        </button>

        <div className="composer-input-shell">
          <textarea
            ref={
              textareaRef
            }
            className="composer-textarea"
            value={
              content
            }
            onChange={
              handleChange
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder="Type a message..."
            rows={1}
            maxLength={4000}
            disabled={
              disabled ||
              isSending
            }
            aria-label="Message"
          />

          <span
            className="composer-character-count"
            aria-hidden="true"
          >
            {content.length >
            3600
              ? `${content.length}/4000`
              : ""}
          </span>
        </div>

        <button
          className="composer-send-button"
          type="submit"
          disabled={
            !canSend
          }
          aria-label={
            isSending
              ? "Sending message"
              : "Send message"
          }
        >
          {isSending ? (
            <span
              className="composer-send-spinner"
              aria-hidden="true"
            />
          ) : (
            <SendIcon />
          )}
        </button>
      </div>
    </form>
  );
}