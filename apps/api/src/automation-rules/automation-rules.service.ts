import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import {
  ActionType,
  AutomationRule,
  ConditionOperator,
  RuleAction,
  RuleCondition,
  RuleEventEntity,
  RuleEventType,
} from './automation-rule.entity';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

export interface TaskEventPayload {
  firmId: string;
  task: Task;
  eventType: RuleEventType;
  actorUserId: string;
  previousStatus?: string;
  previousPriority?: string;
}

export interface ResolvedAction {
  type: ActionType;
  value: string;
}

@Injectable()
export class AutomationRulesService {
  constructor(
    @InjectRepository(AutomationRule)
    private readonly ruleRepository: Repository<AutomationRule>,
  ) {}

  async create(firmId: string, dto: CreateAutomationRuleDto, actorUserId: string): Promise<AutomationRule> {
    return this.ruleRepository.save(
      this.ruleRepository.create({
        firmId,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        events: dto.events,
        conditions: dto.conditions,
        actions: dto.actions,
        priority: dto.priority ?? 0,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
  }

  async update(firmId: string, id: string, dto: UpdateAutomationRuleDto, actorUserId: string): Promise<AutomationRule> {
    const rule = await this.ruleRepository.findOne({ where: { id, firmId } });
    if (!rule) throw new NotFoundException('Automation rule not found');

    if (dto.name !== undefined) rule.name = dto.name;
    if (dto.description !== undefined) rule.description = dto.description;
    if (dto.isActive !== undefined) rule.isActive = dto.isActive;
    if (dto.events !== undefined) rule.events = dto.events;
    if (dto.conditions !== undefined) rule.conditions = dto.conditions;
    if (dto.actions !== undefined) rule.actions = dto.actions;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    rule.updatedBy = actorUserId;

    return this.ruleRepository.save(rule);
  }

  async remove(firmId: string, id: string): Promise<void> {
    const rule = await this.ruleRepository.findOne({ where: { id, firmId } });
    if (!rule) throw new NotFoundException('Automation rule not found');
    await this.ruleRepository.softRemove(rule);
  }

  async list(firmId: string): Promise<AutomationRule[]> {
    return this.ruleRepository.find({
      where: { firmId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async getOne(firmId: string, id: string): Promise<AutomationRule> {
    const rule = await this.ruleRepository.findOne({ where: { id, firmId } });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  async evaluateTaskEvent(payload: TaskEventPayload): Promise<ResolvedAction[]> {
    const rules = await this.ruleRepository.find({
      where: { firmId: payload.firmId, isActive: true },
      order: { priority: 'DESC' },
    });

    const matchedActions: ResolvedAction[] = [];

    for (const rule of rules) {
      if (!this.eventMatches(rule, RuleEventEntity.Task, payload.eventType)) continue;
      if (!this.conditionsMatch(rule.conditions, payload.task)) continue;

      for (const action of rule.actions) {
        matchedActions.push({ type: action.type, value: action.value });
      }
    }

    return matchedActions;
  }

  private eventMatches(rule: AutomationRule, entity: RuleEventEntity, eventType: RuleEventType): boolean {
    return rule.events.some((e) => e.entity === entity && e.type === eventType);
  }

  private conditionsMatch(conditions: RuleCondition[], task: Task): boolean {
    if (!conditions || conditions.length === 0) return true;

    let result = true;
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(task, condition.field);
      const match = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      if (condition.logic === 'or') {
        result = result || match;
      } else {
        result = result && match;
      }
    }

    return result;
  }

  private getFieldValue(task: Task, field: string): string | null | undefined {
    const map: Record<string, string | null | undefined> = {
      status: task.status,
      priority: task.priority,
      serviceId: task.serviceId,
      assignedToUserId: task.assignedToUserId,
      assignedTeamId: task.assignedTeamId,
      customerId: task.customerId,
      generatedBy: task.generatedBy,
    };
    return map[field];
  }

  private evaluateCondition(fieldValue: string | null | undefined, operator: ConditionOperator, conditionValue: string | string[] | null): boolean {
    switch (operator) {
      case ConditionOperator.Equals:
        return fieldValue === conditionValue;
      case ConditionOperator.NotEquals:
        return fieldValue !== conditionValue;
      case ConditionOperator.In:
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue ?? '');
      case ConditionOperator.NotIn:
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue ?? '');
      case ConditionOperator.IsNull:
        return fieldValue == null;
      case ConditionOperator.IsNotNull:
        return fieldValue != null;
      default:
        return false;
    }
  }
}
