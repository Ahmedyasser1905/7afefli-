'use client';
export const dynamic = 'force-dynamic';
// apps/admin/app/subscriptions/page.tsx

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';  // fix C5

interface Subscription {
  id: string;
  salon_id: string;
  plan: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  // FIX-2: Plans join added in admin.service.ts getAllSubscriptions()
  plans: { name: string; price: number } | null;
  salons: {
    name: string;
  } | null;
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // FIX-2: getAllSubscriptions now joins plans(name, price)
      const data = await apiFetch<Subscription[]>('/admin/subscriptions', session.access_token);
      setSubscriptions(data ?? []);
    } catch (e) {
      console.error('Failed to fetch subscriptions:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>💈</span>
          <h1 style={styles.logoText}>BarberDZ</h1>
          <span style={styles.adminBadge}>Admin</span>
        </div>
        <nav style={styles.nav}>
          <Link href="/dashboard" style={styles.navLink}>📊 Dashboard</Link>
          <Link href="/salons" style={styles.navLink}>🏪 Approbations</Link>
          <Link href="/users" style={styles.navLink}>👥 Utilisateurs</Link>
          <Link href="/reservations" style={styles.navLink}>📅 Réservations</Link>
          <Link href="/subscriptions" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            💳 Abonnements
          </Link>
          <Link href="/payments" style={styles.navLink}>💰 Paiements</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Gestion des Abonnements</h2>
            <p style={styles.pageSubtitle}>
              Suivi des formules souscrites par les salons partenaires
            </p>
          </div>
          <button onClick={fetchSubscriptions} style={styles.refreshBtn}>
            🔄 Actualiser
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Chargement des abonnements...</p>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Salon</th>
                  <th style={styles.th}>Formule</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Date de début</th>
                  <th style={styles.th}>Fin d'essai gratuit</th>
                  <th style={styles.th}>Fin d'abonnement</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#9A9A9A' }}>
                      Aucun abonnement enregistré.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.salonName}>{sub.salons?.name ?? 'Salon Inconnu'}</div>
                        <div style={styles.salonId}>{sub.salon_id}</div>
                      </td>
                      <td style={styles.td}>
                        {/* FIX-2: Show plan name from joined plans table, fall back to raw plan UUID */}
                        <span style={styles.planText}>✨ {sub.plans?.name ?? sub.plan ?? 'Inconnu'}</span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(sub.status === 'Active'
                              ? styles.badgeActive
                              : sub.status === 'Trial'
                              ? styles.badgeTrial
                              : styles.badgeExpired),
                          }}
                        >
                          {sub.status === 'Active'
                            ? 'Actif'
                            : sub.status === 'Trial'
                            ? 'Essai'
                            : 'Expiré'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.dateText}>{formatDate(sub.starts_at)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.dateText}>{formatDate(sub.trial_ends_at)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.dateText}>{formatDate(sub.ends_at)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#0F0F0F',
    color: '#F5F5F5',
    fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
  },
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
  main: {
    flex: 1,
    padding: '32px 40px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#F5F5F5',
    margin: 0,
    fontFamily: '"Syne", sans-serif',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#9A9A9A',
    margin: '4px 0 0',
  },
  refreshBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #3E3E3E',
    backgroundColor: 'transparent',
    color: '#F5F5F5',
    cursor: 'pointer',
    fontSize: 13,
  },
  tableContainer: {
    borderRadius: 12,
    border: '1px solid #2C2C2C',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 12,
    color: '#9A9A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #2C2C2C',
  },
  tr: {
    borderBottom: '1px solid #1A1A1A',
  },
  td: {
    padding: '14px 16px',
    fontSize: 14,
    verticalAlign: 'middle',
  },
  salonName: {
    fontWeight: 600,
    color: '#F5F5F5',
  },
  salonId: {
    fontSize: 10,
    color: '#5A5A5A',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  planText: {
    color: '#E8A020',
    fontWeight: 600,
  },
  dateText: {
    color: '#9A9A9A',
    fontSize: 13,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  badgeActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    color: '#2ECC71',
  },
  badgeTrial: {
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    color: '#3498DB',
  },
  badgeExpired: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    color: '#E74C3C',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 80,
    gap: 16,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #2C2C2C',
    borderTopColor: '#E8A020',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: { color: '#9A9A9A', fontSize: 14 },
};
