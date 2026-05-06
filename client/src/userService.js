import dbService from "./dbService";

const normalizeUserRole = (user, org) => {
  if (!user) return null;
  const normalized = { ...user };
  if (org && Array.isArray(org.members) && org.members.length === 1) {
    normalized.role = "owner";
  }
  return normalized;
};

const getUserByName = async (name) => {
  if (!name) return null;
  return dbService.getUserByName(name);
};

const getUserById = async (id) => {
  if (!id) return null;
  return dbService.getUserById(id);
};

const createUser = async ({ id, name, email, role, organizationId }) => {
  return dbService.saveUser({
    id,
    name,
    email: email || "",
    role: role || "viewer",
    organizationId: organizationId || "",
    createdAt: Date.now(),
  });
};

const getOrganizationById = async (organizationId) => {
  if (!organizationId) return null;
  return dbService.getOrganizationById(organizationId);
};

const createOrganization = async ({ id, name, ownerId, members }) => {
  return dbService.saveOrganization({
    id,
    name,
    ownerId,
    createdAt: Date.now(),
    members: members || [],
  });
};

const getOrganizationForUser = async (userId) => {
  const user = await getUserById(userId);
  if (!user || !user.organizationId) return null;
  return getOrganizationById(user.organizationId);
};

const getOrganizationMembers = async (organizationId) => {
  if (!organizationId) return [];
  return dbService.getOrganizationMembers(organizationId);
};

export default {
  normalizeUserRole,
  getUserByName,
  getUserById,
  createUser,
  createOrganization,
  getOrganizationById,
  getOrganizationForUser,
  getOrganizationMembers,
};
