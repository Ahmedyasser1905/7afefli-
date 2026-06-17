'use client';
export const dynamic = 'force-dynamic';
// apps/admin/app/users/page.tsx

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';  // fix C5

interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  role: string;
  avatar_url: string | null;
  wilaya: string | null;
  created_at: string;
  updated_at: string;
  is_banned?: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // FIX-1: API returns { data: UserProfile[], total: number } — unwrap correctly
      const response = await apiFetch<{ data: UserProfile[]; total: number }>('/admin/users', session.access_token);
      setUsers(response.data ?? []);
      setTotalUsers(response.total ?? 0);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    if (!confirm(`Voulez-vous changer le rôle de cet utilisateur en "${newRole}" ?`)) {
      return;
    }
    setActionLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await apiFetch(`/admin/users/${userId}/role`, session?.access_token ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });

      setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  }

  // FIX-4: Delete user with confirmation
  async function deleteUser(userId: string) {
    if (!confirm('Supprimer définitivement cet utilisateur ? Cette action est irréversible.')) return;
    setActionLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await apiFetch(`/admin/users/${userId}`, session?.access_token ?? '', { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotalUsers((prev) => prev - 1);
    } catch (e) {
      console.error('Failed to delete user:', e);
      alert('Erreur lors de la suppression.');
    } finally {
      setActionLoading(null);
    }
  }

  // FIX-4: Ban / unban user toggle
  async function banUser(userId: string, currentlyBanned: boolean) {
    const action = currentlyBanned ? 'débannir' : 'bannir';
    if (!confirm(`Voulez-vous ${action} cet utilisateur ?`)) return;
    setActionLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await apiFetch(`/admin/users/${userId}/ban`, session?.access_token ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ isBanned: !currentlyBanned }),
      });
      // Toggle a visual indicator — backend handles the actual ban in Supabase Auth
      setUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, is_banned: !currentlyBanned } : u)
      );
    } catch (e) {
      console.error('Failed to ban/unban user:', e);
      alert('Erreur lors de l\'opération.');
    } finally {
      setActionLoading(null);
    }
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
          <Link href="/dashboard" style={styles.navLink}>📊 Dashboard</Link>
          <Link href="/salons" style={styles.navLink}>🏪 Approbations</Link>
          <Link href="/users" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            👥 Utilisateurs
          </Link>
          <Link href="/reservations" style={styles.navLink}>📅 Réservations</Link>
          <Link href="/subscriptions" style={styles.navLink}>💳 Abonnements</Link>
          <Link href="/payments" style={styles.navLink}>💰 Paiements</Link>
          <Link href="/notifications" style={styles.navLink}>📢 Notifications</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Gestion des Utilisateurs</h2>
            <p style={styles.pageSubtitle}>
              {totalUsers} utilisateur{totalUsers !== 1 ? 's' : ''} inscrits sur la plateforme
            </p>
          </div>
          <button onClick={fetchUsers} style={styles.refreshBtn}>
            🔄 Actualiser
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Chargement des profils...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyIcon}>👥</p>
            <p style={styles.emptyTitle}>Aucun utilisateur trouvé</p>
            <p style={styles.emptySubtitle}>Il n'y a actuellement aucun utilisateur sur la plateforme.</p>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Utilisateur</th>
                  <th style={styles.th}>Téléphone</th>
                  <th style={styles.th}>Rôle</th>
                  <th style={styles.th}>Wilaya</th>
                  <th style={styles.th}>Date d'inscription</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((profile) => (
                  <tr key={profile.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.userCell}>
                        <div style={styles.avatar}>
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="avatar" style={styles.avatarImg} />
                          ) : (
                            <span>👤</span>
                          )}
                        </div>
                        <div>
                          <div style={styles.userName}>{profile.full_name || 'Sans Nom'}</div>
                          <div style={styles.userId}>{profile.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.phoneText}>{profile.phone_number || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.roleBadge,
                          ...(profile.role === 'Admin'
                            ? styles.badgeAdmin
                            : profile.role === 'Coiffeur'
                            ? styles.badgeBarber
                            : styles.badgeClient),
                        }}
                      >
                        {profile.role}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.wilayaBadge}>{profile.wilaya || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.dateText}>{formatDate(profile.created_at)}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionCell}>
                        {profile.role === 'Client' && (
                          <button
                            onClick={() => updateUserRole(profile.id, 'Coiffeur')}
                            disabled={actionLoading === profile.id}
                            style={styles.promoteBtn}
                          >
                            {actionLoading === profile.id ? '...' : '💈 Promouvoir Coiffeur'}
                          </button>
                        )}
                        {profile.role === 'Coiffeur' && (
                          <button
                            onClick={() => updateUserRole(profile.id, 'Client')}
                            disabled={actionLoading === profile.id}
                            style={styles.demoteBtn}
                          >
                            {actionLoading === profile.id ? '...' : '👤 Rétrograder Client'}
                          </button>
                        )}
                        {profile.role !== 'Admin' && (
                          <button
                            onClick={() => updateUserRole(profile.id, 'Admin')}
                            disabled={actionLoading === profile.id}
                            style={styles.adminBtn}
                          >
                            🔑 Promouvoir Admin
                          </button>
                        )}
                        {/* FIX-4: Ban / Unban button */}
                        {profile.role !== 'Admin' && (
                          <button
                            onClick={() => banUser(profile.id, !!profile.is_banned)}
                            disabled={actionLoading === profile.id}
                            style={profile.is_banned ? styles.unbanBtn : styles.banBtn}
                          >
                            {profile.is_banned ? '✅ Débannir' : '🚫 Bannir'}
                          </button>
                        )}
                        {/* FIX-4: Delete button */}
                        {profile.role !== 'Admin' && (
                          <button
                            onClick={() => deleteUser(profile.id)}
                            disabled={actionLoading === profile.id}
                            style={styles.deleteBtn}
                          >
                            🗑️ Supprimer
                          </button>
                        )}
                        {profile.role === 'Admin' && (
                          <span style={{ color: '#5A5A5A', fontSize: 13 }}>Aucune action</span>
                        )}
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
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#2C2C2C',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 18,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  userName: {
    fontWeight: 600,
    color: '#F5F5F5',
  },
  userId: {
    fontSize: 10,
    color: '#5A5A5A',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  phoneText: {
    color: '#9A9A9A',
    fontSize: 13,
  },
  roleBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  badgeAdmin: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    color: '#E74C3C',
  },
  badgeBarber: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    color: '#E8A020',
  },
  badgeClient: {
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    color: '#3498DB',
  },
  wilayaBadge: {
    color: '#9A9A9A',
  },
  dateText: {
    color: '#9A9A9A',
    fontSize: 13,
  },
  actionCell: {
    display: 'flex',
    gap: 8,
  },
  promoteBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    color: '#E8A020',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  demoteBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    color: '#3498DB',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  adminBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    color: '#E74C3C',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  // FIX-4: Ban / Delete styles
  banBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'rgba(255, 100, 0, 0.15)',
    color: '#FF6400',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  unbanBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    color: '#2ECC71',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  deleteBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'rgba(231, 76, 60, 0.25)',
    color: '#E74C3C',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
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
