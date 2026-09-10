import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { BackstageCredentials } from '@backstage/backend-plugin-api';

const PROJECT_SLUG_ANNOTATION = 'github.com/project-slug';

// Lowercased github.com/project-slug -> the Component entity ref that
// declares it. Built with a single catalog query per request (never one
// per repo).
export async function buildCatalogSlugIndex(
  catalog: CatalogService,
  credentials: BackstageCredentials,
): Promise<Map<string, string>> {
  const { items } = await catalog.getEntities(
    {
      filter: { kind: 'Component' },
      fields: ['metadata.name', 'metadata.namespace', 'metadata.annotations'],
    },
    { credentials },
  );

  const index = new Map<string, string>();
  for (const entity of items) {
    const slug = entity.metadata.annotations?.[PROJECT_SLUG_ANNOTATION];
    if (!slug) {
      continue;
    }
    const namespace = entity.metadata.namespace ?? 'default';
    index.set(slug.toLowerCase(), `component:${namespace}/${entity.metadata.name}`);
  }
  return index;
}
