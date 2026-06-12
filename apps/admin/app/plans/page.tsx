// apps/admin/app/plans/page.tsx
// Super Admin — Subscription Plans management

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  max_barbers: number;
  max_portfolio_photos: number;
  max_reservations: number;
  is_active: boolean;
  slug: string | null;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Plan>>>({});

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const data = await apiFetch<Plan[]>('/subscriptions/plans', session.access_token);
      setPlans(data ?? []);
    } catch (e) {
      console.error('Failed to fetch plans:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(planId: string, field: keyof Plan, value: unknown) {
    setEdits((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }));
  }

  async function savePlan(plan: Plan) {
    const changes = edits[plan.id];
    if (!changes || Object.keys(changes).length === 0) return;
    setSaving(plan.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await apiFetch(`/admin/plans/${plan.id}`, session.access_token, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, ...changes } : p))
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
      alert('Plan mis à jour avec succès !');
    } catch (e) {
      console.error('Failed to update plan:', e);
      alert('Erreur lors de la mise à jour.');
    } finally {
      setSaving(null);
    }
  }

  function getFieldValue<K extends keyof Plan>(plan: Plan, field: K): Plan[K] {
    return (edits[plan.id]?.[field] as Plan[K]) ?? plan[field];
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
          <a href="/reservations" style={styles.navLink}>📅 Réservations</a>
          <a href="/subscriptions" style={styles.navLink}>💳 Abonnements</a>
          <a href="/payments" style={styles.navLink}>💰 Paiements</a>
          <a href="/reviews" style={styles.navLink}>⭐ Avis</a>
          <a href="/plans" style={{ ...styles.navLink, ...styles.navLinkActive }}>📊 Plans</a>
          <a href="/analytics" style={styles.navLink}>📈 Analytiques</a>
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.pageTitle}>Gestion des Plans</h2>
            <p style={styles.pageSubtitle}>{plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={fetchPlans} style={styles.refreshBtn}>🔄 Actualiser</button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <p style={styles.loadingText}>Chargement des plans...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {plans.map((plan) => {
              const hasChanges = !!(edits[plan.id] && Object.keys(edits[plan.id]).length > 0);
              return (
                <div key={plan.id} style={styles.planCard}>
                  <div style={styles.planHeader}>
                    <h3 style={styles.planName}>{plan.name}</h3>
                    {plan.slug && <span style={styles.slug}>{plan.slug}</span>}
                    <span style={{
                      ...styles.badge,
                      backgroundColor: plan.is_active ? '#0D3320' : '#3A1010',
                      color: plan.is_active ? '#2ECC71' : '#E74C3C',
                    }}>
                      {plan.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div style={styles.planFields}>
                    <label style={styles.fieldLabel}>
                      Prix (DZD)
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={getFieldValue(plan, 'price')}
                        onChange={(e) => handleEdit(plan.id, 'price', Number(e.target.value))}
                      />
                    </label>
                    <label style={styles.fieldLabel}>
                      Durée (jours)
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={getFieldValue(plan, 'duration_days')}
                        onChange={(e) => handleEdit(plan.id, 'duration_days', Number(e.target.value))}
                      />
                    </label>
                    <label style={styles.fieldLabel}>
                      Max coiffeurs
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={getFieldValue(plan, 'max_barbers')}
                        onChange={(e) => handleEdit(plan.id, 'max_barbers', Number(e.target.value))}
                      />
                    </label>
                    <label style={styles.fieldLabel}>
                      Max photos
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={getFieldValue(plan, 'max_portfolio_photos')}
                        onChange={(e) => handleEdit(plan.id, 'max_portfolio_photos', Number(e.target.value))}
                      />
                    </label>
                    <label style={styles.fieldLabel}>
                      Max réservations/mois
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={getFieldValue(plan, 'max_reservations')}
                        onChange={(e) => handleEdit(plan.id, 'max_reservations', Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      onClick={() => savePlan(plan)}
                      disabled={!hasChanges || saving === plan.id}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: !hasChanges || saving === plan.id ? '#333' : '#F5A623',
                        color: !hasChanges || saving === plan.id ? '#666' : '#000',
                        border: 'none',
                        borderRadius: 8,
                        cursor: !hasChanges || saving === plan.id ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {saving === plan.id ? 'Sauvegarde...' : '💾 Sauvegarder'}
                    </button>
                    {hasChanges && (
                      <span style={{ color: '#F5A623', fontSize: 12 }}>● Modifications non sauvegardées</span>
                    )}
                  </div>
                </div>
              );
            })}
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
  planCard: { backgroundColor: '#1A1A1A', borderRadius: 12, border: '1px solid #2A2A2A', padding: 24 },
  planHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  planName: { fontSize: 18, fontWeight: 700, color: '#F5F5F5', margin: 0 },
  slug: { fontSize: 12, color: '#9A9A9A', backgroundColor: '#252525', padding: '2px 8px', borderRadius: 4 },
  badge: { fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600 },
  planFields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#9A9A9A', fontWeight: 600 },
  fieldInput: { padding: '8px 12px', backgroundColor: '#252525', border: '1px solid #3A3A3A', borderRadius: 8, color: '#F5F5F5', fontSize: 14 },
};
