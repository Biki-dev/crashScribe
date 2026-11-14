"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_js_1 = require("../controllers/auth.controller.js");
exports.authRouter = (0, express_1.Router)();
// Public routes
exports.authRouter.post('/signup', auth_controller_js_1.AuthController.signup);
exports.authRouter.post('/login', auth_controller_js_1.AuthController.login);
exports.authRouter.post('/refresh', auth_controller_js_1.AuthController.refresh);
// Protected routes (Gateway injects X-Officer-ID or local JWT check)
exports.authRouter.get('/profile', auth_controller_js_1.AuthController.getProfile);
exports.authRouter.put('/profile', auth_controller_js_1.AuthController.updateProfile);
