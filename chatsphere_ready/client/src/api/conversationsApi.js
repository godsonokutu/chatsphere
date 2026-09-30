import {
  apiClient,
} from "./apiClient";

// ======================================================
// CONVERSATION INBOX
// ======================================================

export async function fetchConversations({
  cursor,
  limit = 30,
} = {}) {
  const response =
    await apiClient.get(
      "/conversations",
      {
        params: {
          limit,

          ...(cursor
            ? { cursor }
            : {}),
        },
      }
    );

  return response.data.data;
}

// ======================================================
// DIRECT CONVERSATION
// ======================================================

export async function createDirectConversation(
  participantId
) {
  const response =
    await apiClient.post(
      "/conversations/direct",
      {
        participantId:
          String(
            participantId
          ),
      }
    );

  return response.data.data;
}

// ======================================================
// CREATE GROUP
// ======================================================

export async function createGroupConversation({
  title,
  memberIds,
}) {
  const response =
    await apiClient.post(
      "/conversations/group",
      {
        title:
          title.trim(),

        memberIds:
          memberIds.map(
            String
          ),
      }
    );

  return response.data.data;
}

// ======================================================
// GROUP DETAILS
// ======================================================

export async function fetchGroupDetails(
  conversationId
) {
  const response =
    await apiClient.get(
      `/conversations/${conversationId}/group`
    );

  return response.data.data;
}

// ======================================================
// RENAME GROUP
// ======================================================

export async function renameGroup({
  conversationId,
  title,
}) {
  const response =
    await apiClient.patch(
      `/conversations/${conversationId}/group`,
      {
        title:
          title.trim(),
      }
    );

  return response.data.data;
}

// ======================================================
// ADD GROUP MEMBER
// ======================================================

export async function addGroupMember({
  conversationId,
  memberId,
}) {
  const response =
    await apiClient.post(
      `/conversations/${conversationId}/members`,
      {
        memberId:
          String(
            memberId
          ),
      }
    );

  return response.data.data;
}

// ======================================================
// REMOVE GROUP MEMBER
// ======================================================

export async function removeGroupMember({
  conversationId,
  memberId,
}) {
  const response =
    await apiClient.delete(
      `/conversations/${conversationId}/members/${memberId}`
    );

  return response.data.data;
}

// ======================================================
// UPDATE MEMBER ROLE
// ======================================================

export async function updateGroupMemberRole({
  conversationId,
  memberId,
  role,
}) {
  const response =
    await apiClient.patch(
      `/conversations/${conversationId}/members/${memberId}/role`,
      {
        role,
      }
    );

  return response.data.data;
}

// ======================================================
// TRANSFER OWNERSHIP
// ======================================================

export async function transferGroupOwnership({
  conversationId,
  memberId,
}) {
  const response =
    await apiClient.post(
      `/conversations/${conversationId}/owner-transfer`,
      {
        memberId:
          String(
            memberId
          ),
      }
    );

  return response.data.data;
}

// ======================================================
// LEAVE GROUP
// ======================================================

export async function leaveGroup(
  conversationId
) {
  const response =
    await apiClient.post(
      `/conversations/${conversationId}/leave`
    );

  return response.data.data;
}