import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { PasswordResetToken } from '../auth/password-reset-token.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { Attachment } from '../attachments/attachment.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { InvoiceLineItem } from '../billing/invoice-line-item.entity';
import { Invoice } from '../billing/invoice.entity';
import { Payment } from '../billing/payment.entity';
import { Firm } from '../common/entities/firm.entity';
import { Customer } from '../customers/customer.entity';
import { Enquiry } from '../enquiries/enquiry.entity';
import { ApiKey } from '../integrations/api-key.entity';
import { Webhook } from '../integrations/webhook.entity';
import { Notification } from '../notifications/notification.entity';
import { Permission } from '../permissions/permission.entity';
import { RecurrenceRunLog } from '../recurrences/recurrence-run-log.entity';
import { TaskRecurrence } from '../recurrences/task-recurrence.entity';
import { RolePermission } from '../roles/role-permission.entity';
import { Role } from '../roles/role.entity';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { TaskComment } from '../task-comments/task-comment.entity';
import { Task } from '../tasks/task.entity';
import { TeamMember } from '../teams/team-member.entity';
import { Team } from '../teams/team.entity';
import { TimeLog } from '../time-logs/time-log.entity';
import { User } from '../users/user.entity';
import { TaskStepHistory } from '../workflows/task-step-history.entity';
import { WorkflowStepTransition } from '../workflows/workflow-step-transition.entity';
import { WorkflowStep } from '../workflows/workflow-step.entity';
import { Workflow } from '../workflows/workflow.entity';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    Firm,
    User,
    Role,
    Permission,
    RolePermission,
    Team,
    TeamMember,
    RefreshToken,
    PasswordResetToken,
    Customer,
    Enquiry,
    ServiceCatalog,
    Task,
    TaskComment,
    Attachment,
    TimeLog,
    Workflow,
    WorkflowStep,
    WorkflowStepTransition,
    TaskStepHistory,
    TaskRecurrence,
    RecurrenceRunLog,
    Invoice,
    InvoiceLineItem,
    Payment,
    ApiKey,
    Webhook,
    Notification,
    AuditLog,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default AppDataSource;
