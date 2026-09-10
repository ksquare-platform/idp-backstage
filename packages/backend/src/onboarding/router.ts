import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from '@backstage/config';
import type {
  BackstageCredentials,
  HttpAuthService,
  LoggerService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { NotAllowedError, NotFoundError, ServiceUnavailableError } from '@backstage/errors';
import {
  createOctokitForOrg,
  githubCredentialsResolveForOrg,
} from '../github/octokit';
import { idpOnboardingReadPermission } from './permissions';
import { TtlCache } from './cache';
import { buildCatalogSlugIndex } from './catalogIndex';
import { fetchOrgRepos, isRateLimitError, type FetchReposResult } from './githubRepos';

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 50;

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

async function authorize(
  permissions: PermissionsService,
  credentials: BackstageCredentials,
): Promise<void> {
  const [decision] = await permissions.authorize(
    [{ permission: idpOnboardingReadPermission }],
    { credentials },
  );
  if (decision.result === AuthorizeResult.DENY) {
    throw new NotAllowedError('Missing permission to read onboarding data');
  }
}

function parsePagination(req: Request): { page: number; perPage: number } {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const requestedPerPage = Number.parseInt(
    String(req.query.perPage ?? DEFAULT_PER_PAGE),
    10,
  );
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, requestedPerPage || DEFAULT_PER_PAGE),
  );
  return { page, perPage };
}

export interface RouterOptions {
  config: Config;
  logger: LoggerService;
  permissions: PermissionsService;
  catalog: CatalogService;
  httpAuth: HttpAuthService;
}

export async function createRouter(options: RouterOptions): Promise<express.Router> {
  const { config, logger, permissions, catalog, httpAuth } = options;

  const organizations: string[] =
    config.getOptionalStringArray('idp.onboarding.organizations') ?? [];

  const repoListCache = new TtlCache<FetchReposResult>();

  const router = express.Router();
  router.use(express.json());

  router.get(
    '/organizations',
    asyncHandler(async (req, res) => {
      const credentials = await httpAuth.credentials(req);
      await authorize(permissions, credentials);

      const results = await Promise.all(
        organizations.map(async org => ({
          name: org,
          credentialsResolved: await githubCredentialsResolveForOrg(config, org),
        })),
      );
      res.json({ organizations: results });
    }),
  );

  router.get(
    '/organizations/:org/repositories',
    asyncHandler(async (req, res) => {
      const credentials = await httpAuth.credentials(req);
      await authorize(permissions, credentials);

      const { org } = req.params;
      if (!organizations.some(o => o.toLowerCase() === org.toLowerCase())) {
        throw new NotFoundError(
          `Unknown organization '${org}'. Configured organizations: ${organizations.join(', ') || '(none)'}`,
        );
      }

      const { page, perPage } = parsePagination(req);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const includeArchived = ['1', 'true'].includes(String(req.query.archived ?? ''));

      const cacheKey = `${org}:${page}:${perPage}:${search}:${includeArchived}`;

      let octokit;
      try {
        octokit = await createOctokitForOrg(config, org);
      } catch (e) {
        throw new ServiceUnavailableError(
          `GitHub credentials are not available for organization '${org}' - the GitHub App is likely not installed there`,
        );
      }

      let result = repoListCache.get(cacheKey);
      if (!result) {
        try {
          result = await fetchOrgRepos(octokit, org, {
            page,
            perPage,
            search: search || undefined,
          });
          repoListCache.set(cacheKey, result);
        } catch (e) {
          if (isRateLimitError(e)) {
            const stale = repoListCache.getStale(cacheKey);
            if (stale) {
              logger.warn(
                `GitHub rate limit hit listing repositories for '${org}' - serving cached data`,
              );
              result = stale;
            } else {
              logger.warn(
                `GitHub rate limit hit listing repositories for '${org}' - no cached data to fall back to`,
              );
              throw new ServiceUnavailableError(
                `GitHub API rate limit exceeded while listing repositories for '${org}', and no cached data is available yet - try again shortly`,
              );
            }
          } else {
            throw e;
          }
        }
      }

      const filteredRepos = includeArchived
        ? result.repos
        : result.repos.filter(repo => !repo.archived);

      const slugIndex = await buildCatalogSlugIndex(catalog, credentials);
      const repositories = filteredRepos.map(repo => {
        const entityRef = slugIndex.get(`${org}/${repo.name}`.toLowerCase());
        return {
          ...repo,
          inCatalog: Boolean(entityRef),
          catalogEntityRef: entityRef,
        };
      });

      res.json({
        repositories,
        page,
        perPage,
        hasNextPage: result.hasNextPage,
        total: result.total,
      });
    }),
  );

  return router;
}
