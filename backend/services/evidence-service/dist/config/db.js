"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.pool = void 0;
const pg_1 = __importDefault(require("pg"));
const index_js_1 = require("./index.js");
const { Pool } = pg_1.default;
exports.pool = new Pool({
    connectionString: index_js_1.config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
exports.pool.on('error', (err) => {
    console.error('[Evidence DB Pool Error]', err);
});
const query = (text, params) => exports.pool.query(text, params);
exports.query = query;
