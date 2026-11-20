import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type {
  Agent,
  AgentConnectionStatus,
  AgentConnectionType,
  AgentProvider,
  Execution,
  Project,
  ProjectStatus,
  PullRequestStatus,
  Task,
  TaskPriority,
  TaskStatus,
  UserProfile,
} from '../../src/shared/types.ts';
import {
  calculateAnalyticsSummary,
  calculateDashboardMetrics,
  canTransitionTaskStatus,
  isValidHttpUrl,
  validateAgentPayload,
  validateProjectPayload,
  validateTaskPayload,
} from '../../src/shared/logic.ts';
import { maskSecret, storage } from '../storage.ts';
import { resolveAgentAdapter } from '../services/agentAdapters.ts';
import { githubService } from '../services/githubService.ts';

interface AuthedRequest extends Request {
  user?: UserProfile;
  authToken?: string;
}

function getTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getTokenFromHeader(req);
  if (!token) {
    res.status(401).json({ error: '認証が必要です。サインインしてください。' });
    return;
  }
  const user = storage.findUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'セッションの有効期限が切れています。再度サインインしてください。' });
    return;
  }
  req.user = user;
  req.authToken = token;
  next();
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, mode: 'server-persistence', timestamp: new Date().toISOString() });
  });

  // --- Auth Routes ---
  router.post('/auth/login', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const displayName =
      typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!email || !email.includes('@') || email.length > 120) {
      res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
      return;
    }
    const user = storage.findOrCreateUser(email, displayName);
    const session = storage.createSession(user.id);
    res.json({ token: session.token, user });
  });

  router.post('/auth/demo', (_req, res) => {
    const user = storage.getDemoUser();
    const session = storage.createSession(user.id);
    res.json({ token: session.token, user });
  });

  router.post('/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    if (req.authToken) {
      storage.removeSession(req.authToken);
    }
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  router.post('/auth/onboarding/complete', requireAuth, (req: AuthedRequest, res) => {
    const user = storage.getDb().users.find((u) => u.id === req.user!.id);
    if (user) {
      user.onboardingCompleted = true;
      storage.save();
    }
    res.json({ user });
  });

  // --- Dashboard ---
  router.get('/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const projects = db.projects.filter((p) => p.userId === userId);
    const agents = db.agents.filter((a) => a.userId === userId);
    const tasks = db.tasks.filter((t) => t.userId === userId);
    const executions = db.executions
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    const metrics = calculateDashboardMetrics({ projects, agents, tasks, executions });

    const agentActivities = agents.map((agent) => {
      const runningExec = executions.find(
        (e) => e.agentId === agent.id && (e.status === 'running' || e.status === 'queued'),
      );
      const latestExec = runningExec ?? executions.find((e) => e.agentId === agent.id) ?? null;
      const currentTask = latestExec ? taskMap.get(latestExec.taskId) ?? null : null;
      const currentProject = currentTask ? projectMap.get(currentTask.projectId) ?? null : null;
      return {
        agentId: agent.id,
        agentName: agent.name,
        provider: agent.provider,
        connectionType: agent.connectionType,
        connectionStatus: agent.connectionStatus,
        currentTaskId: currentTask?.id ?? null,
        currentTaskTitle: currentTask?.title ?? null,
        projectId: currentProject?.id ?? null,
        projectName: currentProject?.name ?? null,
        executionStatus: latestExec?.status ?? null,
        lastActivityAt: agent.lastActivityAt ?? latestExec?.updatedAt ?? null,
      };
    });

    const recentExecutions = executions.slice(0, 8).map((exec) => ({
      ...exec,
      taskTitle: taskMap.get(exec.taskId)?.title ?? '削除済みタスク',
      projectName: projectMap.get(exec.projectId)?.name ?? '削除済みプロジェクト',
      agentName: agentMap.get(exec.agentId)?.name ?? '削除済みエージェント',
    }));

    const recentPullRequests = tasks
      .filter((t) => t.pullRequest !== null)
      .sort((a, b) =>
        (b.pullRequest?.updatedAt ?? b.updatedAt).localeCompare(
          a.pullRequest?.updatedAt ?? a.updatedAt,
        ),
      )
      .slice(0, 8)
      .map((t) => ({
        taskId: t.id,
        taskTitle: t.title,
        projectId: t.projectId,
        projectName: projectMap.get(t.projectId)?.name ?? '',
        pullRequest: t.pullRequest!,
      }));

    res.json({
      metrics,
      agentActivities,
      recentExecutions,
      recentPullRequests,
    });
  });

  // --- Projects ---
  router.get('/projects', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const projects = storage
      .getDb()
      .projects.filter((p) => p.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ projects });
  });

  router.post('/projects', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const repositoryUrl =
      typeof req.body?.repositoryUrl === 'string' ? req.body.repositoryUrl.trim() : '';
    const defaultBranch =
      typeof req.body?.defaultBranch === 'string' && req.body.defaultBranch.trim()
        ? req.body.defaultBranch.trim()
        : 'main';
    const status: ProjectStatus = ['active', 'paused', 'archived'].includes(req.body?.status)
      ? req.body.status
      : 'active';

    const validationError = validateProjectPayload({ name, repositoryUrl, defaultBranch });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: storage.generateId('proj'),
      userId,
      name,
      description,
      repositoryUrl,
      defaultBranch,
      status,
      createdAt: now,
      updatedAt: now,
    };

    storage.getDb().projects.push(project);
    storage.logActivity({
      userId,
      projectId: project.id,
      eventType: 'project_created',
      description: `プロジェクト「${project.name}」を作成しました`,
    });
    storage.save();
    res.status(201).json({ project });
  });

  router.get('/projects/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const project = db.projects.find((p) => p.id === req.params.id && p.userId === userId);
    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つかりません。' });
      return;
    }

    const tasks = db.tasks
      .filter((t) => t.userId === userId && t.projectId === project.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const executions = db.executions
      .filter((e) => e.userId === userId && e.projectId === project.id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const assignedAgentIds = new Set([
      ...tasks.map((t) => t.assignedAgentId).filter((id): id is string => Boolean(id)),
      ...executions.map((e) => e.agentId),
    ]);
    const agents = db.agents.filter(
      (a) => a.userId === userId && assignedAgentIds.has(a.id),
    );
    const activityLogs = db.activityLogs
      .filter((a) => a.userId === userId && a.projectId === project.id)
      .slice(0, 50);

    res.json({ project, tasks, executions, agents, activityLogs });
  });

  router.patch('/projects/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const project = db.projects.find((p) => p.id === req.params.id && p.userId === userId);
    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つかりません。' });
      return;
    }

    const nextName =
      typeof req.body?.name === 'string' ? req.body.name.trim() : project.name;
    const nextDescription =
      typeof req.body?.description === 'string'
        ? req.body.description.trim()
        : project.description;
    const nextRepo =
      typeof req.body?.repositoryUrl === 'string'
        ? req.body.repositoryUrl.trim()
        : project.repositoryUrl;
    const nextBranch =
      typeof req.body?.defaultBranch === 'string'
        ? req.body.defaultBranch.trim()
        : project.defaultBranch;
    const nextStatus: ProjectStatus = ['active', 'paused', 'archived'].includes(req.body?.status)
      ? req.body.status
      : project.status;

    const validationError = validateProjectPayload({
      name: nextName,
      repositoryUrl: nextRepo,
      defaultBranch: nextBranch,
    });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    project.name = nextName;
    project.description = nextDescription;
    project.repositoryUrl = nextRepo;
    project.defaultBranch = nextBranch;
    project.status = nextStatus;
    project.updatedAt = new Date().toISOString();

    storage.logActivity({
      userId,
      projectId: project.id,
      eventType: 'project_updated',
      description: `プロジェクト「${project.name}」の設定を更新しました`,
    });
    storage.save();
    res.json({ project });
  });

  router.delete('/projects/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const project = db.projects.find((p) => p.id === req.params.id && p.userId === userId);
    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つかりません。' });
      return;
    }

    db.projects = db.projects.filter((p) => !(p.id === project.id && p.userId === userId));
    db.tasks = db.tasks.filter((t) => !(t.projectId === project.id && t.userId === userId));
    db.executions = db.executions.filter(
      (e) => !(e.projectId === project.id && e.userId === userId),
    );
    storage.logActivity({
      userId,
      projectId: null,
      eventType: 'project_deleted',
      description: `プロジェクト「${project.name}」と関連タスクを削除しました`,
    });
    storage.save();
    res.json({ ok: true });
  });

  // --- Tasks ---
  router.get('/tasks', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    let tasks = storage.getDb().tasks.filter((t) => t.userId === userId);
    if (projectId) tasks = tasks.filter((t) => t.projectId === projectId);
    if (status) tasks = tasks.filter((t) => t.status === status);
    tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ tasks });
  });

  router.post('/tasks', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const assignedAgentId =
      typeof req.body?.assignedAgentId === 'string' && req.body.assignedAgentId.trim()
        ? req.body.assignedAgentId.trim()
        : null;
    const priority: TaskPriority = ['critical', 'high', 'medium', 'low'].includes(
      req.body?.priority,
    )
      ? req.body.priority
      : 'medium';
    const status: TaskStatus = ['backlog', 'ready'].includes(req.body?.status)
      ? req.body.status
      : 'ready';
    const dueDate =
      typeof req.body?.dueDate === 'string' && req.body.dueDate.trim()
        ? req.body.dueDate.trim()
        : null;

    const validationError = validateTaskPayload({ title, projectId });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const project = db.projects.find((p) => p.id === projectId && p.userId === userId);
    if (!project) {
      res.status(404).json({ error: '指定されたプロジェクトが見つかりません。' });
      return;
    }

    if (assignedAgentId) {
      const agent = db.agents.find((a) => a.id === assignedAgentId && a.userId === userId);
      if (!agent) {
        res.status(404).json({ error: '指定されたエージェントが見つかりません。' });
        return;
      }
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: storage.generateId('task'),
      userId,
      projectId,
      title,
      description,
      assignedAgentId,
      priority,
      status,
      dueDate,
      pullRequest: null,
      createdAt: now,
      updatedAt: now,
    };

    db.tasks.push(task);
    storage.logActivity({
      userId,
      projectId,
      taskId: task.id,
      agentId: assignedAgentId,
      eventType: 'task_created',
      description: `タスク「${task.title}」を作成しました`,
    });
    if (assignedAgentId) {
      const agent = db.agents.find((a) => a.id === assignedAgentId);
      storage.logActivity({
        userId,
        projectId,
        taskId: task.id,
        agentId: assignedAgentId,
        eventType: 'task_assigned',
        description: `タスク「${task.title}」を ${agent?.name ?? 'エージェント'} に割り当てました`,
      });
    }
    storage.save();
    res.status(201).json({ task });
  });

  router.get('/tasks/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const task = db.tasks.find((t) => t.id === req.params.id && t.userId === userId);
    if (!task) {
      res.status(404).json({ error: 'タスクが見つかりません。' });
      return;
    }
    const project = db.projects.find((p) => p.id === task.projectId && p.userId === userId) ?? null;
    const agent = task.assignedAgentId
      ? db.agents.find((a) => a.id === task.assignedAgentId && a.userId === userId) ?? null
      : null;
    const executions = db.executions
      .filter((e) => e.userId === userId && e.taskId === task.id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    res.json({ task, project, agent, executions });
  });

  router.patch('/tasks/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const task = db.tasks.find((t) => t.id === req.params.id && t.userId === userId);
    if (!task) {
      res.status(404).json({ error: 'タスクが見つかりません。' });
      return;
    }

    const nextTitle =
      typeof req.body?.title === 'string' ? req.body.title.trim() : task.title;
    const validationError = validateTaskPayload({ title: nextTitle, projectId: task.projectId });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    if (typeof req.body?.status === 'string' && req.body.status !== task.status) {
      const targetStatus = req.body.status as TaskStatus;
      if (!canTransitionTaskStatus(task.status, targetStatus)) {
        res.status(400).json({
          error: `タスクステータスを「${task.status}」から「${targetStatus}」へ直接変更することはできません。`,
        });
        return;
      }
      task.status = targetStatus;
    }

    if (req.body?.assignedAgentId !== undefined) {
      const nextAgentId =
        typeof req.body.assignedAgentId === 'string' && req.body.assignedAgentId.trim()
          ? req.body.assignedAgentId.trim()
          : null;
      if (nextAgentId) {
        const exists = db.agents.some((a) => a.id === nextAgentId && a.userId === userId);
        if (!exists) {
          res.status(404).json({ error: '指定されたエージェントが見つかりません。' });
          return;
        }
      }
      if (nextAgentId !== task.assignedAgentId) {
        task.assignedAgentId = nextAgentId;
        if (nextAgentId) {
          const agent = db.agents.find((a) => a.id === nextAgentId);
          storage.logActivity({
            userId,
            projectId: task.projectId,
            taskId: task.id,
            agentId: nextAgentId,
            eventType: 'task_assigned',
            description: `タスク「${task.title}」を ${agent?.name ?? 'エージェント'} に割り当てました`,
          });
        }
      }
    }

    if (typeof req.body?.description === 'string') {
      task.description = req.body.description.trim();
    }
    if (['critical', 'high', 'medium', 'low'].includes(req.body?.priority)) {
      task.priority = req.body.priority;
    }
    if (req.body?.dueDate !== undefined) {
      task.dueDate =
        typeof req.body.dueDate === 'string' && req.body.dueDate.trim()
          ? req.body.dueDate.trim()
          : null;
    }

    task.title = nextTitle;
    task.updatedAt = new Date().toISOString();

    storage.logActivity({
      userId,
      projectId: task.projectId,
      taskId: task.id,
      agentId: task.assignedAgentId,
      eventType: 'task_updated',
      description: `タスク「${task.title}」を更新しました（ステータス: ${task.status}）`,
    });
    storage.save();
    res.json({ task });
  });

  router.post('/tasks/:id/pr', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const task = db.tasks.find((t) => t.id === req.params.id && t.userId === userId);
    if (!task) {
      res.status(404).json({ error: 'タスクが見つかりません。' });
      return;
    }

    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const branch = typeof req.body?.branch === 'string' ? req.body.branch.trim() : '';
    const commitSha =
      typeof req.body?.commitSha === 'string' ? req.body.commitSha.trim() : '';
    const status: PullRequestStatus = ['open', 'merged', 'closed', 'draft'].includes(
      req.body?.status,
    )
      ? req.body.status
      : 'open';

    if (!url || !isValidHttpUrl(url)) {
      res.status(400).json({ error: '有効な Pull Request URL を入力してください。' });
      return;
    }

    const project = db.projects.find((p) => p.id === task.projectId && p.userId === userId);
    task.pullRequest = githubService.buildPullRequestRef({
      url,
      title: title || task.title,
      repositoryUrl: project?.repositoryUrl,
      branch,
      commitSha,
      status,
      isSimulated: false,
    });
    task.updatedAt = new Date().toISOString();

    storage.logActivity({
      userId,
      projectId: task.projectId,
      taskId: task.id,
      agentId: task.assignedAgentId,
      eventType: 'pr_linked',
      description: `Pull Request をタスク「${task.title}」に関連付けました: ${url}`,
    });
    storage.save();
    res.json({ task });
  });

  router.delete('/tasks/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const task = db.tasks.find((t) => t.id === req.params.id && t.userId === userId);
    if (!task) {
      res.status(404).json({ error: 'タスクが見つかりません。' });
      return;
    }
    db.tasks = db.tasks.filter((t) => !(t.id === task.id && t.userId === userId));
    db.executions = db.executions.filter(
      (e) => !(e.taskId === task.id && e.userId === userId),
    );
    storage.save();
    res.json({ ok: true });
  });

  // --- Agents ---
  router.get('/agents', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const agents = db.agents
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((agent) => {
        const agentExecs = db.executions.filter(
          (e) => e.userId === userId && e.agentId === agent.id,
        );
        return {
          ...agent,
          runningCount: agentExecs.filter(
            (e) => e.status === 'running' || e.status === 'queued',
          ).length,
          completedCount: agentExecs.filter((e) => e.status === 'completed').length,
        };
      });
    res.json({ agents });
  });

  router.post('/agents', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const provider = req.body?.provider as AgentProvider;
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const connectionType: AgentConnectionType = [
      'mock',
      'api_key',
      'webhook',
      'oauth',
    ].includes(req.body?.connectionType)
      ? req.body.connectionType
      : 'mock';
    const endpointUrl =
      typeof req.body?.endpointUrl === 'string' ? req.body.endpointUrl.trim() : '';
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    const simulateFailure = Boolean(req.body?.simulateFailure);

    const validationError = validateAgentPayload({ name, provider, endpointUrl });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const now = new Date().toISOString();
    const id = storage.generateId('agent');
    const secrets = storage.getUserSecrets(userId);
    if (apiKey) {
      secrets.agentKeys[id] = apiKey;
    }

    const hasApiKey = Boolean(apiKey);
    const connectionStatus: AgentConnectionStatus =
      connectionType === 'mock'
        ? 'connected'
        : hasApiKey || Boolean(endpointUrl)
          ? 'disconnected'
          : 'not_configured';

    const agent: Agent = {
      id,
      userId,
      name,
      provider,
      description,
      connectionType,
      connectionStatus,
      configuration: {
        model: model || undefined,
        endpointUrl: endpointUrl || undefined,
        hasApiKey,
        maskedApiKey: maskSecret(apiKey),
        simulateFailure,
        simulatedLatencyMs: 3000,
      },
      lastActivityAt: null,
      createdAt: now,
      updatedAt: now,
    };

    storage.getDb().agents.push(agent);
    storage.logActivity({
      userId,
      agentId: agent.id,
      eventType: 'agent_created',
      description: `エージェント「${agent.name}」（${connectionType === 'mock' ? 'Mock Adapter' : '外部プロバイダー設定'}）を登録しました`,
    });
    storage.save();
    res.status(201).json({ agent });
  });

  router.patch('/agents/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const agent = db.agents.find((a) => a.id === req.params.id && a.userId === userId);
    if (!agent) {
      res.status(404).json({ error: 'エージェントが見つかりません。' });
      return;
    }

    const nextName =
      typeof req.body?.name === 'string' ? req.body.name.trim() : agent.name;
    const nextProvider: AgentProvider = ['claude_code', 'openai_codex', 'devin', 'custom'].includes(
      req.body?.provider,
    )
      ? req.body.provider
      : agent.provider;
    const nextEndpoint =
      typeof req.body?.endpointUrl === 'string'
        ? req.body.endpointUrl.trim()
        : agent.configuration.endpointUrl ?? '';

    const validationError = validateAgentPayload({
      name: nextName,
      provider: nextProvider,
      endpointUrl: nextEndpoint,
    });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const nextConnectionType: AgentConnectionType = [
      'mock',
      'api_key',
      'webhook',
      'oauth',
    ].includes(req.body?.connectionType)
      ? req.body.connectionType
      : agent.connectionType;

    const secrets = storage.getUserSecrets(userId);
    if (typeof req.body?.apiKey === 'string' && req.body.apiKey.trim()) {
      const cleanKey = req.body.apiKey.trim();
      secrets.agentKeys[agent.id] = cleanKey;
      agent.configuration.hasApiKey = true;
      agent.configuration.maskedApiKey = maskSecret(cleanKey);
    }

    agent.name = nextName;
    agent.provider = nextProvider;
    agent.description =
      typeof req.body?.description === 'string'
        ? req.body.description.trim()
        : agent.description;
    agent.connectionType = nextConnectionType;
    agent.configuration.endpointUrl = nextEndpoint || undefined;
    if (typeof req.body?.model === 'string') {
      agent.configuration.model = req.body.model.trim() || undefined;
    }
    if (typeof req.body?.simulateFailure === 'boolean') {
      agent.configuration.simulateFailure = req.body.simulateFailure;
    }

    agent.connectionStatus =
      nextConnectionType === 'mock'
        ? 'connected'
        : agent.configuration.hasApiKey || Boolean(agent.configuration.endpointUrl)
          ? 'disconnected'
          : 'not_configured';

    agent.updatedAt = new Date().toISOString();

    storage.logActivity({
      userId,
      agentId: agent.id,
      eventType: 'agent_updated',
      description: `エージェント「${agent.name}」の設定を更新しました`,
    });
    storage.save();
    res.json({ agent });
  });

  router.post('/agents/:id/test', requireAuth, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const agent = db.agents.find((a) => a.id === req.params.id && a.userId === userId);
    if (!agent) {
      res.status(404).json({ error: 'エージェントが見つかりません。' });
      return;
    }

    const secrets = storage.getUserSecrets(userId);
    const hasSecret =
      Boolean(secrets.agentKeys[agent.id]) ||
      Boolean(agent.configuration.endpointUrl) ||
      (agent.provider === 'claude_code' && Boolean(secrets.claudeApiKey)) ||
      (agent.provider === 'openai_codex' && Boolean(secrets.codexApiKey)) ||
      (agent.provider === 'devin' && Boolean(secrets.devinApiKey));

    const adapter = resolveAgentAdapter(agent);
    const result = await adapter.testConnection(agent, hasSecret);

    agent.connectionStatus = result.status;
    agent.updatedAt = result.checkedAt;

    storage.logActivity({
      userId,
      agentId: agent.id,
      eventType: 'agent_tested',
      description: `エージェント「${agent.name}」の接続テストを実施（結果: ${result.status}）`,
    });
    storage.save();
    res.json({ result, agent });
  });

  router.delete('/agents/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const agent = db.agents.find((a) => a.id === req.params.id && a.userId === userId);
    if (!agent) {
      res.status(404).json({ error: 'エージェントが見つかりません。' });
      return;
    }
    db.agents = db.agents.filter((a) => !(a.id === agent.id && a.userId === userId));
    for (const task of db.tasks) {
      if (task.userId === userId && task.assignedAgentId === agent.id) {
        task.assignedAgentId = null;
      }
    }
    const secrets = storage.getUserSecrets(userId);
    delete secrets.agentKeys[agent.id];
    storage.save();
    res.json({ ok: true });
  });

  // --- Executions ---
  router.get('/executions', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';

    let execs = db.executions.filter((e) => e.userId === userId);
    if (projectId) execs = execs.filter((e) => e.projectId === projectId);
    if (agentId) execs = execs.filter((e) => e.agentId === agentId);
    if (status) execs = execs.filter((e) => e.status === status);
    execs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    const projectMap = new Map(
      db.projects.filter((p) => p.userId === userId).map((p) => [p.id, p.name]),
    );
    const taskMap = new Map(
      db.tasks.filter((t) => t.userId === userId).map((t) => [t.id, t.title]),
    );
    const agentMap = new Map(
      db.agents.filter((a) => a.userId === userId).map((a) => [a.id, a.name]),
    );

    res.json({
      executions: execs.map((e) => ({
        ...e,
        projectName: projectMap.get(e.projectId) ?? '不明なプロジェクト',
        taskTitle: taskMap.get(e.taskId) ?? '不明なタスク',
        agentName: agentMap.get(e.agentId) ?? '不明なエージェント',
      })),
    });
  });

  router.get('/executions/:id', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const execution = db.executions.find(
      (e) => e.id === req.params.id && e.userId === userId,
    );
    if (!execution) {
      res.status(404).json({ error: '実行レコードが見つかりません。' });
      return;
    }
    const project =
      db.projects.find((p) => p.id === execution.projectId && p.userId === userId) ?? null;
    const task =
      db.tasks.find((t) => t.id === execution.taskId && t.userId === userId) ?? null;
    const agent =
      db.agents.find((a) => a.id === execution.agentId && a.userId === userId) ?? null;

    res.json({ execution, project, task, agent });
  });

  router.post('/executions', requireAuth, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    const taskId = typeof req.body?.taskId === 'string' ? req.body.taskId.trim() : '';
    const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId.trim() : '';
    const instructions =
      typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';

    if (!projectId || !taskId || !agentId || !instructions) {
      res.status(400).json({
        error: 'プロジェクト、タスク、エージェント、実行指示をすべて指定してください。',
      });
      return;
    }

    const project = db.projects.find((p) => p.id === projectId && p.userId === userId);
    const task = db.tasks.find(
      (t) => t.id === taskId && t.projectId === projectId && t.userId === userId,
    );
    const agent = db.agents.find((a) => a.id === agentId && a.userId === userId);

    if (!project || !task || !agent) {
      res.status(404).json({
        error: '指定されたプロジェクト・タスク・エージェントが見つかりません。',
      });
      return;
    }

    const duplicateRunning = db.executions.some(
      (e) =>
        e.userId === userId &&
        e.taskId === task.id &&
        (e.status === 'queued' || e.status === 'running'),
    );
    if (duplicateRunning) {
      res.status(409).json({
        error: 'このタスクにはすでに待機中または実行中のプロセスが存在します。',
      });
      return;
    }

    const adapter = resolveAgentAdapter(agent);
    if (agent.connectionType !== 'mock' && !adapter.supportsRealExecution) {
      res.status(422).json({
        error:
          '選択されたエージェントは実外部プロバイダーモードですが、外部ワーカーランタイムが未接続のため実行できません。デモを実行するには Mock Adapter モードのエージェントを選択してください。',
      });
      return;
    }

    const now = new Date().toISOString();
    const execution: Execution = {
      id: storage.generateId('exec'),
      userId,
      projectId: project.id,
      taskId: task.id,
      agentId: agent.id,
      provider: agent.provider,
      executionMode: agent.connectionType === 'mock' ? 'mock' : 'real',
      isSimulated: agent.connectionType === 'mock',
      status: 'queued',
      input: instructions,
      output: null,
      error: null,
      logs: [
        {
          id: storage.generateId('log'),
          timestamp: now,
          level: 'info',
          phase: 'キュー登録',
          message:
            agent.connectionType === 'mock'
              ? `[シミュレーション] ${agent.name} の実行キューに登録されました。`
              : `${agent.name} の実行キューに登録されました。`,
        },
      ],
      startedAt: now,
      completedAt: null,
      durationMs: null,
      tokenUsage: null,
      estimatedCostUsd: null,
      costReported: false,
      pullRequestUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    db.executions.unshift(execution);
    task.assignedAgentId = agent.id;
    task.status = 'queued';
    task.updatedAt = now;
    agent.lastActivityAt = now;
    agent.updatedAt = now;

    storage.logActivity({
      userId,
      projectId: project.id,
      taskId: task.id,
      agentId: agent.id,
      eventType: 'execution_started',
      description: `${agent.name} でタスク「${task.title}」の${execution.isSimulated ? 'モック' : ''}実行を開始しました`,
    });
    storage.save();

    await adapter.startExecution({
      executionId: execution.id,
      userId,
      agent,
      taskTitle: task.title,
      projectName: project.name,
      repositoryUrl: project.repositoryUrl,
      instructions,
    });

    res.status(201).json({ execution });
  });

  router.post('/executions/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const execution = db.executions.find(
      (e) => e.id === req.params.id && e.userId === userId,
    );
    if (!execution) {
      res.status(404).json({ error: '実行レコードが見つかりません。' });
      return;
    }
    const agent = db.agents.find((a) => a.id === execution.agentId && a.userId === userId);
    if (!agent) {
      res.status(404).json({ error: 'エージェントが見つかりません。' });
      return;
    }
    const adapter = resolveAgentAdapter(agent);
    const cancelled = await adapter.cancel(execution.id, userId);
    if (!cancelled) {
      res.status(400).json({ error: 'この実行はすでに終了しているかキャンセル非対応です。' });
      return;
    }
    res.json({ execution });
  });

  // --- Analytics & Activity ---
  router.get('/analytics', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const fromDate = typeof req.query.from === 'string' && req.query.from ? req.query.from : null;
    const toDate = typeof req.query.to === 'string' && req.query.to ? req.query.to : null;
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId ? req.query.projectId : null;

    const projects = db.projects.filter((p) => p.userId === userId);
    const agents = db.agents.filter((a) => a.userId === userId);
    let tasks = db.tasks.filter((t) => t.userId === userId);
    let executions = db.executions.filter((e) => e.userId === userId);
    if (projectId) {
      tasks = tasks.filter((t) => t.projectId === projectId);
      executions = executions.filter((e) => e.projectId === projectId);
    }

    const summary = calculateAnalyticsSummary({
      executions,
      agents,
      projects,
      tasks,
      fromDate,
      toDate,
    });
    res.json({ summary });
  });

  router.get('/activity', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : '';
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : '';
    const fromDate = typeof req.query.from === 'string' ? req.query.from : '';
    const toDate = typeof req.query.to === 'string' ? req.query.to : '';

    let logs = storage.getDb().activityLogs.filter((l) => l.userId === userId);
    if (projectId) logs = logs.filter((l) => l.projectId === projectId);
    if (agentId) logs = logs.filter((l) => l.agentId === agentId);
    if (eventType) logs = logs.filter((l) => l.eventType === eventType);
    if (fromDate) logs = logs.filter((l) => l.createdAt.slice(0, 10) >= fromDate);
    if (toDate) logs = logs.filter((l) => l.createdAt.slice(0, 10) <= toDate);

    res.json({ logs: logs.slice(0, 120) });
  });

  // --- Settings ---
  router.get('/settings', requireAuth, (req: AuthedRequest, res) => {
    const settings = storage.getUserSettings(req.user!.id);
    res.json({ settings, user: req.user });
  });

  router.patch('/settings', requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const db = storage.getDb();
    const user = db.users.find((u) => u.id === userId)!;
    const settings = storage.getUserSettings(userId);
    const secrets = storage.getUserSecrets(userId);

    if (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) {
      user.displayName = req.body.displayName.trim().slice(0, 80);
    }

    if (req.body?.github) {
      const gh = req.body.github;
      if (typeof gh.username === 'string') settings.github.username = gh.username.trim();
      if (typeof gh.defaultOrg === 'string') settings.github.defaultOrg = gh.defaultOrg.trim();
      if (typeof gh.defaultBranch === 'string' && gh.defaultBranch.trim()) {
        settings.github.defaultBranch = gh.defaultBranch.trim();
      }
      if (typeof gh.personalToken === 'string' && gh.personalToken.trim()) {
        secrets.githubToken = gh.personalToken.trim();
        settings.github.hasPersonalToken = true;
        settings.github.maskedToken = maskSecret(secrets.githubToken);
        settings.github.connected = true;
      }
      if (gh.disconnectToken === true) {
        delete secrets.githubToken;
        settings.github.hasPersonalToken = false;
        settings.github.maskedToken = undefined;
        settings.github.connected = false;
      }
    }

    if (req.body?.providers) {
      const pv = req.body.providers;
      if (pv.claude_code) {
        if (typeof pv.claude_code.defaultModel === 'string') {
          settings.providers.claude_code.defaultModel = pv.claude_code.defaultModel.trim();
        }
        if (typeof pv.claude_code.apiKey === 'string' && pv.claude_code.apiKey.trim()) {
          secrets.claudeApiKey = pv.claude_code.apiKey.trim();
          settings.providers.claude_code.hasApiKey = true;
          settings.providers.claude_code.maskedApiKey = maskSecret(secrets.claudeApiKey);
        }
      }
      if (pv.openai_codex) {
        if (typeof pv.openai_codex.defaultModel === 'string') {
          settings.providers.openai_codex.defaultModel = pv.openai_codex.defaultModel.trim();
        }
        if (typeof pv.openai_codex.apiKey === 'string' && pv.openai_codex.apiKey.trim()) {
          secrets.codexApiKey = pv.openai_codex.apiKey.trim();
          settings.providers.openai_codex.hasApiKey = true;
          settings.providers.openai_codex.maskedApiKey = maskSecret(secrets.codexApiKey);
        }
      }
      if (pv.devin) {
        if (typeof pv.devin.orgId === 'string') {
          settings.providers.devin.orgId = pv.devin.orgId.trim();
        }
        if (typeof pv.devin.apiKey === 'string' && pv.devin.apiKey.trim()) {
          secrets.devinApiKey = pv.devin.apiKey.trim();
          settings.providers.devin.hasApiKey = true;
          settings.providers.devin.maskedApiKey = maskSecret(secrets.devinApiKey);
        }
      }
      if (pv.custom) {
        if (typeof pv.custom.endpointUrl === 'string') {
          const ep = pv.custom.endpointUrl.trim();
          if (ep && !isValidHttpUrl(ep)) {
            res.status(400).json({ error: 'Custom エンドポイントURLが不正です。' });
            return;
          }
          settings.providers.custom.endpointUrl = ep;
        }
        if (typeof pv.custom.apiKey === 'string' && pv.custom.apiKey.trim()) {
          secrets.customApiKey = pv.custom.apiKey.trim();
          settings.providers.custom.hasApiKey = true;
          settings.providers.custom.maskedApiKey = maskSecret(secrets.customApiKey);
        }
      }
    }

    if (req.body?.preferences) {
      const pref = req.body.preferences;
      if (typeof pref.autoPollIntervalSec === 'number') {
        settings.preferences.autoPollIntervalSec = Math.min(Math.max(pref.autoPollIntervalSec, 1), 30);
      }
      if (typeof pref.notifyOnCompletion === 'boolean') {
        settings.preferences.notifyOnCompletion = pref.notifyOnCompletion;
      }
      if (typeof pref.notifyOnFailure === 'boolean') {
        settings.preferences.notifyOnFailure = pref.notifyOnFailure;
      }
    }

    settings.updatedAt = new Date().toISOString();
    storage.logActivity({
      userId,
      eventType: 'settings_updated',
      description: 'ワークスペース設定・連携設定を更新しました',
    });
    storage.save();
    res.json({ settings, user });
  });

  return router;
}
