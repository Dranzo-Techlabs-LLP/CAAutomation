import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { statutoryRecurrenceTemplates } from '../seeds/statutory-recurrence-templates';
import { CreateRecurrenceDto } from './dto/create-recurrence.dto';
import { UpdateRecurrenceDto } from './dto/update-recurrence.dto';
import { RecurrenceRunLog } from './recurrence-run-log.entity';
import { TaskRecurrence } from './task-recurrence.entity';
import { RecurrencesService } from './recurrences.service';

@ApiTags('Recurrences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recurrences')
export class RecurrencesController {
  constructor(private readonly recurrencesService: RecurrencesService) {}

  @Get('templates/statutory')
  @Permissions('recurrence.view')
  statutoryTemplates() {
    return statutoryRecurrenceTemplates;
  }

  @Get()
  @Permissions('recurrence.view')
  async list(@CurrentUser() user: RequestUser): Promise<TaskRecurrence[]> {
    return this.recurrencesService.list(user.firmId);
  }

  @Post()
  @Permissions('recurrence.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateRecurrenceDto): Promise<TaskRecurrence> {
    return this.recurrencesService.create(user.firmId, dto, user.id);
  }

  @Post('preview')
  @Permissions('recurrence.view')
  preview(@Body() dto: CreateRecurrenceDto): { occurrences: Date[] } {
    return { occurrences: this.recurrencesService.preview(dto) };
  }

  @Patch(':id')
  @Permissions('recurrence.edit')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecurrenceDto,
  ): Promise<TaskRecurrence> {
    return this.recurrencesService.update(user.firmId, id, dto, user.id);
  }

  @Post(':id/run')
  @Permissions('recurrence.run')
  async runNow(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<RecurrenceRunLog> {
    return this.recurrencesService.runOne(user.firmId, id, user.id);
  }

  @Get(':id/log')
  @Permissions('recurrence.view')
  async logs(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<RecurrenceRunLog[]> {
    return this.recurrencesService.logs(user.firmId, id);
  }
}
