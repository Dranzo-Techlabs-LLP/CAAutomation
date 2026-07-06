import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Not, Repository } from 'typeorm';
import { AssignmentService } from '../assignment/assignment.service';
import { CustomerStatus } from '../customers/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { Task, TaskGeneratedBy, TaskPriority, TaskStatus } from '../tasks/task.entity';
import { BulkCreateRecurrenceDto } from './dto/bulk-create-recurrence.dto';
import { CreateRecurrenceDto } from './dto/create-recurrence.dto';
import { UpdateRecurrenceDto } from './dto/update-recurrence.dto';
import { RecurrenceRunLog, RecurrenceRunStatus } from './recurrence-run-log.entity';
import { RecurrenceCalculatorService } from './recurrence-calculator.service';
import { TaskRecurrence } from './task-recurrence.entity';

interface RecurrenceTaskTemplate {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  estimated_hours?: string;
  billable?: boolean;
  billing_amount?: string;
}

@Injectable()
export class RecurrencesService {
  constructor(
    @InjectRepository(TaskRecurrence)
    private readonly recurrenceRepository: Repository<TaskRecurrence>,
    @InjectRepository(RecurrenceRunLog)
    private readonly logRepository: Repository<RecurrenceRunLog>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly customersService: CustomersService,
    private readonly assignmentService: AssignmentService,
    private readonly calculator: RecurrenceCalculatorService,
  ) {}

  async create(firmId: string, dto: CreateRecurrenceDto, actorUserId: string): Promise<TaskRecurrence> {
    const startDate = new Date(dto.startDate);
    const recurrence = this.recurrenceRepository.create({
      ...dto,
      firmId,
      timezone: dto.timezone ?? 'Asia/Kolkata',
      startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      nextRunAt: startDate,
      generateLeadDays: dto.generateLeadDays ?? 7,
      preventOverlap: dto.preventOverlap ?? true,
      createdByUserId: actorUserId,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.recurrenceRepository.save(recurrence);
  }

  /**
   * Set up one recurring statutory task (e.g. GSTR-1) across many parties at once.
   * Creates one TaskRecurrence per party — reusing the existing generation engine —
   * with per-party due-day / pattern overrides. Customers not found in the firm are
   * skipped (reported back) so a bad id doesn't fail the whole batch.
   */
  async createBulk(
    firmId: string,
    dto: BulkCreateRecurrenceDto,
    actorUserId: string,
  ): Promise<{ created: TaskRecurrence[]; skipped: { customerId: string; reason: string }[] }> {
    const created: TaskRecurrence[] = [];
    const skipped: { customerId: string; reason: string }[] = [];
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    const seen = new Set<string>();

    for (const party of dto.parties) {
      if (seen.has(party.customerId)) continue; // de-dupe within one request
      seen.add(party.customerId);

      let customer;
      try {
        customer = await this.customersService.getEntityOrFail(firmId, party.customerId);
      } catch {
        skipped.push({ customerId: party.customerId, reason: 'Customer not found' });
        continue;
      }

      const dueDay = party.dueDay ?? dto.dueDay;
      const recurrence = this.recurrenceRepository.create({
        firmId,
        serviceId: dto.serviceId,
        customerId: party.customerId,
        // Per-party name so the list stays readable when one setup fans out to many.
        name: `${dto.name} — ${customer.name}`,
        patternType: party.patternType ?? dto.patternType,
        patternExpression: `day=${dueDay}`,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        startDate,
        endDate,
        nextRunAt: startDate,
        generateLeadDays: party.generateLeadDays ?? dto.generateLeadDays ?? 5,
        preventOverlap: dto.preventOverlap ?? true,
        // The generated TASK keeps the base name (customer is a separate field on it).
        templateJson: dto.templateJson ?? { title: dto.name, priority: 'medium' },
        assignmentStrategy: dto.assignmentStrategy,
        assignmentTargetUserId: dto.assignmentTargetUserId ?? null,
        assignmentTargetTeamId: dto.assignmentTargetTeamId ?? null,
        assignmentTargetRoleId: dto.assignmentTargetRoleId ?? null,
        createdByUserId: actorUserId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      });
      created.push(await this.recurrenceRepository.save(recurrence));
    }

    return { created, skipped };
  }

  async list(firmId: string): Promise<TaskRecurrence[]> {
    return this.recurrenceRepository.find({ where: { firmId }, order: { nextRunAt: 'ASC' } });
  }

  async update(firmId: string, id: string, dto: UpdateRecurrenceDto, actorUserId: string): Promise<TaskRecurrence> {
    const recurrence = await this.getOne(firmId, id);
    recurrence.isActive = dto.isActive ?? recurrence.isActive;
    recurrence.updatedBy = actorUserId;
    return this.recurrenceRepository.save(recurrence);
  }

  async logs(firmId: string, id: string): Promise<RecurrenceRunLog[]> {
    await this.getOne(firmId, id);
    return this.logRepository.find({ where: { recurrenceId: id }, order: { runAt: 'DESC' }, take: 100 });
  }

  /** Delete a recurrence rule + its run logs. Already-generated tasks are kept. */
  async remove(firmId: string, id: string): Promise<{ deleted: true }> {
    const recurrence = await this.getOne(firmId, id);
    await this.logRepository.delete({ recurrenceId: id });
    await this.recurrenceRepository.remove(recurrence);
    return { deleted: true };
  }

  async dueRecurrences(now = new Date()): Promise<TaskRecurrence[]> {
    return this.recurrenceRepository.find({
      where: { isActive: true, nextRunAt: LessThanOrEqual(now) },
      order: { nextRunAt: 'ASC' },
      take: 500,
    });
  }

  async runDue(now = new Date()): Promise<void> {
    const recurrences = await this.dueRecurrences(now);
    for (const recurrence of recurrences) {
      await this.runOne(recurrence.firmId, recurrence.id, 'scheduler');
    }
  }

  async runOne(firmId: string, id: string, actorUserId: string): Promise<RecurrenceRunLog> {
    const recurrence = await this.getOne(firmId, id);
    const runAt = new Date();
    const dueDate = this.calculator.dueDateForRecurrence(
      recurrence.nextRunAt,
      recurrence.patternExpression,
      recurrence.generateLeadDays,
    );

    try {
      const customer = await this.customersService.getEntityOrFail(firmId, recurrence.customerId);
      if (customer.status !== CustomerStatus.Active) {
        return this.logAndAdvance(recurrence, runAt, dueDate, RecurrenceRunStatus.Skipped, null, 'Customer is not active');
      }

      if (recurrence.preventOverlap) {
        const openTask = await this.taskRepository.findOne({
          where: {
            firmId,
            recurrenceId: recurrence.id,
            status: Not(In([TaskStatus.Completed, TaskStatus.Cancelled])),
          },
        });
        if (openTask) {
          return this.logAndAdvance(recurrence, runAt, dueDate, RecurrenceRunStatus.Skipped, null, 'Previous recurrence task is still open');
        }
      }

      const duplicate = await this.taskRepository.findOne({
        where: { recurrenceId: recurrence.id, dueDate },
      });
      if (duplicate) {
        return this.logAndAdvance(recurrence, runAt, dueDate, RecurrenceRunStatus.Skipped, duplicate.id, 'Duplicate recurrence instance');
      }

      const assignment = await this.assignmentService.resolveForRecurrence(recurrence);
      const template = recurrence.templateJson as RecurrenceTaskTemplate;
      const task = await this.taskRepository.save(
        this.taskRepository.create({
          firmId,
          customerId: recurrence.customerId,
          serviceId: recurrence.serviceId,
          workflowId: recurrence.workflowId,
          title: template.title ?? recurrence.name,
          description: template.description,
          priority: template.priority ?? TaskPriority.Medium,
          status: assignment.assignedToUserId ? TaskStatus.Assigned : TaskStatus.Unassigned,
          assignedToUserId: assignment.assignedToUserId,
          assignedTeamId: assignment.assignedTeamId,
          dueDate,
          recurrenceId: recurrence.id,
          generatedBy: TaskGeneratedBy.Recurrence,
          estimatedHours: template.estimated_hours,
          billable: template.billable ?? true,
          billingAmount: template.billing_amount,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        }),
      );

      return this.logAndAdvance(recurrence, runAt, dueDate, RecurrenceRunStatus.Success, task.id);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown recurrence error';
      return this.logAndAdvance(recurrence, runAt, dueDate, RecurrenceRunStatus.Failed, null, undefined, message);
    }
  }

  preview(dto: CreateRecurrenceDto): Date[] {
    return this.calculator.preview(
      new Date(dto.startDate),
      dto.patternType,
      dto.patternExpression,
      dto.generateLeadDays ?? 7,
    );
  }

  private async getOne(firmId: string, id: string): Promise<TaskRecurrence> {
    const recurrence = await this.recurrenceRepository.findOne({ where: { firmId, id } });
    if (!recurrence) throw new NotFoundException('Recurrence not found');
    return recurrence;
  }

  private async logAndAdvance(
    recurrence: TaskRecurrence,
    runAt: Date,
    dueDate: Date,
    status: RecurrenceRunStatus,
    taskId: string | null,
    skipReason?: string,
    errorMessage?: string,
  ): Promise<RecurrenceRunLog> {
    recurrence.lastRunAt = runAt;
    recurrence.nextRunAt = this.calculator.nextRunAfter(
      recurrence.nextRunAt,
      recurrence.patternType,
      recurrence.patternExpression,
    );
    if (recurrence.endDate && recurrence.nextRunAt > recurrence.endDate) {
      recurrence.isActive = false;
    }
    await this.recurrenceRepository.save(recurrence);
    return this.logRepository.save(
      this.logRepository.create({
        recurrenceId: recurrence.id,
        runAt,
        dueDateGenerated: dueDate,
        taskIdCreated: taskId,
        status,
        skipReason,
        errorMessage,
      }),
    );
  }
}
