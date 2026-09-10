export type CheckStatus = 'pass' | 'fail' | 'unknown';

export type CheckId =
  | 'has-owner'
  | 'has-description'
  | 'has-project-slug'
  | 'has-docs-annotation'
  | 'has-deploy-config'
  | 'has-system'
  | 'valid-lifecycle'
  | 'branch-protected'
  | 'has-ci'
  | 'has-readme';

export type CheckGroup = 'catalog' | 'github';

export interface CheckDefinition {
  id: CheckId;
  group: CheckGroup;
  title: string;
  // Always present, even on a pass - the frontend only displays it for
  // non-pass results, but keeping it on the shared definition means every
  // check is required to have one.
  fix: string;
}

export interface CheckResult extends CheckDefinition {
  status: CheckStatus;
  // Explains *why* the check got this status, e.g. "Owner 'x@y.com' is an
  // email address, not a catalog Group." or "GitHub returned 403 for this
  // repo."
  detail: string;
}

export interface Scorecard {
  entityRef: string;
  name: string;
  namespace: string;
  kind: string;
  title?: string;
  owner?: string;
  // null when there's nothing evaluable at all (passed + failed === 0) -
  // distinct from 0, which would misleadingly read as "failed everything".
  score: number | null;
  passed: number;
  failed: number;
  unknown: number;
  checks: CheckResult[];
}
