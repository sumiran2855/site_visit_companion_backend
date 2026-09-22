import type { FastifyRequest, FastifyReply } from 'fastify';
import { VisitService } from '../services/visit.service.js';
import { VisitValidator } from '../validators/visit.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class VisitController {
  private readonly visitService: VisitService;

  constructor(visitService?: VisitService) {
    this.visitService = visitService ?? new VisitService();
  }

  public list = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const query = request.query as { companyId?: string };
    const visits = await this.visitService.listVisits(request.user, query.companyId);
    reply.send(ResponseUtil.success(visits));
  };

  public getById = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { id } = request.params as { id: string };
    const visit = await this.visitService.getVisitById(id, request.user);
    reply.send(ResponseUtil.success(visit));
  };

  public create = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const validated = VisitValidator.createVisitSchema.parse(request.body);
    const created = await this.visitService.createVisit(
      {
        siteName: validated.siteName,
        companyId: validated.companyId,
      },
      request.user
    );
    reply.status(201).send(ResponseUtil.success(created, 'Site visit created successfully'));
  };

  public update = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { id } = request.params as { id: string };
    const validated = VisitValidator.updateVisitSchema.parse(request.body);
    const updated = await this.visitService.updateVisit(
      id,
      {
        siteName: validated.siteName,
        status: validated.status,
      },
      request.user
    );
    reply.send(ResponseUtil.success(updated, 'Visit updated successfully'));
  };

  public delete = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { id } = request.params as { id: string };
    await this.visitService.deleteVisit(id, request.user);
    reply.send(ResponseUtil.success(null, 'Visit deleted successfully'));
  };
}

