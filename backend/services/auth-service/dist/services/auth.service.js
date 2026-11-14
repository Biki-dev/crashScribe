"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../config/db.js");
const index_js_1 = require("../config/index.js");
const SALT_ROUNDS = 12;
class AuthService {
    /**
     * Hashes password using bcrypt with cost factor 12
     */
    static async hashPassword(password) {
        return bcrypt_1.default.hash(password, SALT_ROUNDS);
    }
    /**
     * Verifies password against hash
     */
    static async verifyPassword(password, hash) {
        return bcrypt_1.default.compare(password, hash);
    }
    /**
     * Generates JWT Access Token (15m) and Refresh Token (30d)
     */
    static generateTokens(officer) {
        const payload = {
            officer_id: officer.id,
            official_id: officer.official_id,
            district: officer.district,
            police_station: officer.police_station,
            role: officer.role,
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, index_js_1.config.jwtSecret, {
            expiresIn: index_js_1.config.jwtExpiration,
        });
        const refreshTokenRaw = crypto_1.default.randomBytes(40).toString('hex');
        const refreshTokenHash = crypto_1.default.createHash('sha256').update(refreshTokenRaw).digest('hex');
        return {
            accessToken,
            refreshToken: refreshTokenRaw,
            refreshTokenHash,
        };
    }
    /**
     * Registers a new officer with duplicate badge/phone check
     */
    static async register(data) {
        // 1. Check duplicate official_id or phone
        const existingCheck = await (0, db_js_1.query)(`SELECT id, official_id, phone FROM officers WHERE official_id = $1 OR phone = $2 LIMIT 1`, [data.official_id, data.phone]);
        if (existingCheck.rows.length > 0) {
            const match = existingCheck.rows[0];
            if (match.official_id === data.official_id) {
                throw new Error('DUPLICATE_BADGE_ID: An officer with this official ID is already registered.');
            }
            throw new Error('DUPLICATE_PHONE: This mobile number is already registered.');
        }
        // 2. Hash password with bcrypt cost 12
        const password_hash = await this.hashPassword(data.password);
        const role = data.role || 'OFFICER';
        // 3. Insert record
        const insertResult = await (0, db_js_1.query)(`INSERT INTO officers (
        official_id, name, email, phone, password_hash, district, police_station, designation, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, official_id, name, email, phone, district, police_station, designation, role, is_active, created_at, updated_at`, [
            data.official_id,
            data.name,
            data.email || null,
            data.phone,
            password_hash,
            data.district,
            data.police_station,
            data.designation,
            role,
        ]);
        const officer = insertResult.rows[0];
        // 4. Generate and store tokens
        const tokens = this.generateTokens(officer);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await (0, db_js_1.query)(`INSERT INTO refresh_tokens (officer_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [officer.id, tokens.refreshTokenHash, expiresAt]);
        return {
            officer,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    /**
     * Authenticates an officer by badge ID, phone, or email
     */
    static async login(loginId, password) {
        const result = await (0, db_js_1.query)(`SELECT * FROM officers WHERE official_id = $1 OR phone = $1 OR email = $1 LIMIT 1`, [loginId]);
        if (result.rows.length === 0) {
            throw new Error('INVALID_CREDENTIALS: Incorrect official ID, phone, or password.');
        }
        const officer = result.rows[0];
        if (!officer.is_active) {
            throw new Error('ACCOUNT_DEACTIVATED: This officer account is deactivated. Contact district admin.');
        }
        const passwordValid = await this.verifyPassword(password, officer.password_hash);
        if (!passwordValid) {
            throw new Error('INVALID_CREDENTIALS: Incorrect official ID, phone, or password.');
        }
        const { password_hash, ...safeOfficer } = officer;
        const tokens = this.generateTokens(safeOfficer);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await (0, db_js_1.query)(`INSERT INTO refresh_tokens (officer_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [safeOfficer.id, tokens.refreshTokenHash, expiresAt]);
        return {
            officer: safeOfficer,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    /**
     * Rotates refresh token and generates a new access token
     */
    static async refresh(refreshTokenRaw) {
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshTokenRaw).digest('hex');
        const result = await (0, db_js_1.query)(`SELECT rt.*, o.id as officer_id, o.official_id, o.name, o.district, o.police_station, o.role, o.is_active
       FROM refresh_tokens rt
       JOIN officers o ON o.id = rt.officer_id
       WHERE rt.token_hash = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW() LIMIT 1`, [tokenHash]);
        if (result.rows.length === 0) {
            throw new Error('INVALID_REFRESH_TOKEN: Token is invalid, expired, or revoked.');
        }
        const record = result.rows[0];
        if (!record.is_active) {
            throw new Error('ACCOUNT_DEACTIVATED: Officer account is deactivated.');
        }
        // Revoke current refresh token (rotation)
        await (0, db_js_1.query)(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [record.id]);
        const safeOfficer = {
            id: record.officer_id,
            official_id: record.official_id,
            name: record.name,
            email: null,
            phone: '',
            district: record.district,
            police_station: record.police_station,
            designation: '',
            role: record.role,
            is_active: record.is_active,
            created_at: new Date(),
            updated_at: new Date(),
        };
        const tokens = this.generateTokens(safeOfficer);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await (0, db_js_1.query)(`INSERT INTO refresh_tokens (officer_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [safeOfficer.id, tokens.refreshTokenHash, expiresAt]);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    /**
     * Retrieves profile by officer ID
     */
    static async getProfile(officerId) {
        const result = await (0, db_js_1.query)(`SELECT id, official_id, name, email, phone, district, police_station, designation, role, is_active, created_at, updated_at
       FROM officers WHERE id = $1 LIMIT 1`, [officerId]);
        if (result.rows.length === 0) {
            throw new Error('OFFICER_NOT_FOUND');
        }
        return result.rows[0];
    }
    /**
     * Updates officer profile
     */
    static async updateProfile(officerId, updates) {
        const fields = [];
        const values = [];
        let idx = 1;
        if (updates.name) {
            fields.push(`name = $${idx++}`);
            values.push(updates.name);
        }
        if (updates.email !== undefined) {
            fields.push(`email = $${idx++}`);
            values.push(updates.email);
        }
        if (updates.phone) {
            fields.push(`phone = $${idx++}`);
            values.push(updates.phone);
        }
        if (updates.designation) {
            fields.push(`designation = $${idx++}`);
            values.push(updates.designation);
        }
        if (updates.police_station) {
            fields.push(`police_station = $${idx++}`);
            values.push(updates.police_station);
        }
        if (fields.length === 0) {
            return this.getProfile(officerId);
        }
        fields.push(`updated_at = NOW()`);
        values.push(officerId);
        const queryStr = `
      UPDATE officers SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, official_id, name, email, phone, district, police_station, designation, role, is_active, created_at, updated_at
    `;
        const result = await (0, db_js_1.query)(queryStr, values);
        return result.rows[0];
    }
}
exports.AuthService = AuthService;
