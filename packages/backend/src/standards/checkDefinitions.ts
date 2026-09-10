import type { CheckDefinition, CheckId } from './types';

// Single source of truth for each check's title and fix text, shared by
// catalogChecks.ts and githubChecks.ts so the "how to fix it" copy lives in
// exactly one place per check.
export const CHECK_DEFINITIONS: Record<CheckId, CheckDefinition> = {
  'has-owner': {
    id: 'has-owner',
    group: 'catalog',
    title: 'Has a valid owner',
    fix: 'Set spec.owner in catalog-info.yaml to an existing Group entity ref (e.g. group:default/my-team), not an email address.',
  },
  'has-description': {
    id: 'has-description',
    group: 'catalog',
    title: 'Has a meaningful description',
    fix: 'Add a metadata.description longer than 20 characters explaining what this service does.',
  },
  'has-project-slug': {
    id: 'has-project-slug',
    group: 'catalog',
    title: 'Linked to a GitHub repository',
    fix: "Add a github.com/project-slug annotation (e.g. 'my-org/my-repo') so the portal can link to the repo and run GitHub-based checks.",
  },
  'has-docs-annotation': {
    id: 'has-docs-annotation',
    group: 'catalog',
    title: 'TechDocs configured',
    fix: 'Add a backstage.io/techdocs-ref annotation (e.g. dir:.) plus an mkdocs.yml so this service has browsable docs.',
  },
  'has-deploy-config': {
    id: 'has-deploy-config',
    group: 'catalog',
    title: 'Deploy environments configured',
    fix: 'Add a ksquare.io/deploy-environments annotation mapping at least one environment to a workflow and branch, e.g. "production: ci.yml@main".',
  },
  'has-system': {
    id: 'has-system',
    group: 'catalog',
    title: 'Assigned to a system',
    fix: 'Set spec.system in catalog-info.yaml so this component groups with related services.',
  },
  'valid-lifecycle': {
    id: 'valid-lifecycle',
    group: 'catalog',
    title: 'Valid lifecycle stage',
    fix: "Set spec.lifecycle to one of 'experimental', 'production', or 'deprecated'.",
  },
  'branch-protected': {
    id: 'branch-protected',
    group: 'github',
    title: 'Default branch is protected',
    fix: 'Enable branch protection on the default branch (repo Settings -> Branches) - at minimum, require a pull request before merging.',
  },
  'has-ci': {
    id: 'has-ci',
    group: 'github',
    title: 'Has a CI workflow',
    fix: 'Add at least one active GitHub Actions workflow under .github/workflows/ (not disabled).',
  },
  'has-readme': {
    id: 'has-readme',
    group: 'github',
    title: 'Has a README',
    fix: 'Add a README.md at the repo root explaining what this service is and how to run it.',
  },
};
