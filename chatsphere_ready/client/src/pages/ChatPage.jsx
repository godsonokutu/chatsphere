import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "../auth/useAuth";

import { refreshSession } from "../api/apiClient";

import {
  fetchConversations,
} from "../api/conversationsApi";

import {
  fetchMessages,
} from "../api/messagesApi";

import {
  connectSocket,
  disconnectSocket,
  getOrCreateSocket,
  getSocket,
  reconnectSocket,
} from "../realtime/socket";

import {
  ConversationItem,
} from "../components/ConversationItem";

import {
  MessageBubble,
} from "../components/MessageBubble";

import {
  MessageComposer,
} from "../components/MessageComposer";

import {
  NewChatModal,
} from "../components/NewChatModal";

import {
  CreateGroupModal,
} from "../components/CreateGroupModal";

import {
  GroupInfoPanel,
} from "../components/GroupInfoPanel";

import "./ChatPage.css";

// ======================================================
// MESSAGE STATUS
// ======================================================

const MESSAGE_STATUS_RANK = {
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
};

function strongestMessageStatus(
  currentStatus,
  newStatus
) {
  const currentRank =
    MESSAGE_STATUS_RANK[currentStatus] || 0;

  const newRank =
    MESSAGE_STATUS_RANK[newStatus] || 0;

  return newRank > currentRank
    ? newStatus
    : currentStatus;
}

// ======================================================
// USER ID
// ======================================================

function getUserId(user) {
  return (
    user?.id ??
    user?.userId ??
    null
  );
}

// ======================================================
// WINDOW VISIBILITY
// ======================================================

function isDocumentActivelyViewed() {
  return (
    document.visibilityState === "visible" &&
    document.hasFocus()
  );
}

// ======================================================
// MESSAGE DEDUPLICATION
// ======================================================

function addMessageWithoutDuplicate(
  currentMessages,
  message
) {
  const exists =
    currentMessages.some(
      (existing) =>
        String(existing.id) ===
          String(message.id) ||
        (
          message.clientMessageId &&
          existing.clientMessageId ===
            message.clientMessageId
        )
    );

  if (exists) {
    return currentMessages;
  }

  return [
    ...currentMessages,
    message,
  ];
}

// ======================================================
// SOCKET ACK
// ======================================================

function emitWithAck(
  socket,
  eventName,
  payload,
  timeout = 10000
) {
  return new Promise(
    (resolve, reject) => {
      socket
        .timeout(timeout)
        .emit(
          eventName,
          payload,
          (
            error,
            response
          ) => {
            if (error) {
              reject(
                new Error(
                  "The server did not respond in time."
                )
              );

              return;
            }

            if (!response?.success) {
              reject(
                new Error(
                  response
                    ?.error
                    ?.message ||
                    "Unable to complete the request."
                )
              );

              return;
            }

            resolve(response);
          }
        );
    }
  );
}

// ======================================================
// LAST SEEN
// ======================================================

function formatLastSeen(value) {
  if (!value) {
    return "Offline";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Offline";
  }

  return `Last seen ${new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date)}`;
}

// ======================================================
// CONVERSATION DISPLAY HELPERS
// ======================================================

function getConversationName(
  conversation
) {
  if (
    conversation?.type ===
    "GROUP"
  ) {
    return (
      conversation.title ||
      "Unnamed group"
    );
  }

  return (
    conversation
      ?.participant
      ?.username ||
    "Unavailable user"
  );
}

function getInitialsFromName(
  name
) {
  const words =
    String(
      name || ""
    )
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

function getConversationInitials(
  conversation
) {
  return getInitialsFromName(
    getConversationName(
      conversation
    )
  );
}

function getConversationSearchText(
  conversation
) {
  const lastMessage =
    conversation?.lastMessage;

  return [
    getConversationName(
      conversation
    ),
    lastMessage
      ?.content,
    lastMessage
      ?.senderUsername,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

// ======================================================
// MESSAGE ID COMPARISON
// ======================================================

function messageIdIsAtOrBefore(
  messageId,
  cursorId
) {
  try {
    return (
      BigInt(
        String(messageId)
      ) <=
      BigInt(
        String(cursorId)
      )
    );
  } catch {
    return false;
  }
}

// ======================================================
// CHAT PAGE
// ======================================================

export function ChatPage() {
  const {
    user,
    logout,
  } = useAuth();

  const currentUserId =
    getUserId(user);

  // ====================================================
  // STATE
  // ====================================================

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState(null);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isLoadingMessages,
    setIsLoadingMessages,
  ] = useState(false);

  const [
    isLoadingOlderMessages,
    setIsLoadingOlderMessages,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    messageError,
    setMessageError,
  ] = useState("");

  const [
    olderMessageError,
    setOlderMessageError,
  ] = useState("");

  const [
    socketStatus,
    setSocketStatus,
  ] = useState(
    "connecting"
  );

  const [
    presenceByUserId,
    setPresenceByUserId,
  ] = useState({});

  const [
    messageStatuses,
    setMessageStatuses,
  ] = useState({});

  const [
    messagePagination,
    setMessagePagination,
  ] = useState({
    hasMore: false,
    nextCursor: null,
  });

  const [
    isNewChatOpen,
    setIsNewChatOpen,
  ] = useState(false);

  const [
    isCreateGroupOpen,
    setIsCreateGroupOpen,
  ] = useState(false);

  const [
    isGroupInfoOpen,
    setIsGroupInfoOpen,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    conversationFilter,
    setConversationFilter,
  ] = useState("ALL");

  const [
    isMobileConversationOpen,
    setIsMobileConversationOpen,
  ] = useState(false);

  // ====================================================
  // REFS
  // ====================================================

  const selectedConversationIdRef =
    useRef(null);

  const messageListRef =
    useRef(null);

  const messageRequestRef =
    useRef(0);

  const messagesRef =
    useRef([]);

  const conversationsRef =
    useRef([]);

  const shouldScrollToBottomRef =
    useRef(false);

  const prependScrollRestoreRef =
    useRef(null);

  const loadingOlderRef =
    useRef(false);

  // ====================================================
  // KEEP REFS CURRENT
  // ====================================================

  useEffect(
    () => {
      messagesRef.current =
        messages;
    },
    [messages]
  );

  useEffect(
    () => {
      conversationsRef.current =
        conversations;
    },
    [conversations]
  );

  useEffect(
    () => {
      selectedConversationIdRef.current =
        selectedConversation?.id ??
        null;
    },
    [
      selectedConversation,
    ]
  );

  // ====================================================
  // MESSAGE STATUS
  // ====================================================

  const advanceMessageStatus =
    useCallback(
      (
        messageId,
        nextStatus
      ) => {
        if (!messageId) {
          return;
        }

        const id =
          String(messageId);

        setMessageStatuses(
          (currentStatuses) => ({
            ...currentStatuses,

            [id]:
              strongestMessageStatus(
                currentStatuses[id],
                nextStatus
              ),
          })
        );
      },
      []
    );

  // ====================================================
  // UPDATE CONVERSATION SIDEBAR
  // ====================================================

  // ====================================================
// UPDATE CONVERSATION SIDEBAR
// ====================================================

const applyMessageToConversationList =
  useCallback(
    (
      message,
      incoming
    ) => {
      const conversationId =
        String(
          message.conversationId
        );

      const currentlySelected =
        String(
          selectedConversationIdRef
            .current
        ) ===
        conversationId;

      setConversations(
        (
          currentConversations
        ) => {
          const target =
            currentConversations.find(
              (
                conversation
              ) =>
                String(
                  conversation.id
                ) ===
                conversationId
            );

          if (!target) {
            return currentConversations;
          }

          const updated = {
            ...target,

            lastMessage: {
              id:
                String(
                  message.id
                ),

              senderId:
                message.senderId
                  ? String(
                      message.senderId
                    )
                  : null,

              // ======================================
              // NEW: group sender name
              // ======================================

              senderUsername:
                message.senderUsername ||
                null,

              type:
                message.type,

              content:
                message.content,

              deleted:
                Boolean(
                  message.deletedAt
                ),

              createdAt:
                message.createdAt,
            },

            unreadCount:
              incoming &&
              !currentlySelected
                ? Number(
                    target.unreadCount ||
                    0
                  ) + 1
                : currentlySelected
                  ? 0
                  : target.unreadCount,
          };

          return [
            updated,

            ...currentConversations
              .filter(
                (
                  conversation
                ) =>
                  String(
                    conversation.id
                  ) !==
                  conversationId
              ),
          ];
        }
      );
    },
    []
  );

  // ====================================================
  // LOAD CONVERSATIONS
  // ====================================================

  const loadConversations =
    useCallback(
      async () => {
        setErrorMessage("");

        try {
          const result =
            await fetchConversations({
              limit: 30,
            });

          const loadedConversations =
            Array.isArray(
              result
                ?.conversations
            )
              ? result.conversations
              : [];

          setConversations(
            loadedConversations
          );

          setSelectedConversation(
            (
              currentSelection
            ) => {
              if (
                currentSelection
              ) {
                const updated =
                  loadedConversations
                    .find(
                      (
                        conversation
                      ) =>
                        String(
                          conversation.id
                        ) ===
                        String(
                          currentSelection.id
                        )
                    );

                if (updated) {
                  return updated;
                }
              }

              return (
                loadedConversations[0] ||
                null
              );
            }
          );
        } catch (error) {
          setErrorMessage(
            error.response
              ?.data
              ?.message ||
            error.response
              ?.data
              ?.error
              ?.message ||
            "Unable to load conversations."
          );
        } finally {
          setIsLoading(false);
        }
      },
      []
    );

  useEffect(
    () => {
      loadConversations();
    },
    [
      loadConversations,
    ]
  );

  // ====================================================
  // DELIVERY ACK
  // ====================================================

  const acknowledgeDelivery =
    useCallback(
      (message) => {
        if (
          !message?.id ||
          String(
            message.senderId
          ) ===
            String(
              currentUserId
            )
        ) {
          return;
        }

        const socket =
          getSocket();

        if (
          !socket?.connected
        ) {
          return;
        }

        socket.emit(
          "message:delivered",
          {
            messageId:
              String(
                message.id
              ),
          }
        );
      },
      [
        currentUserId,
      ]
    );

  // ====================================================
  // READ ACK
  // ====================================================

  const acknowledgeRead =
    useCallback(
      (
        conversationId,
        message
      ) => {
        if (
          !message?.id ||
          String(
            message.senderId
          ) ===
            String(
              currentUserId
            )
        ) {
          return;
        }

        if (
          !isDocumentActivelyViewed()
        ) {
          return;
        }

        const socket =
          getSocket();

        if (
          !socket?.connected
        ) {
          return;
        }

        socket.emit(
          "conversation:read",
          {
            conversationId:
              String(
                conversationId
              ),

            messageId:
              String(
                message.id
              ),
          }
        );

        setConversations(
          (
            currentConversations
          ) =>
            currentConversations.map(
              (conversation) =>
                String(
                  conversation.id
                ) ===
                String(
                  conversationId
                )
                  ? {
                      ...conversation,
                      unreadCount: 0,
                    }
                  : conversation
            )
        );
      },
      [
        currentUserId,
      ]
    );

  // ====================================================
  // LOAD CURRENT MESSAGE PAGE
  // ====================================================

  useEffect(
    () => {
      const conversationId =
        selectedConversation
          ?.id;

      if (!conversationId) {
        setMessages([]);

        setMessagePagination({
          hasMore: false,
          nextCursor: null,
        });

        return;
      }

      const requestId =
        ++messageRequestRef
          .current;

      async function loadMessages() {
        setIsLoadingMessages(
          true
        );

        setMessageError("");

        setOlderMessageError(
          ""
        );

        loadingOlderRef.current =
          false;

        setIsLoadingOlderMessages(
          false
        );

        setMessagePagination({
          hasMore: false,
          nextCursor: null,
        });

        setMessages([]);

        try {
          const result =
            await fetchMessages({
              conversationId,
              limit: 50,
            });

          if (
            requestId !==
            messageRequestRef
              .current
          ) {
            return;
          }

          const loadedMessages =
            Array.isArray(
              result?.messages
            )
              ? result.messages
              : [];

          shouldScrollToBottomRef
            .current =
            true;

          setMessages(
            loadedMessages
          );

          setMessagePagination({
            hasMore:
              Boolean(
                result
                  ?.pagination
                  ?.hasMore
              ),

            nextCursor:
              result
                ?.pagination
                ?.nextCursor ||
              null,
          });

          setMessageStatuses(
            (
              currentStatuses
            ) => {
              const next = {
                ...currentStatuses,
              };

              for (
                const message
                of loadedMessages
              ) {
                if (
                  String(
                    message.senderId
                  ) !==
                  String(
                    currentUserId
                  )
                ) {
                  continue;
                }

                const id =
                  String(
                    message.id
                  );

                next[id] =
                  strongestMessageStatus(
                    next[id],
                    message
                      .deliveryStatus ||
                      "SENT"
                  );
              }

              return next;
            }
          );

          for (
            const message
            of loadedMessages
          ) {
            acknowledgeDelivery(
              message
            );
          }

          const latestIncoming =
            [
              ...loadedMessages,
            ]
              .reverse()
              .find(
                (message) =>
                  String(
                    message.senderId
                  ) !==
                  String(
                    currentUserId
                  )
              );

          if (
            latestIncoming
          ) {
            acknowledgeRead(
              conversationId,
              latestIncoming
            );
          }
        } catch (error) {
          if (
            requestId !==
            messageRequestRef
              .current
          ) {
            return;
          }

          setMessageError(
            error.response
              ?.data
              ?.message ||
            error.response
              ?.data
              ?.error
              ?.message ||
            "Unable to load messages."
          );
        } finally {
          if (
            requestId ===
            messageRequestRef
              .current
          ) {
            setIsLoadingMessages(
              false
            );
          }
        }
      }

      loadMessages();
    },
    [
      selectedConversation
        ?.id,

      currentUserId,

      acknowledgeDelivery,

      acknowledgeRead,
    ]
  );

  // ====================================================
  // LOAD OLDER MESSAGES
  // ====================================================

  const loadOlderMessages =
    useCallback(
      async () => {
        const conversationId =
          selectedConversationIdRef
            .current;

        if (
          !conversationId ||
          loadingOlderRef
            .current ||
          !messagePagination
            .hasMore ||
          !messagePagination
            .nextCursor
        ) {
          return;
        }

        loadingOlderRef.current =
          true;

        setIsLoadingOlderMessages(
          true
        );

        setOlderMessageError("");

        try {
          const result =
            await fetchMessages({
              conversationId,

              before:
                messagePagination
                  .nextCursor,

              limit: 50,
            });

          if (
            String(
              selectedConversationIdRef
                .current
            ) !==
            String(
              conversationId
            )
          ) {
            return;
          }

          const olderMessages =
            Array.isArray(
              result?.messages
            )
              ? result.messages
              : [];

          const messageList =
            messageListRef
              .current;

          if (messageList) {
            prependScrollRestoreRef
              .current = {
                previousScrollHeight:
                  messageList
                    .scrollHeight,

                previousScrollTop:
                  messageList
                    .scrollTop,
              };
          }

          setMessages(
            (
              currentMessages
            ) => {
              const existingIds =
                new Set(
                  currentMessages.map(
                    (message) =>
                      String(
                        message.id
                      )
                  )
                );

              const existingClientIds =
                new Set(
                  currentMessages
                    .filter(
                      (message) =>
                        message
                          .clientMessageId
                    )
                    .map(
                      (message) =>
                        message
                          .clientMessageId
                    )
                );

              const uniqueOlder =
                olderMessages.filter(
                  (message) =>
                    !existingIds.has(
                      String(
                        message.id
                      )
                    ) &&
                    (
                      !message
                        .clientMessageId ||
                      !existingClientIds
                        .has(
                          message
                            .clientMessageId
                        )
                    )
                );

              return [
                ...uniqueOlder,
                ...currentMessages,
              ];
            }
          );

          setMessageStatuses(
            (
              currentStatuses
            ) => {
              const next = {
                ...currentStatuses,
              };

              for (
                const message
                of olderMessages
              ) {
                if (
                  String(
                    message.senderId
                  ) !==
                  String(
                    currentUserId
                  )
                ) {
                  continue;
                }

                const id =
                  String(
                    message.id
                  );

                next[id] =
                  strongestMessageStatus(
                    next[id],
                    message
                      .deliveryStatus ||
                      "SENT"
                  );
              }

              return next;
            }
          );

          setMessagePagination({
            hasMore:
              Boolean(
                result
                  ?.pagination
                  ?.hasMore
              ),

            nextCursor:
              result
                ?.pagination
                ?.nextCursor ||
              null,
          });
        } catch (error) {
          console.error(
            "Unable to load older messages:",
            error
          );

          setOlderMessageError(
            error.response
              ?.data
              ?.error
              ?.message ||
            "Unable to load earlier messages."
          );
        } finally {
          loadingOlderRef.current =
            false;

          setIsLoadingOlderMessages(
            false
          );
        }
      },
      [
        currentUserId,

        messagePagination
          .hasMore,

        messagePagination
          .nextCursor,
      ]
    );

  // ====================================================
  // MESSAGE SCROLL
  // ====================================================

  const handleMessageListScroll =
    useCallback(
      (event) => {
        if (
          event.nativeEvent &&
          event.nativeEvent
            .isTrusted ===
            false
        ) {
          return;
        }

        if (
          event.currentTarget
            .scrollTop <=
          80
        ) {
          loadOlderMessages();
        }
      },
      [
        loadOlderMessages,
      ]
    );

  // ====================================================
  // MARK READ WHEN WINDOW RETURNS
  // ====================================================

  useEffect(
    () => {
      function markVisibleConversationRead() {
        if (
          !isDocumentActivelyViewed()
        ) {
          return;
        }

        const conversationId =
          selectedConversationIdRef
            .current;

        if (!conversationId) {
          return;
        }

        const latestIncoming =
          [
            ...messagesRef.current,
          ]
            .reverse()
            .find(
              (message) =>
                String(
                  message
                    .conversationId
                ) ===
                  String(
                    conversationId
                  ) &&
                String(
                  message.senderId
                ) !==
                  String(
                    currentUserId
                  )
            );

        if (
          !latestIncoming
        ) {
          return;
        }

        acknowledgeRead(
          conversationId,
          latestIncoming
        );
      }

      document.addEventListener(
        "visibilitychange",
        markVisibleConversationRead
      );

      window.addEventListener(
        "focus",
        markVisibleConversationRead
      );

      return () => {
        document.removeEventListener(
          "visibilitychange",
          markVisibleConversationRead
        );

        window.removeEventListener(
          "focus",
          markVisibleConversationRead
        );
      };
    },
    [
      currentUserId,
      acknowledgeRead,
    ]
  );

  // ====================================================
  // SOCKET
  // ====================================================

  useEffect(
    () => {
      const socket =
        getOrCreateSocket();

      function applyPresenceSnapshot(
        payload
      ) {
        const onlineUserIds =
          new Set(
            Array.isArray(
              payload
                ?.onlineUserIds
            )
              ? payload
                  .onlineUserIds
                  .map(String)
              : []
          );

        setPresenceByUserId(
          (
            currentPresence
          ) => {
            const next = {
              ...currentPresence,
            };

            for (
              const conversation
              of conversationsRef
                .current
            ) {
              if (
                conversation.type !==
                "DIRECT"
              ) {
                continue;
              }

              const participant =
                conversation
                  .participant;

              if (
                !participant?.id
              ) {
                continue;
              }

              const participantId =
                String(
                  participant.id
                );

              next[
                participantId
              ] =
                onlineUserIds.has(
                  participantId
                )
                  ? {
                      status:
                        "ONLINE",

                      lastSeenAt:
                        null,
                    }
                  : {
                      status:
                        "OFFLINE",

                      lastSeenAt:
                        next[
                          participantId
                        ]
                          ?.lastSeenAt ||
                        participant
                          .lastSeenAt ||
                        null,
                    };
            }

            return next;
          }
        );
      }

      function synchronizePresence() {
        socket.emit(
          "presence:sync",
          (response) => {
            if (
              !response?.success
            ) {
              return;
            }

            applyPresenceSnapshot(
              response
            );
          }
        );
      }

      function handleConnect() {
        setSocketStatus(
          "connected"
        );

        synchronizePresence();

        if (
          isDocumentActivelyViewed()
        ) {
          const conversationId =
            selectedConversationIdRef
              .current;

          if (
            conversationId
          ) {
            const latestIncoming =
              [
                ...messagesRef
                  .current,
              ]
                .reverse()
                .find(
                  (message) =>
                    String(
                      message
                        .conversationId
                    ) ===
                      String(
                        conversationId
                      ) &&
                    String(
                      message
                        .senderId
                    ) !==
                      String(
                        currentUserId
                      )
                );

            if (
              latestIncoming
            ) {
              acknowledgeRead(
                conversationId,
                latestIncoming
              );
            }
          }
        }
      }

      function handleDisconnect() {
        setSocketStatus(
          "disconnected"
        );
      }

      function handleConnectError(
        error
      ) {
        console.error(
          "Socket connection error:",
          error.message
        );

        setSocketStatus(
          "disconnected"
        );
      }

      function handlePresenceUpdate(
        payload
      ) {
        if (
          !payload?.userId ||
          !payload?.status
        ) {
          return;
        }

        const participantId =
          String(
            payload.userId
          );

        setPresenceByUserId(
          (
            currentPresence
          ) => ({
            ...currentPresence,

            [participantId]: {
              status:
                payload.status,

              lastSeenAt:
                payload
                  .lastSeenAt ||
                null,
            },
          })
        );
      }

      function handleNewMessage(
        message
      ) {
        if (
          !message?.id ||
          !message
            ?.conversationId
        ) {
          return;
        }

        const conversationId =
          String(
            message
              .conversationId
          );

        const conversationKnown =
          conversationsRef
            .current
            .some(
              (conversation) =>
                String(
                  conversation.id
                ) ===
                conversationId
            );

        if (
          !conversationKnown
        ) {
          loadConversations();
        }

        const incoming =
          String(
            message.senderId
          ) !==
          String(
            currentUserId
          );

        if (incoming) {
          acknowledgeDelivery(
            message
          );
        }

        const isSelected =
          String(
            selectedConversationIdRef
              .current
          ) ===
          conversationId;

        if (isSelected) {
          shouldScrollToBottomRef
            .current =
            true;

          setMessages(
            (
              currentMessages
            ) =>
              addMessageWithoutDuplicate(
                currentMessages,
                message
              )
          );

          if (incoming) {
            acknowledgeRead(
              conversationId,
              message
            );
          }
        }

        applyMessageToConversationList(
          message,
          incoming
        );
      }

      function handleDelivery(
        payload
      ) {
        if (
          !payload?.messageId
        ) {
          return;
        }

        advanceMessageStatus(
          payload.messageId,
          "DELIVERED"
        );
      }

      function handleConversationRead(
        payload
      ) {
        if (
          !payload
            ?.conversationId ||
          !payload
            ?.lastReadMessageId
        ) {
          return;
        }

        if (
          String(
            payload.userId
          ) ===
          String(
            currentUserId
          )
        ) {
          return;
        }

        const conversationId =
          String(
            payload
              .conversationId
          );

        const readCursor =
          String(
            payload
              .lastReadMessageId
          );

        setMessageStatuses(
          (
            currentStatuses
          ) => {
            const next = {
              ...currentStatuses,
            };

            next[
              readCursor
            ] =
              strongestMessageStatus(
                next[
                  readCursor
                ],
                "READ"
              );

            for (
              const message
              of messagesRef
                .current
            ) {
              if (
                String(
                  message
                    .conversationId
                ) !==
                  conversationId ||
                String(
                  message
                    .senderId
                ) !==
                  String(
                    currentUserId
                  )
              ) {
                continue;
              }

              if (
                messageIdIsAtOrBefore(
                  message.id,
                  readCursor
                )
              ) {
                const id =
                  String(
                    message.id
                  );

                next[id] =
                  strongestMessageStatus(
                    next[id],
                    "READ"
                  );
              }
            }

            return next;
          }
        );
      }

      async function handleAuthExpired() {
        setSocketStatus(
          "refreshing"
        );

        try {
          await refreshSession();

          reconnectSocket();
        } catch (error) {
          console.error(
            "Unable to refresh socket authentication:",
            error
          );

          setSocketStatus(
            "disconnected"
          );
        }
      }

      socket.on(
        "connect",
        handleConnect
      );

      socket.on(
        "disconnect",
        handleDisconnect
      );

      socket.on(
        "connect_error",
        handleConnectError
      );

      socket.on(
        "presence:update",
        handlePresenceUpdate
      );

      socket.on(
        "message:new",
        handleNewMessage
      );

      socket.on(
        "message:delivery",
        handleDelivery
      );

      socket.on(
        "conversation:read",
        handleConversationRead
      );

      socket.on(
        "auth:expired",
        handleAuthExpired
      );

      connectSocket();

      return () => {
        socket.off(
          "connect",
          handleConnect
        );

        socket.off(
          "disconnect",
          handleDisconnect
        );

        socket.off(
          "connect_error",
          handleConnectError
        );

        socket.off(
          "presence:update",
          handlePresenceUpdate
        );

        socket.off(
          "message:new",
          handleNewMessage
        );

        socket.off(
          "message:delivery",
          handleDelivery
        );

        socket.off(
          "conversation:read",
          handleConversationRead
        );

        socket.off(
          "auth:expired",
          handleAuthExpired
        );

        disconnectSocket();
      };
    },
    [
      currentUserId,
      acknowledgeDelivery,
      acknowledgeRead,
      applyMessageToConversationList,
      advanceMessageStatus,
      loadConversations,
    ]
  );

  // ====================================================
  // SCROLL MANAGEMENT
  // ====================================================

  useLayoutEffect(
    () => {
      const messageList =
        messageListRef
          .current;

      if (!messageList) {
        return;
      }

      if (
        prependScrollRestoreRef
          .current
      ) {
        const {
          previousScrollHeight,
          previousScrollTop,
        } =
          prependScrollRestoreRef
            .current;

        const newScrollHeight =
          messageList
            .scrollHeight;

        messageList.scrollTop =
          newScrollHeight -
          previousScrollHeight +
          previousScrollTop;

        prependScrollRestoreRef
          .current =
          null;

        return;
      }

      if (
        shouldScrollToBottomRef
          .current
      ) {
        messageList.scrollTop =
          messageList
            .scrollHeight;

        shouldScrollToBottomRef
          .current =
          false;
      }
    },
    [
      messages,
      selectedConversation
        ?.id,
    ]
  );

  // ====================================================
  // SEND MESSAGE
  // ====================================================

  async function handleSendMessage(
    content
  ) {
    const conversationId =
      selectedConversation
        ?.id;

    if (!conversationId) {
      throw new Error(
        "Select a conversation first."
      );
    }

    const socket =
      getSocket();

    if (
      !socket?.connected
    ) {
      throw new Error(
        "Realtime connection is unavailable."
      );
    }

    const clientMessageId =
      crypto.randomUUID();

    const response =
      await emitWithAck(
        socket,
        "message:send",
        {
          conversationId:
            String(
              conversationId
            ),

          clientMessageId,

          content,
        }
      );

    const savedMessage =
      response.message;

    if (!savedMessage) {
      throw new Error(
        "Server did not return the saved message."
      );
    }

    advanceMessageStatus(
      savedMessage.id,
      "SENT"
    );

    shouldScrollToBottomRef
      .current =
      true;

    setMessages(
      (
        currentMessages
      ) =>
        addMessageWithoutDuplicate(
          currentMessages,
          savedMessage
        )
    );

    applyMessageToConversationList(
      savedMessage,
      false
    );
  }

  // ====================================================
  // SELECT CONVERSATION
  // ====================================================

  function handleSelectConversation(
    conversation
  ) {
    messageRequestRef.current +=
      1;

    loadingOlderRef.current =
      false;

    prependScrollRestoreRef
      .current =
      null;

    selectedConversationIdRef
      .current =
      conversation.id;

    setIsGroupInfoOpen(
      false
    );

    setSelectedConversation(
      conversation
    );

    setIsMobileConversationOpen(
      true
    );
  }

  // ====================================================
  // DIRECT CHAT CREATED
  // ====================================================

  async function handleConversationCreated(
    conversation
  ) {
    if (
      !conversation?.id
    ) {
      return;
    }

    const conversationId =
      String(
        conversation.id
      );

    const existing =
      conversationsRef
        .current
        .find(
          (item) =>
            String(
              item.id
            ) ===
            conversationId
        );

    const normalizedConversation = {
      ...(existing || {}),
      ...conversation,

      id:
        conversationId,

      type:
        "DIRECT",

      participant: {
        ...(existing
          ?.participant ||
          {}),

        ...(conversation
          .participant ||
          {}),
      },

      lastMessage:
        existing
          ?.lastMessage ||
        conversation
          .lastMessage ||
        null,

      unreadCount:
        Number(
          existing
            ?.unreadCount ??
          conversation
            .unreadCount ??
          0
        ),
    };

    setConversations(
      (
        currentConversations
      ) => [
        normalizedConversation,

        ...currentConversations
          .filter(
            (item) =>
              String(
                item.id
              ) !==
              conversationId
          ),
      ]
    );

    messageRequestRef.current +=
      1;

    loadingOlderRef.current =
      false;

    prependScrollRestoreRef
      .current =
      null;

    selectedConversationIdRef
      .current =
      conversationId;

    setSelectedConversation(
      normalizedConversation
    );

    setIsMobileConversationOpen(
      true
    );

    const participantId =
      normalizedConversation
        .participant
        ?.id;

    const socket =
      getSocket();

    if (
      participantId &&
      socket?.connected
    ) {
      socket.emit(
        "presence:sync",
        (response) => {
          if (
            !response?.success
          ) {
            return;
          }

          const online =
            Array.isArray(
              response
                .onlineUserIds
            ) &&
            response
              .onlineUserIds
              .map(String)
              .includes(
                String(
                  participantId
                )
              );

          setPresenceByUserId(
            (
              currentPresence
            ) => ({
              ...currentPresence,

              [String(
                participantId
              )]: {
                status:
                  online
                    ? "ONLINE"
                    : "OFFLINE",

                lastSeenAt:
                  online
                    ? null
                    : currentPresence[
                        String(
                          participantId
                        )
                      ]
                        ?.lastSeenAt ||
                      normalizedConversation
                        .participant
                        ?.lastSeenAt ||
                      null,
              },
            })
          );
        }
      );
    }
  }

  // ====================================================
  // GROUP CREATED
  // ====================================================

  async function handleGroupCreated(
    group
  ) {
    if (!group?.id) {
      return;
    }

    const normalizedGroup = {
      ...group,

      id:
        String(
          group.id
        ),

      type:
        "GROUP",

      title:
        group.title,

      memberCount:
        Number(
          group.memberCount ||
          1
        ),

      lastMessage:
        null,

      unreadCount:
        0,
    };

    setConversations(
      (
        currentConversations
      ) => [
        normalizedGroup,

        ...currentConversations
          .filter(
            (conversation) =>
              String(
                conversation.id
              ) !==
              String(
                normalizedGroup.id
              )
          ),
      ]
    );

    messageRequestRef.current +=
      1;

    loadingOlderRef.current =
      false;

    prependScrollRestoreRef
      .current =
      null;

    selectedConversationIdRef
      .current =
      normalizedGroup.id;

    setSelectedConversation(
      normalizedGroup
    );

    setIsMobileConversationOpen(
      true
    );
  }

  // ====================================================
  // GROUP UPDATED
  // ====================================================

  const handleGroupUpdated =
    useCallback(
      (update) => {
        if (!update?.id) {
          return;
        }

        const groupId =
          String(
            update.id
          );

        setConversations(
          (
            currentConversations
          ) =>
            currentConversations.map(
              (conversation) => {
                if (
                  String(
                    conversation.id
                  ) !==
                  groupId
                ) {
                  return conversation;
                }

                return {
                  ...conversation,

                  ...(update.title
                    ? {
                        title:
                          update.title,
                      }
                    : {}),

                  ...(Number.isFinite(
                    Number(
                      update.memberCount
                    )
                  )
                    ? {
                        memberCount:
                          Number(
                            update.memberCount
                          ),
                      }
                    : {}),
                };
              }
            )
        );

        setSelectedConversation(
          (
            currentConversation
          ) => {
            if (
              !currentConversation ||
              String(
                currentConversation.id
              ) !==
              groupId
            ) {
              return currentConversation;
            }

            return {
              ...currentConversation,

              ...(update.title
                ? {
                    title:
                      update.title,
                  }
                : {}),

              ...(Number.isFinite(
                Number(
                  update.memberCount
                )
              )
                ? {
                    memberCount:
                      Number(
                        update.memberCount
                      ),
                  }
                : {}),
            };
          }
        );
      },
      []
    );

  // ====================================================
  // LEFT GROUP
  // ====================================================

  const handleLeftGroup =
    useCallback(
      (
        conversationId
      ) => {
        const id =
          String(
            conversationId
          );

        const remaining =
          conversationsRef
            .current
            .filter(
              (conversation) =>
                String(
                  conversation.id
                ) !==
                id
            );

        conversationsRef.current =
          remaining;

        setConversations(
          remaining
        );

        const nextConversation =
          remaining[0] ||
          null;

        selectedConversationIdRef
          .current =
          nextConversation
            ?.id ||
          null;

        setSelectedConversation(
          nextConversation
        );

        if (!nextConversation) {
          setIsMobileConversationOpen(
            false
          );
        }

        setMessages([]);

        setMessagePagination({
          hasMore: false,
          nextCursor: null,
        });

        setIsGroupInfoOpen(
          false
        );
      },
      []
    );

  // ====================================================
  // LOGOUT
  // ====================================================

  async function handleLogout() {
    disconnectSocket();

    await logout();
  }

  // ====================================================
  // PARTICIPANT PRESENCE
  // ====================================================

  const selectedParticipant =
    selectedConversation
      ?.type ===
    "DIRECT"
      ? selectedConversation
          .participant
      : null;

  const participantPresence =
    selectedParticipant?.id
      ? presenceByUserId[
          String(
            selectedParticipant.id
          )
        ]
      : null;

  const participantIsOnline =
    participantPresence
      ?.status ===
    "ONLINE";

  const participantLastSeen =
    participantPresence
      ?.lastSeenAt ||
    selectedParticipant
      ?.lastSeenAt ||
    null;

  // ====================================================
  // DERIVED UI STATE
  // ====================================================

  const normalizedSearch =
    searchQuery
      .trim()
      .toLocaleLowerCase();

  const filteredConversations =
    conversations.filter(
      (conversation) => {
        if (
          conversationFilter ===
            "UNREAD" &&
          Number(
            conversation
              .unreadCount ||
            0
          ) <= 0
        ) {
          return false;
        }

        if (
          conversationFilter ===
            "GROUPS" &&
          conversation.type !==
            "GROUP"
        ) {
          return false;
        }

        if (
          normalizedSearch &&
          !getConversationSearchText(
            conversation
          ).includes(
            normalizedSearch
          )
        ) {
          return false;
        }

        return true;
      }
    );

  const selectedConversationName =
    selectedConversation
      ? getConversationName(
          selectedConversation
        )
      : "";

  const selectedConversationInitials =
    selectedConversation
      ? getConversationInitials(
          selectedConversation
        )
      : "";

  const currentUserInitials =
    getInitialsFromName(
      user?.username ||
      "User"
    );

  const selectedConversationStatus =
    selectedConversation
      ?.type ===
    "GROUP"
      ? `${selectedConversation.memberCount || 0} members`
      : participantIsOnline
        ? "Online now"
        : formatLastSeen(
            participantLastSeen
          );

  // ====================================================
  // UI
  // ====================================================

  return (
    <>
      <div
        className={
          isMobileConversationOpen
            ? "chat-page chat-mobile--conversation"
            : "chat-page chat-mobile--list"
        }
      >
        <div
          className="chat-layout chat-layout--advanced"
        >
          {/* ==========================================
              PRODUCT NAVIGATION
              ========================================== */}

          <nav
            className="chat-nav-rail"
            aria-label="ChatSphere navigation"
          >
            <div
              className="chat-nav-brand"
              aria-label="ChatSphere"
              title="ChatSphere"
            >
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
            </div>

            <div
              className="chat-nav-actions"
            >
              <button
                type="button"
                className={
                  conversationFilter !==
                  "GROUPS"
                    ? "chat-nav-button chat-nav-button--active"
                    : "chat-nav-button"
                }
                onClick={
                  () => {
                    setConversationFilter(
                      "ALL"
                    );

                    setSearchQuery(
                      ""
                    );
                  }
                }
                aria-label="All chats"
                title="All chats"
                aria-pressed={
                  conversationFilter !==
                  "GROUPS"
                }
              >
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
              </button>

              <button
                type="button"
                className={
                  conversationFilter ===
                  "GROUPS"
                    ? "chat-nav-button chat-nav-button--active"
                    : "chat-nav-button"
                }
                onClick={
                  () =>
                    setConversationFilter(
                      "GROUPS"
                    )
                }
                aria-label="Groups"
                title="Groups"
                aria-pressed={
                  conversationFilter ===
                  "GROUPS"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
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
              </button>

              <button
                type="button"
                className="chat-nav-button chat-nav-button--disabled"
                disabled
                aria-label="Notifications are not available yet"
                title="Notifications are not available yet"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6.5 9a5.5 5.5 0 0 1 11 0v4l1.7 2.3H4.8L6.5 13V9Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M9.5 18a2.5 2.5 0 0 0 5 0"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div
              className="chat-nav-user"
            >
              <div
                className="chat-nav-avatar"
                title={
                  user?.username ||
                  "User"
                }
                aria-label={`Signed in as ${
                  user?.username ||
                  "User"
                }`}
              >
                {
                  currentUserInitials
                }
              </div>
            </div>
          </nav>

          {/* ==========================================
              SIDEBAR
              ========================================== */}

          <aside
            className="sidebar"
          >
            <header
              className="sidebar-header"
            >
              <div>
                <h1>
                  Messages
                </h1>

                <p>
                  Signed in as{" "}
                  {user
                    ?.username ||
                    "User"}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleLogout
                }
              >
                Log out
              </button>
            </header>

            <div
              className="connection-status"
              role="status"
              aria-live="polite"
            >
              <span
                className={
                  socketStatus ===
                  "connected"
                    ? "status-dot status-dot--online"
                    : "status-dot"
                }
              />

              {socketStatus ===
              "connected"
                ? "Realtime connected"
                : socketStatus ===
                    "refreshing"
                  ? "Refreshing connection..."
                  : "Realtime disconnected"}
            </div>

            <div
              className="conversation-create-actions"
            >
              <button
                type="button"
                className="new-chat-button"
                onClick={
                  () =>
                    setIsNewChatOpen(
                      true
                    )
                }
              >
                <span
                  aria-hidden="true"
                >
                  +
                </span>

                New chat
              </button>

              <button
                type="button"
                className="new-group-button"
                onClick={
                  () =>
                    setIsCreateGroupOpen(
                      true
                    )
                }
              >
                <span
                  aria-hidden="true"
                >
                  +
                </span>

                New group
              </button>
            </div>

            <div
              className="sidebar-search-wrap"
            >
              <label
                className="sidebar-search"
              >
                <svg
                  className="sidebar-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />

                  <path
                    d="m16 16 4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  type="search"
                  value={
                    searchQuery
                  }
                  onChange={
                    (event) =>
                      setSearchQuery(
                        event
                          .target
                          .value
                      )
                  }
                  placeholder="Search conversations"
                  aria-label="Search conversations"
                  autoComplete="off"
                />
              </label>
            </div>

            <div
              className="sidebar-tabs"
              aria-label="Conversation filters"
            >
              {[
                [
                  "ALL",
                  "All",
                ],
                [
                  "UNREAD",
                  "Unread",
                ],
                [
                  "GROUPS",
                  "Groups",
                ],
              ].map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={
                      value
                    }
                    type="button"
                    className={
                      conversationFilter ===
                      value
                        ? "sidebar-tab sidebar-tab--active"
                        : "sidebar-tab"
                    }
                    onClick={
                      () =>
                        setConversationFilter(
                          value
                        )
                    }
                    aria-pressed={
                      conversationFilter ===
                      value
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div
              className="sidebar-section-label"
            >
              Recent
            </div>

            <div
              className="conversation-list"
            >
              {isLoading && (
                <p
                  className="sidebar-message"
                >
                  Loading conversations...
                </p>
              )}

              {!isLoading &&
                errorMessage && (
                  <div
                    className="sidebar-message"
                  >
                    <p>
                      {errorMessage}
                    </p>

                    <button
                      type="button"
                      onClick={
                        loadConversations
                      }
                    >
                      Retry
                    </button>
                  </div>
                )}

              {!isLoading &&
                !errorMessage &&
                conversations
                  .length ===
                  0 && (
                  <p
                    className="sidebar-message"
                  >
                    No conversations yet.
                  </p>
                )}

              {!isLoading &&
                !errorMessage &&
                conversations.length >
                  0 &&
                filteredConversations
                  .length ===
                  0 && (
                  <p
                    className="sidebar-message"
                  >
                    No conversations match
                    your search or filter.
                  </p>
                )}

              {!isLoading &&
                !errorMessage &&
                filteredConversations.map(
                  (
                    conversation
                  ) => {
                    const participantId =
                      conversation
                        .type ===
                        "DIRECT"
                        ? conversation
                            .participant
                            ?.id
                        : null;

                    const isOnline =
                      participantId
                        ? presenceByUserId[
                            String(
                              participantId
                            )
                          ]
                            ?.status ===
                          "ONLINE"
                        : false;

                    return (
                      <ConversationItem
                        key={
                          conversation.id
                        }
                        conversation={
                          conversation
                        }
                        selected={
                          String(
                            selectedConversation
                              ?.id
                          ) ===
                          String(
                            conversation.id
                          )
                        }
                        isOnline={
                          isOnline
                        }
                        onSelect={
                          handleSelectConversation
                        }
                      />
                    );
                  }
                )}
            </div>
          </aside>

          {/* ==========================================
              CHAT PANEL
              ========================================== */}

          <main
            className="conversation-panel"
          >
            {selectedConversation ? (
              <>
                <header
                  className="conversation-panel-header"
                >
                  <div
                    className="conversation-header-main"
                  >
                    <button
                      type="button"
                      className="mobile-chat-back"
                      onClick={
                        () =>
                          setIsMobileConversationOpen(
                            false
                          )
                      }
                      aria-label="Back to conversations"
                      title="Back to conversations"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="m14.5 5-7 7 7 7"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    <div
                      className="conversation-header-avatar"
                      aria-hidden="true"
                    >
                      {
                        selectedConversationInitials
                      }
                    </div>

                    <div
                      className="conversation-header-copy"
                    >
                      <h2>
                        {
                          selectedConversationName
                        }
                      </h2>

                      <p
                        className={
                          participantIsOnline
                            ? "chat-presence chat-presence--online"
                            : "chat-presence"
                        }
                      >
                        {selectedConversation
                          .type ===
                        "GROUP"
                          ? `${selectedConversation.memberCount || 0} members`
                          : participantIsOnline
                            ? "Online now"
                            : formatLastSeen(
                                participantLastSeen
                              )}
                      </p>
                    </div>
                  </div>

                  {selectedConversation
                    .type ===
                    "GROUP" && (
                    <button
                      type="button"
                      className="group-info-open-button"
                      onClick={
                        () =>
                          setIsGroupInfoOpen(
                            true
                          )
                      }
                    >
                      Group info
                    </button>
                  )}
                </header>

                {/* ======================================
                    MESSAGES
                    ====================================== */}

                <section
                  ref={
                    messageListRef
                  }
                  className="message-list"
                  aria-live="polite"
                  aria-label={`Messages in ${selectedConversationName}`}
                  onScroll={
                    handleMessageListScroll
                  }
                >
                  {!isLoadingMessages &&
                    messages.length >
                      0 &&
                    messagePagination
                      .hasMore && (
                      <div
                        className="older-messages-control"
                      >
                        <button
                          type="button"
                          onClick={
                            loadOlderMessages
                          }
                          disabled={
                            isLoadingOlderMessages
                          }
                        >
                          {isLoadingOlderMessages
                            ? "Loading earlier messages..."
                            : "Load earlier messages"}
                        </button>
                      </div>
                    )}

                  {olderMessageError && (
                    <div
                      className="older-messages-error"
                    >
                      <span>
                        {
                          olderMessageError
                        }
                      </span>

                      <button
                        type="button"
                        onClick={
                          loadOlderMessages
                        }
                        disabled={
                          isLoadingOlderMessages
                        }
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {isLoadingMessages && (
                    <div
                      className="message-state"
                    >
                      Loading messages...
                    </div>
                  )}

                  {!isLoadingMessages &&
                    messageError && (
                      <div
                        className="message-state message-state--error"
                      >
                        {
                          messageError
                        }
                      </div>
                    )}

                  {!isLoadingMessages &&
                    !messageError &&
                    messages.length ===
                      0 && (
                      <div
                        className="message-state"
                      >
                        <strong>
                          No messages yet
                        </strong>

                        <span>
                          Send the first
                          message.
                        </span>
                      </div>
                    )}

                  {!isLoadingMessages &&
                    !messageError &&
                    messages.map(
                      (
                        message
                      ) => (
                        <MessageBubble
                          key={
                            message.id
                          }
                          message={
                            message
                          }
                          currentUserId={
                            currentUserId
                          }
                          isGroup={
                            selectedConversation
                              .type ===
                            "GROUP"
                          }
                          deliveryStatus={
                            selectedConversation
                              .type ===
                            "DIRECT"
                              ? messageStatuses[
                                  String(
                                    message.id
                                  )
                                ] ||
                                null
                              : null
                          }
                        />
                      )
                    )}
                </section>

                <MessageComposer
                  onSend={
                    handleSendMessage
                  }
                  disabled={
                    socketStatus !==
                    "connected"
                  }
                />
              </>
            ) : (
              <section
                className="empty-chat"
              >
                <h2>
                  Welcome to ChatSphere
                </h2>

                <p>
                  Select a conversation,
                  start a new chat, or
                  create a group.
                </p>
              </section>
            )}
          </main>

          {/* ==========================================
              DESKTOP CONVERSATION DETAILS
              ========================================== */}

          <aside
            className="chat-details-panel"
            aria-label="Conversation details"
          >
            <header
              className="chat-details-header"
            >
              <h3>
                Conversation details
              </h3>
            </header>

            {selectedConversation ? (
              <>
                <section
                  className="chat-details-profile"
                >
                  <div
                    className={
                      selectedConversation
                        .type ===
                      "GROUP"
                        ? "chat-details-avatar chat-details-avatar--group"
                        : "chat-details-avatar"
                    }
                    aria-hidden="true"
                  >
                    {
                      selectedConversationInitials
                    }

                    {selectedConversation
                      .type ===
                      "DIRECT" &&
                      participantIsOnline && (
                        <span
                          className="chat-details-online-dot"
                        />
                      )}
                  </div>

                  <h4
                    className="chat-details-name"
                    title={
                      selectedConversationName
                    }
                  >
                    {
                      selectedConversationName
                    }
                  </h4>

                  <p
                    className={
                      participantIsOnline
                        ? "chat-details-status chat-details-status--online"
                        : "chat-details-status"
                    }
                  >
                    {
                      selectedConversationStatus
                    }
                  </p>
                </section>

                <section
                  className="chat-details-section"
                >
                  <p
                    className="chat-details-section-title"
                  >
                    Conversation
                  </p>

                  <div
                    className="chat-details-row"
                  >
                    <span
                      className="chat-details-row-label"
                    >
                      Type
                    </span>

                    <span
                      className="chat-details-row-value"
                    >
                      {selectedConversation
                        .type ===
                      "GROUP"
                        ? "Group chat"
                        : "Direct message"}
                    </span>
                  </div>

                  {selectedConversation
                    .type ===
                  "GROUP" ? (
                    <div
                      className="chat-details-row"
                    >
                      <span
                        className="chat-details-row-label"
                      >
                        Members
                      </span>

                      <span
                        className="chat-details-row-value"
                      >
                        {
                          selectedConversation
                            .memberCount ||
                          0
                        }
                      </span>
                    </div>
                  ) : (
                    <div
                      className="chat-details-row"
                    >
                      <span
                        className="chat-details-row-label"
                      >
                        Presence
                      </span>

                      <span
                        className="chat-details-row-value"
                        title={
                          selectedConversationStatus
                        }
                      >
                        {
                          selectedConversationStatus
                        }
                      </span>
                    </div>
                  )}
                </section>

                {selectedConversation
                  .type ===
                  "GROUP" && (
                  <section
                    className="chat-details-section"
                  >
                    <p
                      className="chat-details-section-title"
                    >
                      Group
                    </p>

                    <button
                      type="button"
                      className="chat-details-action"
                      onClick={
                        () =>
                          setIsGroupInfoOpen(
                            true
                          )
                      }
                    >
                      Open group details
                    </button>
                  </section>
                )}
              </>
            ) : (
              <section
                className="chat-details-profile"
              >
                <h4
                  className="chat-details-name"
                >
                  No conversation selected
                </h4>

                <p
                  className="chat-details-status"
                >
                  Choose a conversation
                  to view its details.
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>

      {/* ==========================================
          NEW CHAT
          ========================================== */}

      <NewChatModal
        isOpen={
          isNewChatOpen
        }
        onClose={
          () =>
            setIsNewChatOpen(
              false
            )
        }
        onConversationCreated={
          handleConversationCreated
        }
      />

      {/* ==========================================
          CREATE GROUP
          ========================================== */}

      <CreateGroupModal
        isOpen={
          isCreateGroupOpen
        }
        onClose={
          () =>
            setIsCreateGroupOpen(
              false
            )
        }
        onGroupCreated={
          handleGroupCreated
        }
      />

      {/* ==========================================
          GROUP INFO
          ========================================== */}

      <GroupInfoPanel
        isOpen={
          isGroupInfoOpen
        }
        conversation={
          selectedConversation
            ?.type ===
          "GROUP"
            ? selectedConversation
            : null
        }
        currentUserId={
          currentUserId
        }
        onClose={
          () =>
            setIsGroupInfoOpen(
              false
            )
        }
        onGroupUpdated={
          handleGroupUpdated
        }
        onLeftGroup={
          handleLeftGroup
        }
      />
    </>
  );
}