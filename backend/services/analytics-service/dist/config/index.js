"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load root .env
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.ANALYTICS_PORT || '5004', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.ANALYTICS_DB_URL ||
        process.env.DATABASE_URL_ANALYTICS ||
        'postgresql://localhost:5432/crashscribe_analytics',
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    useRabbitMQ: process.env.USE_RABBITMQ === 'true',
};
