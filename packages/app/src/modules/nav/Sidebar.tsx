import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { usePermission } from '@backstage/plugin-permission-react';
import { policyEntityReadPermission } from '@backstage-community/plugin-rbac-common';
import type { ReactNode } from 'react';

// Only renders its children once the signed-in user is allowed to read RBAC
// policies - i.e. RBAC superusers, or anyone else granted that permission -
// so the nav item doesn't show up for users who couldn't open the page anyway.
function RbacNavItem({ children }: { children: ReactNode }) {
  const { loading, allowed } = usePermission({
    permission: policyEntityReadPermission,
    resourceRef: undefined,
  });
  if (loading || !allowed) {
    return null;
  }
  return <>{children}</>;
}

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const nav = navItems.withComponent(item => (
        <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
      ));

      // Skipped items
      nav.take('page:search'); // Using search modal instead
      nav.take('page:notifications'); // Using NotificationsSidebarItem manually instead
      // "Register Existing Component" 404s on client orgs and is replaced
      // by the "Onboard an existing repository" template - hide it rather
      // than let it fall through into nav.rest() below.
      nav.take('page:catalog-import');
      const rbacNavItem = nav.take('page:rbac');

      return (
        <Sidebar>
          <SidebarLogo />
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarDivider />
          <SidebarGroup label="Menu" icon={<MenuIcon />}>
            {nav.take('page:home')}
            {nav.take('page:catalog')}
            {nav.take('page:idp-onboarding')}
            {nav.take('page:scaffolder')}
            <SidebarDivider />
            <SidebarScrollWrapper>
              {nav.rest({ sortBy: 'title' })}
            </SidebarScrollWrapper>
          </SidebarGroup>
          <SidebarSpace />
          <SidebarDivider />
          <NotificationsSidebarItem />
          <SidebarDivider />
          <SidebarGroup
            label="Settings"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            <RbacNavItem>{rbacNavItem}</RbacNavItem>
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});
