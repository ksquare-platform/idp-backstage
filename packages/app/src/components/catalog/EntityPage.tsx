import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { convertLegacyEntityContentExtension } from '@backstage/plugin-catalog-react/alpha';
import { Entity } from '@backstage/catalog-model';
import { isGithubActionsAvailable } from '@backstage/plugin-github-actions';
import { GithubActionsMessageClamp } from './GithubActionsMessageClamp';
import {
  EntityGithubPullRequestsContent,
  isGithubPullRequestsAvailable,
} from '@roadiehq/backstage-plugin-github-pull-requests';
import {
  EntityGithubInsightsContent,
  isGithubInsightsAvailable,
} from '@roadiehq/backstage-plugin-github-insights';

const isComponentWithGithubSlug =
  (isAvailable: (entity: Entity) => boolean) => (entity: Entity) =>
    entity.kind === 'Component' && isAvailable(entity);

const githubActionsContent = convertLegacyEntityContentExtension(
  GithubActionsMessageClamp,
  {
    name: 'github-actions',
    path: '/ci-cd',
    title: 'CI/CD',
    filter: isComponentWithGithubSlug(isGithubActionsAvailable),
  },
);

const githubPullRequestsContent = convertLegacyEntityContentExtension(
  EntityGithubPullRequestsContent,
  {
    name: 'github-pull-requests',
    path: '/pull-requests',
    title: 'Pull Requests',
    filter: isComponentWithGithubSlug(isGithubPullRequestsAvailable),
  },
);

const githubInsightsContent = convertLegacyEntityContentExtension(
  EntityGithubInsightsContent,
  {
    name: 'github-insights',
    path: '/github-insights',
    title: 'GitHub Insights',
    filter: isComponentWithGithubSlug(isGithubInsightsAvailable),
  },
);

export const githubEntityPageModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    githubActionsContent,
    githubPullRequestsContent,
    githubInsightsContent,
  ],
});
