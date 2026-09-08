import { useMemo } from 'react';
import useAsync from 'react-use/esm/useAsync';
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

const DEPLOY_ENVIRONMENTS_ANNOTATION = 'ksquare.io/deploy-environments';

type DeployTarget = { workflow: string; ref: string };

// Mirrors packages/backend/src/deploy/dispatchWorkflowAction.ts's
// parseDeployEnvironments exactly - keep both in sync if the annotation
// format ever changes.
function parseDeployEnvironments(raw: string): Map<string, DeployTarget> {
  const targets = new Map<string, DeployTarget>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const environment = line.slice(0, colonIndex).trim();
    const target = line.slice(colonIndex + 1).trim();
    const atIndex = target.lastIndexOf('@');
    if (!environment || atIndex === -1) {
      continue;
    }
    const workflow = target.slice(0, atIndex).trim();
    const ref = target.slice(atIndex + 1).trim();
    if (workflow && ref) {
      targets.set(environment, { workflow, ref });
    }
  }
  return targets;
}

function Message(props: { error?: boolean; children: string }) {
  return (
    <FormControl fullWidth error={props.error}>
      <FormHelperText>{props.children}</FormHelperText>
    </FormControl>
  );
}

export function DeployEnvironmentPicker(
  props: FieldExtensionComponentProps<string>,
) {
  const { onChange, formData, required, rawErrors, formContext } = props;
  const catalogApi = useApi(catalogApiRef);

  // The component field lives on an earlier page of the same form -
  // formContext carries the whole cross-page formData.
  const componentRef = (formContext?.formData as { component?: string } | undefined)
    ?.component;

  const {
    value: entity,
    loading,
    error,
  } = useAsync(async () => {
    if (!componentRef) {
      return undefined;
    }
    return catalogApi.getEntityByRef(componentRef);
  }, [componentRef]);

  const annotationRaw = entity?.metadata.annotations?.[DEPLOY_ENVIRONMENTS_ANNOTATION];
  const targets = useMemo(
    () => (annotationRaw ? parseDeployEnvironments(annotationRaw) : undefined),
    [annotationRaw],
  );

  if (!componentRef) {
    return <Message>Select a component first to see its available environments.</Message>;
  }
  if (loading) {
    return <Message>Loading available environments…</Message>;
  }
  if (error || !entity) {
    return (
      <Message error>Could not load the selected component's catalog entry.</Message>
    );
  }
  if (!annotationRaw) {
    return (
      <Message error>
        {`This component has no '${DEPLOY_ENVIRONMENTS_ANNOTATION}' annotation - it can't be deployed from here.`}
      </Message>
    );
  }
  if (!targets || targets.size === 0) {
    return (
      <Message error>
        {`This component's '${DEPLOY_ENVIRONMENTS_ANNOTATION}' annotation couldn't be parsed - expected lines like "qa: deploy-qa.yml@qa".`}
      </Message>
    );
  }

  return (
    <FormControl fullWidth required={required} error={Boolean(rawErrors?.length)}>
      <InputLabel id="deploy-environment-picker-label">Environment</InputLabel>
      <Select
        labelId="deploy-environment-picker-label"
        value={formData ?? ''}
        onChange={e => onChange(e.target.value as string)}
      >
        {Array.from(targets.entries()).map(([env, target]) => (
          <MenuItem key={env} value={env}>
            {`${env} - ${target.workflow} @ ${target.ref}`}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>Target environment</FormHelperText>
    </FormControl>
  );
}
