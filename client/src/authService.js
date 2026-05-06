import dbService from "./dbService";

const API_BASE = "/api";
const STORAGE_KEYS = {
  SESSION_TOKEN: "cf_session_token",
  CURRENT_ORG_ID: "cf_currentOrgId",
  USER_ID: "cf_user_id",
};

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getToken = () => localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
const setToken = (token) => {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  }
};

const buildHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response) => {
  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      // ignore
    }
    const errorMessage = data?.error || response.statusText || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
};

const persistSession = async (session) => {
  if (!session || !session.user || !session.token) return;

  setToken(session.token);
  localStorage.setItem(STORAGE_KEYS.USER_ID, session.user.id);
  if (session.organization?.id) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ORG_ID, session.organization.id);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG_ID);
  }

  await dbService.setCurrentUserId(session.user.id);
  await dbService.setCurrentOrgId(session.organization?.id || session.user.id);
};

const clearSession = async () => {
  setToken(null);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG_ID);
  localStorage.removeItem(STORAGE_KEYS.USER_ID);
  await dbService.setCurrentUserId(null);
  await dbService.setCurrentOrgId(null);
};

const normalizeSessionPayload = (payload) => {
  if (!payload || !payload.user) return null;

  const user = {
    ...payload.user,
    memberOf: parseJson(payload.user.memberOf, []),
  };

  const organization = payload.organization || {
    id: user.id,
    name: `${user.name}'s Farm`,
    ownerId: user.id,
    members: [user.id],
    type: "individual",
  };

  return {
    user,
    organization,
    token: payload.token || getToken(),
    pendingInvites: payload.pendingInvites || [],
  };
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: buildHeaders(),
    ...options,
  });
  return handleResponse(response);
};

const login = async ({ nameOrEmail, password }) => {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ nameOrEmail, password }),
  });
};

const signup = async ({ name, email, password, accountType, organizationName }) => {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password, accountType, organizationName }),
  });
};

const loginOrSignup = async ({ name, email = "", password, accountType = "individual", organizationName = "" }) => {
  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim();
  const trimmedPassword = String(password || "").trim();

  if (!trimmedName || !trimmedPassword) {
    throw new Error("Name and password are required.");
  }

  const identifier = trimmedEmail || trimmedName;
  try {
    const result = await login({ nameOrEmail: identifier, password: trimmedPassword });
    const session = normalizeSessionPayload(result);
    await persistSession(session);
    return session;
  } catch (error) {
    const message = String(error.message || "Login failed");
    if (message.includes("User not found")) {
      const result = await signup({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
        accountType,
        organizationName,
      });
      const session = normalizeSessionPayload(result);
      await persistSession(session);
      return session;
    }
    throw error;
  }
};

const restoreSession = async () => {
  const token = getToken();
  if (token) {
    try {
      const result = await request("/auth/session", { method: "GET" });
      const session = normalizeSessionPayload(result);
      await persistSession(session);
      return session;
    } catch (error) {
      console.warn("Session restore failed", error.message);
    }
  }

  const fallbackUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (fallbackUserId) {
    const user = await dbService.getUserById(fallbackUserId);
    if (!user) return null;
    const orgId = localStorage.getItem(STORAGE_KEYS.CURRENT_ORG_ID);
    const organization = orgId ? await dbService.getOrganizationById(orgId) : null;

    const session = {
      user: {
        ...user,
        memberOf: parseJson(user.memberOf, []),
      },
      organization: organization || {
        id: user.id,
        name: `${user.name}'s Farm`,
        ownerId: user.id,
        members: [user.id],
        type: "individual",
      },
      token: null,
    };

    await dbService.setCurrentUserId(user.id);
    await dbService.setCurrentOrgId(session.organization.id);
    return session;
  }

  return null;
};

const logout = async () => {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    // ignore errors during logout
  }
  await clearSession();
};

const switchMode = async ({ mode, organizationId, leaveOrganizationId }) => {
  const result = await request("/organizations/switch-mode", {
    method: "POST",
    body: JSON.stringify({ mode, organizationId, leaveOrganizationId }),
  });
  const session = normalizeSessionPayload(result);
  await persistSession(session);
  return session;
};

const getPendingInvites = async () => {
  const result = await request("/organizations/invites", { method: "GET" });
  return result.invites || [];
};

const inviteUser = async ({ organizationId, target }) => {
  return request("/organizations/invite", {
    method: "POST",
    body: JSON.stringify({ organizationId, target }),
  });
};

const acceptInvite = async (inviteId) => {
  const result = await request("/organizations/accept-invite", {
    method: "POST",
    body: JSON.stringify({ inviteId }),
  });
  const session = normalizeSessionPayload(result);
  await persistSession(session);
  return session;
};

const rejectInvite = async (inviteId) => {
  return request("/organizations/reject-invite", {
    method: "POST",
    body: JSON.stringify({ inviteId }),
  });
};

export default {
  loginOrSignup,
  restoreSession,
  logout,
  switchMode,
  getPendingInvites,
  inviteUser,
  acceptInvite,
  rejectInvite,
};
