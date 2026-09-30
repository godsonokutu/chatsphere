import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  searchUsers,
} from "../api/usersApi";

import {
  createGroupConversation,
} from "../api/conversationsApi";

import "./CreateGroupModal.css";

export function CreateGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
}) {
  const [
    title,
    setTitle,
  ] =
    useState("");

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
    selectedUsers,
    setSelectedUsers,
  ] =
    useState([]);

  const [
    isSearching,
    setIsSearching,
  ] =
    useState(false);

  const [
    isCreating,
    setIsCreating,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const searchInputRef =
    useRef(null);

  const requestSequenceRef =
    useRef(0);

  // ====================================================
  // RESET MODAL
  // ====================================================

  useEffect(
    () => {
      if (!isOpen) {
        setTitle("");
        setQuery("");
        setUsers([]);
        setSelectedUsers([]);
        setErrorMessage("");
        setIsSearching(false);
        setIsCreating(false);

        return;
      }

      const timer =
        window.setTimeout(
          () => {
            searchInputRef
              .current
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
  // ESCAPE KEY
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
          !isCreating
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
      isCreating,
      onClose,
    ]
  );

  // ====================================================
  // SEARCH USERS
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
        setIsSearching(false);

        return;
      }

      const sequence =
        ++requestSequenceRef
          .current;

      const timer =
        window.setTimeout(
          async () => {
            setIsSearching(
              true
            );

            setErrorMessage("");

            try {
              const result =
                await searchUsers({
                  query:
                    trimmedQuery,

                  limit:
                    20,
                });

              if (
                sequence !==
                requestSequenceRef
                  .current
              ) {
                return;
              }

              const foundUsers =
                Array.isArray(
                  result?.users
                )
                  ? result.users
                  : [];

              /*
               * Do not show already-selected
               * users in search results.
               */
              const selectedIds =
                new Set(
                  selectedUsers.map(
                    (
                      selected
                    ) =>
                      String(
                        selected.id
                      )
                  )
                );

              setUsers(
                foundUsers.filter(
                  (
                    foundUser
                  ) =>
                    !selectedIds.has(
                      String(
                        foundUser.id
                      )
                    )
                )
              );
            } catch (
              error
            ) {
              if (
                sequence !==
                requestSequenceRef
                  .current
              ) {
                return;
              }

              console.error(
                "Group user search failed:",
                error
              );

              setUsers([]);

              setErrorMessage(
                error.response
                  ?.data
                  ?.error
                  ?.message ||
                "Unable to search users."
              );
            } finally {
              if (
                sequence ===
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
      selectedUsers,
    ]
  );

  // ====================================================
  // SELECT MEMBER
  // ====================================================

  function handleSelectUser(
    foundUser
  ) {
    const userId =
      String(
        foundUser.id
      );

    setSelectedUsers(
      (
        currentUsers
      ) => {
        const alreadySelected =
          currentUsers.some(
            (
              currentUser
            ) =>
              String(
                currentUser.id
              ) ===
              userId
          );

        if (
          alreadySelected
        ) {
          return currentUsers;
        }

        return [
          ...currentUsers,
          {
            id:
              userId,

            username:
              foundUser.username,
          },
        ];
      }
    );

    setQuery("");
    setUsers([]);

    searchInputRef
      .current
      ?.focus();
  }

  // ====================================================
  // REMOVE MEMBER
  // ====================================================

  function handleRemoveUser(
    userId
  ) {
    setSelectedUsers(
      (
        currentUsers
      ) =>
        currentUsers.filter(
          (
            currentUser
          ) =>
            String(
              currentUser.id
            ) !==
            String(
              userId
            )
        )
    );
  }

  // ====================================================
  // CREATE GROUP
  // ====================================================

  async function handleCreateGroup(
    event
  ) {
    event.preventDefault();

    const trimmedTitle =
      title.trim();

    if (
      trimmedTitle.length ===
      0
    ) {
      setErrorMessage(
        "Enter a group name."
      );

      return;
    }

    if (
      selectedUsers.length ===
      0
    ) {
      setErrorMessage(
        "Select at least one member."
      );

      return;
    }

    if (
      isCreating
    ) {
      return;
    }

    setIsCreating(
      true
    );

    setErrorMessage("");

    try {
      const group =
        await createGroupConversation({
          title:
            trimmedTitle,

          memberIds:
            selectedUsers.map(
              (
                selectedUser
              ) =>
                String(
                  selectedUser.id
                )
            ),
        });

      await onGroupCreated(
        group
      );

      onClose();
    } catch (
      error
    ) {
      console.error(
        "Group creation failed:",
        error
      );

      setErrorMessage(
        error.response
          ?.data
          ?.error
          ?.message ||
        error.response
          ?.data
          ?.message ||
        "Unable to create group."
      );
    } finally {
      setIsCreating(
        false
      );
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="create-group-overlay"
      role="presentation"
      onMouseDown={
        (
          event
        ) => {
          if (
            event.target ===
              event.currentTarget &&
            !isCreating
          ) {
            onClose();
          }
        }
      }
    >
      <section
        className="create-group-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
      >
        <header
          className="create-group-header"
        >
          <div>
            <h2
              id="create-group-title"
            >
              Create group
            </h2>

            <p>
              Choose a name
              and add members.
            </p>
          </div>

          <button
            type="button"
            className="create-group-close"
            onClick={
              onClose
            }
            disabled={
              isCreating
            }
            aria-label="Close create group"
          >
            ×
          </button>
        </header>

        <form
          className="create-group-form"
          onSubmit={
            handleCreateGroup
          }
        >
          <div
            className="create-group-field"
          >
            <label
              htmlFor="group-name"
            >
              Group name
            </label>

            <input
              id="group-name"
              type="text"
              maxLength={120}
              autoComplete="off"
              placeholder="Enter group name"
              value={
                title
              }
              onChange={
                (
                  event
                ) =>
                  setTitle(
                    event.target
                      .value
                  )
              }
              disabled={
                isCreating
              }
            />
          </div>

          {selectedUsers.length >
            0 && (
            <div
              className="selected-group-members"
            >
              {selectedUsers.map(
                (
                  selectedUser
                ) => (
                  <span
                    key={
                      selectedUser.id
                    }
                    className="selected-group-member"
                  >
                    {
                      selectedUser.username
                    }

                    <button
                      type="button"
                      aria-label={`Remove ${selectedUser.username}`}
                      onClick={
                        () =>
                          handleRemoveUser(
                            selectedUser.id
                          )
                      }
                      disabled={
                        isCreating
                      }
                    >
                      ×
                    </button>
                  </span>
                )
              )}
            </div>
          )}

          <div
            className="create-group-field"
          >
            <label
              htmlFor="group-member-search"
            >
              Add members
            </label>

            <input
              ref={
                searchInputRef
              }
              id="group-member-search"
              type="search"
              autoComplete="off"
              maxLength={50}
              placeholder="Search usernames..."
              value={
                query
              }
              onChange={
                (
                  event
                ) =>
                  setQuery(
                    event.target
                      .value
                  )
              }
              disabled={
                isCreating
              }
            />
          </div>

          <div
            className="create-group-results"
          >
            {query
              .trim()
              .length >=
              2 &&
              isSearching && (
                <div
                  className="create-group-state"
                >
                  Searching...
                </div>
              )}

            {query
              .trim()
              .length >=
              2 &&
              !isSearching &&
              users.length ===
                0 && (
                <div
                  className="create-group-state"
                >
                  No users found.
                </div>
              )}

            {!isSearching &&
              users.map(
                (
                  foundUser
                ) => (
                  <button
                    key={
                      foundUser.id
                    }
                    type="button"
                    className="create-group-user"
                    onClick={
                      () =>
                        handleSelectUser(
                          foundUser
                        )
                    }
                    disabled={
                      isCreating
                    }
                  >
                    <span
                      className="create-group-avatar"
                    >
                      {foundUser
                        .username
                        ?.charAt(0)
                        .toUpperCase() ||
                        "?"}
                    </span>

                    <span>
                      {
                        foundUser.username
                      }
                    </span>
                  </button>
                )
              )}
          </div>

          {errorMessage && (
            <div
              className="create-group-error"
            >
              {errorMessage}
            </div>
          )}

          <footer
            className="create-group-footer"
          >
            <span>
              {
                selectedUsers.length
              }{" "}
              member
              {selectedUsers.length ===
              1
                ? ""
                : "s"}{" "}
              selected
            </span>

            <button
              type="submit"
              className="create-group-submit"
              disabled={
                isCreating ||
                !title.trim() ||
                selectedUsers.length ===
                  0
              }
            >
              {isCreating
                ? "Creating..."
                : "Create group"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}