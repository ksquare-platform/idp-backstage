import path from 'node:path';
import fs from 'node:fs/promises';
import type { Config } from '@backstage/config';
import type { PermissionsService } from '@backstage/backend-plugin-api';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { InputError, NotAllowedError } from '@backstage/errors';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOctokitForRepo } from '../github/octokit';
import { catalogUserOnboardPermission } from './permissions';

const USERS_FILE_REPO = 'ksquare-platform/idp-backstage';
const USERS_FILE_PATH = 'catalog/users.yaml';

export function createCatalogUserOnboardAction(
  config: Config,
  permissions: PermissionsService,
) {
  return createTemplateAction({
    id: 'catalog:user:onboard',
    description:
      'Appends a User entity to catalog/users.yaml in the workspace, for a follow-up publish:github:pull-request step to commit. Restricted to platform-admins.',
    schema: {
      input: {
        githubUsername: z =>
          z
            .string()
            .regex(
              /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
              'must be a lowercase GitHub username',
            )
            .describe('GitHub username to onboard (lowercase)'),
        group: z =>
          z
            .enum(['developers', 'platform-admins'])
            .describe('Group the new user should belong to'),
      },
      output: {
        usersFilePath: z =>
          z.string().describe('Workspace-relative path of the updated file'),
      },
    },
    async handler(ctx) {
      const credentials = await ctx.getInitiatorCredentials();
      const [decision] = await permissions.authorize(
        [{ permission: catalogUserOnboardPermission }],
        { credentials },
      );
      if (decision.result === AuthorizeResult.DENY) {
        throw new NotAllowedError(
          'Only platform-admins can onboard a new user',
        );
      }

      const { githubUsername, group } = ctx.input;
      const [owner, repo] = USERS_FILE_REPO.split('/');
      const octokit = await createOctokitForRepo(config, USERS_FILE_REPO);

      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: USERS_FILE_PATH,
      });
      if (Array.isArray(data) || data.type !== 'file' || !data.content) {
        throw new InputError(
          `${USERS_FILE_PATH} is not a readable file in ${USERS_FILE_REPO}`,
        );
      }
      const currentContent = Buffer.from(data.content, 'base64').toString(
        'utf-8',
      );

      if (new RegExp(`name:\\s*${githubUsername}\\b`).test(currentContent)) {
        throw new InputError(
          `A User entity named '${githubUsername}' already exists in ${USERS_FILE_PATH}`,
        );
      }

      const newEntity = [
        '---',
        'apiVersion: backstage.io/v1alpha1',
        'kind: User',
        'metadata:',
        `  name: ${githubUsername}`,
        'spec:',
        `  memberOf: [${group}]`,
        '',
      ].join('\n');

      const newContent = `${currentContent.replace(/\n*$/, '\n')}${newEntity}`;

      const outputPath = path.join(ctx.workspacePath, USERS_FILE_PATH);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, newContent, 'utf-8');

      ctx.logger.info(
        `Staged '${githubUsername}' (memberOf: ${group}) in ${USERS_FILE_PATH} for a pull request`,
      );
      ctx.output('usersFilePath', USERS_FILE_PATH);
    },
  });
}
