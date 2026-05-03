import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Firm } from '../common/entities/firm.entity';
import { Customer, CustomerStatus, CustomerType, EnquirySource } from '../customers/customer.entity';
import { Permission } from '../permissions/permission.entity';
import { RolePermission } from '../roles/role-permission.entity';
import { Role } from '../roles/role.entity';
import { RecurrenceDefault, ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { Enquiry, EnquiryStatus } from '../enquiries/enquiry.entity';
import { AssignmentStrategy, RecurrencePatternType, TaskRecurrence } from '../recurrences/task-recurrence.entity';
import { Task, TaskGeneratedBy, TaskPriority, TaskStatus } from '../tasks/task.entity';
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
  const customerRepository = AppDataSource.getRepository(Customer);
  const permissionRepository = AppDataSource.getRepository(Permission);
  const roleRepository = AppDataSource.getRepository(Role);
  const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
  const userRepository = AppDataSource.getRepository(User);
  const teamRepository = AppDataSource.getRepository(Team);
  const teamMemberRepository = AppDataSource.getRepository(TeamMember);
  const serviceRepository = AppDataSource.getRepository(ServiceCatalog);
  const taskRepository = AppDataSource.getRepository(Task);
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
  const manager = roles.find((role) => role.name === 'Manager');
  const seniorAssociate = roles.find((role) => role.name === 'Senior Associate');
  const associate = roles.find((role) => role.name === 'Associate');
  if (partner) {
    await rolePermissionRepository.delete({ roleId: partner.id });
    await rolePermissionRepository.save(
      permissions.map((permission) => rolePermissionRepository.create({ roleId: partner.id, permissionId: permission.id })),
    );
  }
  const assignPermissions = async (role: Role | undefined, codes: string[]) => {
    if (!role) return;
    const selected = permissions.filter((permission) => codes.includes(permission.code));
    await rolePermissionRepository.delete({ roleId: role.id });
    await rolePermissionRepository.save(
      selected.map((permission) =>
        rolePermissionRepository.create({ roleId: role.id, permissionId: permission.id }),
      ),
    );
  };
  await assignPermissions(manager, [
    'user.view',
    'team.view',
    'customer.view',
    'service.view',
    'task.view',
    'task.create',
    'task.edit',
    'task.comment',
    'attachment.view',
    'attachment.create',
    'time_log.view',
    'time_log.create',
    'dashboard.manager',
    'dashboard.associate',
    'dashboard.compliance_calendar',
  ]);
  await assignPermissions(seniorAssociate, [
    'customer.view', 'task.view', 'task.create', 'task.edit', 'task.comment',
    'attachment.view', 'attachment.create', 'time_log.view', 'time_log.create',
    'dashboard.associate',
  ]);
  await assignPermissions(associate, [
    'customer.view', 'task.view', 'task.create', 'task.edit', 'task.comment',
    'attachment.view', 'attachment.create', 'time_log.view', 'time_log.create',
    'dashboard.associate',
  ]);

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

  const customer =
    (await customerRepository.findOne({ where: { firmId: firm.id, name: 'Acme Trading Private Limited' } })) ??
    (await customerRepository.save(
      customerRepository.create({
        firmId: firm.id,
        type: CustomerType.Company,
        name: 'Acme Trading Private Limited',
        contactNo: '+919999999999',
        email: 'accounts@acme.example',
        pan: 'AACCA1234A',
        gstin: '27AACCA1234A1Z1',
        address: 'Andheri East, Mumbai',
        enquirySource: EnquirySource.Referral,
        status: CustomerStatus.Active,
        briefText: 'Demo client for GST, TDS, and ITR compliance workflows.',
        ownerUserId: users[1]?.id,
        defaultTeamId: teams[0]?.id,
        onboardedAt: new Date(),
      }),
    ));

  const recurrenceRepository = AppDataSource.getRepository(TaskRecurrence);
  const enquiryRepository = AppDataSource.getRepository(Enquiry);

  const gstr3b = await serviceRepository.findOne({ where: { firmId: firm.id, code: 'GSTR3B' } });
  const itr = await serviceRepository.findOne({ where: { firmId: firm.id, code: 'ITR' } });
  const demoTasks = [
    {
      title: 'Prepare April GSTR-3B working',
      description: 'Download books, reconcile GSTR-2B, prepare liability summary, and attach evidence before manager review.',
      priority: TaskPriority.High,
      assignedToUserId: users[2]?.id,
      serviceId: gstr3b?.id,
      status: TaskStatus.Assigned,
    },
    {
      title: 'Resolve ITR document gap',
      description: 'Collect missing Form 16 and AIS clarification from the client before computation can proceed.',
      priority: TaskPriority.Medium,
      assignedToUserId: users[2]?.id,
      serviceId: itr?.id,
      status: TaskStatus.InProgress,
    },
    {
      title: 'Review GST filing checklist',
      description: 'Manager review for return data, challan values, and filing confirmation.',
      priority: TaskPriority.Urgent,
      assignedToUserId: users[1]?.id,
      serviceId: gstr3b?.id,
      status: TaskStatus.Review,
    },
  ];

  for (const taskSeed of demoTasks) {
    const existing = await taskRepository.findOne({ where: { firmId: firm.id, title: taskSeed.title } });
    if (!existing) {
      await taskRepository.save(
        taskRepository.create({
          firmId: firm.id,
          customerId: customer.id,
          serviceId: taskSeed.serviceId,
          title: taskSeed.title,
          description: taskSeed.description,
          priority: taskSeed.priority,
          status: taskSeed.status,
          assignedToUserId: taskSeed.assignedToUserId,
          assignedTeamId: teams[0]?.id,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          generatedBy: TaskGeneratedBy.Manual,
          billable: true,
          billingAmount: '500000',
        }),
      );
    }
  }

  const tds = await serviceRepository.findOne({ where: { firmId: firm.id, code: 'TDS_Q' } });
  const demoRecurrences = [
    {
      name: 'GSTR-3B Monthly',
      serviceId: gstr3b!.id,
      customerId: customer.id,
      patternType: RecurrencePatternType.Monthly,
      patternExpression: '0 0 13 * *',
      assignmentStrategy: AssignmentStrategy.TeamLeastLoaded,
      assignmentTargetTeamId: teams[0]?.id,
      workflowId: workflow.id,
    },
    {
      name: 'TDS Quarterly Return',
      serviceId: tds!.id,
      customerId: customer.id,
      patternType: RecurrencePatternType.Quarterly,
      patternExpression: '0 0 25 1,4,7,10 *',
      assignmentStrategy: AssignmentStrategy.CustomerOwner,
    },
    {
      name: 'ITR Yearly Filing',
      serviceId: itr!.id,
      customerId: customer.id,
      patternType: RecurrencePatternType.Yearly,
      patternExpression: '0 0 1 7 *',
      assignmentStrategy: AssignmentStrategy.TeamRoundRobin,
      assignmentTargetTeamId: teams[2]?.id,
    },
  ];

  for (const rec of demoRecurrences) {
    const existing = await recurrenceRepository.findOne({ where: { firmId: firm.id, name: rec.name } });
    if (!existing) {
      await recurrenceRepository.save(
        recurrenceRepository.create({
          firmId: firm.id,
          name: rec.name,
          serviceId: rec.serviceId,
          customerId: rec.customerId,
          patternType: rec.patternType,
          patternExpression: rec.patternExpression,
          startDate: new Date(),
          nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true,
          generateLeadDays: 5,
          preventOverlap: true,
          templateJson: { title: rec.name, priority: 'medium', estimatedHours: '4' },
          assignmentStrategy: rec.assignmentStrategy,
          assignmentTargetTeamId: rec.assignmentTargetTeamId ?? null,
          workflowId: rec.workflowId ?? null,
          createdByUserId: users[0]?.id,
          createdBy: users[0]?.id,
          updatedBy: users[0]?.id,
        }),
      );
    }
  }

  const existingEnquiry = await enquiryRepository.findOne({ where: { firmId: firm.id, customerId: customer.id } });
  if (!existingEnquiry) {
    await enquiryRepository.save(
      enquiryRepository.create({
        firmId: firm.id,
        customerId: customer.id,
        source: EnquirySource.Referral,
        brief: 'Client interested in GST compliance and annual ITR filing services.',
        status: EnquiryStatus.Converted,
        convertedAt: new Date(),
        createdBy: users[1]?.id,
        updatedBy: users[1]?.id,
      }),
    );
  }

  await AppDataSource.destroy();
}

void seed();
