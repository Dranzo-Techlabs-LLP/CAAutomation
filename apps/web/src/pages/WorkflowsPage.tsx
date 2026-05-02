import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

/* ---- Types ---- */
interface Workflow {
  id: string;
  name: string;
  description?: string;
  appliesTo: string;
  isActive: boolean;
  version: number;
  steps?: WorkflowStep[];
}

interface WorkflowStep {
  id?: string;
  sequenceNo: number;
  name: string;
  assigneeStrategy: string;
  assigneeValue?: string;
  slaHours?: number;
  requiresAttachment: boolean;
  requiresApproval: boolean;
  onCompleteAction: string;
}

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  events: { entity: string; type: string }[];
  conditions: { field: string; operator: string; value: string | string[] | null; logic?: string }[];
  actions: { type: string; value: string }[];
  priority: number;
}

/* ---- Constants ---- */
const EVENT_ENTITIES = ['task', 'customer', 'enquiry'];
const EVENT_TYPES = ['created', 'updated', 'status_changed', 'assigned', 'resolution_added', 'priority_changed'];
const CONDITION_FIELDS = ['status', 'priority', 'serviceId', 'assignedToUserId', 'assignedTeamId', 'customerId', 'generatedBy'];
const CONDITION_OPERATORS = ['equals', 'not_equals', 'in', 'not_in', 'is_null', 'is_not_null'];
const ACTION_TYPES = ['set_status', 'set_priority', 'assign_to_user', 'assign_to_team', 'set_resolution', 'start_workflow', 'create_notification'];
const TASK_STATUSES = ['unassigned', 'assigned', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const ASSIGNEE_STRATEGIES = ['specific_user', 'role', 'team_round_robin', 'team_least_loaded', 'round_robin', 'customer_owner', 'previous_step_assignee'];
const ON_COMPLETE_ACTIONS = ['next_step', 'branch', 'end', 'notify', 'generate_invoice'];

/* ---- Main Component ---- */
export default function WorkflowsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('workflow.manage');
  const [tab, setTab] = useState<'workflows' | 'automation'>('workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [showNewRule, setShowNewRule] = useState(false);

  const loadWorkflows = () => api<Workflow[]>('/workflows').then(setWorkflows).catch(() => {});
  const loadRules = () => api<AutomationRule[]>('/automation-rules').then(setRules).catch(() => {});

  useEffect(() => {
    loadWorkflows();
    loadRules();
  }, []);

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center gap-4">
        <button className={`text-sm font-medium ${tab === 'workflows' ? 'text-primary underline' : 'text-muted-foreground'}`} onClick={() => setTab('workflows')}>
          Step Workflows
        </button>
        <button className={`text-sm font-medium ${tab === 'automation' ? 'text-primary underline' : 'text-muted-foreground'}`} onClick={() => setTab('automation')}>
          Automation Rules
        </button>
      </div>

      {tab === 'workflows' && (
        <WorkflowsTab
          workflows={workflows}
          canManage={canManage}
          editing={editingWorkflow}
          showNew={showNewWorkflow}
          onEdit={async (w) => {
            const steps = await api<WorkflowStep[]>(`/workflows/${w.id}/steps`).catch(() => []);
            setEditingWorkflow({ ...w, steps });
          }}
          onCancelEdit={() => setEditingWorkflow(null)}
          onToggleNew={() => { setShowNewWorkflow(!showNewWorkflow); setEditingWorkflow(null); }}
          onSaved={() => { loadWorkflows(); setShowNewWorkflow(false); setEditingWorkflow(null); }}
          onDelete={async (id) => {
            await api(`/workflows/${id}`, { method: 'DELETE' });
            loadWorkflows();
          }}
        />
      )}

      {tab === 'automation' && (
        <AutomationTab
          rules={rules}
          canManage={canManage}
          editing={editingRule}
          showNew={showNewRule}
          onEdit={(r) => setEditingRule(r)}
          onCancelEdit={() => setEditingRule(null)}
          onToggleNew={() => { setShowNewRule(!showNewRule); setEditingRule(null); }}
          onSaved={() => { loadRules(); setShowNewRule(false); setEditingRule(null); }}
          onDelete={async (id) => {
            await api(`/automation-rules/${id}`, { method: 'DELETE' });
            loadRules();
          }}
          onToggleActive={async (id, isActive) => {
            await api(`/automation-rules/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) });
            loadRules();
          }}
        />
      )}
    </section>
  );
}

/* ---- Step Workflows Tab ---- */
function WorkflowsTab({
  workflows, canManage, editing, showNew, onEdit, onCancelEdit, onToggleNew, onSaved, onDelete,
}: {
  workflows: Workflow[];
  canManage: boolean;
  editing: Workflow | null;
  showNew: boolean;
  onEdit: (w: Workflow) => void;
  onCancelEdit: () => void;
  onToggleNew: () => void;
  onSaved: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step Workflows</h2>
        {canManage && (
          <button className="primary-button" onClick={onToggleNew}>
            {showNew ? 'Cancel' : 'Create Workflow'}
          </button>
        )}
      </div>

      {showNew && <WorkflowForm onSaved={onSaved} />}
      {editing && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Editing: {editing.name}</p>
            <button className="text-xs text-primary hover:underline" onClick={onCancelEdit}>Cancel</button>
          </div>
          <WorkflowForm workflow={editing} onSaved={onSaved} />
        </div>
      )}

      <div className="space-y-2">
        {workflows.map((w) => (
          <div key={w.id} className="panel flex items-center justify-between">
            <div>
              <h3 className="font-medium">{w.name} <span className="text-xs text-muted-foreground">v{w.version}</span></h3>
              {w.description && <p className="text-xs text-muted-foreground">{w.description}</p>}
              <p className="text-xs text-muted-foreground">Applies to: {w.appliesTo}</p>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <button className="text-xs text-primary hover:underline" onClick={() => onEdit(w)}>Edit</button>
                <button className="text-xs text-red-600 hover:underline" onClick={() => onDelete(w.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
        {workflows.length === 0 && (
          <div className="panel py-6 text-center text-muted-foreground">No workflows yet</div>
        )}
      </div>
    </>
  );
}

/* ---- Workflow Form ---- */
function WorkflowForm({ workflow, onSaved }: { workflow?: Workflow; onSaved: () => void }) {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [appliesTo, setAppliesTo] = useState(workflow?.appliesTo || 'any');
  const [steps, setSteps] = useState<WorkflowStep[]>(
    workflow?.steps?.length
      ? workflow.steps
      : [{ sequenceNo: 1, name: '', assigneeStrategy: 'team_least_loaded', requiresAttachment: false, requiresApproval: false, onCompleteAction: 'next_step' }],
  );
  const [error, setError] = useState('');

  const addStep = () => {
    setSteps([...steps, {
      sequenceNo: steps.length + 1,
      name: '',
      assigneeStrategy: 'team_least_loaded',
      requiresAttachment: false,
      requiresApproval: false,
      onCompleteAction: 'next_step',
    }]);
  };

  const removeStep = (idx: number) => {
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sequenceNo: i + 1 }));
    setSteps(updated);
  };

  const updateStep = (idx: number, field: string, value: unknown) => {
    const updated = [...steps];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setSteps(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = { name, description, appliesTo, steps };
      if (workflow?.id) {
        await api(`/workflows/${workflow.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="panel space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Applies To (service code)</label>
          <input className="input-field" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} />
        </div>
      </div>

      <div className="text-xs font-semibold uppercase text-muted-foreground">Steps</div>
      {steps.map((step, idx) => (
        <div key={idx} className="rounded border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Step {step.sequenceNo}</span>
            {steps.length > 1 && (
              <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeStep(idx)}>Remove</button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Step Name</label>
              <input className="input-field text-xs" value={step.name} onChange={(e) => updateStep(idx, 'name', e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Assignee Strategy</label>
              <select className="input-field text-xs" value={step.assigneeStrategy} onChange={(e) => updateStep(idx, 'assigneeStrategy', e.target.value)}>
                {ASSIGNEE_STRATEGIES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">On Complete</label>
              <select className="input-field text-xs" value={step.onCompleteAction} onChange={(e) => updateStep(idx, 'onCompleteAction', e.target.value)}>
                {ON_COMPLETE_ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">SLA Hours</label>
              <input type="number" className="input-field text-xs" value={step.slaHours ?? ''} onChange={(e) => updateStep(idx, 'slaHours', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Assignee Value (ID)</label>
              <input className="input-field text-xs" value={step.assigneeValue ?? ''} onChange={(e) => updateStep(idx, 'assigneeValue', e.target.value || undefined)} />
            </div>
            <label className="flex items-center gap-1 text-xs cursor-pointer pt-4">
              <input type="checkbox" checked={step.requiresAttachment} onChange={(e) => updateStep(idx, 'requiresAttachment', e.target.checked)} />
              Requires Attachment
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer pt-4">
              <input type="checkbox" checked={step.requiresApproval} onChange={(e) => updateStep(idx, 'requiresApproval', e.target.checked)} />
              Requires Approval
            </label>
          </div>
        </div>
      ))}
      <button type="button" className="text-xs text-primary hover:underline" onClick={addStep}>+ Add Step</button>
      <div>
        <button type="submit" className="primary-button">{workflow?.id ? 'Update Workflow' : 'Create Workflow'}</button>
      </div>
    </form>
  );
}

/* ---- Automation Rules Tab ---- */
function AutomationTab({
  rules, canManage, editing, showNew, onEdit, onCancelEdit, onToggleNew, onSaved, onDelete, onToggleActive,
}: {
  rules: AutomationRule[];
  canManage: boolean;
  editing: AutomationRule | null;
  showNew: boolean;
  onEdit: (r: AutomationRule) => void;
  onCancelEdit: () => void;
  onToggleNew: () => void;
  onSaved: () => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Automation Rules</h2>
        {canManage && (
          <button className="primary-button" onClick={onToggleNew}>
            {showNew ? 'Cancel' : 'Add Workflow'}
          </button>
        )}
      </div>

      {showNew && <AutomationRuleForm onSaved={onSaved} />}
      {editing && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Editing: {editing.name}</p>
            <button className="text-xs text-primary hover:underline" onClick={onCancelEdit}>Cancel</button>
          </div>
          <AutomationRuleForm rule={editing} onSaved={onSaved} />
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="panel">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{rule.name}</h3>
                {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-1 text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </span>
                {canManage && (
                  <>
                    <button className="text-xs text-primary hover:underline" onClick={() => onToggleActive(rule.id, rule.isActive)}>
                      {rule.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button className="text-xs text-primary hover:underline" onClick={() => onEdit(rule)}>Edit</button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => onDelete(rule.id)}>Delete</button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Events</p>
                {rule.events.map((e, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs mb-1">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{e.entity}</span>
                    <span className="rounded bg-accent px-1.5 py-0.5">{e.type.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Conditions</p>
                {rule.conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions (always matches)</p>}
                {rule.conditions.map((c, i) => (
                  <p key={i} className="text-xs mb-1">
                    {i > 0 && <span className="font-semibold text-muted-foreground mr-1">{c.logic?.toUpperCase() || 'AND'}</span>}
                    <span className="font-medium">{c.field}</span>{' '}
                    <span className="text-muted-foreground">{c.operator.replace(/_/g, ' ')}</span>{' '}
                    {c.value != null && <span className="font-mono">{Array.isArray(c.value) ? c.value.join(', ') : String(c.value)}</span>}
                  </p>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Actions</p>
                {rule.actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs mb-1">
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800 dark:bg-green-900/30 dark:text-green-300">{a.type.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-muted-foreground">{a.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="panel py-6 text-center text-muted-foreground">No automation rules yet</div>
        )}
      </div>
    </>
  );
}

/* ---- Automation Rule Form (Event → Condition → Action builder) ---- */
function AutomationRuleForm({ rule, onSaved }: { rule?: AutomationRule; onSaved: () => void }) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [events, setEvents] = useState<{ entity: string; type: string }[]>(
    rule?.events?.length ? rule.events : [{ entity: 'task', type: 'created' }],
  );
  const [conditions, setConditions] = useState<{ field: string; operator: string; value: string; logic: string }[]>(
    rule?.conditions?.length
      ? rule.conditions.map((c) => ({ field: c.field, operator: c.operator, value: Array.isArray(c.value) ? c.value.join(',') : (c.value ?? ''), logic: c.logic || 'and' }))
      : [],
  );
  const [actions, setActions] = useState<{ type: string; value: string }[]>(
    rule?.actions?.length ? rule.actions : [{ type: 'set_status', value: 'assigned' }],
  );
  const [error, setError] = useState('');

  const addEvent = () => setEvents([...events, { entity: 'task', type: 'created' }]);
  const removeEvent = (i: number) => setEvents(events.filter((_, idx) => idx !== i));
  const updateEvent = (i: number, field: string, val: string) => {
    const updated = [...events];
    (updated[i] as Record<string, string>)[field] = val;
    setEvents(updated);
  };

  const addCondition = (logic: string) => setConditions([...conditions, { field: 'status', operator: 'equals', value: '', logic }]);
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, field: string, val: string) => {
    const updated = [...conditions];
    (updated[i] as Record<string, string>)[field] = val;
    setConditions(updated);
  };

  const addAction = () => setActions([...actions, { type: 'set_status', value: '' }]);
  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, field: string, val: string) => {
    const updated = [...actions];
    (updated[i] as Record<string, string>)[field] = val;
    setActions(updated);
  };

  const getValueOptions = (actionType: string): string[] | null => {
    if (actionType === 'set_status') return TASK_STATUSES;
    if (actionType === 'set_priority') return PRIORITIES;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = {
        name,
        description,
        events,
        conditions: conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.operator === 'in' || c.operator === 'not_in' ? c.value.split(',').map((v) => v.trim()) : c.operator === 'is_null' || c.operator === 'is_not_null' ? null : c.value,
          logic: c.logic,
        })),
        actions,
      };
      if (rule?.id) {
        await api(`/automation-rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/automation-rules', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Rule Name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {/* Events Section */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Events</p>
        <p className="text-xs text-muted-foreground">An event automatically triggers to check conditions and perform a set of pre-defined actions</p>
        {events.map((evt, i) => (
          <div key={i} className="flex items-center gap-2">
            <select className="input-field text-xs" value={evt.entity} onChange={(e) => updateEvent(i, 'entity', e.target.value)}>
              {EVENT_ENTITIES.map((en) => <option key={en} value={en}>{en.charAt(0).toUpperCase() + en.slice(1)}</option>)}
            </select>
            <select className="input-field text-xs" value={evt.type} onChange={(e) => updateEvent(i, 'type', e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
            <button type="button" className="icon-button text-xs" onClick={() => removeEvent(i)} title="Remove">&times;</button>
          </div>
        ))}
        <button type="button" className="text-xs text-primary hover:underline" onClick={addEvent}>+ Add More</button>
      </div>

      <hr className="border-border" />

      {/* Conditions Section */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Conditions</p>
        <p className="text-xs text-muted-foreground">Conditions are sets of rules which check for specific scenarios</p>
        {conditions.map((cond, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {i > 0 && (
              <span className="rounded bg-accent px-2 py-1 text-[11px] font-semibold uppercase">{cond.logic}</span>
            )}
            <select className="input-field text-xs" style={{ maxWidth: 160 }} value={cond.field} onChange={(e) => updateCondition(i, 'field', e.target.value)}>
              <option value="">Select a Condition</option>
              {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select className="input-field text-xs" style={{ maxWidth: 140 }} value={cond.operator} onChange={(e) => updateCondition(i, 'operator', e.target.value)}>
              {CONDITION_OPERATORS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
            </select>
            {cond.operator !== 'is_null' && cond.operator !== 'is_not_null' && (
              <input className="input-field text-xs" style={{ maxWidth: 180 }} placeholder="Value" value={cond.value} onChange={(e) => updateCondition(i, 'value', e.target.value)} />
            )}
            <button type="button" className="icon-button text-xs" onClick={() => removeCondition(i)} title="Remove">&times;</button>
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => addCondition('or')}>+ OR</button>
          <button type="button" className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => addCondition('and')}>+ AND</button>
        </div>
      </div>

      <hr className="border-border" />

      {/* Actions Section */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Actions</p>
        <p className="text-xs text-muted-foreground">Actions help you automate tickets</p>
        {actions.map((act, i) => {
          const valueOptions = getValueOptions(act.type);
          return (
            <div key={i} className="flex items-center gap-2">
              <select className="input-field text-xs" value={act.type} onChange={(e) => updateAction(i, 'type', e.target.value)}>
                <option value="">Select an action</option>
                {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
              </select>
              {valueOptions ? (
                <select className="input-field text-xs" value={act.value} onChange={(e) => updateAction(i, 'value', e.target.value)}>
                  <option value="">Select...</option>
                  {valueOptions.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                </select>
              ) : (
                <input className="input-field text-xs" placeholder="Value (ID or text)" value={act.value} onChange={(e) => updateAction(i, 'value', e.target.value)} />
              )}
              <button type="button" className="icon-button text-xs" onClick={() => removeAction(i)} title="Remove">&times;</button>
            </div>
          );
        })}
        <button type="button" className="text-xs text-primary hover:underline" onClick={addAction}>+ Add More</button>
      </div>

      <div>
        <button type="submit" className="primary-button">{rule?.id ? 'Update Workflow' : 'Add Workflow'}</button>
      </div>
    </form>
  );
}
