import type { Config } from '@backstage/config';
import type { PermissionsService } from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { BasicPermission } from '@backstage/plugin-permission-common';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { InputError, NotAllowedError } from '@backstage/errors';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { parse as parseYaml } from 'yaml';
import { createOctokitForRepo } from '../github/octokit';
import { deployTriggerPermissions } from './permissions';

const PROJECT_SLUG_ANNOTATION = 'github.com/project-slug';
const DEPLOY_ENVIRONMENTS_ANNOTATION = 'ksquare.io/deploy-environments';
const POLL_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 2_000;

function isRequestError(e: unknown): e is { status: number; message: string } {
  return typeof e === 'object' && e !== null && 'status' in e;
}

// `operation` describes what was being attempted, e.g. "read branch 'qa'" or
// "dispatch 'deploy.yml' at 'qa'" - it's folded into the error message so a
// 404 from a missing file/branch/workflow reads nothing like a permissions
// problem, and a real permissions problem (403) reads nothing like a missing
// resource.
async function withAccessCheck<T>(
  repo: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isRequestError(e) && e.status === 403) {
      throw new InputError(
        `The GitHub integration credentials lack permission to ${operation} on '${repo}'`,
      );
    }
    if (isRequestError(e) && e.status === 404) {
      throw new InputError(
        `${operation} on '${repo}' returned 404 - the resource may not exist, or the credentials cannot see it`,
      );
    }
    throw e;
  }
}

type DeployTarget = { workflow: string; ref: string };

// Parses the ksquare.io/deploy-environments annotation, one mapping per
// line: `<environment>: <workflow file>@<branch>`, e.g. "qa: deploy-qa.yml@qa".
// Kept in sync with the identical parser in
// packages/app/src/scaffolder/DeployEnvironmentPicker.tsx.
function parseDeployEnvironments(raw: string): Map<string, DeployTarget> {
  const targets = new Map<string, DeployTarget>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const environment = line.slice(0, colonIndex).trim();
    const target = line.slice(colonIndex + 1).trim();
    const atIndex = target.lastIndexOf('@');
    if (!environment || atIndex === -1) {
      continue;
    }
    const workflow = target.slice(0, atIndex).trim();
    const ref = target.slice(atIndex + 1).trim();
    if (workflow && ref) {
      targets.set(environment, { workflow, ref });
    }
  }
  return targets;
}

// Returns the set of input names declared under `on.workflow_dispatch.inputs`
// in a parsed workflow file, or undefined if the workflow has no
// workflow_dispatch trigger at all (in any of the shapes GitHub accepts for
// `on:` - a bare string, a list of trigger names, or a map of trigger
// configs).
function getWorkflowDispatchInputNames(parsed: unknown): Set<string> | undefined {
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const on = (parsed as Record<string, unknown>).on;
  if (typeof on === 'string') {
    return on === 'workflow_dispatch' ? new Set() : undefined;
  }
  if (Array.isArray(on)) {
    return on.includes('workflow_dispatch') ? new Set() : undefined;
  }
  if (typeof on !== 'object' || on === null) {
    return undefined;
  }
  const workflowDispatch = (on as Record<string, unknown>).workflow_dispatch;
  if (workflowDispatch === undefined) {
    return undefined;
  }
  if (typeof workflowDispatch !== 'object' || workflowDispatch === null) {
    // `workflow_dispatch:` with nothing under it is still dispatchable,
    // just with no declared inputs.
    return new Set();
  }
  const inputs = (workflowDispatch as Record<string, unknown>).inputs;
  if (typeof inputs !== 'object' || inputs === null) {
    return new Set();
  }
  return new Set(Object.keys(inputs));
}

export function createDispatchWorkflowAction(
  config: Config,
  permissions: PermissionsService,
  catalog: CatalogService,
) {
  return createTemplateAction({
    id: 'github:workflow:dispatch',
    description:
      "Dispatches a component's own GitHub Actions deploy workflow for a given environment. Backstage never deploys anything itself - it only triggers the workflow that does.",
    schema: {
      input: {
        entityRef: z =>
          z.string().describe('Catalog entity ref of the component being deployed'),
        environment: z =>
          z
            .string()
            .describe(
              "Target deploy environment - must match an entry in the entity's ksquare.io/deploy-environments annotation",
            ),
        fullSource: z =>
          z
            .boolean()
            .optional()
            .describe('Whether to do a full source deploy (only meaningful to some workflows)'),
        testLevel: z =>
          z
            .string()
            .optional()
            .describe('Test level to run (only meaningful to some workflows)'),
      },
      output: {
        found: z =>
          z.boolean().describe('Whether the dispatched run was found within the poll window'),
        runId: z => z.number().optional().describe('The dispatched run id, if found'),
        runUrl: z =>
          z
            .string()
            .describe(
              "URL of the dispatched run if found, otherwise the workflow's runs list URL",
            ),
      },
    },
    async handler(ctx) {
      const { entityRef, environment, fullSource, testLevel } = ctx.input;

      const credentials = await ctx.getInitiatorCredentials();

      // Environment names now come from each repo's own annotation, not a
      // fixed enum, so this lookup can legitimately miss. Deny by default
      // whenever no permission is defined for the requested name - never
      // fall through to allowed.
      const permission = (
        deployTriggerPermissions as Record<string, BasicPermission | undefined>
      )[environment];
      if (!permission) {
        throw new NotAllowedError(
          `No permission is defined for environment '${environment}' - denying by default`,
        );
      }
      const [decision] = await permissions.authorize([{ permission }], { credentials });
      if (decision.result === AuthorizeResult.DENY) {
        throw new NotAllowedError(
          `You don't have permission to trigger a deploy to '${environment}'`,
        );
      }

      const entity = await catalog.getEntityByRef(entityRef, { credentials });
      if (!entity) {
        throw new InputError(`No such entity '${entityRef}'`);
      }

      const projectSlug = entity.metadata.annotations?.[PROJECT_SLUG_ANNOTATION];
      if (!projectSlug || !projectSlug.includes('/')) {
        throw new InputError(
          `Entity '${entityRef}' has no valid '${PROJECT_SLUG_ANNOTATION}' annotation`,
        );
      }
      const [repoOwner, repo] = projectSlug.split('/');
      const repoSlug = `${repoOwner}/${repo}`;

      const deployEnvironmentsRaw =
        entity.metadata.annotations?.[DEPLOY_ENVIRONMENTS_ANNOTATION];
      if (!deployEnvironmentsRaw) {
        throw new InputError(
          `Entity '${entityRef}' has no '${DEPLOY_ENVIRONMENTS_ANNOTATION}' annotation`,
        );
      }
      const target = parseDeployEnvironments(deployEnvironmentsRaw).get(environment);
      if (!target) {
        throw new InputError(
          `Entity '${entityRef}' has no '${environment}' entry in its '${DEPLOY_ENVIRONMENTS_ANNOTATION}' annotation`,
        );
      }
      const { workflow, ref } = target;

      const octokit = await createOctokitForRepo(config, repoSlug);

      // GitHub requires a workflow_dispatch workflow (and its input
      // declarations) to be read from the repo's DEFAULT branch, regardless
      // of which branch it's being dispatched at.
      const { data: repoData } = await withAccessCheck(
        repoSlug,
        'read repository metadata',
        () => octokit.rest.repos.get({ owner: repoOwner, repo }),
      );
      const defaultBranch = repoData.default_branch;

      const { data: workflowFile } = await withAccessCheck(
        repoSlug,
        `read '.github/workflows/${workflow}' at '${defaultBranch}'`,
        () =>
          octokit.rest.repos.getContent({
            owner: repoOwner,
            repo,
            path: `.github/workflows/${workflow}`,
            ref: defaultBranch,
          }),
      );
      if (
        Array.isArray(workflowFile) ||
        workflowFile.type !== 'file' ||
        !workflowFile.content
      ) {
        throw new InputError(
          `'${workflow}' is not a readable file in '${repoSlug}' at '${defaultBranch}'`,
        );
      }
      const workflowYaml = Buffer.from(workflowFile.content, 'base64').toString('utf-8');

      let parsedWorkflow: unknown;
      try {
        parsedWorkflow = parseYaml(workflowYaml);
      } catch (e) {
        throw new InputError(
          `Could not parse '${workflow}' in '${repoSlug}' as YAML: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }

      const declaredInputs = getWorkflowDispatchInputNames(parsedWorkflow);
      if (declaredInputs === undefined) {
        throw new InputError(
          `'${workflow}' in '${repoSlug}' has no workflow_dispatch trigger - it isn't dispatchable`,
        );
      }

      // Only send inputs the workflow actually declares - dispatching an
      // undeclared input is a 422. Workflows may name these in camelCase or
      // (more conventionally) snake_case, so accept either.
      const candidates: { names: string[]; value: string }[] = [
        { names: ['environment'], value: environment },
      ];
      if (fullSource !== undefined) {
        candidates.push({ names: ['fullSource', 'full_source'], value: String(fullSource) });
      }
      if (testLevel !== undefined) {
        candidates.push({ names: ['testLevel', 'test_level'], value: testLevel });
      }
      const inputsToSend: Record<string, string> = {};
      for (const candidate of candidates) {
        const declaredName = candidate.names.find(name => declaredInputs.has(name));
        if (declaredName) {
          inputsToSend[declaredName] = candidate.value;
        }
      }

      // Validate the dispatch ref up front so a typo'd or deleted branch in
      // the annotation fails with a message naming it, rather than
      // surfacing as GitHub's opaque 404 from createWorkflowDispatch.
      await withAccessCheck(repoSlug, `read branch '${ref}'`, () =>
        octokit.rest.repos.getBranch({ owner: repoOwner, repo, branch: ref }),
      );

      const dispatchedAt = Date.now();
      await withAccessCheck(repoSlug, `dispatch '${workflow}' at '${ref}'`, () =>
        octokit.rest.actions.createWorkflowDispatch({
          owner: repoOwner,
          repo,
          workflow_id: workflow,
          ref,
          inputs: inputsToSend,
        }),
      );

      const triggeredBy =
        ctx.user?.entity?.metadata.name ?? ctx.user?.ref ?? 'unknown user';
      ctx.logger.info(
        `${triggeredBy} triggered '${workflow}' in '${repoSlug}' at ref '${ref}' for environment '${environment}'`,
      );

      // createWorkflowDispatch returns 204 with no body, so poll for the run
      // it created.
      const runsUrl = `https://github.com/${repoSlug}/actions/workflows/${workflow}`;
      let run: { id: number; html_url: string } | undefined;
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (!run && Date.now() < deadline) {
        const { data } = await octokit.rest.actions.listWorkflowRuns({
          owner: repoOwner,
          repo,
          workflow_id: workflow,
          branch: ref,
          event: 'workflow_dispatch',
          per_page: 5,
        });
        const found = data.workflow_runs.find(
          candidate => new Date(candidate.created_at).getTime() >= dispatchedAt - 5_000,
        );
        if (found) {
          run = { id: found.id, html_url: found.html_url };
          break;
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!run) {
        ctx.logger.info(
          `Workflow dispatched but its run wasn't visible yet within ${POLL_TIMEOUT_MS / 1000}s - see ${runsUrl}`,
        );
        ctx.output('found', false);
        ctx.output('runUrl', runsUrl);
        return;
      }

      ctx.output('found', true);
      ctx.output('runId', run.id);
      ctx.output('runUrl', run.html_url);
    },
  });
}
