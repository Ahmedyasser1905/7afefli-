import React from 'react';
import Link from 'next/link';

interface SidebarProps {
  activePath: string;
}

export function Sidebar({ activePath }: SidebarProps) {
  const links = [
    { href: '/dashboard', label: '📊 Dashboard' },
    { href: '/salons', label: '🏪 Approbations' },
    { href: '/users', label: '👥 Utilisateurs' },
    { href: '/reservations', label: '📅 Réservations' },
    { href: '/subscriptions', label: '💳 Abonnements' },
    { href: '/payments', label: '💰 Paiements' },
    { href: '/reviews', label: '⭐ Avis' },
    { href: '/plans', label: '📊 Plans' },
    { href: '/analytics', label: '📈 Analytiques' },
    { href: '/notifications', label: '📢 Notifications' },
  ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoIcon}>💈</span>
        <h1 style={styles.logoText}>BarberDZ</h1>
        <span style={styles.adminBadge}>Admin</span>
      </div>
      <nav style={styles.nav}>
        {links.map((link) => {
          const isActive = activePath === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260,
    backgroundColor: '#1A1A1A',
    borderRight: '1px solid #2C2C2C',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 8px',
  },
  logoIcon: { fontSize: 28 },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#E8A020',
    margin: 0,
    fontFamily: '"Syne", sans-serif',
  },
  adminBadge: {
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: '#3A2F00',
    color: '#E8A020',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 600,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navLink: {
    padding: '10px 12px',
    borderRadius: 8,
    color: '#9A9A9A',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'all 0.2s',
  },
  navLinkActive: {
    backgroundColor: '#2C2C2C',
    color: '#E8A020',
  },
};
