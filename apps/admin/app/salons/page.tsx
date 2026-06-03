// apps/admin/app/salons/page.tsx
// Super Admin — Salon Approvals Data Table

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface PendingSalon {
  id: string;
  name: string;
  wilaya: string;
  address: string;
  description: string | null;
  created_at: string;
  subscription_status: string;
  profiles: {
    full_name: string;
    phone_number: string | null;
  } | null;
}

export default function SalonApprovalsPage() {
  const [pending, setPending] = useState<PendingSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingSalons();
  }, []);

  async function fetchPendingSalons() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/salons/pending`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPending(data as PendingSalon[]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function approveSalon(salonId: string) {
    setActionLoading(salonId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/salons/${salonId}/approve`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approved: true })
      });
      if (res.ok) {
        setPending((prev) => prev.filter((s) => s.id !== salonId));
      }
    } catch (e) {
      console.error(e);
    }
    setActionLoading(null);
  }

  async function rejectSalon(salonId: string) {
    setActionLoading(salonId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/salons/${salonId}/approve`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approved: false })
      });
      if (res.ok) {
        setPending((prev) => prev.filter((s) => s.id !== salonId));
      }
    } catch (e) {
      console.error(e);
    }
    setActionLoading(null);
  }

  function formatDate(dateStr: string): string {
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
          <a href="/dashboard" style={styles.navLink}>📊 Dashboard</a>
          <a href="/salons" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            🏪 Approbations
          </a>
          <a href="/users" style={styles.navLink}>👥 Utilisateurs</a>
          <a href="/reservations" style={styles.navLink}>📅 Réservations</a>
          <a href="/subscriptions" style={styles.navLink}>💳 Abonnements</a>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Approbation des salons</h2>
            <p style={styles.pageSubtitle}>
              {pending.length} salon{pending.length !== 1 ? 's' : ''} en attente d'approbation
            </p>
          </div>
          <button onClick={fetchPendingSalons} style={styles.refreshBtn}>
            🔄 Actualiser
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Chargement...</p>
          </div>
        ) : pending.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyIcon}>✅</p>
            <p style={styles.emptyTitle}>Aucun salon en attente</p>
            <p style={styles.emptySubtitle}>Tous les salons ont été traités.</p>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Salon</th>
                  <th style={styles.th}>Propriétaire</th>
                  <th style={styles.th}>Wilaya</th>
                  <th style={styles.th}>Adresse</th>
                  <th style={styles.th}>Demande</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((salon) => (
                  <tr key={salon.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.salonName}>{salon.name}</div>
                      {salon.description && (
                        <div style={styles.salonDesc}>
                          {salon.description.substring(0, 60)}...
                        </div>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.ownerName}>{salon.profiles?.full_name ?? '—'}</div>
                      <div style={styles.ownerPhone}>
                        {salon.profiles?.phone_number ?? '—'}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.wilayaBadge}>{salon.wilaya}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.addressText}>{salon.address}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.dateText}>{formatDate(salon.created_at)}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionCell}>
                        <button
                          onClick={() => approveSalon(salon.id)}
                          disabled={actionLoading === salon.id}
                          style={styles.approveBtn}
                        >
                          {actionLoading === salon.id ? '...' : '✓ Approuver'}
                        </button>
                        <button
                          onClick={() => rejectSalon(salon.id)}
                          disabled={actionLoading === salon.id}
                          style={styles.rejectBtn}
                        >
                          ✕ Rejeter
                        </button>
                        <button style={styles.viewBtn}>👁️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// Inline styles (production would use CSS modules or Tailwind)
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
    textTransform: 'uppercase' as const,
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
    borderCollapse: 'collapse' as const,
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    fontSize: 12,
    color: '#9A9A9A',
    textTransform: 'uppercase' as const,
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
    verticalAlign: 'middle' as const,
  },
  salonName: {
    fontWeight: 600,
    color: '#F5F5F5',
  },
  salonDesc: {
    fontSize: 12,
    color: '#5A5A5A',
    marginTop: 2,
  },
  ownerName: { fontWeight: 500 },
  ownerPhone: { fontSize: 12, color: '#9A9A9A' },
  wilayaBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 4,
    backgroundColor: '#1A3D2A',
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: 500,
  },
  addressText: { color: '#9A9A9A', fontSize: 13 },
  dateText: { color: '#9A9A9A', fontSize: 13 },
  actionCell: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  approveBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#2ECC71',
    color: '#0F0F0F',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  rejectBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#E74C3C',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  viewBtn: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #3E3E3E',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
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
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 80,
    gap: 8,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: '#F5F5F5' },
  emptySubtitle: { fontSize: 14, color: '#9A9A9A' },
};
