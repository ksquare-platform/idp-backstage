import useAsync from 'react-use/esm/useAsync';
import { Link, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import type { ScaffolderTask } from '@backstage/plugin-scaffolder-common';
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';
import { formatRelativeTime } from '../../onboarding/relativeTime';

const STATUS_COLORS: Record<string, string> = {
  completed: '#2e7d32',
  failed: '#c62828',
  cancelled: '#757575',
  processing: '#1565c0',
  open: '#ef6c00',
  skipped: '#757575',
};

function templateLabel(task: ScaffolderTask): string {
  const info = task.spec.templateInfo;
  return (
    info?.entity?.metadata.title ??
    info?.entity?.metadata.name ??
    info?.entityRef ??
    'Unknown template'
  );
}

function runByLabel(task: ScaffolderTask): string {
  return task.spec.user?.entity?.metadata.name ?? task.spec.user?.ref ?? 'unknown user';
}

export const RecentActivity = () => {
  const scaffolderApi = useApi(scaffolderApiRef);
  const { value, loading, error } = useAsync(
    () => scaffolderApi.listTasks({ filterByOwnership: 'all', limit: 8 }),
    [],
  );

  if (loading) {
    return <Progress />;
  }
  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  const tasks = value?.tasks ?? [];
  if (tasks.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        No scaffolder tasks have run yet. Runs from the quick actions above
        will show up here.
      </Typography>
    );
  }

  return (
    <List dense>
      {tasks.map(task => (
        <ListItem key={task.id} divider dense disableGutters>
          <ListItemText
            primary={
              <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                <Link to={`/create/tasks/${task.id}`}>{templateLabel(task)}</Link>
                <Chip
                  label={task.status}
                  size="small"
                  style={{
                    backgroundColor: STATUS_COLORS[task.status] ?? '#757575',
                    color: '#fff',
                  }}
                />
              </Box>
            }
            secondary={`${runByLabel(task)} · ${formatRelativeTime(task.createdAt)}`}
          />
        </ListItem>
      ))}
    </List>
  );
};
