import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Firm } from '../common/entities/firm.entity';
import { PasswordResetToken } from '../auth/password-reset-token.entity';
import { Customer } from '../customers/customer.entity';
import { Enquiry } from '../enquiries/enquiry.entity';
import { Permission } from '../permissions/permission.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { RolePermission } from '../roles/role-permission.entity';
import { Role } from '../roles/role.entity';
import { TeamMember } from '../teams/team-member.entity';
import { Team } from '../teams/team.entity';
import { User } from '../users/user.entity';

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
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default AppDataSource;
