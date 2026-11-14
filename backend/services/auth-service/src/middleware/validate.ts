import { z } from 'zod';

export const SignupSchema = z.object({
  official_id: z.string().min(3, 'Official ID must be at least 3 characters').max(50),
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  district: z.string().min(2, 'District is required').max(100),
  police_station: z.string().min(2, 'Police station is required').max(100),
  designation: z.string().min(2, 'Designation is required').max(100),
  role: z.enum(['OFFICER', 'DISTRICT_SP', 'SUPER_ADMIN']).default('OFFICER').optional(),
});

export const LoginSchema = z.object({
  login_id: z.string().min(1, 'Badge ID, Phone, or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10).max(20).optional(),
  designation: z.string().min(2).max(100).optional(),
  police_station: z.string().min(2).max(100).optional(),
});
