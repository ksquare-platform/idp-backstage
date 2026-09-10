import { HomePageSearchBar } from '@backstage/plugin-search';

export const Hero = () => (
  <div
    style={{
      background: 'linear-gradient(120deg, #1C3A63 0%, #2F6DB8 100%)',
      borderRadius: 4,
      padding: '20px 32px',
      color: '#F5F7FA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 24,
      boxSizing: 'border-box',
      minHeight: '100%',
    }}
  >
    <div style={{ flex: '1 1 320px' }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: '#FFFFFF',
          marginBottom: 4,
        }}
      >
        Ksquare IDP
      </div>
      <div style={{ fontSize: 14, maxWidth: 520, lineHeight: 1.4 }}>
        Self-service to create, catalog, and manage your services. Scaffold
        a new project, find who owns what, and check CI/CD status - all
        from one place.
      </div>
    </div>
    <div style={{ flex: '1 1 280px', maxWidth: 420, color: '#000' }}>
      <HomePageSearchBar />
    </div>
  </div>
);
