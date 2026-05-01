import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { TeamMember } from '../teams/team-member.entity';
import { Team } from '../teams/team.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { AssignmentStrategy, TaskRecurrence } from '../recurrences/task-recurrence.entity';

export interface AssignmentResult {
  assignedToUserId: string | null;
  assignedTeamId: string | null;
}

@Injectable()
export class AssignmentService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(ServiceCatalog)
    private readonly serviceRepository: Repository<ServiceCatalog>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async resolveForRecurrence(recurrence: TaskRecurrence): Promise<AssignmentResult> {
    return this.resolve(
      recurrence.firmId,
      recurrence.assignmentStrategy,
      recurrence.customerId,
      recurrence.serviceId,
      recurrence.assignmentTargetUserId ?? null,
      recurrence.assignmentTargetTeamId ?? null,
      recurrence.assignmentTargetRoleId ?? null,
    );
  }

  async resolve(
    firmId: string,
    strategy: AssignmentStrategy,
    customerId: string,
    serviceId: string | null,
    targetUserId: string | null,
    targetTeamId: string | null,
    targetRoleId: string | null,
  ): Promise<AssignmentResult> {
    if (strategy === AssignmentStrategy.SpecificUser && targetUserId) {
      const user = await this.activeUser(firmId, targetUserId);
      if (user) return { assignedToUserId: user.id, assignedTeamId: targetTeamId };
    }

    if (strategy === AssignmentStrategy.CustomerOwner) {
      const customer = await this.customerRepository.findOne({ where: { firmId, id: customerId } });
      if (customer?.ownerUserId) {
        const user = await this.activeUser(firmId, customer.ownerUserId);
        if (user) return { assignedToUserId: user.id, assignedTeamId: customer.defaultTeamId ?? targetTeamId };
      }
    }

    if (strategy === AssignmentStrategy.ServiceDefault && serviceId) {
      const service = await this.serviceRepository.findOne({ where: { firmId, id: serviceId } });
      const nextStrategy = service?.defaultAssigneeStrategy as AssignmentStrategy | undefined;
      if (nextStrategy && nextStrategy !== AssignmentStrategy.ServiceDefault) {
        return this.resolve(
          firmId,
          nextStrategy,
          customerId,
          serviceId,
          targetUserId,
          service.defaultTeamId ?? targetTeamId,
          targetRoleId,
        );
      }
    }

    if (strategy === AssignmentStrategy.TeamRoundRobin && targetTeamId) {
      return this.teamRoundRobin(firmId, targetTeamId);
    }

    if (strategy === AssignmentStrategy.TeamLeastLoaded && targetTeamId) {
      return this.teamLeastLoaded(firmId, targetTeamId);
    }

    if (strategy === AssignmentStrategy.RoleRoundRobin && targetRoleId) {
      const user = await this.userRepository.findOne({
        where: { firmId, roleId: targetRoleId, isActive: true },
        order: { lastLoginAt: 'ASC' },
      });
      if (user) return { assignedToUserId: user.id, assignedTeamId: targetTeamId };
    }

    return { assignedToUserId: null, assignedTeamId: targetTeamId };
  }

  private async activeUser(firmId: string, id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { firmId, id, isActive: true } });
  }

  private async activeTeamMembers(firmId: string, teamId: string): Promise<TeamMember[]> {
    return this.teamMemberRepository.find({
      where: { firmId, teamId, isActive: true },
      order: { joinedAt: 'ASC' },
    });
  }

  private async teamRoundRobin(firmId: string, teamId: string): Promise<AssignmentResult> {
    const team = await this.teamRepository.findOne({ where: { firmId, id: teamId, isActive: true } });
    const members = await this.activeTeamMembers(firmId, teamId);
    if (!team || members.length === 0) return { assignedToUserId: null, assignedTeamId: teamId };

    const lastIndex = members.findIndex((member) => member.userId === team.lastAssignedUserId);
    const next = members[(lastIndex + 1) % members.length];
    team.lastAssignedUserId = next.userId;
    await this.teamRepository.save(team);
    return { assignedToUserId: next.userId, assignedTeamId: teamId };
  }

  private async teamLeastLoaded(firmId: string, teamId: string): Promise<AssignmentResult> {
    const members = await this.activeTeamMembers(firmId, teamId);
    if (members.length === 0) return { assignedToUserId: null, assignedTeamId: teamId };

    const loads = await Promise.all(
      members.map(async (member) => ({
        userId: member.userId,
        count: await this.taskRepository.count({
          where: {
            firmId,
            assignedToUserId: member.userId,
            status: Not(In([TaskStatus.Completed, TaskStatus.Cancelled])),
          },
        }),
      })),
    );
    loads.sort((a, b) => a.count - b.count);
    return { assignedToUserId: loads[0]?.userId ?? null, assignedTeamId: teamId };
  }
}
