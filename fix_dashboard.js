const fs = require('fs');
const file = 'c:\\Users\\dz laptops\\Desktop\\projets\\Barber\\apps\\mobile\\src\\screens\\barber\\DashboardScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// Exact pattern found from debug output (mixed LF/CRLF)
const broken = "showBlocks]);\n      await apiClient.patch(`/reservations/${id}/status`, { status });\r\n    },";

const statsAndDecl = `showBlocks]);

  // Statistics \u2014 always derived from periodItems (period-aware)
  const stats = useMemo(() => {
    const periodRealBookings = periodItems.filter((r) => !(r as any).notes?.includes('CR\\u00c9NEAU BLOQU\\u00c9'));
    const nowAlgS  = new Date(Date.now() + 60 * 60 * 1000);
    const nowStrS  = \`\${String(nowAlgS.getUTCHours()).padStart(2, '0')}:\${String(nowAlgS.getUTCMinutes()).padStart(2, '0')}\`;
    const todayAlg = \`\${nowAlgS.getUTCFullYear()}-\${String(nowAlgS.getUTCMonth()+1).padStart(2,'0')}-\${String(nowAlgS.getUTCDate()).padStart(2,'0')}\`;
    const total = periodRealBookings.filter((r) =>
      r.status === 'Completed' || r.status === 'Confirmed'
    ).length;
    const pending = periodRealBookings.filter((r) => {
      if (r.status !== 'Pending') return false;
      const apptDate = (r.appointment_date as string) ?? '';
      const endTime  = (r.end_time ?? '').slice(0, 5);
      return !(apptDate < todayAlg || (apptDate === todayAlg && !!endTime && endTime < nowStrS));
    }).length;
    const revenue = periodRealBookings
      .filter((r) => r.status === 'Completed' || r.status === 'Confirmed')
      .reduce((sum, r) => { const svc = (r as any).services; return sum + ((svc?.price as number) ?? 0); }, 0);
    return { total, pending, revenue };
  }, [periodItems]);


  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(\`/reservations/\${id}/status\`, { status });
    },`;

if (content.includes(broken)) {
  content = content.replace(broken, statsAndDecl);
  fs.writeFileSync(file, content, 'utf8');
  console.log('SUCCESS');
} else {
  console.log('Still not found. Trying regex...');
  const regex = /showBlocks\]\);[\r\n]+\s+await apiClient\.patch\(`\/reservations\/\$\{id\}\/status`, \{ status \}\);[\r\n]+\s+\},/;
  if (regex.test(content)) {
    content = content.replace(regex, statsAndDecl);
    fs.writeFileSync(file, content, 'utf8');
    console.log('SUCCESS via regex');
  } else {
    console.log('COMPLETE FAIL');
  }
}
