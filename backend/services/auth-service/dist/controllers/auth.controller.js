"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_js_1 = require("../services/auth.service.js");
const validate_js_1 = require("../middleware/validate.js");
class AuthController {
    static async signup(req, res) {
        try {
            const parsed = validate_js_1.SignupSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: parsed.error.errors,
                });
            }
            const result = await auth_service_js_1.AuthService.register(parsed.data);
            return res.status(201).json({
                success: true,
                message: 'Officer registered successfully',
                data: result,
            });
        }
        catch (err) {
            if (err.message && err.message.startsWith('DUPLICATE')) {
                return res.status(409).json({ success: false, error: err.message });
            }
            console.error('[Signup Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error during registration.' });
        }
    }
    static async login(req, res) {
        try {
            const parsed = validate_js_1.LoginSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: parsed.error.errors,
                });
            }
            const result = await auth_service_js_1.AuthService.login(parsed.data.login_id, parsed.data.password);
            return res.status(200).json({
                success: true,
                message: 'Login successful',
                data: result,
            });
        }
        catch (err) {
            if (err.message && (err.message.startsWith('INVALID_CREDENTIALS') || err.message.startsWith('ACCOUNT_DEACTIVATED'))) {
                return res.status(401).json({ success: false, error: err.message });
            }
            console.error('[Login Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
        }
    }
    static async refresh(req, res) {
        try {
            const parsed = validate_js_1.RefreshSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: parsed.error.errors,
                });
            }
            const tokens = await auth_service_js_1.AuthService.refresh(parsed.data.refreshToken);
            return res.status(200).json({
                success: true,
                message: 'Tokens rotated successfully',
                data: tokens,
            });
        }
        catch (err) {
            if (err.message && err.message.startsWith('INVALID_REFRESH_TOKEN')) {
                return res.status(401).json({ success: false, error: err.message });
            }
            console.error('[Refresh Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error during token refresh.' });
        }
    }
    static async getProfile(req, res) {
        try {
            // Extracted from gateway header or JWT auth
            const officerId = req.headers['x-officer-id'];
            if (!officerId) {
                return res.status(401).json({ success: false, error: 'Unauthorized: missing officer ID' });
            }
            const profile = await auth_service_js_1.AuthService.getProfile(officerId);
            return res.status(200).json({
                success: true,
                data: profile,
            });
        }
        catch (err) {
            if (err.message === 'OFFICER_NOT_FOUND') {
                return res.status(404).json({ success: false, error: 'Officer profile not found.' });
            }
            console.error('[Profile Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error retrieving profile.' });
        }
    }
    static async updateProfile(req, res) {
        try {
            const officerId = req.headers['x-officer-id'];
            if (!officerId) {
                return res.status(401).json({ success: false, error: 'Unauthorized: missing officer ID' });
            }
            const parsed = validate_js_1.UpdateProfileSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: parsed.error.errors,
                });
            }
            const updated = await auth_service_js_1.AuthService.updateProfile(officerId, parsed.data);
            return res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: updated,
            });
        }
        catch (err) {
            console.error('[Update Profile Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error updating profile.' });
        }
    }
}
exports.AuthController = AuthController;
