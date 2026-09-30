import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  searchUsers,
} from "../api/usersApi";

import {
  createDirectConversation,
} from "../api/conversationsApi";

import "./NewChatModal.css";

// ======================================================
// NEW CHAT MODAL
// ======================================================

export function NewChatModal({
  isOpen,
  onClose,
  onConversationCreated,
}) {
  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    users,
    setUsers,
  ] =
    useState([]);

  const [
    isSearching,
    setIsSearching,
  ] =
    useState(false);

  const [
    searchError,
    setSearchError,
  ] =
    useState("");

  const [
    startingUserId,
    setStartingUserId,
  ] =
    useState(null);

  const inputRef =
    useRef(null);

  const requestSequenceRef =
    useRef(0);

  // ====================================================
  // RESET WHEN OPENED / CLOSED
  // ====================================================

  useEffect(
    () => {
      if (!isOpen) {
        setQuery("");

        setUsers([]);

        setSearchError("");

        setIsSearching(
          false
        );

        setStartingUserId(
          null
        );

        return;
      }

      const timer =
        window.setTimeout(
          () => {
            inputRef.current
              ?.focus();
          },
          0
        );

      return () => {
        window.clearTimeout(
          timer
        );
      };
    },
    [
      isOpen,
    ]
  );

  // ====================================================
  // ESCAPE TO CLOSE
  // ====================================================

  useEffect(
    () => {
      if (!isOpen) {
        return;
      }

      function handleKeyDown(
        event
      ) {
        if (
          event.key ===
          "Escape" &&
          !startingUserId
        ) {
          onClose();
        }
      }

      document.addEventListener(
        "keydown",
        handleKeyDown
      );

      return () => {
        document.removeEventListener(
          "keydown",
          handleKeyDown
        );
      };
    },
    [
      isOpen,
      onClose,
      startingUserId,
    ]
  );

  // ====================================================
  // DEBOUNCED USER SEARCH
  // ====================================================

  useEffect(
    () => {
      const trimmedQuery =
        query.trim();

      if (
        !isOpen ||
        trimmedQuery.length < 2
      ) {
        requestSequenceRef
          .current +=
          1;

        setUsers([]);

        setSearchError("");

        setIsSearching(
          false
        );

        return;
      }

      const requestSequence =
        ++requestSequenceRef
          .current;

      const timer =
        window.setTimeout(
          async () => {
            setIsSearching(
              true
            );

            setSearchError("");

            try {
              const result =
                await searchUsers({
                  query:
                    trimmedQuery,

                  limit:
                    10,
                });

              /*
               * Ignore stale response if user typed
               * another search while request was
               * running.
               */
              if (
                requestSequence !==
                requestSequenceRef
                  .current
              ) {
                return;
              }

              setUsers(
                Array.isArray(
                  result?.users
                )
                  ? result.users
                  : []
              );
            } catch (
              error
            ) {
              if (
                requestSequence !==
                requestSequenceRef
                  .current
              ) {
                return;
              }

              console.error(
                "User search failed:",
                error
              );

              setUsers([]);

              setSearchError(
                error.response
                  ?.data
                  ?.error
                  ?.message ||
                "Unable to search users."
              );
            } finally {
              if (
                requestSequence ===
                requestSequenceRef
                  .current
              ) {
                setIsSearching(
                  false
                );
              }
            }
          },
          300
        );

      return () => {
        window.clearTimeout(
          timer
        );
      };
    },
    [
      isOpen,
      query,
    ]
  );

  // ====================================================
  // START CHAT
  // ====================================================

  async function handleStartChat(
    selectedUser
  ) {
    if (
      startingUserId
    ) {
      return;
    }

    const userId =
      String(
        selectedUser.id
      );

    setStartingUserId(
      userId
    );

    setSearchError("");

    try {
      /*
       * Backend safely returns either:
       *
       * - newly-created direct conversation
       * - already-existing direct conversation
       */
      const conversation =
        await createDirectConversation(
          userId
        );

      await onConversationCreated(
        conversation
      );

      onClose();
    } catch (
      error
    ) {
      console.error(
        "Unable to start conversation:",
        error
      );

      setSearchError(
        error.response
          ?.data
          ?.error
          ?.message ||
        error.response
          ?.data
          ?.message ||
        "Unable to start conversation."
      );
    } finally {
      setStartingUserId(
        null
      );
    }
  }

  if (!isOpen) {
    return null;
  }

  const trimmedQuery =
    query.trim();

  return (
    <div
      className="new-chat-overlay"
      role="presentation"
      onMouseDown={
        (
          event
        ) => {
          if (
            event.target ===
            event.currentTarget &&
            !startingUserId
          ) {
            onClose();
          }
        }
      }
    >
      <section
        className="new-chat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
      >
        <header
          className="new-chat-header"
        >
          <div>
            <h2
              id="new-chat-title"
            >
              New chat
            </h2>

            <p>
              Search for a
              registered user.
            </p>
          </div>

          <button
            type="button"
            className="new-chat-close"
            onClick={
              onClose
            }
            disabled={
              Boolean(
                startingUserId
              )
            }
            aria-label="Close new chat"
          >
            ×
          </button>
        </header>

        <div
          className="new-chat-search"
        >
          <label
            htmlFor="new-chat-search-input"
          >
            Username
          </label>

          <input
            ref={
              inputRef
            }
            id="new-chat-search-input"
            type="search"
            autoComplete="off"
            maxLength={50}
            placeholder="Search username..."
            value={
              query
            }
            onChange={
              (
                event
              ) => {
                setQuery(
                  event.target
                    .value
                );
              }
            }
          />
        </div>

        <div
          className="new-chat-results"
        >
          {trimmedQuery.length <
            2 && (
            <div
              className="new-chat-state"
            >
              Enter at least
              2 characters.
            </div>
          )}

          {trimmedQuery.length >=
            2 &&
            isSearching && (
              <div
                className="new-chat-state"
              >
                Searching...
              </div>
            )}

          {searchError && (
            <div
              className="new-chat-error"
            >
              {searchError}
            </div>
          )}

          {trimmedQuery.length >=
            2 &&
            !isSearching &&
            !searchError &&
            users.length ===
              0 && (
              <div
                className="new-chat-state"
              >
                No users found.
              </div>
            )}

          {!isSearching &&
            users.map(
              (
                foundUser
              ) => {
                const userId =
                  String(
                    foundUser.id
                  );

                const starting =
                  startingUserId ===
                  userId;

                return (
                  <button
                    key={
                      userId
                    }
                    type="button"
                    className="new-chat-user"
                    disabled={
                      Boolean(
                        startingUserId
                      )
                    }
                    onClick={
                      () =>
                        handleStartChat(
                          foundUser
                        )
                    }
                  >
                    <span
                      className="new-chat-avatar"
                      aria-hidden="true"
                    >
                      {foundUser
                        .username
                        ?.charAt(0)
                        .toUpperCase() ||
                        "?"}
                    </span>

                    <span
                      className="new-chat-user-details"
                    >
                      <strong>
                        {
                          foundUser.username
                        }
                      </strong>

                      <small>
                        {starting
                          ? "Opening chat..."
                          : "Start conversation"}
                      </small>
                    </span>
                  </button>
                );
              }
            )}
        </div>
      </section>
    </div>
  );
}