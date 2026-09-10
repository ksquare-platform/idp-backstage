import { useMemo } from 'react';
import useAsync from 'react-use/esm/useAsync';
import { Link, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { usePermission } from '@backstage/plugin-permission-react';
import { makeStyles, Paper, Typography } from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import StorageIcon from '@material-ui/icons/Storage';
import type { ComponentType } from 'react';
import {
  catalogRepoOnboardPermission,
  catalogServiceCreatePermission,
  deployTriggerIntegrationPermission,
  idpOnboardingReadPermission,
} from '../../permissions';
import type { BasicPermission } from '@backstage/plugin-permission-common';

const useStyles = makeStyles(theme => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(2.5),
    textDecoration: 'none',
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    transition: 'border-color 0.15s ease, transform 0.15s ease',
    height: '100%',
    boxSizing: 'border-box',
    '&:hover': {
      borderColor: theme.palette.primary.main,
      transform: 'translateY(-2px)',
    },
  },
  icon: {
    color: theme.palette.primary.main,
    fontSize: 28,
  },
  title: {
    fontWeight: 700,
  },
}));

type Action = {
  title: string;
  description: string;
  to: string;
  Icon: ComponentType<{ className?: string }>;
  // Only present for tiles backed by a scaffolder template - checked
  // against the catalog so a removed/renamed template doesn't 404.
  templateName?: string;
  permission: BasicPermission;
};

const actions: Action[] = [
  {
    title: 'Create a new service',
    description: 'Scaffold a new repo, CI, docs and catalog entry for a brand-new service.',
    to: '/create/templates/default/new-service',
    Icon: AddCircleOutlineIcon,
    templateName: 'new-service',
    permission: catalogServiceCreatePermission,
  },
  {
    title: 'Onboard a repository',
    description: "Register an existing GitHub repo in the catalog, opening a PR if it needs a catalog-info.yaml.",
    to: '/create/templates/default/onboard-repo',
    Icon: PlaylistAddCheckIcon,
    templateName: 'onboard-repo',
    permission: catalogRepoOnboardPermission,
  },
  {
    title: 'Deploy a service',
    description: "Trigger a component's own GitHub Actions deploy workflow for an environment.",
    to: '/create/templates/default/deploy-service',
    Icon: CloudUploadIcon,
    templateName: 'deploy-service',
    permission: deployTriggerIntegrationPermission,
  },
  {
    title: 'Browse repositories',
    description: "Browse an org's GitHub repos and onboard any that aren't in the catalog yet.",
    to: '/repositories',
    Icon: StorageIcon,
    permission: idpOnboardingReadPermission,
  },
];

export const QuickActions = () => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);

  const { value: registeredTemplates, loading: templatesLoading } = useAsync(
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'Template' },
        fields: ['metadata.name'],
      });
      return new Set(items.map(entity => entity.metadata.name));
    },
    [],
  );

  // Hooks can't be called in a loop, so each tile's permission is checked
  // explicitly (the tile list above is fixed, not data-driven).
  const createServicePermission = usePermission({ permission: actions[0].permission });
  const onboardRepoPermission = usePermission({ permission: actions[1].permission });
  const deployPermission = usePermission({ permission: actions[2].permission });
  const browseReposPermission = usePermission({ permission: actions[3].permission });
  const permissionResults = [
    createServicePermission,
    onboardRepoPermission,
    deployPermission,
    browseReposPermission,
  ];

  const visibleActions = useMemo(
    () =>
      actions.filter((action, index) => {
        if (action.templateName) {
          if (templatesLoading || !registeredTemplates?.has(action.templateName)) {
            return false;
          }
        }
        const permissionResult = permissionResults[index];
        return !permissionResult.loading && permissionResult.allowed;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registeredTemplates, templatesLoading, ...permissionResults],
  );

  if (templatesLoading) {
    return <Progress />;
  }

  if (visibleActions.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        You don't have access to any quick actions yet. Ask a platform
        admin to add you to the developers or platform-admins group.
      </Typography>
    );
  }

  return (
    <div className={classes.grid}>
      {visibleActions.map(({ title, description, to, Icon }) => (
        <Link key={to} to={to} style={{ textDecoration: 'none' }}>
          <Paper className={classes.card}>
            <Icon className={classes.icon} />
            <Typography className={classes.title} variant="body1">
              {title}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {description}
            </Typography>
          </Paper>
        </Link>
      ))}
    </div>
  );
};
