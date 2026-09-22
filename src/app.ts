import Fastify, { type FastifyInstance, type FastifyError, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';

import { EnvConfig } from './config/env.config.js';
import { APP_CONSTANTS } from './config/constants.js';
import { AppError } from './errors/app.error.js';
import { AppRouter } from './routes/index.js';
import { ResponseUtil } from './utils/response.util.js';
import { Logger } from './utils/logger.js';

export class App {
  private readonly fastify: FastifyInstance;
  private readonly logger: Logger;
  private readonly config: EnvConfig;

  constructor() {
    this.logger = new Logger('App');
    this.config = EnvConfig.getInstance();
    this.fastify = Fastify({
      logger: !this.config.isProduction,
    });
  }

  public async build(): Promise<FastifyInstance> {
    await this.registerPlugins();
    this.registerErrorHandler();
    await this.registerRoutes();
    return this.fastify;
  }

  private async registerPlugins(): Promise<void> {
    // 1. CORS
    await this.fastify.register(cors, {
      origin: [this.config.frontendUrl, 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    // 2. Helmet Security Headers
    await this.fastify.register(helmet, {
      contentSecurityPolicy: false, // Allows swagger and iframe/pdf embeds if needed
    });

    // 3. Rate Limiting
    await this.fastify.register(rateLimit, {
      max: APP_CONSTANTS.DEFAULT_RATE_LIMIT_MAX,
      timeWindow: APP_CONSTANTS.DEFAULT_RATE_LIMIT_TIME_WINDOW,
    });

    // 4. Multipart support
    await this.fastify.register(multipart, {
      limits: {
        fileSize: APP_CONSTANTS.MAX_FILE_SIZE_BYTES,
      },
    });

    // 5. Swagger Documentation
    await this.fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Site Visit Companion API',
          description: 'REST API for EC Power Site Visit Companion technician application',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${this.config.port}`,
            description: 'Local development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await this.fastify.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }

  private registerErrorHandler(): void {
    this.fastify.setErrorHandler((error: FastifyError | AppError | ZodError | Error, _request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof ZodError) {
        return reply.status(400).send(ResponseUtil.error('Validation error', error.format()));
      }

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(ResponseUtil.error(error.message));
      }

      const statusCode = (error as FastifyError).statusCode || 500;
      this.logger.error('Unhandled server error', error);

      return reply.status(statusCode).send(
        ResponseUtil.error(
          this.config.isProduction ? 'Internal Server Error' : error.message
        )
      );
    });
  }

  private async registerRoutes(): Promise<void> {
    await AppRouter.registerRoutes(this.fastify);
  }

  public getFastifyInstance(): FastifyInstance {
    return this.fastify;
  }
}

