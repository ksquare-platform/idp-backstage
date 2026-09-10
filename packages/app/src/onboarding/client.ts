import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export type OrganizationDto = {
  name: string;
  credentialsResolved: boolean;
};

export type RepositoryDto = {
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  private: boolean;
  language: string | null;
  defaultBranch: string;
  archived: boolean;
  pushedAt: string | null;
  inCatalog: boolean;
  catalogEntityRef?: string;
};

export type RepositoriesResponse = {
  repositories: RepositoryDto[];
  page: number;
  perPage: number;
  hasNextPage: boolean;
  total?: number;
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

export async function fetchOrganizations(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<OrganizationDto[]> {
  const baseUrl = await discoveryApi.getBaseUrl('idp-onboarding');
  const { organizations } = await requestJson<{ organizations: OrganizationDto[] }>(
    fetchApi,
    `${baseUrl}/organizations`,
  );
  return organizations;
}

export async function fetchRepositories(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  org: string,
  params: { page: number; perPage: number; search?: string },
): Promise<RepositoriesResponse> {
  const baseUrl = await discoveryApi.getBaseUrl('idp-onboarding');
  const query = new URLSearchParams({
    page: String(params.page),
    perPage: String(params.perPage),
  });
  if (params.search) {
    query.set('search', params.search);
  }
  return requestJson<RepositoriesResponse>(
    fetchApi,
    `${baseUrl}/organizations/${encodeURIComponent(org)}/repositories?${query}`,
  );
}
