// apps/admin/app/reservations/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Reservation {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  client: {
    full_name: string | null;
    phone_number: string | null;
  } | null;
  salons: {
    name: string;
  } | null;
  services: {
    service_name: string;
    price: number;
  } | null;
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
  }, []);

  async function fetchReservations() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/reservations`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setReservations(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch reservations:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatTime(timeStr: string): string {
    return timeStr.substring(0, 5);
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
          <a href="/salons" style={styles.navLink}>🏪 Approbations</a>
          <a href="/users" style={styles.navLink}>👥 Utilisateurs</a>
          <a href="/reservations" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            📅 Réservations
          </a>
          <a href="/subscriptions" style={styles.navLink}>💳 Abonnements</a>
          <a href="/payments" style={styles.navLink}>💰 Paiements</a>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Gestion des Réservations</h2>
            <p style={styles.pageSubtitle}>
              {reservations.length} réservation{reservations.length !== 1 ? 's' : ''} enregistrée{reservations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={fetchReservations} style={styles.refreshBtn}>
            🔄 Actualiser
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Chargement des réservations...</p>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Salon</th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Service</th>
                  <th style={styles.th}>Date & Heure</th>
                  <th style={styles.th}>Tarif</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#9A9A9A' }}>
                      Aucune réservation enregistrée.
                    </td>
                  </tr>
                ) : (
                  reservations.map((res) => (
                    <tr key={res.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.salonName}>{res.salons?.name ?? '—'}</div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.clientName}>{res.client?.full_name ?? 'Client de passage'}</div>
                        <div style={styles.clientPhone}>{res.client?.phone_number ?? '—'}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.serviceText}>{res.services?.service_name ?? '—'}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.dateText}>{formatDate(res.appointment_date)}</div>
                        <div style={styles.timeText}>
                          ⏱️ {formatTime(res.start_time)} – {formatTime(res.end_time)}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.priceText}>
                          {res.services?.price ? `${res.services.price} DZD` : '—'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(res.status === 'Confirmed'
                              ? styles.badgeConfirmed
                              : res.status === 'Pending'
                              ? styles.badgePending
                              : res.status === 'Cancelled'
                              ? styles.badgeCancelled
                              : styles.badgeCompleted),
                          }}
                        >
                          {res.status}
                        </span>
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
  clientName: {
    fontWeight: 500,
  },
  clientPhone: {
    fontSize: 12,
    color: '#9A9A9A',
    marginTop: 2,
  },
  serviceText: {
    color: '#F5F5F5',
  },
  dateText: {
    fontWeight: 500,
  },
  timeText: {
    fontSize: 12,
    color: '#9A9A9A',
    marginTop: 2,
  },
  priceText: {
    color: '#2ECC71',
    fontWeight: 600,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  badgeConfirmed: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    color: '#2ECC71',
  },
  badgePending: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    color: '#E8A020',
  },
  badgeCancelled: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    color: '#E74C3C',
  },
  badgeCompleted: {
    backgroundColor: 'rgba(154, 154, 154, 0.15)',
    color: '#9A9A9A',
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
