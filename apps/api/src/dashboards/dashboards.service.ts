import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from '../billing/invoice.entity';
import { TaskRecurrence } from '../recurrences/task-recurrence.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { TimeLog } from '../time-logs/time-log.entity';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(TimeLog)
    private readonly timeLogRepository: Repository<TimeLog>,
    @InjectRepository(TaskRecurrence)
    private readonly recurrenceRepository: Repository<TaskRecurrence>,
  ) {}

  async partner(firmId: string) {
    const invoices = await this.invoiceRepository.find({ where: { firmId } });
    const revenue = invoices
      .filter((invoice) => invoice.status === InvoiceStatus.Paid)
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);
    const wip = await this.taskRepository.count({
      where: { firmId, status: TaskStatus.InProgress },
    });
    const overdueTasks = await this.taskRepository.count({
      where: { firmId, dueDate: LessThan(new Date()), status: TaskStatus.InProgress },
    });
    return { revenue, wip, overdueTasks, invoiceCount: invoices.length };
  }

  async manager(firmId: string) {
    const openTasks = await this.taskRepository.count({
      where: { firmId, status: TaskStatus.InProgress },
    });
    const pendingReviews = await this.taskRepository.count({
      where: { firmId, status: TaskStatus.Review },
    });
    const upcomingRecurrences = await this.recurrenceRepository.count({
      where: { firmId, isActive: true, nextRunAt: MoreThanOrEqual(new Date()) },
    });
    return { openTasks, pendingReviews, upcomingRecurrences };
  }

  async associate(firmId: string, userId: string) {
    const myOpenTasks = await this.taskRepository.count({
      where: { firmId, assignedToUserId: userId, status: TaskStatus.InProgress },
    });
    const myOverdueTasks = await this.taskRepository.count({
      where: { firmId, assignedToUserId: userId, dueDate: LessThan(new Date()) },
    });
    const logs = await this.timeLogRepository.find({ where: { firmId, userId } });
    const minutes = logs.reduce((sum, log) => sum + (log.durationMinutes ?? 0), 0);
    return { myOpenTasks, myOverdueTasks, myHours: Math.round((minutes / 60) * 100) / 100 };
  }

  async complianceCalendar(firmId: string) {
    const tasks = await this.taskRepository.find({
      where: { firmId, generatedBy: 'recurrence' as Task['generatedBy'] },
      order: { dueDate: 'ASC' },
      take: 500,
    });
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      customerId: task.customerId,
      serviceId: task.serviceId,
      status: task.status,
      dueDate: task.dueDate,
    }));
  }
}
