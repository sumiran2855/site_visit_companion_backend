import type { FastifyRequest, FastifyReply } from 'fastify';
import { CompanyService, type CompanyTreeNode } from '../services/company.service.js';
import { CompanyValidator } from '../validators/company.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import type { ICompany } from '../types/models.js';

export class CompanyController {
  private readonly companyService: CompanyService;

  constructor(companyService?: CompanyService) {
    this.companyService = companyService ?? new CompanyService();
  }

  private sanitizeCompany(company: ICompany, isAdmin: boolean): ICompany {
    if (isAdmin) {
      return company;
    }
    return {
      ...company,
      allowedEmailDomains: (company.allowedEmailDomains || []).filter((d) => !d.includes('@')),
    };
  }

  private sanitizeTreeNode(node: CompanyTreeNode, isAdmin: boolean): CompanyTreeNode {
    return {
      ...this.sanitizeCompany(node, isAdmin),
      children: (node.children || []).map((c) => this.sanitizeTreeNode(c, isAdmin)),
    };
  }

  public getTree = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const isAdmin = request.user?.role === 'admin';
    const tree = await this.companyService.getCompanyTree();
    const sanitized = tree.map((node) => this.sanitizeTreeNode(node, isAdmin));
    reply.send(ResponseUtil.success(sanitized));
  };

  public list = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const isAdmin = request.user?.role === 'admin';
    const companies = await this.companyService.getAllCompanies();
    const sanitized = companies.map((c) => this.sanitizeCompany(c, isAdmin));
    reply.send(ResponseUtil.success(sanitized));
  };

  public getById = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const isAdmin = request.user?.role === 'admin';
    const { id } = request.params as { id: string };
    const company = await this.companyService.getCompanyById(id);
    reply.send(ResponseUtil.success(this.sanitizeCompany(company, isAdmin)));
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

