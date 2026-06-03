// apps/admin/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          throw new Error('Impossible de vérifier votre rôle.');
        }

        if (profile.role !== 'Admin') {
          await supabase.auth.signOut();
          router.push('/unauthorized');
          return;
        }

        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides');
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>💈</span>
          <h1 style={styles.logoText}>BarberDZ</h1>
          <span style={styles.badge}>Super Admin</span>
        </div>
        <p style={styles.subtitle}>Connectez-vous pour accéder au panneau de contrôle.</p>

        {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Adresse Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@barberdz.com"
              required
              disabled={loading}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0F0F0F',
    color: '#F5F5F5',
    fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
    backgroundImage: 'radial-gradient(circle at center, #1E1A0F 0%, #0F0F0F 70%)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1A1A1A',
    border: '1px solid #2C2C2C',
    borderRadius: 16,
    padding: '40px 32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  logoIcon: {
    fontSize: 32,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 700,
    color: '#E8A020',
    margin: 0,
    fontFamily: '"Syne", sans-serif',
  },
  badge: {
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: '#3A2F00',
    color: '#E8A020',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 600,
  },
  subtitle: {
    fontSize: 14,
    color: '#9A9A9A',
    margin: '0 0 24px 0',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: 8,
    color: '#E74C3C',
    fontSize: 13,
    marginBottom: 20,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#9A9A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid #2C2C2C',
    backgroundColor: '#0F0F0F',
    color: '#F5F5F5',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  submitBtn: {
    padding: '14px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#E8A020',
    color: '#0F0F0F',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: 8,
  },
};
