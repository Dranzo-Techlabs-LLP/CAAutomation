import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Firm } from '../common/entities/firm.entity';
import { Permission } from '../permissions/permission.entity';
import { RolePermission } from '../roles/role-permission.entity';
import { Role } from '../roles/role.entity';
import { RecurrenceDefault, ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { TeamMember, TeamRole } from '../teams/team-member.entity';
import { Team } from '../teams/team.entity';
import { User } from '../users/user.entity';
import { OnCompleteAction, StepAssigneeStrategy, WorkflowStep } from '../workflows/workflow-step.entity';
import { Workflow } from '../workflows/workflow.entity';
import AppDataSource from './data-source';

const permissionSeeds = [
  ['user.create', 'Create users', 'users'],
  ['user.view', 'View users', 'users'],
  ['role.view', 'View roles', 'roles'],
  ['role.create', 'Create roles', 'roles'],
  ['role.edit', 'Edit roles', 'roles'],
  ['team.view', 'View teams', 'teams'],
  ['team.create', 'Create teams', 'teams'],
  ['customer.view', 'View customers', 'customers'],
  ['customer.create', 'Create customers', 'customers'],
  ['enquiry.view', 'View enquiries', 'enquiries'],
  ['enquiry.create', 'Create enquiries', 'enquiries'],
  ['enquiry.edit', 'Edit enquiries', 'enquiries'],
  ['service.view', 'View services', 'services'],
  ['service.create', 'Create services', 'services'],
  ['task.view', 'View tasks', 'tasks'],
  ['task.create', 'Create tasks', 'tasks'],
  ['task.edit', 'Edit tasks', 'tasks'],
  ['task.comment', 'Comment on tasks', 'tasks'],
  ['workflow.view', 'View workflows', 'workflows'],
  ['workflow.manage', 'Manage workflows', 'workflows'],
  ['recurrence.view', 'View recurrences', 'recurrences'],
  ['recurrence.create', 'Create recurrences', 'recurrences'],
  ['recurrence.edit', 'Edit recurrences', 'recurrences'],
  ['recurrence.run', 'Run recurrences', 'recurrences'],
  ['billing.view', 'View billing', 'billing'],
  ['invoice.create', 'Create invoices', 'billing'],
  ['payment.create', 'Record payments', 'billing'],
  ['dashboard.partner', 'Partner dashboard', 'dashboards'],
  ['dashboard.manager', 'Manager dashboard', 'dashboards'],
  ['dashboard.associate', 'Associate dashboard', 'dashboards'],
  ['dashboard.compliance_calendar', 'Compliance calendar', 'dashboards'],
  ['api_key.create', 'Create API keys', 'integrations'],
  ['webhook.view', 'View webhooks', 'integrations'],
  ['webhook.create', 'Create webhooks', 'integrations'],
  ['notification.create', 'Create notifications', 'notifications'],
  ['audit.view', 'View audit logs', 'audit'],
  ['scheduler.view', 'View scheduler status', 'scheduler'],
] as const;

async function seed() {
  await AppDataSource.initialize();
  const firmRepository = AppDataSource.getRepository(Firm);
  const permissionRepository = AppDataSource.getRepository(Permission);
  const roleRepository = AppDataSource.getRepository(Role);
  const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
  const userRepository = AppDataSource.getRepository(User);
  const teamRepository = AppDataSource.getRepository(Team);
  const teamMemberRepository = AppDataSource.getRepository(TeamMember);
  const serviceRepository = AppDataSource.getRepository(ServiceCatalog);
  const workflowRepository = AppDataSource.getRepository(Workflow);
  const stepRepository = AppDataSource.getRepository(WorkflowStep);

  const firm =
    (await firmRepository.findOne({ where: { name: 'Demo CA Firm' } })) ??
    (await firmRepository.save(
      firmRepository.create({
        id: randomUUID(),
        name: 'Demo CA Firm',
        pan: 'ABCDE1234F',
        gstin: '27ABCDE1234F1Z5',
        address: 'Mumbai, Maharashtra',
      }),
    ));

  const permissions = await Promise.all(
    permissionSeeds.map(async ([code, description, module]) => {
      const existing = await permissionRepository.findOne({ where: { code } });
      return existing ?? permissionRepository.save(permissionRepository.create({ code, description, module }));
    }),
  );

  const roleNames = ['Super Admin', 'Partner', 'Manager', 'Senior Associate', 'Associate', 'Intern', 'Read-only Client'];
  const roles = await Promise.all(
    roleNames.map(async (name) => {
      const existing = await roleRepository.findOne({ where: { firmId: firm.id, name } });
      return existing ?? roleRepository.save(roleRepository.create({ firmId: firm.id, name, isSystemRole: true }));
    }),
  );

  const partner = roles.find((role) => role.name === 'Partner');
  if (partner) {
    await rolePermissionRepository.delete({ roleId: partner.id });
    await rolePermissionRepository.save(
      permissions.map((permission) => rolePermissionRepository.create({ roleId: partner.id, permissionId: permission.id })),
    );
  }

  const passwordHash = await bcrypt.hash('DemoPassword123!', 12);
  const users = await Promise.all(
    ['partner@demo.local', 'manager@demo.local', 'associate@demo.local'].map(async (email, index) => {
      const existing = await userRepository.findOne({ where: { email } });
      return (
        existing ??
        userRepository.save(
          userRepository.create({
            firmId: firm.id,
            name: ['Demo Partner', 'Demo Manager', 'Demo Associate'][index],
            email,
            passwordHash,
            roleId: roles[Math.min(index + 1, roles.length - 1)].id,
          }),
        )
      );
    }),
  );

  const teams = await Promise.all(
    ['GST Team', 'Audit Team', 'ITR Team'].map(async (name, index) => {
      const existing = await teamRepository.findOne({ where: { firmId: firm.id, name } });
      return (
        existing ??
        teamRepository.save(
          teamRepository.create({
            firmId: firm.id,
            name,
            leadUserId: users[1]?.id,
            description: `${name} demo workload`,
          }),
        )
      );
    }),
  );

  for (const team of teams) {
    for (const user of users) {
      const existing = await teamMemberRepository.findOne({ where: { firmId: firm.id, teamId: team.id, userId: user.id } });
      if (!existing) {
        await teamMemberRepository.save(
          teamMemberRepository.create({
            firmId: firm.id,
            teamId: team.id,
            userId: user.id,
            roleInTeam: user.email.includes('manager') ? TeamRole.Lead : TeamRole.Member,
          }),
        );
      }
    }
  }

  const workflow =
    (await workflowRepository.findOne({ where: { firmId: firm.id, name: 'GSTR-3B Filing', version: 1 } })) ??
    (await workflowRepository.save(
      workflowRepository.create({
        firmId: firm.id,
        name: 'GSTR-3B Filing',
        description: 'Prep, review, filing, and billing workflow for GSTR-3B',
        appliesTo: 'GSTR3B',
        version: 1,
      }),
    ));

  if ((await stepRepository.count({ where: { workflowId: workflow.id } })) === 0) {
    await stepRepository.save([
      stepRepository.create({ workflowId: workflow.id, sequenceNo: 1, name: 'Prepare return', assigneeStrategy: StepAssigneeStrategy.TeamLeastLoaded, assigneeValue: teams[0].id, slaHours: 24 }),
      stepRepository.create({ workflowId: workflow.id, sequenceNo: 2, name: 'Manager review', assigneeStrategy: StepAssigneeStrategy.Role, assigneeValue: roles[2].id, slaHours: 12, requiresAttachment: true }),
      stepRepository.create({ workflowId: workflow.id, sequenceNo: 3, name: 'File and generate invoice', assigneeStrategy: StepAssigneeStrategy.PreviousStepAssignee, slaHours: 8, onCompleteAction: OnCompleteAction.GenerateInvoice }),
    ]);
  }

  const services = [
    ['GSTR1', 'GSTR-1 Filing', RecurrenceDefault.Monthly],
    ['GSTR3B', 'GSTR-3B Filing', RecurrenceDefault.Monthly],
    ['ITR', 'Income Tax Return', RecurrenceDefault.Yearly],
    ['ROC_AOC4', 'ROC AOC-4 Filing', RecurrenceDefault.Yearly],
    ['TDS_Q', 'TDS Quarterly Return', RecurrenceDefault.Quarterly],
  ] as const;

  for (const [code, name, recurrenceDefault] of services) {
    const existing = await serviceRepository.findOne({ where: { firmId: firm.id, code } });
    if (!existing) {
      await serviceRepository.save(
        serviceRepository.create({
          firmId: firm.id,
          code,
          name,
          defaultWorkflowId: code === 'GSTR3B' ? workflow.id : null,
          defaultTeamId: teams[0].id,
          defaultAssigneeStrategy: 'team_least_loaded',
          defaultBillingAmount: '500000',
          recurrenceDefault,
        }),
      );
    }
  }

  await AppDataSource.destroy();
}

void seed();
