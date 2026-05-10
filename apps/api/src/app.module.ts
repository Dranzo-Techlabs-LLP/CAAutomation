import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentModule } from './assignment/assignment.module';
import { AuditLog } from './audit/audit-log.entity';
import { AutomationRule } from './automation-rules/automation-rule.entity';
import { AutomationRulesModule } from './automation-rules/automation-rules.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { Attachment } from './attachments/attachment.entity';
import { AttachmentsModule } from './attachments/attachments.module';
import { BillingModule } from './billing/billing.module';
import { InvoiceLineItem } from './billing/invoice-line-item.entity';
import { Invoice } from './billing/invoice.entity';
import { Payment } from './billing/payment.entity';
import { PaymentAdvice } from './billing/payment-advice.entity';
import { Firm } from './common/entities/firm.entity';
import { validateEnv } from './config/env.validation';
import { Customer } from './customers/customer.entity';
import { CustomersModule } from './customers/customers.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { Enquiry } from './enquiries/enquiry.entity';
import { HealthModule } from './health/health.module';
import { ApiKey } from './integrations/api-key.entity';
import { IntegrationsModule } from './integrations/integrations.module';
import { Webhook } from './integrations/webhook.entity';
import { Notification } from './notifications/notification.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Permission } from './permissions/permission.entity';
import { PermissionsModule } from './permissions/permissions.module';
import { PublicApiModule } from './public-api/public-api.module';
import { RolePermission } from './roles/role-permission.entity';
import { Role } from './roles/role.entity';
import { RolesModule } from './roles/roles.module';
import { RecurrenceRunLog } from './recurrences/recurrence-run-log.entity';
import { RecurrencesModule } from './recurrences/recurrences.module';
import { TaskRecurrence } from './recurrences/task-recurrence.entity';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ServiceCatalog } from './services-catalog/service-catalog.entity';
import { ServiceSubtaskTemplate } from './services-catalog/service-subtask-template.entity';
import { ServicesCatalogModule } from './services-catalog/services-catalog.module';
import { TaskStatusEntity } from './task-statuses/task-status.entity';
import { TaskStatusesModule } from './task-statuses/task-statuses.module';
import { TaskComment } from './task-comments/task-comment.entity';
import { TaskCommentsModule } from './task-comments/task-comments.module';
import { Task } from './tasks/task.entity';
import { TasksModule } from './tasks/tasks.module';
import { TeamMember } from './teams/team-member.entity';
import { Team } from './teams/team.entity';
import { TeamsModule } from './teams/teams.module';
import { TimeLog } from './time-logs/time-log.entity';
import { TimeLogsModule } from './time-logs/time-logs.module';
import { ReportsModule } from './reports/reports.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { TaskStepHistory } from './workflows/task-step-history.entity';
import { WorkflowStepTransition } from './workflows/workflow-step-transition.entity';
import { WorkflowStep } from './workflows/workflow-step.entity';
import { Workflow } from './workflows/workflow.entity';
import { SettingsModule } from './settings/settings.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.getOrThrow<string>('DB_PORT')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
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
          ServiceSubtaskTemplate,
          TaskStatusEntity,
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
          PaymentAdvice,
          ApiKey,
          Webhook,
          Notification,
          AuditLog,
          AutomationRule,
        ],
        synchronize: false,
        autoLoadEntities: false,
        logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
    ...(process.env.DISABLE_SCHEDULER === 'true'
      ? []
      : [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>('REDIS_HOST') ?? 'localhost',
                port: Number(config.get<string>('REDIS_PORT') ?? 6379),
                password: config.get<string>('REDIS_PASSWORD') || undefined,
              },
            }),
          }),
        ]),
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    TeamsModule,
    HealthModule,
    CustomersModule,
    EnquiriesModule,
    ServicesCatalogModule,
    TasksModule,
    TaskCommentsModule,
    AttachmentsModule,
    TimeLogsModule,
    WorkflowsModule,
    AssignmentModule,
    RecurrencesModule,
    ...(process.env.DISABLE_SCHEDULER === 'true' ? [] : [SchedulerModule]),
    BillingModule,
    DashboardsModule,
    IntegrationsModule,
    PublicApiModule,
    NotificationsModule,
    AuditModule,
    AutomationRulesModule,
    SettingsModule,
    ReportsModule,
    TaskStatusesModule,
  ],
})
export class AppModule {}
