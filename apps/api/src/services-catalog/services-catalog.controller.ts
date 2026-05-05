import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { ServiceCatalog } from './service-catalog.entity';
import { ServicesCatalogService } from './services-catalog.service';

@ApiTags('Services Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('services-catalog')
export class ServicesCatalogController {
  constructor(private readonly servicesCatalogService: ServicesCatalogService) {}

  @Get()
  @Permissions('service.view')
  async list(@CurrentUser() user: RequestUser): Promise<ServiceCatalog[]> {
    return this.servicesCatalogService.list(user.firmId);
  }

  @Post()
  @Permissions('service.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateServiceCatalogDto): Promise<ServiceCatalog> {
    return this.servicesCatalogService.create(user.firmId, dto, user.id);
  }

  @Patch(':id')
  @Permissions('service.create')
  async update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Partial<CreateServiceCatalogDto>): Promise<ServiceCatalog> {
    return this.servicesCatalogService.update(user.firmId, id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('service.create')
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<{ deleted: boolean }> {
    await this.servicesCatalogService.delete(user.firmId, id);
    return { deleted: true };
  }
}
