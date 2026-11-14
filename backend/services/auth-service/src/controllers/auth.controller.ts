import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { SignupSchema, LoginSchema, RefreshSchema, UpdateProfileSchema } from '../middleware/validate.js';

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const parsed = SignupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const result = await AuthService.register(parsed.data);
      return res.status(201).json({
        success: true,
        message: 'Officer registered successfully',
        data: result,
      });
    } catch (err: any) {
      if (err.message && err.message.startsWith('DUPLICATE')) {
        return res.status(409).json({ success: false, error: err.message });
      }
      console.error('[Signup Error]', err);
      return res.status(500).json({ success: false, error: 'Internal server error during registration.' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const result = await AuthService.login(parsed.data.login_id, parsed.data.password);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (err: any) {
      if (err.message && (err.message.startsWith('INVALID_CREDENTIALS') || err.message.startsWith('ACCOUNT_DEACTIVATED'))) {
        return res.status(401).json({ success: false, error: err.message });
      }
      console.error('[Login Error]', err);
      return res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const parsed = RefreshSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const tokens = await AuthService.refresh(parsed.data.refreshToken);
      return res.status(200).json({
        success: true,
        message: 'Tokens rotated successfully',
        data: tokens,
      });
    } catch (err: any) {
      if (err.message && err.message.startsWith('INVALID_REFRESH_TOKEN')) {
        return res.status(401).json({ success: false, error: err.message });
      }
      console.error('[Refresh Error]', err);
      return res.status(500).json({ success: false, error: 'Internal server error during token refresh.' });
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      // Extracted from gateway header or JWT auth
      const officerId = req.headers['x-officer-id'] as string;
      if (!officerId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: missing officer ID' });
      }

      const profile = await AuthService.getProfile(officerId);
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err: any) {
      if (err.message === 'OFFICER_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'Officer profile not found.' });
      }
      console.error('[Profile Error]', err);
      return res.status(500).json({ success: false, error: 'Internal server error retrieving profile.' });
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const officerId = req.headers['x-officer-id'] as string;
      if (!officerId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: missing officer ID' });
      }

      const parsed = UpdateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const updated = await AuthService.updateProfile(officerId, parsed.data);
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updated,
      });
    } catch (err: any) {
      console.error('[Update Profile Error]', err);
      return res.status(500).json({ success: false, error: 'Internal server error updating profile.' });
    }
  }
}
