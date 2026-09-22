import type { FastifyRequest, FastifyReply } from 'fastify';
import { ChecklistService } from '../services/checklist.service.js';
import { VisitValidator } from '../validators/visit.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class ChecklistController {
  private readonly checklistService: ChecklistService;

  constructor(checklistService?: ChecklistService) {
    this.checklistService = checklistService ?? new ChecklistService();
  }

  public getAnswers = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };
    const answers = await this.checklistService.getAnswers(visitId, request.user);
    reply.send(ResponseUtil.success(answers));
  };

  public saveAnswer = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };
    const validated = VisitValidator.updateChecklistAnswerSchema.parse(request.body);

    const saved = await this.checklistService.saveAnswer(
      visitId,
      validated.sectionId,
      validated.fieldId,
      validated.value,
      validated.notes,
      request.user
    );

    reply.send(ResponseUtil.success(saved, 'Checklist answer saved'));
  };

  public batchSave = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };
    const validated = VisitValidator.batchUpdateChecklistSchema.parse(request.body);

    const savedList = await this.checklistService.batchSaveAnswers(
      visitId,
      validated.answers,
      request.user
    );

    reply.send(ResponseUtil.success(savedList, 'Batch checklist answers saved'));
  };
}

