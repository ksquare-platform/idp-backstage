import type { PermissionsService } from '@backstage/backend-plugin-api';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { NotAllowedError } from '@backstage/errors';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { catalogServiceCreatePermission } from './permissions';

// Runs as the first step of examples/templates/new-service/template.yaml,
// before fetch:template/publish:github/catalog:register - creating a repo
// under ksquare-platform (the only org that template's RepoUrlPicker
// allows) is a privileged operation, gated the same way as
// catalog:user:onboard/catalog:repo:onboard: a custom app-defined
// permission, checked here and granted to platform-admins only in
// rbac/rbac-policy.csv. Denying here means no GitHub side effects happen
// at all.
export function createServiceCreateAuthorizeAction(
  permissions: PermissionsService,
) {
  return createTemplateAction({
    id: 'catalog:service:create',
    description:
      'Authorizes creation of a new service repository. Restricted to platform-admins - see rbac/rbac-policy.csv.',
    async handler(ctx) {
      const credentials = await ctx.getInitiatorCredentials();
      const [decision] = await permissions.authorize(
        [{ permission: catalogServiceCreatePermission }],
        { credentials },
      );
      if (decision.result === AuthorizeResult.DENY) {
        throw new NotAllowedError(
          'Only platform-admins can create a new service',
        );
      }
    },
  });
}
