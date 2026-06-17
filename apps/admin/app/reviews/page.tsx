'use client';
// apps/admin/app/reviews/page.tsx
// Super Admin — Reviews moderation page

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

interface Review {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  salons: { name: string } | null;
  profiles: { full_name: string | null } | null;
}

interface ReviewsResponse {
  data: Review[];
  total: number;
}

export default function ReviewsModerationPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await apiFetch<ReviewsResponse>('/admin/reviews?page=1&limit=100', session.access_token);
      setReviews(response.data ?? []);
      setTotalCount(response.total ?? 0);
    } catch (e) {
      console.error('Failed to fetch reviews:', e);
    } finally {
      setLoading(false);
    }
  }

  async function deleteReview(reviewId: string) {
    if (!confirm('Supprimer cet avis ? Cette action est irréversible.')) return;
    setDeleting(reviewId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await apiFetch(`/reviews/${reviewId}`, session.access_token, { method: 'DELETE' });
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setTotalCount((c) => c - 1);
    } catch (e) {
      console.error('Failed to delete review:', e);
      alert('Erreur lors de la suppression.');
    } finally {
      setDeleting(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function renderStars(rating: number) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
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
          <Link href="/reviews" style={{ ...styles.navLink, ...styles.navLinkActive }}>⭐ Avis</Link>
          <Link href="/plans" style={styles.navLink}>📊 Plans</Link>
          <Link href="/analytics" style={styles.navLink}>📈 Analytiques</Link>
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Modération des Avis</h2>
            <p style={styles.pageSubtitle}>{totalCount} avis enregistré{totalCount !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={fetchReviews} style={styles.refreshBtn}>🔄 Actualiser</button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <p style={styles.loadingText}>Chargement des avis...</p>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Salon</th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Note</th>
                  <th style={styles.th}>Commentaire</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#9A9A9A' }}>
                      Aucun avis trouvé.
                    </td>
                  </tr>
                ) : (
                  reviews.map((review) => (
                    <tr key={review.id} style={styles.tr}>
                      <td style={styles.td}>{review.salons?.name ?? '—'}</td>
                      <td style={styles.td}>{review.profiles?.full_name ?? 'Anonyme'}</td>
                      <td style={styles.td}>
                        <span style={{ color: '#F5A623', fontSize: 16 }}>{renderStars(review.rating)}</span>
                        <span style={{ color: '#9A9A9A', marginLeft: 6 }}>({review.rating}/5)</span>
                      </td>
                      <td style={{ ...styles.td, maxWidth: 300 }}>
                        <span style={{ color: '#D0D0D0', fontSize: 13 }}>{review.body ?? <em style={{ color: '#666' }}>Pas de commentaire</em>}</span>
                      </td>
                      <td style={styles.td}>{formatDate(review.created_at)}</td>
                      <td style={styles.td}>
                        <button
                          onClick={() => deleteReview(review.id)}
                          disabled={deleting === review.id}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: deleting === review.id ? '#333' : '#8B0000',
                            color: deleting === review.id ? '#666' : '#fff',
                            border: 'none',
                            borderRadius: 6,
                            cursor: deleting === review.id ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {deleting === review.id ? '...' : '🗑️ Supprimer'}
                        </button>
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
  tableContainer: { backgroundColor: '#1A1A1A', borderRadius: 12, border: '1px solid #2A2A2A', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #2A2A2A', backgroundColor: '#151515' },
  tr: { borderBottom: '1px solid #1F1F1F' },
  td: { padding: '14px 16px', fontSize: 14, color: '#D0D0D0', verticalAlign: 'middle' },
};
