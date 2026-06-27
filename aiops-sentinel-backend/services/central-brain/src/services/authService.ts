import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

const JWT_SECRET  = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const JWT_EXPIRES = '24h';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  platformId: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  platformId: string;
  createdAt: Date;
}

export async function registerUser(
  email: string,
  name: string,
  password: string,
  role = 'SRE',
): Promise<{ user: SafeUser; token: string }> {
  const platformId = uuidv4();
  const pool = getPool();

  const existing = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) throw new Error('Email already registered');

  const hashed = await bcrypt.hash(password, 12);
  const id = uuidv4();
  const now = new Date();

  await pool.query(
    `INSERT INTO "User" (id, email, name, role, password, "platformId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [id, email, name, role, hashed, platformId, now],
  );

  const user: SafeUser = { id, email, name, role, platformId, createdAt: now };
  const token = jwt.sign({ userId: id, email, role, platformId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { user, token };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: SafeUser; token: string }> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
  const row = rows[0];
  if (!row) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, row.password as string);
  if (!valid) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { userId: row.id as string, email: row.email as string, role: row.role as string, platformId: row.platformId as string },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );

  const user: SafeUser = {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as string,
    platformId: row.platformId as string,
    createdAt: row.createdAt as Date,
  };
  return { user, token };
}

export async function getUserById(userId: string): Promise<SafeUser | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT id, email, name, role, "platformId", "createdAt" FROM "User" WHERE id = $1',
    [userId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    role: r.role as string,
    platformId: r.platformId as string,
    createdAt: r.createdAt as Date,
  };
}

export async function updateUserProfile(
  userId: string,
  name: string,
  role: string,
): Promise<SafeUser | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE "User" SET name = $1, role = $2, "updatedAt" = $3 WHERE id = $4
     RETURNING id, email, name, role, "platformId", "createdAt"`,
    [name, role, new Date(), userId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    role: r.role as string,
    platformId: r.platformId as string,
    createdAt: r.createdAt as Date,
  };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
