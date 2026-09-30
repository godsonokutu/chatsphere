function formatMessageTime(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl
    .DateTimeFormat(
      undefined,
      {
        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    )
    .format(date);
}

// ======================================================
// MESSAGE STATUS
//
// SENT       = ✓
// DELIVERED  = ✓✓
// READ       = ✓✓ highlighted
// ======================================================

function MessageStatus({
  status,
}) {
  if (!status) {
    return null;
  }

  if (
    status ===
    "READ"
  ) {
    return (
      <span
        className="
          message-status
          message-status--read
        "
        title="Read"
        aria-label="Read"
      >
        <span
          aria-hidden="true"
        >
          ✓✓
        </span>
      </span>
    );
  }

  if (
    status ===
    "DELIVERED"
  ) {
    return (
      <span
        className="
          message-status
          message-status--delivered
        "
        title="Delivered"
        aria-label="Delivered"
      >
        <span
          aria-hidden="true"
        >
          ✓✓
        </span>
      </span>
    );
  }

  return (
    <span
      className="
        message-status
        message-status--sent
      "
      title="Sent"
      aria-label="Sent"
    >
      <span
        aria-hidden="true"
      >
        ✓
      </span>
    </span>
  );
}

// ======================================================
// MESSAGE BUBBLE
// ======================================================

export function MessageBubble({
  message,
  currentUserId,
  deliveryStatus,
  isGroup = false,
}) {
  const isOwnMessage =
    String(
      message.senderId
    ) ===
    String(
      currentUserId
    );

  const isDeleted =
    Boolean(
      message.deletedAt ||
      message.deleted
    );

  /*
   * Only show sender name for incoming
   * messages inside group conversations.
   *
   * The logged-in user's own name is not
   * repeated above their own messages.
   */
  const shouldShowSenderName =
    isGroup &&
    !isOwnMessage &&
    Boolean(
      message.senderUsername
    );

  const rowClassName = [
    "message-row",

    isOwnMessage
      ? "message-row--own"
      : "message-row--incoming",

    isGroup
      ? "message-row--group"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const bubbleClassName = [
    "message-bubble",

    isOwnMessage
      ? "message-bubble--own"
      : "message-bubble--incoming",

    isDeleted
      ? "message-bubble--deleted"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const messageText =
    isDeleted
      ? "Message deleted"
      : message.content;

  return (
    <div
      className={
        rowClassName
      }
      data-message-id={
        message.id
          ? String(
              message.id
            )
          : undefined
      }
    >
      <article
        className={
          bubbleClassName
        }
      >
        {shouldShowSenderName && (
          <div
            className="
              message-sender-name
            "
            title={
              message.senderUsername
            }
          >
            {
              message.senderUsername
            }
          </div>
        )}

        <p
          className={
            isDeleted
              ? "message-text message-text--deleted"
              : "message-text"
          }
        >
          {messageText}
        </p>

        <footer
          className="message-meta"
        >
          <time
            className="
              message-time
            "
            dateTime={
              message.createdAt
            }
            title={
              message.createdAt
                ? new Date(
                    message.createdAt
                  ).toLocaleString()
                : undefined
            }
          >
            {formatMessageTime(
              message.createdAt
            )}
          </time>

          {isOwnMessage && (
            <MessageStatus
              status={
                deliveryStatus
              }
            />
          )}
        </footer>
      </article>
    </div>
  );
}