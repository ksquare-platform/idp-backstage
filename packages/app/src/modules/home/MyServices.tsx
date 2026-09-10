import { useEffect, useState } from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { Link, Progress } from '@backstage/core-components';
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';

function entityRoute(entity: Entity): string {
  const namespace = entity.metadata.namespace ?? 'default';
  return `/catalog/${namespace}/${entity.kind.toLowerCase()}/${entity.metadata.name}`;
}

export const MyServices = () => {
  const catalogApi = useApi(catalogApiRef);
  const identityApi = useApi(identityApiRef);
  const [entities, setEntities] = useState<Entity[] | undefined>();

  useEffect(() => {
    let active = true;
    (async () => {
      const identity = await identityApi.getBackstageIdentity();
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'Component',
          'relations.ownedBy': identity.ownershipEntityRefs,
        },
      });
      if (active) {
        setEntities(items);
      }
    })();
    return () => {
      active = false;
    };
  }, [catalogApi, identityApi]);

  if (!entities) {
    return <Progress />;
  }

  if (entities.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        Services appear here once their catalog-info.yaml owner is a group
        you're in. Don't see a service you expect? Try{' '}
        <Link to="/repositories">Browse repositories</Link> to onboard it.
      </Typography>
    );
  }

  return (
    <List dense>
      {entities.map(entity => {
        const spec = entity.spec as { type?: string; lifecycle?: string } | undefined;
        return (
          <ListItem key={entity.metadata.uid} divider dense disableGutters>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                  <Link to={entityRoute(entity)}>
                    {entity.metadata.title ?? entity.metadata.name}
                  </Link>
                  {spec?.lifecycle && (
                    <Chip label={spec.lifecycle} size="small" />
                  )}
                  {spec?.type && (
                    <Typography variant="caption" color="textSecondary">
                      {spec.type}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        );
      })}
    </List>
  );
};
