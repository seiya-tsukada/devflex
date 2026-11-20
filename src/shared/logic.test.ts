import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAnalyticsSummary,
  calculateDashboardMetrics,
  canTransitionExecutionStatus,
  canTransitionTaskStatus,
  extractRepoNameFromUrl,
  validateAgentPayload,
  validateProjectPayload,
  validateTaskPayload,
} from './logic.ts';
import type { Execution, Project, Task } from './types.ts';

test('task status state machine prevents invalid transitions', () => {
  assert.equal(canTransitionTaskStatus('backlog', 'ready'), true);
  assert.equal(canTransitionTaskStatus('ready', 'running'), true);
  assert.equal(canTransitionTaskStatus('backlog', 'completed'), false);
  assert.equal(canTransitionTaskStatus('cancelled', 'completed'), false);
  assert.equal(canTransitionTaskStatus('completed', 'ready'), true);
});

test('execution status state machine locks terminal states', () => {
  assert.equal(canTransitionExecutionStatus('queued', 'running'), true);
  assert.equal(canTransitionExecutionStatus('running', 'completed'), true);
  assert.equal(canTransitionExecutionStatus('completed', 'running'), false);
  assert.equal(canTransitionExecutionStatus('failed', 'completed'), false);
  assert.equal(canTransitionExecutionStatus('cancelled', 'running'), false);
});

test('validation helpers enforce constraints and reject bad URLs', () => {
  assert.equal(
    validateProjectPayload({
      name: 'Billing Core',
      repositoryUrl: 'https://github.com/acme/billing-core',
      defaultBranch: 'main',
    }),
    null,
  );
  assert.ok(validateProjectPayload({ name: 'a', defaultBranch: 'main' }) !== null);
  assert.ok(
    validateProjectPayload({
      name: 'Valid',
      repositoryUrl: 'javascript:alert(1)',
      defaultBranch: 'main',
    }) !== null,
  );
  assert.ok(validateTaskPayload({ title: 'x', projectId: 'p1' }) !== null);
  assert.equal(validateTaskPayload({ title: 'Implement auth', projectId: 'p1' }), null);
  assert.equal(
    validateAgentPayload({ name: 'Claude Alpha', provider: 'claude_code' }),
    null,
  );
  assert.equal(extractRepoNameFromUrl('https://github.com/acme/billing-core.git'), 'acme/billing-core');
});

test('dashboard metrics and analytics reflect stored records accurately', () => {
  const projects: Project[] = [
    {
      id: 'p1',
      userId: 'u1',
      name: 'Core API',
      description: '',
      repositoryUrl: 'https://github.com/acme/core-api',
      defaultBranch: 'main',
      status: 'active',
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    },
  ];
  const tasks: Task[] = [
    {
      id: 't1',
      userId: 'u1',
      projectId: 'p1',
      title: 'Fix auth bug',
      description: '',
      assignedAgentId: 'a1',
      priority: 'high',
      status: 'completed',
      dueDate: null,
      pullRequest: {
        url: 'https://github.com/acme/core-api/pull/42',
        title: 'fix: auth bug',
        repository: 'acme/core-api',
        status: 'open',
        isSimulated: true,
        updatedAt: '2026-11-18T02:00:00.000Z',
      },
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T02:00:00.000Z',
    },
    {
      id: 't2',
      userId: 'u1',
      projectId: 'p1',
      title: 'Add metrics',
      description: '',
      assignedAgentId: 'a1',
      priority: 'medium',
      status: 'ready',
      dueDate: null,
      pullRequest: null,
      createdAt: '2026-11-18T01:00:00.000Z',
      updatedAt: '2026-11-18T01:00:00.000Z',
    },
  ];
  const executions: Execution[] = [
    {
      id: 'e1',
      userId: 'u1',
      projectId: 'p1',
      taskId: 't1',
      agentId: 'a1',
      provider: 'claude_code',
      executionMode: 'mock',
      isSimulated: true,
      status: 'completed',
      input: 'Fix auth',
      output: 'Done',
      error: null,
      logs: [],
      startedAt: '2026-11-18T01:00:00.000Z',
      completedAt: '2026-11-18T01:00:10.000Z',
      durationMs: 10000,
      tokenUsage: 2400,
      estimatedCostUsd: 0.012,
      costReported: true,
      pullRequestUrl: 'https://github.com/acme/core-api/pull/42',
      createdAt: '2026-11-18T01:00:00.000Z',
      updatedAt: '2026-11-18T01:00:10.000Z',
    },
    {
      id: 'e2',
      userId: 'u1',
      projectId: 'p1',
      taskId: 't2',
      agentId: 'a2',
      provider: 'devin',
      executionMode: 'mock',
      isSimulated: true,
      status: 'failed',
      input: 'Add metrics',
      output: null,
      error: 'Simulated timeout',
      logs: [],
      startedAt: '2026-11-18T02:00:00.000Z',
      completedAt: '2026-11-18T02:00:05.000Z',
      durationMs: 5000,
      tokenUsage: null,
      estimatedCostUsd: null,
      costReported: false,
      pullRequestUrl: null,
      createdAt: '2026-11-18T02:00:00.000Z',
      updatedAt: '2026-11-18T02:00:05.000Z',
    },
  ];

  const metrics = calculateDashboardMetrics({
    projects,
    agents: [{ connectionStatus: 'connected' }, { connectionStatus: 'not_configured' }],
    tasks,
    executions,
  });

  assert.equal(metrics.totalProjects, 1);
  assert.equal(metrics.activeAgents, 1);
  assert.equal(metrics.openTasks, 1);
  assert.equal(metrics.completedTasks, 1);
  assert.equal(metrics.pendingPullRequests, 1);
  assert.equal(metrics.runningExecutions, 0);

  const analytics = calculateAnalyticsSummary({
    executions,
    agents: [
      { id: 'a1', name: 'Claude Code Sim', provider: 'claude_code' },
      { id: 'a2', name: 'Devin Sim', provider: 'devin' },
    ],
    projects,
    tasks,
  });

  assert.equal(analytics.totalExecutions, 2);
  assert.equal(analytics.successfulExecutions, 1);
  assert.equal(analytics.failedExecutions, 1);
  assert.equal(analytics.successRatePercent, 50);
  assert.equal(analytics.averageDurationMs, 7500);
  assert.equal(analytics.totalSimulatedCostUsd, 0.012);
  assert.equal(analytics.totalReportedCostUsd, null);
});
