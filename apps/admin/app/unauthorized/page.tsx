// apps/admin/app/unauthorized/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function UnauthorizedPage() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconContainer}>
          <span style={styles.icon}>🚫</span>
        </div>
        <h1 style={styles.title}>Accès Non Autorisé</h1>
        <p style={styles.subtitle}>
          Votre compte ne dispose pas des privilèges d'administrateur requis pour accéder à ce portail.
        </p>
        <button onClick={handleLogout} style={styles.button}>
          Retourner à la connexion
        </button>
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
    backgroundImage: 'radial-gradient(circle at center, #2A1715 0%, #0F0F0F 70%)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1A1A1A',
    border: '1px solid #3E201E',
    borderRadius: 16,
    padding: '40px 32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto 24px',
    border: '1px solid rgba(231, 76, 60, 0.2)',
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#E74C3C',
    margin: '0 0 12px 0',
    fontFamily: '"Syne", sans-serif',
  },
  subtitle: {
    fontSize: 14,
    color: '#9A9A9A',
    margin: '0 0 32px 0',
    lineHeight: 1.6,
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#3E3E3E',
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
