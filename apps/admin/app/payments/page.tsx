'use client';
// apps/admin/app/payments/page.tsx

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';  // fix C5

interface RevenueStats {
  totalRevenue: number;
  totalPayments: number;
}

interface Payment {
  id: string;
  salon_id: string;
  amount: number;
  status: string;
  provider_payment_id: string | null;
  created_at: string;
  updated_at: string;
  salons?: { name: string };
}

export default function PaymentsPage() {
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // FIX-C5/AUTH-BOUNDARY: Use backend API instead of direct Supabase
      // so admin authorization is enforced on the server side.
      const [revenueData, paymentsResponse] = await Promise.all([
        apiFetch('/admin/revenue', session.access_token).catch(() => null),
        apiFetch<{ data: Payment[]; total: number }>('/admin/payments?page=1&limit=100', session.access_token).catch(() => null),
      ]);

      if (revenueData) setRevenue(revenueData as typeof revenue);
      if (paymentsResponse?.data) setPayments(paymentsResponse.data);
    } catch (e) {
      console.error('Failed to load payments:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDZD(amount: number): string {
    return amount.toLocaleString('fr-DZ') + ' DZD';
  }

  function getStatusStyle(status: string): React.CSSProperties {
    switch (status) {
      case 'Completed':
        return { backgroundColor: '#0D3320', color: '#2ECC71' };
      case 'Pending':
        return { backgroundColor: '#3A2F00', color: '#F1C40F' };
      case 'Failed':
        return { backgroundColor: '#3A1010', color: '#E74C3C' };
      default:
        return { backgroundColor: '#2C2C2C', color: '#9A9A9A' };
    }
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
          <Link href="/subscriptions" style={styles.navLink}>💳 Abonnements</Link>
          <Link href="/payments" style={{ ...styles.navLink, ...styles.navLinkActive }}>💰 Paiements</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Paiements</h2>
            <p style={styles.pageSubtitle}>Historique des transactions et revenus Chargily</p>
          </div>
          <div style={styles.headerActions}>
            <button onClick={loadPayments} style={styles.refreshBtn}>
              🔄 Actualiser
            </button>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              🚪 Déconnexion
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Chargement des paiements...</p>
          </div>
        ) : (
          <>
            {/* Revenue Summary Cards */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statIcon}>💰</span>
                <div>
                  <h3 style={styles.statLabel}>Revenus Totaux</h3>
                  <p style={{ ...styles.statValue, color: '#2ECC71' }}>
                    {revenue ? formatDZD(revenue.totalRevenue) : '0 DZD'}
                  </p>
                </div>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statIcon}>🧾</span>
                <div>
                  <h3 style={styles.statLabel}>Total Transactions</h3>
                  <p style={styles.statValue}>{revenue?.totalPayments ?? 0}</p>
                </div>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statIcon}>📈</span>
                <div>
                  <h3 style={styles.statLabel}>Moyenne par Transaction</h3>
                  <p style={styles.statValue}>
                    {revenue && revenue.totalPayments > 0
                      ? formatDZD(Math.round(revenue.totalRevenue / revenue.totalPayments))
                      : '0 DZD'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payments Table */}
            <h2 style={{ ...styles.pageTitle, marginTop: 40, marginBottom: 16 }}>
              Historique des Transactions
            </h2>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Salon</th>
                    <th style={styles.th}>Montant</th>
                    <th style={styles.th}>Statut</th>
                    <th style={styles.th}>ID Paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#9A9A9A' }}>
                        Aucun paiement enregistré.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id} style={styles.tr}>
                        <td style={styles.td}>{formatDate(payment.created_at)}</td>
                        <td style={styles.td}>
                          {(payment.salons as any)?.name || payment.salon_id.slice(0, 8) + '...'}
                        </td>
                        <td style={{ ...styles.td, fontWeight: 600, color: '#2ECC71' }}>
                          {formatDZD(payment.amount)}
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, ...getStatusStyle(payment.status) }}>
                            {payment.status}
                          </span>
                        </td>
                        <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>
                          {payment.provider_payment_id || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
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
    marginBottom: 32,
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
  headerActions: {
    display: 'flex',
    gap: 12,
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
  logoutBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#E74C3C',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 20,
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1A1A1A',
    border: '1px solid #2C2C2C',
    borderRadius: 12,
    padding: '24px 20px',
  },
  statIcon: { fontSize: 32 },
  statLabel: {
    fontSize: 12,
    color: '#9A9A9A',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: '#F5F5F5',
    margin: '4px 0 0 0',
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
  statusBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
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
