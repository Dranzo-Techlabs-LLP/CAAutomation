import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer, CustomerStatus } from './customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async create(firmId: string, dto: CreateCustomerDto, actorUserId: string): Promise<CustomerResponseDto> {
    const customer = this.customerRepository.create({
      ...dto,
      firmId,
      ownerUserId: dto.ownerUserId ?? actorUserId,
      status: dto.status ?? CustomerStatus.Enquiry,
      onboardedAt:
        dto.status === CustomerStatus.Onboarded || dto.status === CustomerStatus.Active
          ? new Date()
          : null,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.toResponse(await this.customerRepository.save(customer));
  }

  async list(firmId: string): Promise<CustomerResponseDto[]> {
    // Return the firm's FULL customer list — this feeds every customer dropdown
    // (task creation, invoices, advices, recurrences…) and the id→name maps used
    // to label existing records. The previous take:100 (updatedAt DESC) silently
    // hid older clients from those pickers and made old tasks show a blank
    // customer even though the record still existed. Customer counts per firm are
    // bounded; the high ceiling is just a runaway guard.
    const customers = await this.customerRepository.find({
      where: { firmId },
      order: { name: 'ASC' },
      take: 5000,
    });
    return customers.map((customer) => this.toResponse(customer));
  }

  async getEntityOrFail(firmId: string, id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { firmId, id } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async getOne(firmId: string, id: string): Promise<CustomerResponseDto> {
    return this.toResponse(await this.getEntityOrFail(firmId, id));
  }

  async update(firmId: string, id: string, dto: UpdateCustomerDto, actorUserId: string): Promise<CustomerResponseDto> {
    const customer = await this.getEntityOrFail(firmId, id);
    if (dto.name !== undefined) customer.name = dto.name;
    if (dto.type !== undefined) customer.type = dto.type;
    if (dto.email !== undefined) customer.email = dto.email ?? null;
    if (dto.contactNo !== undefined) customer.contactNo = dto.contactNo ?? null;
    if (dto.gstin !== undefined) customer.gstin = dto.gstin ?? null;
    if (dto.pan !== undefined) customer.pan = dto.pan ?? null;
    if (dto.address !== undefined) customer.address = dto.address ?? null;
    if (dto.enquirySource !== undefined) customer.enquirySource = dto.enquirySource;
    if (dto.status !== undefined) {
      // Capture onboarding moment if status transitions into onboarded/active for the first time.
      if (
        !customer.onboardedAt &&
        (dto.status === CustomerStatus.Onboarded || dto.status === CustomerStatus.Active)
      ) {
        customer.onboardedAt = new Date();
      }
      customer.status = dto.status;
    }
    if (dto.briefText !== undefined) customer.briefText = dto.briefText ?? null;
    if (dto.requirementsJson !== undefined) customer.requirementsJson = dto.requirementsJson;
    if (dto.ownerUserId !== undefined) customer.ownerUserId = dto.ownerUserId ?? null;
    if (dto.defaultTeamId !== undefined) customer.defaultTeamId = dto.defaultTeamId ?? null;
    customer.updatedBy = actorUserId;
    return this.toResponse(await this.customerRepository.save(customer));
  }

  async remove(firmId: string, id: string): Promise<void> {
    const customer = await this.getEntityOrFail(firmId, id);
    await this.customerRepository.remove(customer);
  }

  async markOnboarded(firmId: string, id: string, actorUserId: string): Promise<Customer> {
    const customer = await this.getEntityOrFail(firmId, id);
    customer.status = CustomerStatus.Active;
    customer.onboardedAt = new Date();
    customer.updatedBy = actorUserId;
    return this.customerRepository.save(customer);
  }

  toResponse(customer: Customer): CustomerResponseDto {
    return {
      id: customer.id,
      firmId: customer.firmId,
      type: customer.type,
      name: customer.name,
      contactNo: customer.contactNo,
      email: customer.email,
      gstin: customer.gstin,
      pan: customer.pan,
      address: customer.address,
      enquirySource: customer.enquirySource,
      status: customer.status,
      briefText: customer.briefText,
      requirementsJson: customer.requirementsJson,
      ownerUserId: customer.ownerUserId,
      defaultTeamId: customer.defaultTeamId,
      onboardedAt: customer.onboardedAt,
    };
  }
}
