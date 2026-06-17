'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

interface BroadcastLog {
  id: string;
  title: string;
  body: string;
  sent_at: string;
  sent_by: string;
  profiles?: {
    full_name: string;
  };
}

export default function NotificationsPage() {
  const [history, setHistory] = useState<BroadcastLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;
      const response = await apiFetch<{ data: BroadcastLog[] }>('/admin/notifications/broadcasts?limit=50', token);
      if (response && response.data) {
        setHistory(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load broadcast history:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setStatusMsg({ type: 'error', text: 'Veuillez remplir le titre et le message.' });
      return;
    }

    setSending(true);
    setStatusMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');
      const token = session.access_token;

      const res = await apiFetch<{ sent: number }>('/admin/notifications/broadcast', token, {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      });

      setStatusMsg({ type: 'success', text: `Notification envoyée avec succès à ${res.sent} utilisateurs.` });
      setTitle('');
      setBody('');
      loadHistory();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Erreur lors de l'envoi de la notification." });
    } finally {
      setSending(false);
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
          <Link href="/dashboard" style={styles.navLink}>📊 Dashboard</Link>
          <Link href="/salons" style={styles.navLink}>🏪 Approbations</Link>
          <Link href="/users" style={styles.navLink}>👥 Utilisateurs</Link>
          <Link href="/reservations" style={styles.navLink}>📅 Réservations</Link>
          <Link href="/subscriptions" style={styles.navLink}>💳 Abonnements</Link>
          <Link href="/payments" style={styles.navLink}>💰 Paiements</Link>
          <Link href="/notifications" style={{ ...styles.navLink, ...styles.navLinkActive }}>📢 Notifications</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Notifications Push</h2>
            <p style={styles.pageSubtitle}>Envoyer des messages de diffusion à tous les utilisateurs</p>
          </div>
          <div style={styles.headerActions}>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              🚪 Déconnexion
            </button>
          </div>
        </div>

        {/* Form & Info Section */}
        <div style={styles.contentGrid}>
          {/* Form Card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📢 Nouvelle Diffusion</h3>
            <form onSubmit={handleSendBroadcast} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Titre de la notification</label>
                <input
                  type="text"
                  placeholder="Ex: Maintenance du serveur, Promotion..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Message / Contenu</label>
                <textarea
                  placeholder="Saisissez le message de la notification push ici..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={styles.textarea}
                  required
                />
              </div>

              {statusMsg && (
                <div style={statusMsg.type === 'success' ? styles.successAlert : styles.errorAlert}>
                  {statusMsg.text}
                </div>
              )}

              <button type="submit" disabled={sending} style={sending ? styles.buttonDisabled : styles.button}>
                {sending ? 'Envoi en cours...' : '🚀 Diffuser la notification'}
              </button>
            </form>
          </div>

          {/* Guidelines / Info Card */}
          <div style={{ ...styles.card, justifyContent: 'flex-start' }}>
            <h3 style={styles.cardTitle}>ℹ️ Directives de Diffusion</h3>
            <p style={styles.infoText}>
              Cette fonctionnalité envoie simultanément une <strong>notification push</strong> sur mobile
              à tous les utilisateurs disposant d'un jeton push valide, et crée une notification 
              <strong>dans l'application</strong> visible dans leur historique de notifications.
            </p>
            <div style={styles.infoBox}>
              <strong style={{ color: '#E8A020' }}>Attention :</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#A0A0A0' }}>
                Les diffusions de masse touchent tous les utilisateurs inscrits (clients et coiffeurs). 
                Veuillez utiliser cette fonction avec discernement pour éviter de saturer vos utilisateurs.
              </p>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div style={{ ...styles.card, marginTop: 32 }}>
          <h3 style={styles.cardTitle}>🕰️ Historique des Diffusions</h3>
          {loading ? (
            <p style={{ color: '#9A9A9A' }}>Chargement de l'historique...</p>
          ) : history.length === 0 ? (
            <p style={{ color: '#9A9A9A' }}>Aucune notification diffusée pour le moment.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Titre</th>
                  <th style={styles.th}>Message</th>
                  <th style={styles.th}>Envoyé par</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id} style={styles.tr}>
                    <td style={styles.td}>{formatDate(log.sent_at)}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#F5F5F5' }}>{log.title}</td>
                    <td style={styles.td}>{log.body}</td>
                    <td style={styles.td}>{log.profiles?.full_name || 'Admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
    margin: '4px 0 0 0',
  },
  logoutBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    backgroundColor: 'transparent',
    border: '1px solid #2C2C2C',
    color: '#9A9A9A',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 24,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    border: '1px solid #2C2C2C',
    padding: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#F5F5F5',
    margin: '0 0 20px 0',
    fontFamily: '"Syne", sans-serif',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#C0C0C0',
  },
  input: {
    backgroundColor: '#0F0F0F',
    border: '1px solid #2C2C2C',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#F5F5F5',
    fontSize: 14,
    outline: 'none',
  },
  textarea: {
    backgroundColor: '#0F0F0F',
    border: '1px solid #2C2C2C',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#F5F5F5',
    fontSize: 14,
    outline: 'none',
    minHeight: 120,
    resize: 'vertical',
  },
  button: {
    backgroundColor: '#E8A020',
    color: '#0F0F0F',
    border: 'none',
    borderRadius: 8,
    padding: '14px 24px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#3A2F00',
    color: '#808080',
    border: 'none',
    borderRadius: 8,
    padding: '14px 24px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'not-allowed',
  },
  successAlert: {
    padding: '12px 16px',
    borderRadius: 8,
    backgroundColor: '#0A3B1E',
    color: '#2ECC71',
    border: '1px solid #145A2D',
    fontSize: 14,
  },
  errorAlert: {
    padding: '12px 16px',
    borderRadius: 8,
    backgroundColor: '#3D0F0F',
    color: '#E74C3C',
    border: '1px solid #631C1C',
    fontSize: 14,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#A0A0A0',
    margin: 0,
  },
  infoBox: {
    marginTop: 20,
    padding: '16px',
    borderRadius: 8,
    backgroundColor: '#242414',
    border: '1px solid #3A3A1A',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  thRow: {
    borderBottom: '1px solid #2C2C2C',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    color: '#9A9A9A',
    fontWeight: 600,
  },
  tr: {
    borderBottom: '1px solid #2C2C2C',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '16px',
    color: '#A0A0A0',
    verticalAlign: 'top',
  },
};
