import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Firm } from './common/entities/firm.entity';
import { validateEnv } from './config/env.validation';
import { Permission } from './permissions/permission.entity';
import { PermissionsModule } from './permissions/permissions.module';
import { RolePermission } from './roles/role-permission.entity';
import { Role } from './roles/role.entity';
import { RolesModule } from './roles/roles.module';
import { TeamMember } from './teams/team-member.entity';
import { Team } from './teams/team.entity';
import { TeamsModule } from './teams/teams.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { HealthModule } from './health/health.module';

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
  ],
})
export class AppModule {}
