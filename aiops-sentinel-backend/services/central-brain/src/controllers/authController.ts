import { Router } from 'express';
import type { Response } from 'express';
import { registerUser, loginUser, getUserById, updateUserProfile } from '../services/authService';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';

export const authRouter = Router();

authRouter.post('/register', async (req, res: Response) => {
  try {
    const { email, name, password, role } = req.body as {
      email?: string;
      name?: string;
      password?: string;
      role?: string;
    };
    if (!email || !name || !password) {
      res.status(400).json({ error: 'email, name, and password are required' });
      return;
    }
    const { user, token } = await registerUser(email, name, password, role);
    res.status(201).json({ user, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    const status = message === 'Email already registered' ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

authRouter.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const { user, token } = await loginUser(email, password);
    res.json({ user, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    res.status(401).json({ error: message });
  }
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.patch('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, role } = req.body as { name?: string; role?: string };
    if (!name?.trim() || !role?.trim()) {
      res.status(400).json({ error: 'name and role are required' });
      return;
    }
    const user = await updateUserProfile(req.user!.userId, name.trim(), role.trim());
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});
