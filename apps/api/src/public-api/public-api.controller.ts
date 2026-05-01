import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateCustomerDto } from '../customers/dto/create-customer.dto';
import { CustomersService } from '../customers/customers.service';
import { CreateEnquiryDto } from '../enquiries/dto/create-enquiry.dto';
import { EnquiriesService } from '../enquiries/enquiries.service';
import { CreateRecurrenceDto } from '../recurrences/dto/create-recurrence.dto';
import { RecurrencesService } from '../recurrences/recurrences.service';
import { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { TasksService } from '../tasks/tasks.service';
import { ApiKeyContext } from './api-key-context.decorator';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiScope } from './api-scope.decorator';

@ApiTags('Public API')
@ApiBearerAuth()
@UseGuards(ApiKeyAuthGuard)
@Controller('public')
export class PublicApiController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly customersService: CustomersService,
    private readonly enquiriesService: EnquiriesService,
    private readonly recurrencesService: RecurrencesService,
  ) {}

  @Post('tasks')
  @ApiScope('task-create')
  createTask(@ApiKeyContext() context: { firmId: string; apiKeyId: string }, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(context.firmId, dto, context.apiKeyId);
  }

  @Get('tasks')
  @ApiScope('read-only')
  listTasks(@ApiKeyContext() context: { firmId: string }) {
    return this.tasksService.list(context.firmId, { limit: 50 });
  }

  @Post('customers')
  @ApiScope('full-access')
  createCustomer(@ApiKeyContext() context: { firmId: string; apiKeyId: string }, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(context.firmId, dto, context.apiKeyId);
  }

  @Post('enquiries')
  @ApiScope('full-access')
  createEnquiry(@ApiKeyContext() context: { firmId: string; apiKeyId: string }, @Body() dto: CreateEnquiryDto) {
    return this.enquiriesService.create(context.firmId, dto, context.apiKeyId);
  }

  @Post('recurrences')
  @ApiScope('full-access')
  createRecurrence(@ApiKeyContext() context: { firmId: string; apiKeyId: string }, @Body() dto: CreateRecurrenceDto) {
    return this.recurrencesService.create(context.firmId, dto, context.apiKeyId);
  }
}
