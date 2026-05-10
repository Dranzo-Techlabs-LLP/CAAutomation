import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { CreateSubtaskTemplateDto, ReorderSubtaskTemplatesDto, UpdateSubtaskTemplateDto } from './dto/subtask-template.dto';
import { RecurrenceDefault, ServiceCatalog } from './service-catalog.entity';
import { ServiceSubtaskTemplate } from './service-subtask-template.entity';
import { TaskPriority } from '../tasks/task.entity';

@Injectable()
export class ServicesCatalogService {
  constructor(
    @InjectRepository(ServiceCatalog)
    private readonly serviceRepository: Repository<ServiceCatalog>,
    @InjectRepository(ServiceSubtaskTemplate)
    private readonly templateRepository: Repository<ServiceSubtaskTemplate>,
  ) {}

  async create(firmId: string, dto: CreateServiceCatalogDto, actorUserId: string): Promise<ServiceCatalog> {
    const service = this.serviceRepository.create({
      ...dto,
      firmId,
      recurrenceDefault: dto.recurrenceDefault ?? RecurrenceDefault.None,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.serviceRepository.save(service);
  }

  async list(firmId: string): Promise<ServiceCatalog[]> {
    return this.serviceRepository.find({ where: { firmId }, order: { code: 'ASC' } });
  }

  async update(firmId: string, id: string, dto: Partial<CreateServiceCatalogDto>, actorUserId: string): Promise<ServiceCatalog> {
    const service = await this.serviceRepository.findOne({ where: { firmId, id } });
    if (!service) throw new NotFoundException('Service not found');
    Object.assign(service, dto);
    service.updatedBy = actorUserId;
    return this.serviceRepository.save(service);
  }

  async delete(firmId: string, id: string): Promise<void> {
    const service = await this.serviceRepository.findOne({ where: { firmId, id } });
    if (!service) throw new NotFoundException('Service not found');
    await this.serviceRepository.remove(service);
  }

  // ── Subtask Templates ──────────────────────────────────────────────────────
  async listTemplates(firmId: string, serviceId: string): Promise<ServiceSubtaskTemplate[]> {
    await this.assertServiceExists(firmId, serviceId);
    return this.templateRepository.find({
      where: { firmId, serviceId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createTemplate(firmId: string, serviceId: string, dto: CreateSubtaskTemplateDto, actorUserId: string): Promise<ServiceSubtaskTemplate> {
    await this.assertServiceExists(firmId, serviceId);
    const maxOrder = await this.templateRepository
      .createQueryBuilder('t')
      .where('t.firm_id = :firmId AND t.service_id = :serviceId', { firmId, serviceId })
      .select('MAX(t.sort_order)', 'max')
      .getRawOne<{ max: number | null }>();
    const next = (maxOrder?.max ?? -1) + 1;
    return this.templateRepository.save(
      this.templateRepository.create({
        firmId,
        serviceId,
        title: dto.title,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? next,
        estimatedHours: dto.estimatedHours ?? null,
        priority: dto.priority ?? TaskPriority.Medium,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
  }

  async updateTemplate(firmId: string, serviceId: string, templateId: string, dto: UpdateSubtaskTemplateDto, actorUserId: string): Promise<ServiceSubtaskTemplate> {
    const template = await this.templateRepository.findOne({ where: { firmId, serviceId, id: templateId } });
    if (!template) throw new NotFoundException('Subtask template not found');
    if (dto.title !== undefined) template.title = dto.title;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.sortOrder !== undefined) template.sortOrder = dto.sortOrder;
    if (dto.estimatedHours !== undefined) template.estimatedHours = dto.estimatedHours;
    if (dto.priority !== undefined) template.priority = dto.priority;
    template.updatedBy = actorUserId;
    return this.templateRepository.save(template);
  }

  async deleteTemplate(firmId: string, serviceId: string, templateId: string): Promise<void> {
    const template = await this.templateRepository.findOne({ where: { firmId, serviceId, id: templateId } });
    if (!template) throw new NotFoundException('Subtask template not found');
    await this.templateRepository.remove(template);
  }

  async reorderTemplates(firmId: string, serviceId: string, dto: ReorderSubtaskTemplatesDto, actorUserId: string): Promise<ServiceSubtaskTemplate[]> {
    await this.assertServiceExists(firmId, serviceId);
    for (let i = 0; i < dto.ids.length; i++) {
      await this.templateRepository.update(
        { firmId, serviceId, id: dto.ids[i] },
        { sortOrder: i, updatedBy: actorUserId },
      );
    }
    return this.listTemplates(firmId, serviceId);
  }

  private async assertServiceExists(firmId: string, serviceId: string): Promise<void> {
    const exists = await this.serviceRepository.exist({ where: { firmId, id: serviceId } });
    if (!exists) throw new NotFoundException('Service not found');
  }
}
