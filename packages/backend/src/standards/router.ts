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
import { stringifyEntityRef } from '@backstage/catalog-model';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { NotAllowedError, NotFoundError } from '@backstage/errors';
import { TtlCache } from '../onboarding/cache';
import { idpStandardsReadPermission } from './permissions';
import { computeScorecards } from './scorecard';
import type { Scorecard } from './types';

const CACHE_KEY = 'all';

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
    [{ permission: idpStandardsReadPermission }],
    { credentials },
  );
  if (decision.result === AuthorizeResult.DENY) {
    throw new NotAllowedError('Missing permission to read standards scorecards');
  }
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

  const scorecardsCache = new TtlCache<Scorecard[]>();

  async function getScorecards(credentials: BackstageCredentials): Promise<Scorecard[]> {
    const cached = scorecardsCache.get(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const computed = await computeScorecards(config, catalog, credentials);
    if (computed.rateLimited) {
      const stale = scorecardsCache.getStale(CACHE_KEY);
      if (stale) {
        logger.warn('GitHub rate limit hit computing standards scorecards - serving cached data');
        return stale;
      }
      logger.warn(
        'GitHub rate limit hit computing standards scorecards, and no cached data is available - serving results with some GitHub checks marked unknown',
      );
    }
    scorecardsCache.set(CACHE_KEY, computed.scorecards);
    return computed.scorecards;
  }

  const router = express.Router();
  router.use(express.json());

  router.get(
    '/scorecards',
    asyncHandler(async (req, res) => {
      const credentials = await httpAuth.credentials(req);
      await authorize(permissions, credentials);

      const scorecards = await getScorecards(credentials);
      res.json({ scorecards });
    }),
  );

  router.get(
    '/scorecards/:namespace/:kind/:name',
    asyncHandler(async (req, res) => {
      const credentials = await httpAuth.credentials(req);
      await authorize(permissions, credentials);

      const { namespace, kind, name } = req.params;
      const entityRef = stringifyEntityRef({ kind, namespace, name });

      const scorecards = await getScorecards(credentials);
      const scorecard = scorecards.find(s => s.entityRef === entityRef);
      if (!scorecard) {
        throw new NotFoundError(`No scorecard for '${entityRef}'`);
      }
      res.json({ scorecard });
    }),
  );

  return router;
}
