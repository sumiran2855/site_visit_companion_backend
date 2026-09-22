import type { FastifyRequest, FastifyReply } from 'fastify';
import { ShareService } from '../services/share.service.js';
import { VisitValidator } from '../validators/visit.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class ShareController {
  private readonly shareService: ShareService;

  constructor(shareService?: ShareService) {
    this.shareService = shareService ?? new ShareService();
  }

  public createShareToken = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };
    const validated = VisitValidator.createShareTokenSchema.parse(request.body || {});

    const token = await this.shareService.createShareToken(
      visitId,
      validated.expiresInDays,
      request.user
    );

    reply.status(201).send(ResponseUtil.success(token, 'Share token created'));
  };

  public getSharedVisit = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { token } = request.params as { token: string };
    const result = await this.shareService.getSharedVisit(token);
    reply.send(ResponseUtil.success(result));
  };
}

