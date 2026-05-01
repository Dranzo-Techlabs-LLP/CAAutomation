import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions('customer.view')
  async list(@CurrentUser() user: RequestUser): Promise<CustomerResponseDto[]> {
    return this.customersService.list(user.firmId);
  }

  @Post()
  @Permissions('customer.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    return this.customersService.create(user.firmId, dto, user.id);
  }

  @Get(':id')
  @Permissions('customer.view')
  async getOne(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<CustomerResponseDto> {
    return this.customersService.getOne(user.firmId, id);
  }
}
