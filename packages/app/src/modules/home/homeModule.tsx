import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { HomePageWidgetBlueprint } from '@backstage/plugin-home-react/alpha';
import { Hero } from './Hero';
import { QuickActions } from './QuickActions';
import { MyServices } from './MyServices';
import { RecentActivity } from './RecentActivity';

const heroWidget = HomePageWidgetBlueprint.make({
  name: 'hero',
  params: {
    name: 'PortalHero',
    title: '',
    description: 'What this portal is for',
    components: async () => ({ Content: Hero }),
  },
});

const quickActionsWidget = HomePageWidgetBlueprint.make({
  name: 'quick-actions',
  params: {
    name: 'QuickActions',
    title: 'Quick actions',
    description: 'Start one of the golden paths',
    components: async () => ({ Content: QuickActions }),
  },
});

const myServicesWidget = HomePageWidgetBlueprint.make({
  name: 'my-services',
  params: {
    name: 'MyServices',
    title: 'My services',
    description: 'Components owned by groups you belong to',
    components: async () => ({ Content: MyServices }),
  },
});

const recentActivityWidget = HomePageWidgetBlueprint.make({
  name: 'recent-activity',
  params: {
    name: 'RecentActivity',
    title: 'Recent activity',
    description: 'The most recent scaffolder template runs',
    components: async () => ({ Content: RecentActivity }),
  },
});

export const homeModule = createFrontendModule({
  pluginId: 'home',
  extensions: [
    heroWidget,
    quickActionsWidget,
    myServicesWidget,
    recentActivityWidget,
  ],
});
