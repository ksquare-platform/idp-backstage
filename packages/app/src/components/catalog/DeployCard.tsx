import { Button } from '@material-ui/core';
import { InfoCard, Link } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';

const DEPLOY_ENVIRONMENTS_ANNOTATION = 'ksquare.io/deploy-environments';

export function DeployCard() {
  const { entity } = useEntity();
  if (!entity.metadata.annotations?.[DEPLOY_ENVIRONMENTS_ANNOTATION]) {
    return null;
  }

  const entityRef = stringifyEntityRef(entity);
  const deployUrl = `/create/templates/default/deploy-service?formData[component]=${encodeURIComponent(entityRef)}`;

  return (
    <InfoCard title="Deploy">
      <Link to={deployUrl} style={{ textDecoration: 'none' }}>
        <Button component="span" variant="contained" color="primary">
          Deploy this service
        </Button>
      </Link>
    </InfoCard>
  );
}
