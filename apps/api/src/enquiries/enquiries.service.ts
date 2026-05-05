import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomersService } from '../customers/customers.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { EnquiryResponseDto } from './dto/enquiry-response.dto';
import { UpdateEnquiryStatusDto } from './dto/update-enquiry-status.dto';
import { Enquiry, EnquiryStatus } from './enquiry.entity';

@Injectable()
export class EnquiriesService {
  constructor(
    @InjectRepository(Enquiry)
    private readonly enquiryRepository: Repository<Enquiry>,
    private readonly customersService: CustomersService,
    private readonly tasksService: TasksService,
  ) {}

  async create(firmId: string, dto: CreateEnquiryDto, actorUserId: string): Promise<EnquiryResponseDto> {
    await this.customersService.getEntityOrFail(firmId, dto.customerId);
    const enquiry = this.enquiryRepository.create({
      ...dto,
      firmId,
      status: EnquiryStatus.Open,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.toResponse(await this.enquiryRepository.save(enquiry));
  }

  async list(firmId: string): Promise<EnquiryResponseDto[]> {
    const enquiries = await this.enquiryRepository.find({
      where: { firmId },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    return enquiries.map((enquiry) => this.toResponse(enquiry));
  }

  async update(
    firmId: string,
    id: string,
    dto: UpdateEnquiryDto,
    actorUserId: string,
  ): Promise<EnquiryResponseDto> {
    const enquiry = await this.enquiryRepository.findOne({ where: { firmId, id } });
    if (!enquiry) throw new NotFoundException('Enquiry not found');

    if (dto.brief !== undefined) enquiry.brief = dto.brief;
    if (dto.source !== undefined) enquiry.source = dto.source;
    if (dto.proposalAmount !== undefined) enquiry.proposalAmount = dto.proposalAmount;
    if (dto.proposalDocUrl !== undefined) enquiry.proposalDocUrl = dto.proposalDocUrl;
    if (dto.requirementsJson !== undefined) enquiry.requirementsJson = dto.requirementsJson;
    if (dto.referralName !== undefined) enquiry.referralName = dto.referralName;
    if (dto.referralContact !== undefined) enquiry.referralContact = dto.referralContact;
    if (dto.referralDetails !== undefined) enquiry.referralDetails = dto.referralDetails;
    if (dto.serviceId !== undefined) enquiry.serviceId = dto.serviceId;

    // Handle status change including auto-convert
    if (dto.status !== undefined) {
      if (dto.status === EnquiryStatus.Converted) {
        if (enquiry.status === EnquiryStatus.Lost) {
          throw new BadRequestException('Lost enquiries cannot be converted');
        }
        await this.customersService.markOnboarded(firmId, enquiry.customerId, actorUserId);
        enquiry.convertedAt = new Date();
        // Auto-create task on conversion
        try {
          await this.tasksService.create(firmId, {
            customerId: enquiry.customerId,
            title: `Enquiry: ${enquiry.brief || 'New engagement'}`,
            description: enquiry.brief || undefined,
            serviceId: enquiry.serviceId || undefined,
          }, actorUserId);
        } catch {
          // Don't fail enquiry conversion if task creation fails
        }
      }
      enquiry.status = dto.status;
    }

    enquiry.updatedBy = actorUserId;
    return this.toResponse(await this.enquiryRepository.save(enquiry));
  }

  async updateStatus(
    firmId: string,
    id: string,
    dto: UpdateEnquiryStatusDto,
    actorUserId: string,
  ): Promise<EnquiryResponseDto> {
    const enquiry = await this.enquiryRepository.findOne({ where: { firmId, id } });
    if (!enquiry) {
      throw new NotFoundException('Enquiry not found');
    }

    if (dto.status === EnquiryStatus.Converted) {
      if (enquiry.status === EnquiryStatus.Lost) {
        throw new BadRequestException('Lost enquiries cannot be converted');
      }
      await this.customersService.markOnboarded(firmId, enquiry.customerId, actorUserId);
      enquiry.convertedAt = new Date();
      // Auto-create task on conversion
      try {
        await this.tasksService.create(firmId, {
          customerId: enquiry.customerId,
          title: `Enquiry: ${enquiry.brief || 'New engagement'}`,
          description: enquiry.brief || undefined,
          serviceId: enquiry.serviceId || undefined,
        }, actorUserId);
      } catch {
        // Don't fail enquiry conversion if task creation fails
      }
    }

    enquiry.status = dto.status;
    enquiry.proposalAmount = dto.proposalAmount ?? enquiry.proposalAmount;
    enquiry.proposalDocUrl = dto.proposalDocUrl ?? enquiry.proposalDocUrl;
    enquiry.lostReason = dto.lostReason ?? enquiry.lostReason;
    enquiry.updatedBy = actorUserId;

    return this.toResponse(await this.enquiryRepository.save(enquiry));
  }

  async delete(firmId: string, id: string): Promise<void> {
    const enquiry = await this.enquiryRepository.findOne({ where: { firmId, id } });
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    await this.enquiryRepository.remove(enquiry);
  }

  private toResponse(enquiry: Enquiry): EnquiryResponseDto {
    return {
      id: enquiry.id,
      firmId: enquiry.firmId,
      customerId: enquiry.customerId,
      source: enquiry.source,
      brief: enquiry.brief,
      status: enquiry.status,
      proposalAmount: enquiry.proposalAmount,
      proposalDocUrl: enquiry.proposalDocUrl,
      lostReason: enquiry.lostReason,
      convertedAt: enquiry.convertedAt,
      serviceId: enquiry.serviceId,
      referralName: enquiry.referralName,
      referralContact: enquiry.referralContact,
      referralDetails: enquiry.referralDetails,
    };
  }
}
