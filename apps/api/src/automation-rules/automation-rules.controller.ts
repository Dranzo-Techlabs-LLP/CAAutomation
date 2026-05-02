import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { AutomationRule } from './automation-rule.entity';
import { AutomationRulesService } from './automation-rules.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

@ApiTags('Automation Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('automation-rules')
export class AutomationRulesController {
  constructor(private readonly automationRulesService: AutomationRulesService) {}

  @Get()
  @Permissions('workflow.view')
  async list(@CurrentUser() user: RequestUser): Promise<AutomationRule[]> {
    return this.automationRulesService.list(user.firmId);
  }

  @Get(':id')
  @Permissions('workflow.view')
  async getOne(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<AutomationRule> {
    return this.automationRulesService.getOne(user.firmId, id);
  }

  @Post()
  @Permissions('workflow.manage')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateAutomationRuleDto): Promise<AutomationRule> {
    return this.automationRulesService.create(user.firmId, dto, user.id);
  }

  @Patch(':id')
  @Permissions('workflow.manage')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ): Promise<AutomationRule> {
    return this.automationRulesService.update(user.firmId, id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('workflow.manage')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<{ message: string }> {
    await this.automationRulesService.remove(user.firmId, id);
    return { message: 'Automation rule deleted' };
  }
}
