import type { FastifyRequest, FastifyReply } from 'fastify';
import { MediaService } from '../services/media.service.js';
import { MediaValidator } from '../validators/media.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class MediaController {
  private readonly mediaService: MediaService;

  constructor(mediaService?: MediaService) {
    this.mediaService = mediaService ?? new MediaService();
  }

  public requestUploadUrl = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const validated = MediaValidator.requestUploadUrlSchema.parse(request.body);

    const result = await this.mediaService.requestUploadUrl(
      {
        visitId: validated.visitId,
        sectionId: validated.sectionId,
        fieldId: validated.fieldId,
        fileName: validated.fileName,
        contentType: validated.contentType,
        type: validated.type,
      },
      request.user
    );

    reply.send(ResponseUtil.success(result, 'Presigned upload URL generated'));
  };

  public confirmUpload = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const validated = MediaValidator.confirmUploadSchema.parse(request.body);

    const media = await this.mediaService.confirmUpload(
      {
        visitId: validated.visitId,
        sectionId: validated.sectionId,
        fieldId: validated.fieldId,
        fileName: validated.fileName,
        fileSize: validated.fileSize,
        storageKey: validated.storageKey,
        type: validated.type,
        notes: validated.notes,
      },
      request.user
    );

    reply.status(201).send(ResponseUtil.success(media, 'Media successfully linked to visit field'));
  };

  public listMedia = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };
    const media = await this.mediaService.getMediaByVisit(visitId, request.user);
    reply.send(ResponseUtil.success(media));
  };

  public deleteMedia = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { id } = request.params as { id: string };
    await this.mediaService.deleteMedia(id, request.user);
    reply.send(ResponseUtil.success(null, 'Media deleted successfully'));
  };
}

