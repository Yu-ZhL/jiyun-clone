import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:8080',
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser(process.env.COOKIE_SECRET));

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        success: true,
        data: {
          service: 'backend',
          database: 'ok',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: error.message
        }
      });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'API endpoint not found'
      }
    });
  });

  return app;
}
