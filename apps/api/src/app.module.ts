import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { Attachment } from './attachments/attachment.entity';
import { AttachmentsModule } from './attachments/attachments.module';
import { Firm } from './common/entities/firm.entity';
import { validateEnv } from './config/env.validation';
import { Customer } from './customers/customer.entity';
import { CustomersModule } from './customers/customers.module';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { Enquiry } from './enquiries/enquiry.entity';
import { HealthModule } from './health/health.module';
import { Permission } from './permissions/permission.entity';
import { PermissionsModule } from './permissions/permissions.module';
import { RolePermission } from './roles/role-permission.entity';
import { Role } from './roles/role.entity';
import { RolesModule } from './roles/roles.module';
import { ServiceCatalog } from './services-catalog/service-catalog.entity';
import { ServicesCatalogModule } from './services-catalog/services-catalog.module';
import { TaskComment } from './task-comments/task-comment.entity';
import { TaskCommentsModule } from './task-comments/task-comments.module';
import { Task } from './tasks/task.entity';
import { TasksModule } from './tasks/tasks.module';
import { TeamMember } from './teams/team-member.entity';
import { Team } from './teams/team.entity';
import { TeamsModule } from './teams/teams.module';
import { TimeLog } from './time-logs/time-log.entity';
import { TimeLogsModule } from './time-logs/time-logs.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { TaskStepHistory } from './workflows/task-step-history.entity';
import { WorkflowStepTransition } from './workflows/workflow-step-transition.entity';
import { WorkflowStep } from './workflows/workflow-step.entity';
import { Workflow } from './workflows/workflow.entity';
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
          Task,
          TaskComment,
          Attachment,
          TimeLog,
          Workflow,
          WorkflowStep,
          WorkflowStepTransition,
          TaskStepHistory,
        ],
        synchronize: false,
        autoLoadEntities: false,
        logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
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
  ],
})
export class AppModule {}
