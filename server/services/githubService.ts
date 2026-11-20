import type { PullRequestRef, PullRequestStatus } from '../../src/shared/types.ts';
import { extractRepoNameFromUrl, isValidHttpUrl } from '../../src/shared/logic.ts';

export class GitHubService {
  public validatePullRequestUrl(url: string): boolean {
    if (!isValidHttpUrl(url)) return false;
    try {
      const parsed = new URL(url.trim());
      return parsed.hostname === 'github.com' || parsed.hostname.endsWith('.github.com');
    } catch {
      return false;
    }
  }

  public buildPullRequestRef(params: {
    url: string;
    title: string;
    repositoryUrl?: string;
    branch?: string;
    commitSha?: string;
    status?: PullRequestStatus;
    isSimulated?: boolean;
  }): PullRequestRef {
    const cleanUrl = params.url.trim();
    const repoFromPr = extractRepoNameFromUrl(cleanUrl);
    const repoFromProject = params.repositoryUrl
      ? extractRepoNameFromUrl(params.repositoryUrl)
      : '';
    return {
      url: cleanUrl,
      title: params.title.trim() || 'Linked Pull Request',
      repository:
        repoFromProject && repoFromProject !== params.repositoryUrl
          ? repoFromProject
          : repoFromPr,
      branch: params.branch?.trim() || undefined,
      commitSha: params.commitSha?.trim() || undefined,
      status: params.status ?? 'open',
      isSimulated: Boolean(params.isSimulated),
      updatedAt: new Date().toISOString(),
    };
  }
}

export const githubService = new GitHubService();
