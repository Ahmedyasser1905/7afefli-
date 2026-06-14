import Link from 'next/link';
// apps/admin/app/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { Sidebar } from '../components/Sidebar';

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

// FIX-5: Analytics stats interface
interface AnalyticsStats {
  totalRevenue: number;
  mrr: number;
  avgSubscriptionValue: number;
  subscriptionsByPlan: { plan_name: string; count: number }[];
  topSalons: { id: string; name: string; wilaya: string; average_rating: number; total_reviews: number }[];
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
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
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

      // FIX-5: Add analytics fetch to parallel block
      const [statsData, revenueData, auditData, analyticsData] = await Promise.all([
        apiFetch<PlatformStats>('/admin/stats', token).catch(() => null),
        apiFetch<RevenueStats>('/admin/revenue', token).catch(() => null),
        apiFetch<{ data: AuditLog[] }>('/admin/audit?limit=10', token).catch(() => null),
        apiFetch<AnalyticsStats>('/admin/analytics', token).catch(() => null),
      ]);

      if (statsData) setStats(statsData);
      if (revenueData) setRevenue(revenueData);
      if (auditData) setAuditLogs(auditData.data || []);
      if (analyticsData) setAnalytics(analyticsData);
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
      <Sidebar activePath="/dashboard" />

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
              {/* FIX-5: Analytics stat cards */}
              {analytics && (
                <>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>📈</span>
                    <div>
                      <h3 style={styles.statLabel}>MRR</h3>
                      <p style={{ ...styles.statValue, color: '#9B59B6' }}>
                        {analytics.mrr} DZD
                      </p>
                    </div>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statIcon}>🎯</span>
                    <div>
                      <h3 style={styles.statLabel}>Valeur moy. abonnement</h3>
                      <p style={{ ...styles.statValue, color: '#3498DB' }}>
                        {analytics.avgSubscriptionValue} DZD
                      </p>
                    </div>
                  </div>
            </div>

            {/* Quick Actions / Shortcuts */}
            <h2 style={{ ...styles.pageTitle, marginTop: 40, marginBottom: 16 }}>Raccourcis Actions Rapides</h2>
            <div style={styles.quickActionsGrid}>
              <Link href="/notifications" style={styles.actionCard}>
                <span style={styles.actionIcon}>📢</span>
                <div>
                  <h4 style={styles.actionTitle}>Diffuser une Notification</h4>
                  <p style={styles.actionDesc}>Envoyer un message push et in-app à tous les utilisateurs.</p>
                </div>
              </Link>
              <Link href="/salons" style={styles.actionCard}>
                <span style={styles.actionIcon}>🏪</span>
                <div>
                  <h4 style={styles.actionTitle}>Approuver des Salons</h4>
                  <p style={styles.actionDesc}>Vérifier et activer les nouveaux salons en attente.</p>
                </div>
              </Link>
              <Link href="/users" style={styles.actionCard}>
                <span style={styles.actionIcon}>👥</span>
                <div>
                  <h4 style={styles.actionTitle}>Gérer les Utilisateurs</h4>
                  <p style={styles.actionDesc}>Bannir des comptes, modifier les rôles ou voir les profils.</p>
                </div>
              </Link>
            </div>

            {/* FIX-5: Top Salons section */}
            {analytics?.topSalons && analytics.topSalons.length > 0 && (
              <>
                <h2 style={{ ...styles.pageTitle, marginTop: 40, marginBottom: 16 }}>Top 5 Salons</h2>
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Salon</th>
                        <th style={styles.th}>Wilaya</th>
                        <th style={styles.th}>Note moy.</th>
                        <th style={styles.th}>Avis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topSalons.slice(0, 5).map((s) => (
                        <tr key={s.id} style={styles.tr}>
                          <td style={styles.td}>{s.name}</td>
                          <td style={styles.td}>{s.wilaya}</td>
                          <td style={styles.td}>⭐ {s.average_rating?.toFixed(1)}</td>
                          <td style={styles.td}>{s.total_reviews}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* FIX-5: Plan breakdown section */}
            {analytics?.subscriptionsByPlan && analytics.subscriptionsByPlan.length > 0 && (
              <>
                <h2 style={{ ...styles.pageTitle, marginTop: 40, marginBottom: 16 }}>Répartition des plans</h2>
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Plan</th>
                        <th style={styles.th}>Abonnements actifs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.subscriptionsByPlan.map((p) => (
                        <tr key={p.plan_name} style={styles.tr}>
                          <td style={styles.td}>✨ {p.plan_name}</td>
                          <td style={styles.td}>{p.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

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
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
    marginBottom: 32,
  },
  actionCard: {
    backgroundColor: '#1A1A1A',
    border: '1px solid #2C2C2C',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    textDecoration: 'none',
    color: '#F5F5F5',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  actionIcon: {
    fontSize: 24,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#F5F5F5',
  },
  actionDesc: {
    margin: '4px 0 0 0',
    fontSize: 13,
    color: '#9A9A9A',
  },
};
