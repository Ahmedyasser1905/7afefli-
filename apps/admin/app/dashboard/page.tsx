// apps/admin/app/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';  // fix C5: centralised fetch adds /api/v1 prefix

interface PlatformStats {
  totalSalons: number;
  activeSalons: number;
  pendingSalons: number;
  totalUsers: number;
  totalReservations: number;
}

interface RevenueStats {
  totalRevenue: number;
  totalPayments: number;
}

interface AuditLog {
  id: string;
  action: string;
  actor_id: string;
  resource: string;
  ip_address: string;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;

      // Parallel fetch for stats, revenue, and audit logs (fix C5: now routes through /api/v1)
      const [statsData, revenueData, auditData] = await Promise.all([
        apiFetch<PlatformStats>('/admin/stats', token).catch(() => null),
        apiFetch<RevenueStats>('/admin/revenue', token).catch(() => null),
        apiFetch<{ data: AuditLog[] }>('/admin/audit?limit=10', token).catch(() => null),
      ]);

      if (statsData) setStats(statsData);
      if (revenueData) setRevenue(revenueData);
      if (auditData) setAuditLogs(auditData.data || []);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
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
      hour: '2-digit',
      minute: '2-digit',
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
          <a href="/dashboard" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            📊 Dashboard
          </a>
          <a href="/salons" style={styles.navLink}>🏪 Approbations</a>
          <a href="/users" style={styles.navLink}>👥 Utilisateurs</a>
          <a href="/reservations" style={styles.navLink}>📅 Réservations</a>
          <a href="/subscriptions" style={styles.navLink}>💳 Abonnements</a>
          <a href="/payments" style={styles.navLink}>💰 Paiements</a>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Dashboard Général</h2>
            <p style={styles.pageSubtitle}>Vue d'ensemble de la plateforme BarberDZ</p>
          </div>
          <div style={styles.headerActions}>
            <button onClick={loadDashboardData} style={styles.refreshBtn}>
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
            <p style={styles.loadingText}>Chargement des statistiques...</p>
          </div>
        ) : (
          <>
            {/* Bento Grid Stats */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statIcon}>👥</span>
                <div>
                  <h3 style={styles.statLabel}>Utilisateurs</h3>
                  <p style={styles.statValue}>{stats?.totalUsers ?? 0}</p>
                </div>
              </div>

              <div style={styles.statCard}>
                <span style={styles.statIcon}>🏪</span>
                <div>
                  <h3 style={styles.statLabel}>Salons Actifs</h3>
                  <p style={styles.statValue}>{stats?.activeSalons ?? 0}</p>
                </div>
              </div>

              <div style={styles.statCard}>
                <span style={styles.statIcon}>⏳</span>
                <div>
                  <h3 style={styles.statLabel}>En Attente</h3>
                  <p style={{ ...styles.statValue, color: '#E8A020' }}>
                    {stats?.pendingSalons ?? 0}
                  </p>
                </div>
              </div>

              <div style={styles.statCard}>
                <span style={styles.statIcon}>📅</span>
                <div>
                  <h3 style={styles.statLabel}>Réservations</h3>
                  <p style={styles.statValue}>{stats?.totalReservations ?? 0}</p>
                </div>
              </div>

              <div style={styles.statCard}>
                <span style={styles.statIcon}>💰</span>
                <div>
                  <h3 style={styles.statLabel}>Revenus</h3>
                  <p style={{ ...styles.statValue, color: '#2ECC71' }}>
                    {revenue?.totalRevenue ? `${revenue.totalRevenue} DZD` : '0 DZD'}
                  </p>
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <h2 style={{ ...styles.pageTitle, marginTop: 40, marginBottom: 16 }}>Journal d'audit</h2>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date & Heure</th>
                    <th style={styles.th}>Action</th>
                    <th style={styles.th}>Acteur (ID)</th>
                    <th style={styles.th}>Cible / Ressource</th>
                    <th style={styles.th}>Adresse IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#9A9A9A' }}>
                        Aucun journal d'audit enregistré.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} style={styles.tr}>
                        <td style={styles.td}>{formatDate(log.created_at)}</td>
                        <td style={styles.td}>
                          <span style={styles.actionBadge}>{log.action}</span>
                        </td>
                        <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>
                          {log.actor_id || 'Système'}
                        </td>
                        <td style={styles.td}>{log.resource}</td>
                        <td style={styles.td}>{log.ip_address || '—'}</td>
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
  statIcon: {
    fontSize: 32,
  },
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
  actionBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    backgroundColor: '#2C2C2C',
    color: '#E8A020',
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
