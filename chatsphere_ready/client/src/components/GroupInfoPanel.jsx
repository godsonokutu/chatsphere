import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  searchUsers,
} from "../api/usersApi";

import {
  addGroupMember,
  fetchGroupDetails,
  leaveGroup,
  removeGroupMember,
  renameGroup,
  transferGroupOwnership,
  updateGroupMemberRole,
} from "../api/conversationsApi";

import "./GroupInfoPanel.css";

// ======================================================
// PUBLIC API ERROR
// ======================================================

function getApiError(
  error,
  fallback
) {
  return (
    error.response
      ?.data
      ?.error
      ?.message ||
    error.response
      ?.data
      ?.message ||
    fallback
  );
}

// ======================================================
// GROUP INFO PANEL
// ======================================================

export function GroupInfoPanel({
  isOpen,
  conversation,
  currentUserId,
  onClose,
  onGroupUpdated,
  onLeftGroup,
}) {
  const [
    group,
    setGroup,
  ] =
    useState(null);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    renameTitle,
    setRenameTitle,
  ] =
    useState("");

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState("");

  const [
    searchResults,
    setSearchResults,
  ] =
    useState([]);

  const [
    isSearching,
    setIsSearching,
  ] =
    useState(false);

  const [
    busyAction,
    setBusyAction,
  ] =
    useState(null);

  const [
    confirmation,
    setConfirmation,
  ] =
    useState(null);

  const searchSequenceRef =
    useRef(0);

  const conversationId =
    conversation?.id
      ? String(
          conversation.id
        )
      : null;

  // ====================================================
  // LOAD GROUP
  // ====================================================

  const loadGroup =
    useCallback(
      async () => {
        if (
          !conversationId
        ) {
          return;
        }

        setIsLoading(
          true
        );

        setErrorMessage(
          ""
        );

        try {
          const result =
            await fetchGroupDetails(
              conversationId
            );

          setGroup(
            result
          );

          setRenameTitle(
            result.title || ""
          );

          onGroupUpdated?.({
            id:
              result.id,

            title:
              result.title,

            memberCount:
              result.memberCount,
          });
        } catch (
          error
        ) {
          console.error(
            "Unable to load group:",
            error
          );

          setErrorMessage(
            getApiError(
              error,
              "Unable to load group information."
            )
          );
        } finally {
          setIsLoading(
            false
          );
        }
      },
      [
        conversationId,
        onGroupUpdated,
      ]
    );

  // ====================================================
  // OPEN / RESET
  // ====================================================

  useEffect(
    () => {
      if (!isOpen) {
        setGroup(null);

        setRenameTitle("");

        setSearchQuery("");

        setSearchResults([]);

        setErrorMessage("");

        setConfirmation(null);

        setBusyAction(null);

        return;
      }

      loadGroup();
    },
    [
      isOpen,
      loadGroup,
    ]
  );

  // ====================================================
  // ESCAPE
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
          !busyAction
        ) {
          if (
            confirmation
          ) {
            setConfirmation(
              null
            );

            return;
          }

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
      busyAction,
      confirmation,
      onClose,
    ]
  );

  // ====================================================
  // SEARCH USERS TO ADD
  // ====================================================

  useEffect(
    () => {
      const query =
        searchQuery.trim();

      if (
        !isOpen ||
        !group ||
        query.length < 2
      ) {
        searchSequenceRef
          .current +=
          1;

        setSearchResults([]);

        setIsSearching(
          false
        );

        return;
      }

      const sequence =
        ++searchSequenceRef
          .current;

      const timer =
        window.setTimeout(
          async () => {
            setIsSearching(
              true
            );

            try {
              const result =
                await searchUsers({
                  query,
                  limit:
                    20,
                });

              if (
                sequence !==
                searchSequenceRef
                  .current
              ) {
                return;
              }

              const currentMemberIds =
                new Set(
                  group.members.map(
                    (
                      member
                    ) =>
                      String(
                        member.id
                      )
                  )
                );

              const users =
                Array.isArray(
                  result?.users
                )
                  ? result.users
                  : [];

              setSearchResults(
                users.filter(
                  (
                    user
                  ) =>
                    !currentMemberIds.has(
                      String(
                        user.id
                      )
                    )
                )
              );
            } catch (
              error
            ) {
              console.error(
                "Group member search failed:",
                error
              );

              if (
                sequence ===
                searchSequenceRef
                  .current
              ) {
                setSearchResults(
                  []
                );
              }
            } finally {
              if (
                sequence ===
                searchSequenceRef
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
      group,
      searchQuery,
    ]
  );

  if (!isOpen) {
    return null;
  }

  const currentRole =
    group
      ?.currentUserRole;

  const isOwner =
    currentRole ===
    "OWNER";

  const isAdmin =
    currentRole ===
    "ADMIN";

  const canManageMembers =
    isOwner ||
    isAdmin;

  // ====================================================
  // RENAME
  // ====================================================

  async function handleRename(
    event
  ) {
    event.preventDefault();

    const title =
      renameTitle.trim();

    if (
      !title ||
      title ===
        group?.title ||
      busyAction
    ) {
      return;
    }

    setBusyAction(
      "rename"
    );

    setErrorMessage(
      ""
    );

    try {
      await renameGroup({
        conversationId,
        title,
      });

      await loadGroup();
    } catch (
      error
    ) {
      setErrorMessage(
        getApiError(
          error,
          "Unable to rename group."
        )
      );
    } finally {
      setBusyAction(
        null
      );
    }
  }

  // ====================================================
  // ADD MEMBER
  // ====================================================

  async function handleAddMember(
    user
  ) {
    if (busyAction) {
      return;
    }

    setBusyAction(
      `add:${user.id}`
    );

    setErrorMessage(
      ""
    );

    try {
      await addGroupMember({
        conversationId,

        memberId:
          user.id,
      });

      setSearchQuery("");

      setSearchResults([]);

      await loadGroup();
    } catch (
      error
    ) {
      setErrorMessage(
        getApiError(
          error,
          "Unable to add member."
        )
      );
    } finally {
      setBusyAction(
        null
      );
    }
  }

  // ====================================================
  // PROMOTE / DEMOTE
  // ====================================================

  async function handleRoleChange(
    member
  ) {
    if (
      !isOwner ||
      busyAction
    ) {
      return;
    }

    const nextRole =
      member.role ===
      "ADMIN"
        ? "MEMBER"
        : "ADMIN";

    setBusyAction(
      `role:${member.id}`
    );

    setErrorMessage(
      ""
    );

    try {
      await updateGroupMemberRole({
        conversationId,

        memberId:
          member.id,

        role:
          nextRole,
      });

      await loadGroup();
    } catch (
      error
    ) {
      setErrorMessage(
        getApiError(
          error,
          "Unable to update member role."
        )
      );
    } finally {
      setBusyAction(
        null
      );
    }
  }

  // ====================================================
  // CONFIRM DESTRUCTIVE ACTION
  // ====================================================

  function requestRemove(
    member
  ) {
    setConfirmation({
      type:
        "REMOVE",

      member,
    });
  }

  function requestTransfer(
    member
  ) {
    setConfirmation({
      type:
        "TRANSFER",

      member,
    });
  }

  function requestLeave() {
    setConfirmation({
      type:
        "LEAVE",
    });
  }

  // ====================================================
  // EXECUTE CONFIRMATION
  // ====================================================

  async function executeConfirmation() {
    if (
      !confirmation ||
      busyAction
    ) {
      return;
    }

    const action =
      confirmation;

    setErrorMessage(
      ""
    );

    try {
      if (
        action.type ===
        "REMOVE"
      ) {
        setBusyAction(
          `remove:${action.member.id}`
        );

        await removeGroupMember({
          conversationId,

          memberId:
            action.member.id,
        });

        setConfirmation(
          null
        );

        await loadGroup();

        return;
      }

      if (
        action.type ===
        "TRANSFER"
      ) {
        setBusyAction(
          `transfer:${action.member.id}`
        );

        await transferGroupOwnership({
          conversationId,

          memberId:
            action.member.id,
        });

        setConfirmation(
          null
        );

        await loadGroup();

        return;
      }

      if (
        action.type ===
        "LEAVE"
      ) {
        setBusyAction(
          "leave"
        );

        await leaveGroup(
          conversationId
        );

        setConfirmation(
          null
        );

        onLeftGroup?.(
          conversationId
        );

        onClose();
      }
    } catch (
      error
    ) {
      setErrorMessage(
        getApiError(
          error,
          "Unable to complete group action."
        )
      );
    } finally {
      setBusyAction(
        null
      );
    }
  }

  // ====================================================
  // REMOVE PERMISSION
  // ====================================================

  function canRemoveMember(
    member
  ) {
    if (
      String(
        member.id
      ) ===
      String(
        currentUserId
      )
    ) {
      return false;
    }

    if (
      member.role ===
      "OWNER"
    ) {
      return false;
    }

    if (isOwner) {
      return true;
    }

    if (
      isAdmin &&
      member.role ===
        "MEMBER"
    ) {
      return true;
    }

    return false;
  }

  // ====================================================
  // CONFIRMATION TEXT
  // ====================================================

  let confirmationTitle =
    "";

  let confirmationText =
    "";

  let confirmationButton =
    "Confirm";

  if (
    confirmation?.type ===
    "REMOVE"
  ) {
    confirmationTitle =
      "Remove member?";

    confirmationText =
      `${confirmation.member.username} will lose access to this group.`;

    confirmationButton =
      "Remove member";
  }

  if (
    confirmation?.type ===
    "TRANSFER"
  ) {
    confirmationTitle =
      "Transfer ownership?";

    confirmationText =
      `${confirmation.member.username} will become the new group owner and you will become a member.`;

    confirmationButton =
      "Transfer ownership";
  }

  if (
    confirmation?.type ===
    "LEAVE"
  ) {
    confirmationTitle =
      "Leave group?";

    confirmationText =
      "You will no longer receive messages from this group.";

    confirmationButton =
      "Leave group";
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <div
      className="group-info-overlay"
      onMouseDown={
        (
          event
        ) => {
          if (
            event.target ===
              event.currentTarget &&
            !busyAction
          ) {
            onClose();
          }
        }
      }
    >
      <aside
        className="group-info-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-info-title"
      >
        <header
          className="group-info-header"
        >
          <div>
            <h2
              id="group-info-title"
            >
              Group info
            </h2>

            <p>
              Manage group settings
              and members.
            </p>
          </div>

          <button
            type="button"
            className="group-info-close"
            onClick={
              onClose
            }
            disabled={
              Boolean(
                busyAction
              )
            }
            aria-label="Close group information"
          >
            ×
          </button>
        </header>

        <div
          className="group-info-body"
        >
          {isLoading &&
            !group && (
              <div
                className="group-info-state"
              >
                Loading group...
              </div>
            )}

          {errorMessage && (
            <div
              className="group-info-error"
            >
              {errorMessage}
            </div>
          )}

          {group && (
            <>
              <section
                className="group-info-summary"
              >
                <div
                  className="group-info-avatar"
                >
                  {group.title
                    ?.charAt(0)
                    .toUpperCase() ||
                    "G"}
                </div>

                <h3>
                  {group.title}
                </h3>

                <p>
                  {group.memberCount}{" "}
                  member
                  {group.memberCount ===
                  1
                    ? ""
                    : "s"}
                </p>

                <span
                  className={`group-role-badge group-role-badge--${currentRole?.toLowerCase()}`}
                >
                  {currentRole}
                </span>
              </section>

              {/* ======================================
                  RENAME
                  ====================================== */}

              {isOwner && (
                <section
                  className="group-info-section"
                >
                  <h4>
                    Group name
                  </h4>

                  <form
                    className="group-rename-form"
                    onSubmit={
                      handleRename
                    }
                  >
                    <input
                      type="text"
                      value={
                        renameTitle
                      }
                      maxLength={120}
                      disabled={
                        Boolean(
                          busyAction
                        )
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setRenameTitle(
                            event.target
                              .value
                          )
                      }
                    />

                    <button
                      type="submit"
                      disabled={
                        Boolean(
                          busyAction
                        ) ||
                        !renameTitle
                          .trim() ||
                        renameTitle
                          .trim() ===
                          group.title
                      }
                    >
                      {busyAction ===
                      "rename"
                        ? "Saving..."
                        : "Save"}
                    </button>
                  </form>
                </section>
              )}

              {/* ======================================
                  ADD MEMBER
                  ====================================== */}

              {canManageMembers && (
                <section
                  className="group-info-section"
                >
                  <h4>
                    Add member
                  </h4>

                  <input
                    className="group-member-search"
                    type="search"
                    autoComplete="off"
                    maxLength={50}
                    placeholder="Search username..."
                    value={
                      searchQuery
                    }
                    disabled={
                      Boolean(
                        busyAction
                      )
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setSearchQuery(
                          event.target
                            .value
                        )
                    }
                  />

                  {isSearching && (
                    <div
                      className="group-search-state"
                    >
                      Searching...
                    </div>
                  )}

                  {!isSearching &&
                    searchQuery
                      .trim()
                      .length >=
                      2 &&
                    searchResults
                      .length ===
                      0 && (
                      <div
                        className="group-search-state"
                      >
                        No available users
                        found.
                      </div>
                    )}

                  {!isSearching &&
                    searchResults.map(
                      (
                        user
                      ) => (
                        <button
                          key={
                            user.id
                          }
                          type="button"
                          className="group-search-user"
                          disabled={
                            Boolean(
                              busyAction
                            )
                          }
                          onClick={
                            () =>
                              handleAddMember(
                                user
                              )
                          }
                        >
                          <span
                            className="group-member-avatar"
                          >
                            {user.username
                              ?.charAt(0)
                              .toUpperCase() ||
                              "?"}
                          </span>

                          <span>
                            {
                              user.username
                            }
                          </span>

                          <strong>
                            {busyAction ===
                            `add:${user.id}`
                              ? "Adding..."
                              : "Add"}
                          </strong>
                        </button>
                      )
                    )}
                </section>
              )}

              {/* ======================================
                  MEMBERS
                  ====================================== */}

              <section
                className="group-info-section"
              >
                <h4>
                  Members ·{" "}
                  {group.memberCount}
                </h4>

                <div
                  className="group-member-list"
                >
                  {group.members.map(
                    (
                      member
                    ) => {
                      const isSelf =
                        String(
                          member.id
                        ) ===
                        String(
                          currentUserId
                        );

                      return (
                        <div
                          key={
                            member.id
                          }
                          className="group-member-row"
                        >
                          <span
                            className="group-member-avatar"
                          >
                            {member.username
                              ?.charAt(0)
                              .toUpperCase() ||
                              "?"}
                          </span>

                          <div
                            className="group-member-main"
                          >
                            <strong>
                              {
                                member.username
                              }

                              {isSelf && (
                                <small>
                                  {" "}
                                  (You)
                                </small>
                              )}
                            </strong>

                            <span>
                              {
                                member.role
                              }
                            </span>
                          </div>

                          {!isSelf && (
                            <div
                              className="group-member-actions"
                            >
                              {isOwner &&
                                member.role !==
                                  "OWNER" && (
                                  <button
                                    type="button"
                                    disabled={
                                      Boolean(
                                        busyAction
                                      )
                                    }
                                    onClick={
                                      () =>
                                        handleRoleChange(
                                          member
                                        )
                                    }
                                  >
                                    {member.role ===
                                    "ADMIN"
                                      ? "Remove admin"
                                      : "Make admin"}
                                  </button>
                                )}

                              {isOwner &&
                                member.role !==
                                  "OWNER" && (
                                  <button
                                    type="button"
                                    disabled={
                                      Boolean(
                                        busyAction
                                      )
                                    }
                                    onClick={
                                      () =>
                                        requestTransfer(
                                          member
                                        )
                                    }
                                  >
                                    Make owner
                                  </button>
                                )}

                              {canRemoveMember(
                                member
                              ) && (
                                <button
                                  type="button"
                                  className="group-member-remove"
                                  disabled={
                                    Boolean(
                                      busyAction
                                    )
                                  }
                                  onClick={
                                    () =>
                                      requestRemove(
                                        member
                                      )
                                  }
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </section>

              {/* ======================================
                  LEAVE GROUP
                  ====================================== */}

              <section
                className="group-info-section group-danger-section"
              >
                <h4>
                  Membership
                </h4>

                {isOwner && (
                  <p>
                    Transfer ownership
                    before leaving this
                    group.
                  </p>
                )}

                <button
                  type="button"
                  className="leave-group-button"
                  disabled={
                    isOwner ||
                    Boolean(
                      busyAction
                    )
                  }
                  onClick={
                    requestLeave
                  }
                >
                  Leave group
                </button>
              </section>
            </>
          )}
        </div>

        {/* ==========================================
            CONFIRMATION
            ========================================== */}

        {confirmation && (
          <div
            className="group-confirm-overlay"
          >
            <div
              className="group-confirm-box"
            >
              <h3>
                {confirmationTitle}
              </h3>

              <p>
                {confirmationText}
              </p>

              <div
                className="group-confirm-actions"
              >
                <button
                  type="button"
                  onClick={
                    () =>
                      setConfirmation(
                        null
                      )
                  }
                  disabled={
                    Boolean(
                      busyAction
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="group-confirm-danger"
                  onClick={
                    executeConfirmation
                  }
                  disabled={
                    Boolean(
                      busyAction
                    )
                  }
                >
                  {busyAction
                    ? "Working..."
                    : confirmationButton}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}