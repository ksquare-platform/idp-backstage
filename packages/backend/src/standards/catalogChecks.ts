import type { Entity } from '@backstage/catalog-model';
import { DEFAULT_NAMESPACE, parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import { CHECK_DEFINITIONS } from './checkDefinitions';
import type { CheckId, CheckResult, CheckStatus } from './types';

const PROJECT_SLUG_ANNOTATION = 'github.com/project-slug';
const TECHDOCS_REF_ANNOTATION = 'backstage.io/techdocs-ref';
const DEPLOY_ENVIRONMENTS_ANNOTATION = 'ksquare.io/deploy-environments';
const MIN_DESCRIPTION_LENGTH = 20;
const VALID_LIFECYCLES = new Set(['experimental', 'production', 'deprecated']);

function result(id: CheckId, status: CheckStatus, detail: string): CheckResult {
  return { ...CHECK_DEFINITIONS[id], status, detail };
}

// Parses the ksquare.io/deploy-environments annotation, one mapping per
// line: `<environment>: <workflow file>@<branch>`, e.g. "qa: deploy-qa.yml@qa".
// Mirrors the parser in packages/backend/src/deploy/dispatchWorkflowAction.ts
// and packages/app/src/scaffolder/DeployEnvironmentPicker.tsx - kept in sync
// by hand if the annotation format ever changes.
function parseDeployEnvironments(raw: string): Map<string, { workflow: string; ref: string }> {
  const targets = new Map<string, { workflow: string; ref: string }>();
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

// Runs the 7 catalog-only checks, purely from the entity itself plus a set
// of Group entity refs (lowercased "group:namespace/name") already known to
// exist - always evaluable, never 'unknown'.
export function runCatalogChecks(entity: Entity, groupRefs: Set<string>): CheckResult[] {
  const results: CheckResult[] = [];
  const annotations = entity.metadata.annotations ?? {};
  const spec = (entity.spec ?? {}) as Record<string, unknown>;

  const owner = typeof spec.owner === 'string' ? spec.owner : undefined;
  if (!owner) {
    results.push(result('has-owner', 'fail', 'No spec.owner is set.'));
  } else if (owner.includes('@') && !owner.includes(':')) {
    results.push(
      result('has-owner', 'fail', `Owner '${owner}' is an email address, not a catalog Group.`),
    );
  } else {
    try {
      const parsed = parseEntityRef(owner, {
        defaultKind: 'group',
        defaultNamespace: DEFAULT_NAMESPACE,
      });
      const ownerRef = stringifyEntityRef(parsed);
      if (parsed.kind.toLowerCase() !== 'group') {
        results.push(result('has-owner', 'fail', `Owner '${owner}' is a ${parsed.kind}, not a Group.`));
      } else if (!groupRefs.has(ownerRef)) {
        results.push(result('has-owner', 'fail', `Group '${ownerRef}' does not exist in the catalog.`));
      } else {
        results.push(result('has-owner', 'pass', `Owned by '${ownerRef}'.`));
      }
    } catch {
      results.push(result('has-owner', 'fail', `Owner '${owner}' is not a valid entity reference.`));
    }
  }

  const description = entity.metadata.description;
  results.push(
    description && description.length > MIN_DESCRIPTION_LENGTH
      ? result('has-description', 'pass', `Description is ${description.length} characters.`)
      : result(
          'has-description',
          'fail',
          description
            ? `Description is only ${description.length} characters (needs more than ${MIN_DESCRIPTION_LENGTH}).`
            : 'No description is set.',
        ),
  );

  const projectSlug = annotations[PROJECT_SLUG_ANNOTATION];
  results.push(
    projectSlug
      ? result('has-project-slug', 'pass', `Linked to '${projectSlug}'.`)
      : result('has-project-slug', 'fail', `No '${PROJECT_SLUG_ANNOTATION}' annotation.`),
  );

  const techdocsRef = annotations[TECHDOCS_REF_ANNOTATION];
  results.push(
    techdocsRef
      ? result('has-docs-annotation', 'pass', `techdocs-ref is '${techdocsRef}'.`)
      : result('has-docs-annotation', 'fail', `No '${TECHDOCS_REF_ANNOTATION}' annotation.`),
  );

  const deployConfigRaw = annotations[DEPLOY_ENVIRONMENTS_ANNOTATION];
  if (!deployConfigRaw) {
    results.push(result('has-deploy-config', 'fail', `No '${DEPLOY_ENVIRONMENTS_ANNOTATION}' annotation.`));
  } else {
    const parsed = parseDeployEnvironments(deployConfigRaw);
    results.push(
      parsed.size > 0
        ? result(
            'has-deploy-config',
            'pass',
            `${parsed.size} environment(s) configured: ${[...parsed.keys()].join(', ')}.`,
          )
        : result(
            'has-deploy-config',
            'fail',
            `'${DEPLOY_ENVIRONMENTS_ANNOTATION}' annotation is present but has no parseable entries.`,
          ),
    );
  }

  const system = typeof spec.system === 'string' ? spec.system : undefined;
  results.push(
    system
      ? result('has-system', 'pass', `Part of system '${system}'.`)
      : result('has-system', 'fail', 'No spec.system is set.'),
  );

  const lifecycle = typeof spec.lifecycle === 'string' ? spec.lifecycle : undefined;
  results.push(
    lifecycle && VALID_LIFECYCLES.has(lifecycle)
      ? result('valid-lifecycle', 'pass', `Lifecycle is '${lifecycle}'.`)
      : result(
          'valid-lifecycle',
          'fail',
          lifecycle
            ? `Lifecycle '${lifecycle}' is not one of experimental/production/deprecated.`
            : 'No spec.lifecycle is set.',
        ),
  );

  return results;
}
