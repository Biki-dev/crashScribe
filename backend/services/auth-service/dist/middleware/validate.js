"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProfileSchema = exports.RefreshSchema = exports.LoginSchema = exports.SignupSchema = void 0;
const zod_1 = require("zod");
exports.SignupSchema = zod_1.z.object({
    official_id: zod_1.z.string().min(3, 'Official ID must be at least 3 characters').max(50),
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(150),
    email: zod_1.z.string().email('Invalid email address').optional().nullable(),
    phone: zod_1.z.string().min(10, 'Phone must be at least 10 digits').max(20),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    district: zod_1.z.string().min(2, 'District is required').max(100),
    police_station: zod_1.z.string().min(2, 'Police station is required').max(100),
    designation: zod_1.z.string().min(2, 'Designation is required').max(100),
    role: zod_1.z.enum(['OFFICER', 'DISTRICT_SP', 'SUPER_ADMIN']).default('OFFICER').optional(),
});
exports.LoginSchema = zod_1.z.object({
    login_id: zod_1.z.string().min(1, 'Badge ID, Phone, or Email is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.RefreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.UpdateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(150).optional(),
    email: zod_1.z.string().email().optional().nullable(),
    phone: zod_1.z.string().min(10).max(20).optional(),
    designation: zod_1.z.string().min(2).max(100).optional(),
    police_station: zod_1.z.string().min(2).max(100).optional(),
});
