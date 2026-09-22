import type { FastifyRequest, FastifyReply } from 'fastify';
import { CompanyService } from '../services/company.service.js';
import { CompanyValidator } from '../validators/company.validator.js';
import { ResponseUtil } from '../utils/response.util.js';

export class CompanyController {
  private readonly companyService: CompanyService;

  constructor(companyService?: CompanyService) {
    this.companyService = companyService ?? new CompanyService();
  }

  public getTree = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const tree = await this.companyService.getCompanyTree();
    reply.send(ResponseUtil.success(tree));
  };

  public list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const companies = await this.companyService.getAllCompanies();
    reply.send(ResponseUtil.success(companies));
  };

  public getById = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const company = await this.companyService.getCompanyById(id);
    reply.send(ResponseUtil.success(company));
  };

  public create = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const validated = CompanyValidator.createCompanySchema.parse(request.body);
    const created = await this.companyService.createCompany({
      name: validated.name,
      parentId: validated.parentId,
      allowedEmailDomains: validated.allowedEmailDomains,
    });
    reply.status(201).send(ResponseUtil.success(created, 'Company created successfully'));
  };

  public update = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const validated = CompanyValidator.updateCompanySchema.parse(request.body);
    const updated = await this.companyService.updateCompany(id, validated);
    reply.send(ResponseUtil.success(updated, 'Company updated successfully'));
  };

  public delete = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    await this.companyService.deleteCompany(id);
    reply.send(ResponseUtil.success(null, 'Company deleted successfully'));
  };
}

