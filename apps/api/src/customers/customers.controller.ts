import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CustomersBulkService } from './customers.bulk';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly bulk: CustomersBulkService,
  ) {}

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

  // ── Bulk operations ─────────────────────────────────────────────────────
  @Get('bulk/template')
  @Permissions('customer.create')
  async downloadTemplate(@CurrentUser() user: RequestUser, @Res() res: Response): Promise<void> {
    const buf = await this.bulk.template(user.firmId);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="customers-template.xlsx"');
    res.send(buf);
  }

  @Get('bulk/export')
  @Permissions('customer.view')
  async exportData(@CurrentUser() user: RequestUser, @Res() res: Response): Promise<void> {
    const buf = await this.bulk.export(user.firmId);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  }

  @Post('bulk/import')
  @Permissions('customer.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importData(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: { buffer: Buffer; mimetype?: string; originalname?: string } | undefined,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('File is required (form field name: file)');
    }
    return this.bulk.import(user.firmId, user.id, file.buffer);
  }

  // ── CRUD by id ──────────────────────────────────────────────────────────
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
