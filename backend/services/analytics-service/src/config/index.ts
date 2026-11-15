import dotenv from 'dotenv';
import path from 'path';

// Load root .env
dotenv.config({ path: path.resolve(process.cwd(), '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.ANALYTICS_PORT || '5004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.ANALYTICS_DB_URL ||
    process.env.DATABASE_URL_ANALYTICS ||
    'postgresql://localhost:5432/crashscribe_analytics',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  useRabbitMQ: process.env.USE_RABBITMQ === 'true',
};
