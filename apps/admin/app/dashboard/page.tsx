'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) setStats(await res.json());
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: 40, backgroundColor: '#0F0F0F', color: '#fff', minHeight: '100vh' }}>
      <h1>Dashboard BarberDZ</h1>
      {stats ? (
        <pre>{JSON.stringify(stats, null, 2)}</pre>
      ) : (
        <p>Loading stats via NestJS API...</p>
      )}
    </div>
  );
}
