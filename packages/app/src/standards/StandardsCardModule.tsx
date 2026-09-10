import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const standardsCard = EntityCardBlueprint.make({
  params: {
    type: 'content',
    filter: (entity: Entity) => entity.kind === 'Component',
    loader: () => import('./StandardsCard').then(m => <m.StandardsCard />),
  },
});

// pluginId 'catalog' matches the real, auto-discovered @backstage/plugin-catalog
// plugin (same as githubEntityPageModule in
// packages/app/src/components/catalog/EntityPage.tsx) - a module here
// correctly attaches since that plugin genuinely exists.
export const standardsCardModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [standardsCard],
});
