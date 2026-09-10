import useAsync from 'react-use/esm/useAsync';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Box, Chip, List, ListItem, ListItemText, Typography } from '@material-ui/core';
import { fetchScorecard, type CheckResult, type CheckStatus } from './client';

const STATUS_COLORS: Record<CheckStatus, string> = {
  pass: '#2e7d32',
  fail: '#c62828',
  // Grey, not red - unknown must read as visually distinct from a failure.
  unknown: '#9e9e9e',
};

function CheckRow({ check }: { check: CheckResult }) {
  return (
    <ListItem dense disableGutters divider>
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <Chip
              label={check.status}
              size="small"
              style={{ backgroundColor: STATUS_COLORS[check.status], color: '#fff' }}
            />
            <Typography variant="body2">{check.title}</Typography>
          </Box>
        }
        secondary={check.status !== 'pass' ? check.fix : check.detail}
      />
    </ListItem>
  );
}

export function StandardsCard() {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const {
    value: scorecard,
    loading,
    error,
  } = useAsync(
    () =>
      fetchScorecard(discoveryApi, fetchApi, {
        kind: entity.kind,
        namespace: entity.metadata.namespace ?? 'default',
        name: entity.metadata.name,
      }),
    [entity],
  );

  return (
    <InfoCard title="Service standards">
      {loading && <Progress />}
      {error && <ResponseErrorPanel error={error} />}
      {!loading && !error && scorecard && (
        <>
          <Box display="flex" alignItems="baseline" style={{ gap: 12, marginBottom: 8 }}>
            <Typography variant="h4">
              {scorecard.score !== null ? `${Math.round(scorecard.score * 100)}%` : 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {`${scorecard.passed} passed · ${scorecard.failed} failed · ${scorecard.unknown} unknown`}
            </Typography>
          </Box>
          <List dense disablePadding>
            {scorecard.checks.map(check => (
              <CheckRow key={check.id} check={check} />
            ))}
          </List>
        </>
      )}
    </InfoCard>
  );
}
