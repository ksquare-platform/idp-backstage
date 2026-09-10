import { useEffect, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import useDebounce from 'react-use/esm/useDebounce';
import {
  Content,
  ContentHeader,
  Header,
  Link,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { fetchOrganizations, fetchRepositories, type RepositoryDto } from './client';
import { formatRelativeTime } from './relativeTime';

const PER_PAGE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

function catalogEntityPageUrl(entityRef: string): string {
  const [kind, rest] = entityRef.split(':');
  const [namespace, name] = rest.split('/');
  return `/catalog/${namespace}/${kind}/${name}`;
}

function DescriptionCell({ description }: { description: string | null }) {
  return (
    <span
      title={description ?? ''}
      style={{
        display: 'block',
        maxWidth: 320,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {description ?? '—'}
    </span>
  );
}

export function RepositoriesPage() {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const {
    value: organizations,
    loading: orgsLoading,
    error: orgsError,
  } = useAsync(() => fetchOrganizations(discoveryApi, fetchApi), []);

  const [selectedOrg, setSelectedOrg] = useState<string | undefined>();
  useEffect(() => {
    if (!selectedOrg && organizations?.length) {
      const firstAvailable = organizations.find(org => org.credentialsResolved);
      setSelectedOrg((firstAvailable ?? organizations[0]).name);
    }
  }, [organizations, selectedOrg]);
  const selectedOrgEntry = organizations?.find(org => org.name === selectedOrg);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useDebounce(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS, [searchInput]);

  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  useEffect(() => {
    setPage(0);
  }, [selectedOrg, search]);

  const {
    value: repoResponse,
    loading: reposLoading,
    error: reposError,
  } = useAsync(async () => {
    if (!selectedOrg || !selectedOrgEntry?.credentialsResolved) {
      return undefined;
    }
    return fetchRepositories(discoveryApi, fetchApi, selectedOrg, {
      page: page + 1,
      perPage,
      search: search || undefined,
    });
  }, [selectedOrg, selectedOrgEntry?.credentialsResolved, page, perPage, search]);

  const columns: TableColumn<RepositoryDto>[] = [
    {
      title: 'Repository',
      field: 'name',
      render: repo => <Link to={repo.htmlUrl}>{repo.name}</Link>,
    },
    {
      title: 'Description',
      render: repo => <DescriptionCell description={repo.description} />,
    },
    { title: 'Language', field: 'language', render: repo => repo.language ?? '—' },
    {
      title: 'Visibility',
      render: repo => (repo.private ? 'Private' : 'Public'),
    },
    {
      title: 'Last pushed',
      field: 'pushedAt',
      render: repo => formatRelativeTime(repo.pushedAt),
    },
    {
      title: 'Status',
      render: repo => (
        <Chip
          label={repo.inCatalog ? 'In catalog' : 'Not onboarded'}
          color={repo.inCatalog ? 'primary' : 'default'}
          size="small"
        />
      ),
    },
    {
      title: 'Actions',
      render: repo =>
        repo.inCatalog && repo.catalogEntityRef ? (
          <Link to={catalogEntityPageUrl(repo.catalogEntityRef)} style={{ textDecoration: 'none' }}>
            <Button component="span" variant="outlined" size="small">
              View in catalog
            </Button>
          </Link>
        ) : (
          <Link
            to={`/create/templates/default/onboard-repo?formData[repoUrl]=${encodeURIComponent(repo.htmlUrl)}`}
            style={{ textDecoration: 'none' }}
          >
            <Button component="span" variant="outlined" size="small" color="primary">
              Onboard
            </Button>
          </Link>
        ),
    },
  ];

  const noOrgsConfigured = !orgsLoading && !orgsError && (!organizations || organizations.length === 0);
  const credentialsMissing = Boolean(selectedOrgEntry && !selectedOrgEntry.credentialsResolved);
  const isRateLimitError = Boolean(reposError && /rate limit/i.test(reposError.message));

  return (
    <Page themeId="tool">
      <Header
        title="Repositories"
        subtitle="Browse an organization's GitHub repositories and onboard them into the catalog"
      />
      <Content>
        {orgsLoading && <Progress />}
        {orgsError && <ResponseErrorPanel error={orgsError} />}

        {noOrgsConfigured && (
          <Typography>
            No organizations are configured. Add one under
            idp.onboarding.organizations in app-config.yaml.
          </Typography>
        )}

        {!orgsLoading && !orgsError && organizations && organizations.length > 0 && (
          <>
            <ContentHeader title="Browse repositories">
              <FormControl style={{ minWidth: 240, marginRight: 16 }}>
                <InputLabel id="idp-onboarding-org-label">Organization</InputLabel>
                <Select
                  labelId="idp-onboarding-org-label"
                  value={selectedOrg ?? ''}
                  onChange={e => setSelectedOrg(e.target.value as string)}
                >
                  {organizations.map(org => (
                    <MenuItem
                      key={org.name}
                      value={org.name}
                      disabled={!org.credentialsResolved}
                      title={
                        org.credentialsResolved
                          ? undefined
                          : "The GitHub App isn't installed on this organization"
                      }
                    >
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Search repositories"
                variant="outlined"
                size="small"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ minWidth: 280 }}
              />
            </ContentHeader>

            {credentialsMissing && (
              <Typography color="error">
                {`GitHub credentials aren't available for '${selectedOrgEntry?.name}' - the GitHub App is likely not installed there.`}
              </Typography>
            )}

            {!credentialsMissing && reposLoading && <Progress />}

            {!credentialsMissing && reposError && isRateLimitError && (
              <Typography color="error">
                GitHub API rate limit exceeded, and no cached data is available for
                this view yet - please try again shortly.
              </Typography>
            )}

            {!credentialsMissing && reposError && !isRateLimitError && (
              <ResponseErrorPanel error={reposError} />
            )}

            {!credentialsMissing &&
              !reposLoading &&
              !reposError &&
              repoResponse &&
              (repoResponse.repositories.length === 0 ? (
                <Typography>
                  {`No repositories found${search ? ` matching "${search}"` : ''}.`}
                </Typography>
              ) : (
                <Table
                  columns={columns}
                  data={repoResponse.repositories}
                  options={{
                    paging: true,
                    search: false,
                    padding: 'dense',
                    pageSize: perPage,
                    pageSizeOptions: PER_PAGE_OPTIONS,
                  }}
                  page={page}
                  totalCount={
                    page * perPage +
                    repoResponse.repositories.length +
                    (repoResponse.hasNextPage ? 1 : 0)
                  }
                  onPageChange={setPage}
                  onRowsPerPageChange={setPerPage}
                />
              ))}
          </>
        )}
      </Content>
    </Page>
  );
}
