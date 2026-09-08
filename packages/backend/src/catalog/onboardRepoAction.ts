import type { Config } from '@backstage/config';
import type { PermissionsService } from '@backstage/backend-plugin-api';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { InputError, NotAllowedError } from '@backstage/errors';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOctokitForRepo } from '../github/octokit';
import { catalogRepoOnboardPermission } from './permissions';

const CATALOG_INFO_PATH = 'catalog-info.yaml';
const ONBOARD_BRANCH = 'backstage/add-catalog-info';

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    throw new InputError(
      `repoUrl must be an absolute URL, got '${repoUrl}'`,
    );
  }
  if (url.hostname !== 'github.com') {
    throw new InputError(
      `repoUrl must point at github.com, got '${repoUrl}'`,
    );
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const [owner, rawRepo] = segments;
  if (!owner || !rawRepo || segments.length !== 2) {
    throw new InputError(
      `repoUrl must be in 'https://github.com/OWNER/REPO' form, got '${repoUrl}'`,
    );
  }
  return { owner, repo: rawRepo.replace(/\.git$/, '') };
}

function isRequestError(e: unknown): e is { status: number; message: string } {
  return typeof e === 'object' && e !== null && 'status' in e;
}

async function withAccessCheck<T>(
  repo: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isRequestError(e) && (e.status === 403 || e.status === 404)) {
      throw new InputError(
        `The GitHub integration credentials don't have access to '${repo}' (HTTP ${e.status})`,
      );
    }
    throw e;
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function buildCatalogInfoYaml(input: {
  name: string;
  title?: string;
  description?: string;
  type: string;
  lifecycle: string;
  owner: string;
  tags?: string[];
  projectSlug: string;
  sourceLocation: string;
}): string {
  const lines = [
    'apiVersion: backstage.io/v1alpha1',
    'kind: Component',
    'metadata:',
    `  name: ${input.name}`,
  ];
  if (input.title) {
    lines.push(`  title: ${yamlString(input.title)}`);
  }
  if (input.description) {
    lines.push(`  description: ${yamlString(input.description)}`);
  }
  lines.push('  annotations:');
  lines.push(`    github.com/project-slug: ${input.projectSlug}`);
  lines.push(`    backstage.io/source-location: ${input.sourceLocation}`);
  if (input.tags?.length) {
    lines.push('  tags:');
    for (const tag of input.tags) {
      lines.push(`    - ${yamlString(tag)}`);
    }
  }
  lines.push('spec:');
  lines.push(`  type: ${input.type}`);
  lines.push(`  lifecycle: ${input.lifecycle}`);
  lines.push(`  owner: ${input.owner}`);
  return `${lines.join('\n')}\n`;
}

export function createCatalogRepoOnboardAction(
  config: Config,
  permissions: PermissionsService,
) {
  return createTemplateAction({
    id: 'catalog:repo:onboard',
    description:
      'Onboards an existing GitHub repository into the catalog: if catalog-info.yaml already exists on its default branch, returns it for registration; otherwise opens a pull request adding one. Restricted to platform-admins.',
    schema: {
      input: {
        repoUrl: z =>
          z
            .string()
            .describe('GitHub repository URL, e.g. https://github.com/OWNER/REPO'),
        name: z =>
          z
            .string()
            .regex(
              /^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$/,
              'must be a valid DNS-safe catalog entity name',
            )
            .describe('Catalog entity name'),
        title: z => z.string().optional().describe('Catalog entity title'),
        description: z =>
          z.string().optional().describe('Catalog entity description'),
        type: z => z.string().describe('Component spec.type'),
        lifecycle: z => z.string().describe('Component spec.lifecycle'),
        owner: z =>
          z
            .string()
            .describe('Component spec.owner, e.g. group:default/developers'),
        tags: z =>
          z.array(z.string()).optional().describe('Catalog entity tags'),
      },
      output: {
        exists: z =>
          z
            .boolean()
            .describe('Whether catalog-info.yaml already existed on the default branch'),
        catalogInfoUrl: z =>
          z
            .string()
            .describe('URL of catalog-info.yaml on the default branch'),
        prUrl: z =>
          z
            .string()
            .optional()
            .describe('URL of the pull request adding catalog-info.yaml, if one was opened'),
      },
    },
    async handler(ctx) {
      const credentials = await ctx.getInitiatorCredentials();
      const [decision] = await permissions.authorize(
        [{ permission: catalogRepoOnboardPermission }],
        { credentials },
      );
      if (decision.result === AuthorizeResult.DENY) {
        throw new NotAllowedError(
          'Only platform-admins can onboard a repository into the catalog',
        );
      }

      const { name, title, description, type, lifecycle, owner, tags } =
        ctx.input;
      const { owner: repoOwner, repo } = parseRepoUrl(ctx.input.repoUrl);
      const repoSlug = `${repoOwner}/${repo}`;
      const octokit = await createOctokitForRepo(config, repoSlug);

      const { data: repoData } = await withAccessCheck(repoSlug, () =>
        octokit.rest.repos.get({ owner: repoOwner, repo }),
      );
      const defaultBranch = repoData.default_branch;

      const catalogInfoUrl = `https://github.com/${repoSlug}/blob/${defaultBranch}/${CATALOG_INFO_PATH}`;

      let catalogInfoExists = true;
      try {
        await octokit.rest.repos.getContent({
          owner: repoOwner,
          repo,
          path: CATALOG_INFO_PATH,
          ref: defaultBranch,
        });
      } catch (e) {
        if (isRequestError(e) && e.status === 404) {
          catalogInfoExists = false;
        } else if (isRequestError(e) && e.status === 403) {
          throw new InputError(
            `The GitHub integration credentials don't have access to '${repoSlug}' (HTTP ${e.status})`,
          );
        } else {
          throw e;
        }
      }

      if (catalogInfoExists) {
        ctx.logger.info(
          `${CATALOG_INFO_PATH} already exists in '${repoSlug}' on '${defaultBranch}' - nothing to create`,
        );
        ctx.output('exists', true);
        ctx.output('catalogInfoUrl', catalogInfoUrl);
        return;
      }

      const content = buildCatalogInfoYaml({
        name,
        title,
        description,
        type,
        lifecycle,
        owner,
        tags,
        projectSlug: repoSlug,
        sourceLocation: `url:https://github.com/${repoSlug}/tree/${defaultBranch}/`,
      });

      const { data: baseRef } = await withAccessCheck(repoSlug, () =>
        octokit.rest.git.getRef({
          owner: repoOwner,
          repo,
          ref: `heads/${defaultBranch}`,
        }),
      );

      try {
        await octokit.rest.git.createRef({
          owner: repoOwner,
          repo,
          ref: `refs/heads/${ONBOARD_BRANCH}`,
          sha: baseRef.object.sha,
        });
      } catch (e) {
        if (isRequestError(e) && e.status === 422) {
          // Branch already exists from a previous run - reuse it.
        } else if (isRequestError(e) && (e.status === 403 || e.status === 404)) {
          throw new InputError(
            `The GitHub integration credentials don't have access to '${repoSlug}' (HTTP ${e.status})`,
          );
        } else {
          throw e;
        }
      }

      let existingFileSha: string | undefined;
      try {
        const { data: existingFile } = await octokit.rest.repos.getContent({
          owner: repoOwner,
          repo,
          path: CATALOG_INFO_PATH,
          ref: ONBOARD_BRANCH,
        });
        if (!Array.isArray(existingFile) && existingFile.type === 'file') {
          existingFileSha = existingFile.sha;
        }
      } catch (e) {
        if (!(isRequestError(e) && e.status === 404)) {
          throw e;
        }
      }

      await withAccessCheck(repoSlug, () =>
        octokit.rest.repos.createOrUpdateFileContents({
          owner: repoOwner,
          repo,
          path: CATALOG_INFO_PATH,
          message: `Add ${CATALOG_INFO_PATH} for ${name}`,
          content: Buffer.from(content, 'utf-8').toString('base64'),
          branch: ONBOARD_BRANCH,
          sha: existingFileSha,
        }),
      );

      let prUrl: string;
      try {
        const { data: pr } = await octokit.rest.pulls.create({
          owner: repoOwner,
          repo,
          title: `Add ${CATALOG_INFO_PATH} for ${name}`,
          head: ONBOARD_BRANCH,
          base: defaultBranch,
          body: `Adds \`${CATALOG_INFO_PATH}\` so **${name}** can be registered in the catalog, via the "Onboard an existing repository" template.`,
        });
        prUrl = pr.html_url;
      } catch (e) {
        if (isRequestError(e) && e.status === 422) {
          const { data: existingPrs } = await octokit.rest.pulls.list({
            owner: repoOwner,
            repo,
            head: `${repoOwner}:${ONBOARD_BRANCH}`,
            state: 'all',
          });
          if (!existingPrs.length) {
            throw e;
          }
          prUrl = existingPrs[0].html_url;
        } else if (isRequestError(e) && (e.status === 403 || e.status === 404)) {
          throw new InputError(
            `The GitHub integration credentials don't have access to '${repoSlug}' (HTTP ${e.status})`,
          );
        } else {
          throw e;
        }
      }

      ctx.logger.info(
        `Opened pull request for '${CATALOG_INFO_PATH}' in '${repoSlug}': ${prUrl}`,
      );
      ctx.output('exists', false);
      ctx.output('catalogInfoUrl', catalogInfoUrl);
      ctx.output('prUrl', prUrl);
    },
  });
}
