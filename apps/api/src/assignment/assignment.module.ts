import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { TeamMember } from '../teams/team-member.entity';
import { Team } from '../teams/team.entity';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { AssignmentService } from './assignment.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Customer, ServiceCatalog, Team, TeamMember, Task])],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
