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
      status: CustomerStatus.Enquiry,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.toResponse(await this.customerRepository.save(customer));
  }

  async list(firmId: string): Promise<CustomerResponseDto[]> {
    const customers = await this.customerRepository.find({
      where: { firmId },
      order: { updatedAt: 'DESC' },
      take: 100,
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
    if (dto.email !== undefined) customer.email = dto.email;
    if (dto.contactNo !== undefined) customer.contactNo = dto.contactNo;
    if (dto.gstin !== undefined) customer.gstin = dto.gstin;
    if (dto.pan !== undefined) customer.pan = dto.pan;
    if (dto.address !== undefined) customer.address = dto.address;
    if (dto.status !== undefined) customer.status = dto.status;
    if (dto.ownerUserId !== undefined) customer.ownerUserId = dto.ownerUserId;
    if (dto.defaultTeamId !== undefined) customer.defaultTeamId = dto.defaultTeamId;
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
      ownerUserId: customer.ownerUserId,
      defaultTeamId: customer.defaultTeamId,
      onboardedAt: customer.onboardedAt,
    };
  }
}
