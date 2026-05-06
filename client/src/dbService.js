const API_BASE = "/api";
const STORAGE_KEYS = {
  USERS: "cf_users",
  ORGS: "cf_orgs",
  META: "cf_meta",
};

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readStore = (key, fallback = []) => parseJson(localStorage.getItem(key), fallback);
const writeStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const getMeta = (key, defaultValue = null) => {
  const meta = parseJson(localStorage.getItem(STORAGE_KEYS.META), {});
  return meta[key] ?? defaultValue;
};

const setMeta = (key, value) => {
  const meta = parseJson(localStorage.getItem(STORAGE_KEYS.META), {});
  meta[key] = value;
  localStorage.setItem(STORAGE_KEYS.META, JSON.stringify(meta));
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

const init = async () => Promise.resolve();

const getAllRecords = async () => {
  const orgId = getMeta("currentOrgId") || "";
  const url = `${API_BASE}/records${orgId ? `?organizationId=${encodeURIComponent(orgId)}` : ""}`;

  return fetch(url, {
    headers: { "Content-Type": "application/json" },
  }).then(handleResponse);
};

const saveAllRecords = async (records) => {
  const orgId = getMeta("currentOrgId") || records[0]?.organizationId || "";
  if (!orgId) {
    throw new Error("Organization ID is required to save records.");
  }

  const normalized = records.map((record) => ({
    ...record,
    organizationId: record.organizationId || orgId,
  }));

  return fetch(`${API_BASE}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
  }).then(handleResponse);
};

const migrateRecordsToOrganization = async () => Promise.resolve();

const getUserById = async (id) => {
  if (!id) return null;
  const users = readStore(STORAGE_KEYS.USERS, []);
  return users.find((user) => user.id === id) || null;
};

const getUserByName = async (name) => {
  if (!name) return null;
  const users = readStore(STORAGE_KEYS.USERS, []);
  return users.find((user) => user.name?.toLowerCase() === name.toLowerCase()) || null;
};

const saveUser = async (user) => {
  const users = readStore(STORAGE_KEYS.USERS, []);
  const index = users.findIndex((item) => item.id === user.id);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  writeStore(STORAGE_KEYS.USERS, users);
  return user;
};

const getOrganizationById = async (organizationId) => {
  if (!organizationId) return null;
  const orgs = readStore(STORAGE_KEYS.ORGS, []);
  return orgs.find((org) => org.id === organizationId) || null;
};

const saveOrganization = async (organization) => {
  const orgs = readStore(STORAGE_KEYS.ORGS, []);
  const index = orgs.findIndex((item) => item.id === organization.id);
  if (index >= 0) {
    orgs[index] = organization;
  } else {
    orgs.push(organization);
  }
  writeStore(STORAGE_KEYS.ORGS, orgs);
  return organization;
};

const getOrganizationMembers = async (organizationId) => {
  if (!organizationId) return [];
  const users = readStore(STORAGE_KEYS.USERS, []);
  return users.filter((user) => user.organizationId === organizationId);
};

const getCurrentUserId = async () => getMeta("currentUserId", null);
const setCurrentUserId = async (id) => setMeta("currentUserId", id);
const getCurrentOrgId = async () => getMeta("currentOrgId", null);
const setCurrentOrgId = async (id) => setMeta("currentOrgId", id);
const getLastSyncedAt = async () => Number(getMeta("lastSyncedAt", 0));
const setLastSyncedAt = async (timestamp) => setMeta("lastSyncedAt", timestamp);
const getPendingChanges = async () => [];
const upsertRecords = async (records) => saveAllRecords(records);
const deleteRecord = async () => Promise.resolve();

export default {
  init,
  getAllRecords,
  saveAllRecords,
  migrateRecordsToOrganization,
  getUserById,
  getUserByName,
  saveUser,
  getOrganizationById,
  saveOrganization,
  getOrganizationMembers,
  getCurrentUserId,
  setCurrentUserId,
  getCurrentOrgId,
  setCurrentOrgId,
  getLastSyncedAt,
  setLastSyncedAt,
  getPendingChanges,
  upsertRecords,
  deleteRecord,
};
