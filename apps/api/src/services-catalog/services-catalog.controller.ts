import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { CreateSubtaskTemplateDto, ReorderSubtaskTemplatesDto, UpdateSubtaskTemplateDto } from './dto/subtask-template.dto';
import { ServiceCatalog } from './service-catalog.entity';
import { ServiceSubtaskTemplate } from './service-subtask-template.entity';
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

  // ── Subtask Templates ────────────────────────────────────────────────────
  @Get(':id/subtask-templates')
  @Permissions('service.view')
  async listTemplates(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<ServiceSubtaskTemplate[]> {
    return this.servicesCatalogService.listTemplates(user.firmId, id);
  }

  @Post(':id/subtask-templates')
  @Permissions('service.create')
  async createTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateSubtaskTemplateDto,
  ): Promise<ServiceSubtaskTemplate> {
    return this.servicesCatalogService.createTemplate(user.firmId, id, dto, user.id);
  }

  @Patch(':id/subtask-templates/:templateId')
  @Permissions('service.create')
  async updateTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateSubtaskTemplateDto,
  ): Promise<ServiceSubtaskTemplate> {
    return this.servicesCatalogService.updateTemplate(user.firmId, id, templateId, dto, user.id);
  }

  @Delete(':id/subtask-templates/:templateId')
  @Permissions('service.create')
  async deleteTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('templateId') templateId: string,
  ): Promise<{ deleted: boolean }> {
    await this.servicesCatalogService.deleteTemplate(user.firmId, id, templateId);
    return { deleted: true };
  }

  @Patch(':id/subtask-templates-reorder')
  @Permissions('service.create')
  async reorderTemplates(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReorderSubtaskTemplatesDto,
  ): Promise<ServiceSubtaskTemplate[]> {
    return this.servicesCatalogService.reorderTemplates(user.firmId, id, dto, user.id);
  }
}
