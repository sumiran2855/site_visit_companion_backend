import type { IProfile } from './models.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: IProfile;
  }
}

