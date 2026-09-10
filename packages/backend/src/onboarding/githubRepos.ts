import type { Octokit } from '@octokit/rest';
import { ServiceUnavailableError } from '@backstage/errors';

export type RepoDto = {
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  private: boolean;
  language: string | null;
  defaultBranch: string;
  archived: boolean;
  pushedAt: string | null;
};

export type FetchReposResult = {
  repos: RepoDto[];
  hasNextPage: boolean;
  total?: number;
};

// Structurally satisfied by both octokit's repos.listForOrg items and its
// search.repos items - the fields this endpoint actually needs from either.
type GithubRepoLike = {
  name: string;
  full_name: string;
  html_url: string;
  description?: string | null;
  private?: boolean;
  language?: string | null;
  default_branch?: string;
  archived?: boolean;
  pushed_at?: string | null;
};

function toDto(repo: GithubRepoLike): RepoDto {
  return {
    name: repo.name,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description ?? null,
    private: repo.private ?? false,
    language: repo.language ?? null,
    defaultBranch: repo.default_branch ?? '',
    archived: repo.archived ?? false,
    pushedAt: repo.pushed_at ?? null,
  };
}

function isRequestError(
  e: unknown,
): e is { status: number; message: string; response?: { headers?: Record<string, string> } } {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export function isRateLimitError(e: unknown): boolean {
  if (!isRequestError(e)) {
    return false;
  }
  if (e.status === 429) {
    return true;
  }
  if (e.status === 403) {
    if (e.response?.headers?.['x-ratelimit-remaining'] === '0') {
      return true;
    }
    if (/rate limit/i.test(e.message)) {
      return true;
    }
  }
  return false;
}

export async function fetchOrgRepos(
  octokit: Octokit,
  org: string,
  options: { page: number; perPage: number; search?: string },
): Promise<FetchReposResult> {
  const { page, perPage, search } = options;

  try {
    if (search) {
      // repos.listForOrg has no text-search parameter - the Search API is
      // the only way to search by name/description across an org, and (as
      // a bonus) it does give a total count, unlike listForOrg.
      const { data } = await octokit.rest.search.repos({
        q: `org:${org} ${search} in:name,description`,
        per_page: perPage,
        page,
      });
      return {
        repos: data.items.map(toDto),
        total: data.total_count,
        hasNextPage: page * perPage < data.total_count,
      };
    }

    const response = await octokit.rest.repos.listForOrg({
      org,
      type: 'all',
      sort: 'pushed',
      direction: 'desc',
      per_page: perPage,
      page,
    });
    return {
      repos: response.data.map(toDto),
      hasNextPage: /rel="next"/.test(response.headers.link ?? ''),
    };
  } catch (e) {
    if (isRequestError(e) && e.status === 404) {
      throw new ServiceUnavailableError(
        `Organization '${org}' was not found on GitHub, or the credentials cannot see it`,
      );
    }
    if (isRequestError(e) && e.status === 403 && !isRateLimitError(e)) {
      throw new ServiceUnavailableError(
        `The GitHub integration credentials lack permission to list repositories in '${org}'`,
      );
    }
    throw e;
  }
}
