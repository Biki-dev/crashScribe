import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

export const authRouter = Router();

// Public routes
authRouter.post('/signup', AuthController.signup);
authRouter.post('/register', AuthController.signup);
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh', AuthController.refresh);

// Protected routes (Gateway injects X-Officer-ID or local JWT check)
authRouter.get('/profile', AuthController.getProfile);
authRouter.put('/profile', AuthController.updateProfile);
