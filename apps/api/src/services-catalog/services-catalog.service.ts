import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { RecurrenceDefault, ServiceCatalog } from './service-catalog.entity';

@Injectable()
export class ServicesCatalogService {
  constructor(
    @InjectRepository(ServiceCatalog)
    private readonly serviceRepository: Repository<ServiceCatalog>,
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
}
