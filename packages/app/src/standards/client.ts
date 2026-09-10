import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export type CheckStatus = 'pass' | 'fail' | 'unknown';
export type CheckGroup = 'catalog' | 'github';

export type CheckResult = {
  id: string;
  group: CheckGroup;
  title: string;
  fix: string;
  status: CheckStatus;
  detail: string;
};

export type Scorecard = {
  entityRef: string;
  name: string;
  namespace: string;
  kind: string;
  title?: string;
  owner?: string;
  score: number | null;
  passed: number;
  failed: number;
  unknown: number;
  checks: CheckResult[];
};

async function requestJson<T>(fetchApi: FetchApi, url: string): Promise<T> {
  const response = await fetchApi.fetch(url);
  if (!response.ok) {
    let message = `Request to '${url}' failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.error?.message === 'string') {
        message = body.error.message;
      }
    } catch {
      // Body wasn't JSON - stick with the generic message above.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchScorecards(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<Scorecard[]> {
  const baseUrl = await discoveryApi.getBaseUrl('idp-standards');
  const { scorecards } = await requestJson<{ scorecards: Scorecard[] }>(
    fetchApi,
    `${baseUrl}/scorecards`,
  );
  return scorecards;
}

export async function fetchScorecard(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  entityRef: { kind: string; namespace: string; name: string },
): Promise<Scorecard> {
  const baseUrl = await discoveryApi.getBaseUrl('idp-standards');
  const { scorecard } = await requestJson<{ scorecard: Scorecard }>(
    fetchApi,
    `${baseUrl}/scorecards/${encodeURIComponent(entityRef.namespace)}/${encodeURIComponent(
      entityRef.kind,
    )}/${encodeURIComponent(entityRef.name)}`,
  );
  return scorecard;
}
