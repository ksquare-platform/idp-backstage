import { Octokit } from '@octokit/rest';
import type { Config } from '@backstage/config';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import { InputError } from '@backstage/errors';

// Single shared credential-resolution path for both a specific repo and a
// whole org - do not duplicate this against a second provider/integration
// lookup.
async function resolveGithubCredentials(
  config: Config,
  url: string,
  label: string,
): Promise<{ token: string; apiBaseUrl?: string }> {
  const integrations = ScmIntegrations.fromConfig(config);
  const credentialsProvider =
    DefaultGithubCredentialsProvider.fromIntegrations(integrations);

  const integration = integrations.github.byUrl(url);
  if (!integration) {
    throw new InputError(
      `No GitHub integration configured that covers '${label}'`,
    );
  }

  const { token } = await credentialsProvider.getCredentials({ url });
  if (!token) {
    throw new InputError(`No GitHub credentials available for '${label}'`);
  }

  return { token, apiBaseUrl: integration.config.apiBaseUrl };
}

export async function createOctokitForRepo(
  config: Config,
  repo: string,
): Promise<Octokit> {
  const { token, apiBaseUrl } = await resolveGithubCredentials(
    config,
    `https://github.com/${repo}`,
    repo,
  );
  return new Octokit({ auth: token, baseUrl: apiBaseUrl });
}

export async function createOctokitForOrg(
  config: Config,
  org: string,
): Promise<Octokit> {
  const { token, apiBaseUrl } = await resolveGithubCredentials(
    config,
    `https://github.com/${org}`,
    org,
  );
  return new Octokit({ auth: token, baseUrl: apiBaseUrl });
}

// Cheap check for the GET /organizations endpoint - resolves credentials
// without making any GitHub API call, so listing configured orgs stays fast
// even if some of them aren't reachable.
export async function githubCredentialsResolveForOrg(
  config: Config,
  org: string,
): Promise<boolean> {
  try {
    await resolveGithubCredentials(config, `https://github.com/${org}`, org);
    return true;
  } catch {
    return false;
  }
}
