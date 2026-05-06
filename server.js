import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "chickfarm.sqlite");
sqlite3.verbose();
const db = new sqlite3.Database(DB_PATH, (error) => {
  if (error) {
    console.error("SQLite failed to open:", error);
    process.exit(1);
  }
  console.log("SQLite database opened at", DB_PATH);
});

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (error) {
    if (error) return reject(error);
    resolve(this);
  });
});

const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => {
    if (error) return reject(error);
    resolve(rows);
  });
});

const parseJson = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const derived = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256");
  return `${salt}$${derived.toString("hex")}`;
};

const verifyPassword = (password, storedHash) => {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split("$");
  if (!salt || !hash) return false;
  const derived = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived);
};

const generateToken = () => crypto.randomBytes(32).toString("hex");

const now = () => Date.now();
const uid = () => `${Math.random().toString(36).slice(2)}${now().toString(36)}`;

const initDb = async () => {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      date TEXT,
      avgWeight TEXT,
      foodSupplied TEXT,
      deaths TEXT,
      injured TEXT,
      soldBirds TEXT,
      unsoldBirds TEXT,
      expenses TEXT,
      income TEXT,
      notes TEXT,
      addedBy TEXT,
      organizationId TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      syncStatus TEXT
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      memberOf TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  await runAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name COLLATE NOCASE)
  `);

  await runAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE)
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ownerId TEXT NOT NULL,
      members TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      invitedUserId TEXT,
      invitedEmail TEXT,
      invitedName TEXT,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      respondedAt INTEGER
    )
  `);

  await runAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_unique_target ON invitations(organizationId, invitedUserId, invitedEmail, invitedName)
  `).catch(() => null);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      currentOrgId TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      expiresAt INTEGER
    )
  `);
};

await initDb();

const app = express();
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};
app.use(cors(corsOptions));
app.use(express.json());

const sendError = (res, status, message) => res.status(status).json({ error: message });

const getAuthToken = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.query.token || null;
};

const getSessionRecord = async (token) => {
  if (!token) return null;
  const rows = await allAsync("SELECT * FROM sessions WHERE token = ?", [token]);
  const session = rows[0] || null;
  if (!session) return null;
  if (session.expiresAt && Number(session.expiresAt) < now()) return null;
  return session;
};

const getUserById = async (id) => {
  if (!id) return null;
  const rows = await allAsync("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
};

const getUserByName = async (name) => {
  if (!name) return null;
  const rows = await allAsync("SELECT * FROM users WHERE LOWER(name) = LOWER(?)", [name]);
  return rows[0] || null;
};

const getUserByEmail = async (email) => {
  if (!email) return null;
  const rows = await allAsync("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]);
  return rows[0] || null;
};

const saveUser = async (user) => {
  const existing = await getUserById(user.id);
  const nowTs = now();
  if (existing) {
    await runAsync(
      `UPDATE users SET name = ?, email = ?, passwordHash = ?, role = ?, memberOf = ?, updatedAt = ? WHERE id = ?`,
      [user.name, user.email, user.passwordHash, user.role, JSON.stringify(user.memberOf || []), nowTs, user.id]
    );
    return { ...user, updatedAt: nowTs };
  }

  await runAsync(
    `INSERT INTO users (id, name, email, passwordHash, role, memberOf, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.name, user.email, user.passwordHash, user.role, JSON.stringify(user.memberOf || []), user.createdAt, nowTs]
  );
  return { ...user, updatedAt: nowTs };
};

const getOrganizationById = async (organizationId) => {
  if (!organizationId) return null;
  const rows = await allAsync("SELECT * FROM organizations WHERE id = ?", [organizationId]);
  return rows[0] || null;
};

const saveOrganization = async (organization) => {
  const existing = await getOrganizationById(organization.id);
  const nowTs = now();
  if (existing) {
    await runAsync(
      `UPDATE organizations SET name = ?, ownerId = ?, members = ?, updatedAt = ? WHERE id = ?`,
      [organization.name, organization.ownerId, JSON.stringify(organization.members || []), nowTs, organization.id]
    );
    return { ...organization, updatedAt: nowTs };
  }

  await runAsync(
    `INSERT INTO organizations (id, name, ownerId, members, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [organization.id, organization.name, organization.ownerId, JSON.stringify(organization.members || []), organization.createdAt, nowTs]
  );
  return { ...organization, updatedAt: nowTs };
};

const saveInvitation = async (invite) => {
  const existing = await allAsync("SELECT * FROM invitations WHERE id = ?", [invite.id]);
  const nowTs = now();
  if (existing.length) {
    await runAsync(
      `UPDATE invitations SET organizationId = ?, invitedUserId = ?, invitedEmail = ?, invitedName = ?, status = ?, updatedAt = ?, respondedAt = ? WHERE id = ?`,
      [invite.organizationId, invite.invitedUserId || null, invite.invitedEmail || null, invite.invitedName || null, invite.status, nowTs, invite.respondedAt || null, invite.id]
    );
    return { ...invite, updatedAt: nowTs };
  }

  await runAsync(
    `INSERT INTO invitations (id, organizationId, invitedUserId, invitedEmail, invitedName, status, createdAt, updatedAt, respondedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [invite.id, invite.organizationId, invite.invitedUserId || null, invite.invitedEmail || null, invite.invitedName || null, invite.status, invite.createdAt, nowTs, invite.respondedAt || null]
  );
  return { ...invite, updatedAt: nowTs };
};

const saveSession = async (session) => {
  const existing = await getSessionRecord(session.token);
  const nowTs = now();
  if (existing) {
    await runAsync(
      `UPDATE sessions SET userId = ?, currentOrgId = ?, updatedAt = ?, expiresAt = ? WHERE token = ?`,
      [session.userId, session.currentOrgId || null, nowTs, session.expiresAt || null, session.token]
    );
    return { ...session, updatedAt: nowTs };
  }

  await runAsync(
    `INSERT INTO sessions (token, userId, currentOrgId, createdAt, updatedAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [session.token, session.userId, session.currentOrgId || null, session.createdAt, nowTs, session.expiresAt || null]
  );
  return { ...session, updatedAt: nowTs };
};

const getPendingInvitesForUser = async (user) => {
  if (!user) return [];
  const email = user.email || "";
  const name = user.name || "";
  const rows = await allAsync(
    `SELECT * FROM invitations WHERE status = 'pending' AND (invitedUserId = ? OR LOWER(invitedEmail) = LOWER(?) OR LOWER(invitedName) = LOWER(?))`,
    [user.id, email, name]
  );
  return rows.map((invite) => ({
    ...invite,
    invitedUserId: invite.invitedUserId || null,
    invitedEmail: invite.invitedEmail || null,
    invitedName: invite.invitedName || null,
  }));
};

const buildOrganizationPayload = async (session, user) => {
  if (session?.currentOrgId) {
    const org = await getOrganizationById(session.currentOrgId);
    if (org) {
      return {
        ...org,
        members: parseJson(org.members, []),
      };
    }
  }

  return {
    id: user.id,
    name: `${user.name}'s Farm`,
    ownerId: user.id,
    members: [user.id],
    type: "individual",
  };
};

const buildSessionResponse = async (session) => {
  const user = await getUserById(session.userId);
  if (!user) return null;

  const pendingInvites = await getPendingInvitesForUser(user);
  const organization = await buildOrganizationPayload(session, user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      memberOf: parseJson(user.memberOf, []),
      createdAt: Number(user.createdAt),
      updatedAt: Number(user.updatedAt),
    },
    organization,
    pendingInvites,
    token: session.token,
  };
};

const requireAuth = async (req, res) => {
  const token = getAuthToken(req);
  if (!token) {
    sendError(res, 401, "Missing authentication token");
    return null;
  }
  const session = await getSessionRecord(token);
  if (!session) {
    sendError(res, 401, "Invalid or expired session token");
    return null;
  }
  return session;
};

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "ChickFarm backend is running" });
});

app.get("/api/auth/session", async (req, res) => {
  try {
    const token = getAuthToken(req);
    const session = await getSessionRecord(token);
    if (!session) {
      return sendError(res, 401, "Session not found");
    }
    const response = await buildSessionResponse(session);
    if (!response) {
      return sendError(res, 401, "Session user not found");
    }
    res.json(response);
  } catch (error) {
    console.error("Failed to restore session", error);
    res.status(500).json({ error: "Failed to restore session" });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, accountType, organizationName } = req.body || {};
    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "").trim();
    const type = String(accountType || "individual").toLowerCase();

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      return sendError(res, 400, "Name, email and password are required to sign up.");
    }

    const existingName = await getUserByName(normalizedName);
    if (existingName) {
      return sendError(res, 400, "A user with that name already exists.");
    }

    const existingEmail = await getUserByEmail(normalizedEmail);
    if (existingEmail) {
      return sendError(res, 400, "A user with that email already exists.");
    }

    const userId = `user_${uid()}`;
    const passwordHash = hashPassword(normalizedPassword);
    const user = {
      id: userId,
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      role: "owner",
      memberOf: [],
      createdAt: now(),
      updatedAt: now(),
    };

    let currentOrgId = user.id;
    if (type === "organization") {
      const organizationId = `org_${uid()}`;
      const org = {
        id: organizationId,
        name: String(organizationName || `${normalizedName}'s Farm`).trim() || `${normalizedName}'s Farm`,
        ownerId: userId,
        members: [userId],
        createdAt: now(),
        updatedAt: now(),
      };
      user.memberOf = [organizationId];
      currentOrgId = organizationId;
      await saveOrganization(org);
    }

    await saveUser(user);

    const token = generateToken();
    await saveSession({
      token,
      userId: user.id,
      currentOrgId,
      createdAt: now(),
      updatedAt: now(),
      expiresAt: null,
    });

    const response = await buildSessionResponse({ token, userId: user.id, currentOrgId });
    return res.json(response);
  } catch (error) {
    console.error("Signup failed", error);
    if (error?.message?.includes("UNIQUE")) {
      return sendError(res, 400, "Username or email already exists.");
    }
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { nameOrEmail, password } = req.body || {};
    const lookup = String(nameOrEmail || "").trim();
    const normalizedPassword = String(password || "").trim();

    if (!lookup || !normalizedPassword) {
      return sendError(res, 400, "Login requires a username or email and password.");
    }

    const user = lookup.includes("@") ? await getUserByEmail(lookup.toLowerCase()) : await getUserByName(lookup);
    if (!user) {
      return sendError(res, 404, "User not found. Please sign up first.");
    }

    if (!verifyPassword(normalizedPassword, user.passwordHash)) {
      return sendError(res, 401, "Invalid password. Please try again.");
    }

    const memberOf = parseJson(user.memberOf, []);
    const currentOrgId = memberOf.length ? memberOf[0] : user.id;

    const token = generateToken();
    await saveSession({
      token,
      userId: user.id,
      currentOrgId,
      createdAt: now(),
      updatedAt: now(),
      expiresAt: null,
    });

    const response = await buildSessionResponse({ token, userId: user.id, currentOrgId });
    return res.json(response);
  } catch (error) {
    console.error("Login failed", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = getAuthToken(req);
    if (token) {
      await runAsync("DELETE FROM sessions WHERE token = ?", [token]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Logout failed", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

app.post("/api/organizations/create", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { organizationName } = req.body || {};
    const name = String(organizationName || "").trim();
    if (!name) {
      return sendError(res, 400, "Organization name is required.");
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return sendError(res, 401, "Authenticated user not found.");
    }

    const organizationId = `org_${uid()}`;
    const organization = {
      id: organizationId,
      name,
      ownerId: user.id,
      members: [user.id],
      createdAt: now(),
      updatedAt: now(),
    };
    user.memberOf = [...new Set([...parseJson(user.memberOf, []), organizationId])];
    await saveOrganization(organization);
    await saveUser({ ...user, memberOf: user.memberOf, passwordHash: user.passwordHash, role: user.role });

    session.currentOrgId = organizationId;
    await saveSession(session);

    const response = await buildSessionResponse(session);
    res.json(response);
  } catch (error) {
    console.error("Create organization failed", error);
    res.status(500).json({ error: "Create organization failed" });
  }
});

app.post("/api/organizations/invite", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { organizationId, target } = req.body || {};
    const targetValue = String(target || "").trim();
    if (!organizationId || !targetValue) {
      return sendError(res, 400, "Organization ID and invite target are required.");
    }

    const organization = await getOrganizationById(organizationId);
    if (!organization) {
      return sendError(res, 404, "Organization not found.");
    }

    if (organization.ownerId !== session.userId) {
      return sendError(res, 403, "Only organization owners can send invites.");
    }

    const existingUser = targetValue.includes("@") ? await getUserByEmail(targetValue.toLowerCase()) : await getUserByName(targetValue);
    if (existingUser && parseJson(organization.members, []).includes(existingUser.id)) {
      return sendError(res, 400, "User is already a member of this organization.");
    }

    const pending = await allAsync(
      `SELECT * FROM invitations WHERE organizationId = ? AND status = 'pending' AND (invitedUserId = ? OR LOWER(invitedEmail) = LOWER(?) OR LOWER(invitedName) = LOWER(?))`,
      [organization.id, existingUser?.id || null, targetValue.toLowerCase(), targetValue.toLowerCase()]
    );
    if (pending.length) {
      return sendError(res, 400, "A pending invite already exists for that user.");
    }

    const invite = {
      id: `invite_${uid()}`,
      organizationId: organization.id,
      invitedUserId: existingUser?.id || null,
      invitedEmail: existingUser ? existingUser.email : targetValue.includes("@") ? targetValue.toLowerCase() : null,
      invitedName: existingUser ? existingUser.name : targetValue.includes("@") ? null : targetValue,
      status: "pending",
      createdAt: now(),
      updatedAt: now(),
      respondedAt: null,
    };

    await saveInvitation(invite);
    res.json({ invite });
  } catch (error) {
    console.error("Invite failed", error);
    res.status(500).json({ error: "Invite failed" });
  }
});

app.get("/api/organizations/invites", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;
    const user = await getUserById(session.userId);
    if (!user) return sendError(res, 401, "Authenticated user not found.");
    const invites = await getPendingInvitesForUser(user);
    res.json({ invites });
  } catch (error) {
    console.error("Failed to fetch invites", error);
    res.status(500).json({ error: "Failed to fetch invites" });
  }
});

const respondToInvite = async (req, res, accepted) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;
    const { inviteId } = req.body || {};
    if (!inviteId) {
      return sendError(res, 400, "Invite ID is required.");
    }

    const rows = await allAsync("SELECT * FROM invitations WHERE id = ?", [inviteId]);
    const invite = rows[0];
    if (!invite) {
      return sendError(res, 404, "Invite not found.");
    }
    if (invite.status !== "pending") {
      return sendError(res, 400, "Invite is no longer pending.");
    }

    const user = await getUserById(session.userId);
    if (!user) return sendError(res, 401, "Authenticated user not found.");

    const email = String(user.email || "").toLowerCase();
    const name = String(user.name || "").toLowerCase();
    const invitedEmail = String(invite.invitedEmail || "").toLowerCase();
    const invitedName = String(invite.invitedName || "").toLowerCase();

    if (invite.invitedUserId && invite.invitedUserId !== user.id) {
      return sendError(res, 403, "This invite is not for your account.");
    }
    if (!invite.invitedUserId && invitedEmail && invitedEmail !== email && invitedName !== name) {
      return sendError(res, 403, "This invite is not addressed to your account.");
    }

    invite.status = accepted ? "accepted" : "rejected";
    invite.updatedAt = now();
    invite.respondedAt = now();
    await saveInvitation(invite);

    if (accepted) {
      const organization = await getOrganizationById(invite.organizationId);
      if (!organization) {
        return sendError(res, 404, "Organization not found.");
      }
      const members = parseJson(organization.members, []);
      if (!members.includes(user.id)) {
        members.push(user.id);
      }
      organization.members = members;
      await saveOrganization(organization);
      const memberOf = parseJson(user.memberOf, []);
      if (!memberOf.includes(organization.id)) {
        memberOf.push(organization.id);
      }
      await saveUser({ ...user, memberOf, passwordHash: user.passwordHash, role: user.role, name: user.name, email: user.email, id: user.id, createdAt: user.createdAt });
    }

    res.json({ invite });
  } catch (error) {
    console.error("Invite response failed", error);
    res.status(500).json({ error: "Invite response failed" });
  }
};

app.post("/api/organizations/accept-invite", async (req, res) => {
  await respondToInvite(req, res, true);
});

app.post("/api/organizations/reject-invite", async (req, res) => {
  await respondToInvite(req, res, false);
});

app.post("/api/organizations/switch-mode", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { mode, organizationId, leaveOrganizationId } = req.body || {};
    const user = await getUserById(session.userId);
    if (!user) return sendError(res, 401, "Authenticated user not found.");

    const memberOf = parseJson(user.memberOf, []);
    let nextOrgId = user.id;

    if (mode === "organization") {
      if (!organizationId) {
        return sendError(res, 400, "Organization ID is required to switch into organization mode.");
      }
      if (!memberOf.includes(organizationId)) {
        return sendError(res, 403, "You are not a member of that organization.");
      }
      nextOrgId = organizationId;
    }

    if (leaveOrganizationId) {
      if (!memberOf.includes(leaveOrganizationId)) {
        return sendError(res, 400, "You are not a member of that organization.");
      }
      const organization = await getOrganizationById(leaveOrganizationId);
      if (!organization) {
        return sendError(res, 404, "Organization not found.");
      }
      if (organization.ownerId === user.id) {
        return sendError(res, 400, "Organization owners cannot leave their own organization.");
      }
      organization.members = parseJson(organization.members, []).filter((member) => member !== user.id);
      await saveOrganization(organization);
      user.memberOf = memberOf.filter((item) => item !== leaveOrganizationId);
      await saveUser({ ...user, memberOf: user.memberOf, passwordHash: user.passwordHash, role: user.role, name: user.name, email: user.email, id: user.id, createdAt: user.createdAt });
      if (nextOrgId === leaveOrganizationId) {
        nextOrgId = user.id;
      }
    }

    session.currentOrgId = nextOrgId;
    await saveSession(session);

    const response = await buildSessionResponse(session);
    res.json(response);
  } catch (error) {
    console.error("Switch mode failed", error);
    res.status(500).json({ error: "Switch mode failed" });
  }
});

app.get("/api/records", async (req, res) => {
  try {
    const organizationId = req.query.organizationId;
    const query = organizationId
      ? `SELECT * FROM records WHERE organizationId = ? ORDER BY date DESC, createdAt DESC`
      : `SELECT * FROM records ORDER BY date DESC, createdAt DESC`;
    const rows = await allAsync(query, organizationId ? [organizationId] : []);
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch records", error);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

app.post("/api/records", async (req, res) => {
  try {
    const payload = req.body;
    const records = Array.isArray(payload) ? payload : [payload];
    if (!records.length) {
      return res.status(400).json({ error: "No records provided" });
    }

    const organizationId = records[0].organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required for records" });
    }

    const incomingIds = records.map((record) => record.id).filter(Boolean);
    await runAsync("BEGIN TRANSACTION");

    const insertSql = `
      INSERT OR REPLACE INTO records (
        id, date, avgWeight, foodSupplied, deaths, injured,
        soldBirds, unsoldBirds, expenses, income, notes,
        addedBy, organizationId, createdAt, updatedAt, syncStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const record of records) {
      await runAsync(insertSql, [
        record.id,
        record.date || "",
        record.avgWeight ?? "",
        record.foodSupplied ?? "",
        record.deaths ?? "",
        record.injured ?? "",
        record.soldBirds ?? "",
        record.unsoldBirds ?? "",
        record.expenses ?? "",
        record.income ?? "",
        record.notes ?? "",
        record.addedBy ?? "",
        record.organizationId || organizationId,
        Number(record.createdAt) || Date.now(),
        Number(record.updatedAt) || Date.now(),
        record.syncStatus || "synced",
      ]);
    }

    if (incomingIds.length > 0) {
      await runAsync(
        `DELETE FROM records WHERE organizationId = ? AND id NOT IN (${incomingIds.map(() => "?").join(",")})`,
        [organizationId, ...incomingIds]
      );
    }

    await runAsync("COMMIT");
    const saved = await allAsync(
      "SELECT * FROM records WHERE organizationId = ? ORDER BY date DESC, createdAt DESC",
      [organizationId]
    );
    res.json(saved);
  } catch (error) {
    console.error("Failed to save records", error);
    await runAsync("ROLLBACK").catch(() => null);
    res.status(500).json({ error: "Failed to save records" });
  }
});

app.post("/api/gemini/insights", async (req, res) => {
  try {
    const { prompt, analytics } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt in request body" });
    }
    if (!analytics || typeof analytics !== "object") {
      return res.status(400).json({ error: "Missing or invalid analytics object in request body" });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      console.error("Gemini API key missing in environment");
      return res.status(500).json({ error: "Gemini API key is not configured on the backend" });
    }

    const combinedPrompt = `${prompt}\n\nAnalytics:\n${JSON.stringify(analytics, null, 2)}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateText?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: { text: combinedPrompt } }),
      }
    );

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      console.error("Gemini API returned error", {
        status: response.status,
        statusText: response.statusText,
        body: data,
      });
      const message = data?.error?.message || data?.message || `Gemini API error ${response.status}`;
      return res.status(response.status).json({ error: message, details: data });
    }

    return res.json(data);
  } catch (error) {
    console.error("Gemini insight request failed", error);
    return res.status(500).json({ error: "Gemini insight request failed", details: error?.message || String(error) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
