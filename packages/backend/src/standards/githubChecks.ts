import type { Octokit } from '@octokit/rest';
import { CHECK_DEFINITIONS } from './checkDefinitions';
import { isRateLimitError } from '../onboarding/githubRepos';
import type { CheckId, CheckResult, CheckStatus } from './types';

function result(id: CheckId, status: CheckStatus, detail: string): CheckResult {
  return { ...CHECK_DEFINITIONS[id], status, detail };
}

function unknown(id: CheckId, detail: string): CheckResult {
  return result(id, 'unknown', detail);
}

function isRequestError(e: unknown): e is { status: number; message: string } {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export type GithubChecksResult = {
  checks: CheckResult[];
  rateLimited: boolean;
};

const GITHUB_IDS: CheckId[] = ['branch-protected', 'has-ci', 'has-readme'];

function allUnknown(detail: string): CheckResult[] {
  return GITHUB_IDS.map(id => unknown(id, detail));
}

// Runs the 3 GitHub-backed checks in 4 API calls: repos.get (to resolve the
// default branch - never assume "main"), getBranchProtection, a root
// directory listing for has-readme, and listRepoWorkflows for has-ci. This
// used to infer has-ci from a ".github" directory being present in the
// root listing, to stay within a 3-call budget - but that false-positives
// on any repo with a .github dir that isn't actually a workflow (e.g. one
// holding only CODEOWNERS), which is a wrong answer, not just an
// imprecise one. A wrong check costs more than the extra request.
export async function runGithubChecks(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<GithubChecksResult> {
  let rateLimited = false;

  let defaultBranch: string;
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    defaultBranch = data.default_branch;
  } catch (e) {
    if (isRateLimitError(e)) {
      rateLimited = true;
    }
    const detail = isRequestError(e)
      ? `GitHub returned ${e.status} reading this repository - it may not exist, or the credentials cannot see it.`
      : 'Could not reach GitHub to read this repository.';
    return { checks: allUnknown(detail), rateLimited };
  }

  const checks: CheckResult[] = [];

  try {
    await octokit.rest.repos.getBranchProtection({ owner, repo, branch: defaultBranch });
    checks.push(result('branch-protected', 'pass', `Branch protection is enabled on '${defaultBranch}'.`));
  } catch (e) {
    if (isRequestError(e) && e.status === 404) {
      // This endpoint's documented 404 means "no protection configured" -
      // a real fail, not an access problem.
      checks.push(result('branch-protected', 'fail', `Branch protection is not enabled on '${defaultBranch}'.`));
    } else if (isRequestError(e) && e.status === 403) {
      if (isRateLimitError(e)) {
        rateLimited = true;
      }
      checks.push(
        unknown('branch-protected', `GitHub credentials lack permission to read branch protection on '${defaultBranch}'.`),
      );
    } else {
      checks.push(unknown('branch-protected', 'Could not reach GitHub to check branch protection.'));
    }
  }

  try {
    const { data: rootContents } = await octokit.rest.repos.getContent({ owner, repo, path: '' });
    const entries = Array.isArray(rootContents) ? rootContents : [rootContents];
    const hasReadme = entries.some(entry => /^readme(\.|$)/i.test(entry.name));
    checks.push(
      hasReadme
        ? result('has-readme', 'pass', 'README found at the repo root.')
        : result('has-readme', 'fail', 'No README found at the repo root.'),
    );
  } catch (e) {
    if (isRequestError(e) && e.status === 404) {
      // Already confirmed the repo exists via repos.get above - a 404 here
      // means an empty repository (no commits yet), which genuinely has no
      // README, not an access problem.
      checks.push(result('has-readme', 'fail', 'Repository appears to be empty.'));
    } else {
      if (isRateLimitError(e)) {
        rateLimited = true;
      }
      const detail = isRequestError(e)
        ? `GitHub returned ${e.status} listing the repo root.`
        : 'Could not reach GitHub to list the repo root.';
      checks.push(unknown('has-readme', detail));
    }
  }

  try {
    const { data } = await octokit.rest.actions.listRepoWorkflows({ owner, repo });
    const activeWorkflows = data.workflows.filter(workflow => workflow.state === 'active');
    checks.push(
      activeWorkflows.length > 0
        ? result(
            'has-ci',
            'pass',
            `${activeWorkflows.length} active workflow(s): ${activeWorkflows.map(w => w.name).join(', ')}.`,
          )
        : result('has-ci', 'fail', 'No active GitHub Actions workflows.'),
    );
  } catch (e) {
    if (isRateLimitError(e)) {
      rateLimited = true;
    }
    const detail = isRequestError(e)
      ? `GitHub returned ${e.status} listing Actions workflows.`
      : 'Could not reach GitHub to list Actions workflows.';
    checks.push(unknown('has-ci', detail));
  }

  return { checks, rateLimited };
}
