function getConversationName(
  conversation
) {
  if (
    conversation.type ===
    "GROUP"
  ) {
    return (
      conversation.title ||
      "Unnamed group"
    );
  }

  return (
    conversation
      .participant
      ?.username ||
    "Unavailable user"
  );
}

// ======================================================
// AVATAR INITIALS
// ======================================================

function getInitials(
  name
) {
  if (!name) {
    return "?";
  }

  const words =
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[
      words.length - 1
    ][0]
  ).toUpperCase();
}

// ======================================================
// LAST MESSAGE PREVIEW
// ======================================================

function getLastMessage(
  conversation
) {
  const message =
    conversation.lastMessage;

  if (!message) {
    return "No messages yet";
  }

  const messageText =
    message.deleted
      ? "Message deleted"
      : message.content ||
        "Message";

  /*
   * Group conversations display the sender
   * because multiple people can contribute
   * to the same conversation.
   */
  if (
    conversation.type ===
      "GROUP" &&
    message.senderUsername
  ) {
    return `${message.senderUsername}: ${messageText}`;
  }

  return messageText;
}

// ======================================================
// FORMAT LAST MESSAGE TIME
// ======================================================

function formatTime(
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

  const now =
    new Date();

  const sameDay =
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate();

  if (sameDay) {
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

  const yesterday =
    new Date(now);

  yesterday.setDate(
    now.getDate() - 1
  );

  const isYesterday =
    date.getFullYear() ===
      yesterday.getFullYear() &&
    date.getMonth() ===
      yesterday.getMonth() &&
    date.getDate() ===
      yesterday.getDate();

  if (isYesterday) {
    return "Yesterday";
  }

  return new Intl
    .DateTimeFormat(
      undefined,
      {
        month:
          "short",

        day:
          "numeric",
      }
    )
    .format(date);
}

// ======================================================
// UNREAD COUNT
// ======================================================

function formatUnreadCount(
  unreadCount
) {
  const count =
    Number(
      unreadCount || 0
    );

  if (count > 99) {
    return "99+";
  }

  return String(count);
}

// ======================================================
// CONVERSATION ITEM
// ======================================================

export function ConversationItem({
  conversation,
  selected,
  onSelect,

  /*
   * ChatPage will provide this when we
   * update the main layout.
   *
   * Keeping a default means this component
   * remains backwards-compatible meanwhile.
   */
  isOnline = false,
}) {
  const name =
    getConversationName(
      conversation
    );

  const preview =
    getLastMessage(
      conversation
    );

  const initials =
    getInitials(name);

  const isGroup =
    conversation.type ===
    "GROUP";

  const unreadCount =
    Number(
      conversation
        .unreadCount ||
      0
    );

  const classNames = [
    "conversation-item",

    selected
      ? "conversation-item--selected"
      : "",

    isGroup
      ? "conversation-item--group"
      : "",

    unreadCount > 0
      ? "conversation-item--unread"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={
        classNames
      }
      onClick={() =>
        onSelect(
          conversation
        )
      }
      aria-current={
        selected
          ? "true"
          : undefined
      }
      aria-label={`Open conversation with ${name}`}
    >
      <div
        className="conversation-avatar-wrap"
        aria-hidden="true"
      >
        <div className="conversation-avatar">
          {initials}
        </div>

        {!isGroup &&
          isOnline && (
            <span className="conversation-online-dot" />
          )}
      </div>

      <div className="conversation-content">
        <div className="conversation-header">
          <strong className="conversation-name">
            {name}
          </strong>

          <span className="conversation-time">
            {formatTime(
              conversation
                .lastMessage
                ?.createdAt
            )}
          </span>
        </div>

        <div className="conversation-preview">
          <span
            className="conversation-preview-text"
            title={preview}
          >
            {preview}
          </span>

          {unreadCount >
            0 && (
            <span
              className="unread-badge"
              aria-label={`${unreadCount} unread ${
                unreadCount === 1
                  ? "message"
                  : "messages"
              }`}
            >
              {formatUnreadCount(
                unreadCount
              )}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}