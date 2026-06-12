import Link from 'next/link';
// apps/admin/app/analytics/page.tsx
// Super Admin — Platform analytics dashboard

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

interface AnalyticsData {
  totalRevenue: number;
  mrr: number;
  avgSubscriptionValue: number;
  subscriptionsByPlan: { plan_name: string; count: number }[];
  topSalons: {
    id: string;
    name: string;
    wilaya: string;
    average_rating: number;
    total_reviews: number;
  }[];
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const data = await apiFetch<AnalyticsData>('/admin/analytics', session.access_token);
      setAnalytics(data);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatDZD(amount: number): string {
    return amount.toLocaleString('fr-DZ') + ' DZD';
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
          <Link href="/payments" style={styles.navLink}>💰 Paiements</Link>
          <Link href="/reviews" style={styles.navLink}>⭐ Avis</Link>
          <Link href="/plans" style={styles.navLink}>📊 Plans</Link>
          <Link href="/analytics" style={{ ...styles.navLink, ...styles.navLinkActive }}>📈 Analytiques</Link>
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Analytiques Plateforme</h2>
            <p style={styles.pageSubtitle}>Vue agrégée des revenus et abonnements</p>
          </div>
          <button onClick={fetchAnalytics} style={styles.refreshBtn}>🔄 Actualiser</button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <p style={styles.loadingText}>Chargement des analytiques...</p>
          </div>
        ) : !analytics ? (
          <p style={{ color: '#9A9A9A' }}>Impossible de charger les données.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* KPI Cards */}
            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiIcon}>💰</div>
                <div style={styles.kpiValue}>{formatDZD(analytics.totalRevenue)}</div>
                <div style={styles.kpiLabel}>Revenu Total</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiIcon}>📆</div>
                <div style={styles.kpiValue}>{formatDZD(analytics.mrr)}</div>
                <div style={styles.kpiLabel}>MRR (Revenu Mensuel)</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiIcon}>📊</div>
                <div style={styles.kpiValue}>{formatDZD(analytics.avgSubscriptionValue)}</div>
                <div style={styles.kpiLabel}>Valeur Moy. Abonnement</div>
              </div>
            </div>

            {/* Subscriptions by Plan */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Abonnements Actifs par Plan</h3>
              {analytics.subscriptionsByPlan.length === 0 ? (
                <p style={{ color: '#9A9A9A', fontSize: 14 }}>Aucun abonnement actif.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {analytics.subscriptionsByPlan.map((item) => (
                    <div key={item.plan_name} style={styles.planRow}>
                      <span style={styles.planRowName}>{item.plan_name}</span>
                      <div style={styles.planBarTrack}>
                        <div
                          style={{
                            ...styles.planBar,
                            width: `${Math.min(100, (item.count / Math.max(...analytics.subscriptionsByPlan.map(p => p.count))) * 100)}%`,
                          }}
                        />
                      </div>
                      <span style={styles.planRowCount}>{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Salons */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Top 10 Salons (par note)</h3>
              {analytics.topSalons.length === 0 ? (
                <p style={{ color: '#9A9A9A', fontSize: 14 }}>Aucun salon approuvé avec note.</p>
              ) : (
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>#</th>
                        <th style={styles.th}>Salon</th>
                        <th style={styles.th}>Wilaya</th>
                        <th style={styles.th}>Note</th>
                        <th style={styles.th}>Avis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topSalons.map((salon, idx) => (
                        <tr key={salon.id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={{ color: idx < 3 ? '#F5A623' : '#9A9A9A', fontWeight: 700 }}>
                              {idx + 1}
                            </span>
                          </td>
                          <td style={styles.td}>{salon.name}</td>
                          <td style={styles.td}>{salon.wilaya}</td>
                          <td style={styles.td}>
                            <span style={{ color: '#F5A623' }}>
                              {'★'.repeat(Math.round(salon.average_rating))}
                            </span>
                            <span style={{ color: '#9A9A9A', marginLeft: 6 }}>
                              {salon.average_rating?.toFixed(1)}
                            </span>
                          </td>
                          <td style={styles.td}>{salon.total_reviews} avis</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#0F0F0F', color: '#F5F5F5', fontFamily: '"DM Sans", "Inter", system-ui, sans-serif' },
  sidebar: { width: 240, backgroundColor: '#1A1A1A', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid #2A2A2A', flexShrink: 0 },
  logo: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #2A2A2A' },
  logoIcon: { fontSize: 24 },
  logoText: { fontSize: 18, fontWeight: 700, color: '#F5A623', margin: 0 },
  adminBadge: { fontSize: 10, backgroundColor: '#F5A623', color: '#000', padding: '2px 6px', borderRadius: 4, fontWeight: 700 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navLink: { padding: '10px 14px', borderRadius: 8, color: '#9A9A9A', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  navLinkActive: { backgroundColor: '#252525', color: '#F5A623' },
  main: { flex: 1, padding: 32, overflowY: 'auto' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: '#F5F5F5', margin: 0 },
  pageSubtitle: { fontSize: 14, color: '#9A9A9A', margin: '4px 0 0' },
  refreshBtn: { padding: '10px 20px', backgroundColor: '#252525', color: '#F5F5F5', border: '1px solid #3A3A3A', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 },
  loadingText: { color: '#9A9A9A', fontSize: 16 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 },
  kpiCard: { backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 24, textAlign: 'center' },
  kpiIcon: { fontSize: 28, marginBottom: 8 },
  kpiValue: { fontSize: 22, fontWeight: 700, color: '#F5A623', marginBottom: 4 },
  kpiLabel: { fontSize: 13, color: '#9A9A9A' },
  section: { backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#F5F5F5', margin: '0 0 16px' },
  planRow: { display: 'flex', alignItems: 'center', gap: 12 },
  planRowName: { width: 160, fontSize: 14, color: '#D0D0D0', flexShrink: 0 },
  planBarTrack: { flex: 1, backgroundColor: '#252525', borderRadius: 4, height: 8, overflow: 'hidden' },
  planBar: { height: '100%', backgroundColor: '#F5A623', borderRadius: 4, transition: 'width 0.3s ease' },
  planRowCount: { width: 40, fontSize: 14, fontWeight: 700, color: '#F5A623', textAlign: 'right' },
  tableContainer: { backgroundColor: '#151515', borderRadius: 8, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #2A2A2A' },
  tr: { borderBottom: '1px solid #1F1F1F' },
  td: { padding: '12px 16px', fontSize: 14, color: '#D0D0D0' },
};
