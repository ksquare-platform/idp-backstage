import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { FormFieldBlueprint, createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { makeFieldSchema } from '@backstage/plugin-scaffolder-react';
import { DeployEnvironmentPicker } from './DeployEnvironmentPicker';

const DeployEnvironmentPickerSchema = makeFieldSchema({
  output: z => z.string(),
});

const deployEnvironmentPickerFieldExtension = FormFieldBlueprint.make({
  params: {
    field: async () =>
      createFormField({
        name: 'DeployEnvironmentPicker',
        component: DeployEnvironmentPicker,
        schema: DeployEnvironmentPickerSchema,
      }),
  },
});

export const deployEnvironmentPickerModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [deployEnvironmentPickerFieldExtension],
});
