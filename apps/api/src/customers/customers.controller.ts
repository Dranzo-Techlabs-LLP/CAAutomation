import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

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

  @Patch(':id')
  @Permissions('customer.edit')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.update(user.firmId, id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('customer.delete')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.customersService.remove(user.firmId, id);
  }
}
