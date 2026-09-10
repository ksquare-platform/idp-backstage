import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { Typography } from '@material-ui/core';
import { fetchScorecards, type Scorecard } from './client';

function catalogEntityPageUrl(entityRef: string): string {
  const [kind, rest] = entityRef.split(':');
  const [namespace, name] = rest.split('/');
  return `/catalog/${namespace}/${kind}/${name}`;
}

export function StandardsPage() {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const navigate = useNavigate();

  const {
    value: scorecards,
    loading,
    error,
  } = useAsync(() => fetchScorecards(discoveryApi, fetchApi), []);

  const sorted = useMemo(
    () =>
      scorecards
        ? [...scorecards].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
        : [],
    [scorecards],
  );

  const isRateLimitError = Boolean(error && /rate limit/i.test(error.message));

  const columns: TableColumn<Scorecard>[] = [
    {
      title: 'Name',
      field: 'name',
      render: sc => sc.title ?? sc.name,
    },
    { title: 'Owner', render: sc => sc.owner ?? '—' },
    {
      title: 'Score',
      render: sc => (sc.score !== null ? `${Math.round(sc.score * 100)}%` : 'N/A'),
    },
    { title: 'Passed', field: 'passed' },
    { title: 'Failed', field: 'failed' },
    { title: 'Unknown', field: 'unknown' },
  ];

  return (
    <Page themeId="tool">
      <Header
        title="Standards"
        subtitle="How every component measures up against platform standards, worst first"
      />
      <Content>
        {loading && <Progress />}

        {error && isRateLimitError && (
          <Typography color="error">
            GitHub API rate limit exceeded, and no cached data is available yet -
            please try again shortly.
          </Typography>
        )}

        {error && !isRateLimitError && <ResponseErrorPanel error={error} />}

        {!loading &&
          !error &&
          scorecards &&
          (scorecards.length === 0 ? (
            <Typography>No components are registered in the catalog yet.</Typography>
          ) : (
            <Table
              columns={columns}
              data={sorted}
              options={{ paging: true, search: true, padding: 'dense', pageSize: 20 }}
              onRowClick={(_event, row) => {
                if (row) {
                  navigate(catalogEntityPageUrl(row.entityRef));
                }
              }}
            />
          ))}
      </Content>
    </Page>
  );
}
