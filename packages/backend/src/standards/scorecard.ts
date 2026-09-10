import type { Config } from '@backstage/config';
import type { BackstageCredentials } from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { createOctokitForRepo } from '../github/octokit';
import { runCatalogChecks } from './catalogChecks';
import { runGithubChecks } from './githubChecks';
import { CHECK_DEFINITIONS } from './checkDefinitions';
import type { CheckId, CheckResult, Scorecard } from './types';

const PROJECT_SLUG_ANNOTATION = 'github.com/project-slug';
const GITHUB_CHECK_IDS: CheckId[] = ['branch-protected', 'has-ci', 'has-readme'];

function unknownGithubChecks(detail: string): CheckResult[] {
  return GITHUB_CHECK_IDS.map(id => ({ ...CHECK_DEFINITIONS[id], status: 'unknown' as const, detail }));
}

function summarize(checks: CheckResult[]): Pick<Scorecard, 'passed' | 'failed' | 'unknown' | 'score'> {
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const unknownCount = checks.filter(c => c.status === 'unknown').length;
  const total = passed + failed;
  return {
    passed,
    failed,
    unknown: unknownCount,
    // Unknowns are excluded from both the numerator and denominator - they
    // must never drag the score down.
    score: total > 0 ? passed / total : null,
  };
}

export type ComputeScorecardsResult = {
  scorecards: Scorecard[];
  rateLimited: boolean;
};

// One catalog query for everything (Components to score, Groups to
// validate ownership against), then at most 3 GitHub calls per repo (see
// githubChecks.ts) - never N calls per check.
export async function computeScorecards(
  config: Config,
  catalog: CatalogService,
  credentials: BackstageCredentials,
): Promise<ComputeScorecardsResult> {
  const { items } = await catalog.getEntities(
    { filter: [{ kind: 'Component' }, { kind: 'Group' }] },
    { credentials },
  );

  const groupRefs = new Set(
    items.filter(entity => entity.kind === 'Group').map(entity => stringifyEntityRef(entity)),
  );
  const components = items.filter(entity => entity.kind === 'Component');

  let rateLimited = false;
  const scorecards: Scorecard[] = [];

  for (const entity of components) {
    const catalogResults = runCatalogChecks(entity, groupRefs);

    const projectSlug = entity.metadata.annotations?.[PROJECT_SLUG_ANNOTATION];
    let githubResults: CheckResult[];
    if (!projectSlug || !projectSlug.includes('/')) {
      githubResults = unknownGithubChecks(
        `No valid '${PROJECT_SLUG_ANNOTATION}' annotation - GitHub checks can't run.`,
      );
    } else if (rateLimited) {
      // Already hit a rate limit earlier in this batch - stop hammering
      // GitHub further for the remaining repos rather than making it worse.
      githubResults = unknownGithubChecks('Skipped after hitting a GitHub rate limit earlier in this batch.');
    } else {
      const [owner, repo] = projectSlug.split('/');
      try {
        const octokit = await createOctokitForRepo(config, projectSlug);
        const githubChecksResult = await runGithubChecks(octokit, owner, repo);
        githubResults = githubChecksResult.checks;
        if (githubChecksResult.rateLimited) {
          rateLimited = true;
        }
      } catch {
        githubResults = unknownGithubChecks(`GitHub credentials are not available for '${projectSlug}'.`);
      }
    }

    const checks = [...catalogResults, ...githubResults];
    const spec = (entity.spec ?? {}) as Record<string, unknown>;
    scorecards.push({
      entityRef: stringifyEntityRef(entity),
      name: entity.metadata.name,
      namespace: entity.metadata.namespace ?? 'default',
      kind: entity.kind,
      title: entity.metadata.title,
      owner: typeof spec.owner === 'string' ? spec.owner : undefined,
      checks,
      ...summarize(checks),
    });
  }

  return { scorecards, rateLimited };
}
