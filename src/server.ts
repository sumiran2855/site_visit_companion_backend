import 'dotenv/config';
import { App } from './app.js';
import { EnvConfig } from './config/env.config.js';
import { Logger } from './utils/logger.js';
import type { FastifyInstance } from 'fastify';

export class Server {
  private appInstance: FastifyInstance | null = null;
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('Server');
  }

  public async start(): Promise<void> {
    try {
      const config = EnvConfig.getInstance();
      const app = new App();
      this.appInstance = await app.build();

      const address = await this.appInstance.listen({
        port: config.port,
        host: '0.0.0.0',
      });

      this.logger.info(`Server listening at ${address}`);
      this.logger.info(`Swagger API Documentation available at ${address}/docs`);

      this.setupGracefulShutdown();
    } catch (err) {
      this.logger.error('Failed to start server', err);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    if (this.appInstance) {
      this.logger.info('Stopping server...');
      await this.appInstance.close();
      this.appInstance = null;
      this.logger.info('Server stopped gracefully');
    }
  }

  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, initiating shutdown...`);
        await this.stop();
        process.exit(0);
      });
    });
  }
}

// Start server if executed directly
const server = new Server();
server.start().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});

