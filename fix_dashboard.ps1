$file = 'c:\Users\dz laptops\Desktop\projets\Barber\apps\mobile\src\screens\barber\DashboardScreen.tsx'
$lines = [System.IO.File]::ReadAllLines($file)

# Find the line with ], [bookingItems, blockedItems, showBlocks]);
$insertAfterIdx = -1
$brokenLineIdx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '\], \[bookingItems, blockedItems, showBlocks\]\);') {
        $insertAfterIdx = $i
    }
    if ($lines[$i] -match "^\s+await apiClient\.patch\(`/reservations/\$\{id\}/status`") {
        $brokenLineIdx = $i
        break
    }
}

Write-Host "insertAfterIdx=$insertAfterIdx, brokenLineIdx=$brokenLineIdx"

if ($insertAfterIdx -ge 0 -and $brokenLineIdx -eq $insertAfterIdx + 1) {
    $newLines = [System.Collections.Generic.List[string]]::new()
    
    # Lines before the break point
    for ($i = 0; $i -le $insertAfterIdx; $i++) {
        $newLines.Add($lines[$i])
    }
    
    # Insert stats memo + updateStatus declaration
    $newLines.Add('')
    $newLines.Add('  // Statistics --- always derived from periodItems (period-aware)')
    $newLines.Add('  const stats = useMemo(() => {')
    $newLines.Add("    const periodRealBookings = periodItems.filter((r) => !(r as any).notes?.includes('CR" + [char]0xC9 + "NEAU BLOQU" + [char]0xC9 + "'));")
    $newLines.Add('    const nowAlgS  = new Date(Date.now() + 60 * 60 * 1000);')
    $newLines.Add('    const nowStrS  = `${String(nowAlgS.getUTCHours()).padStart(2, ' + "'" + '0' + "'" + ')}:${String(nowAlgS.getUTCMinutes()).padStart(2, ' + "'" + '0' + "'" + ')}`;')
    $newLines.Add('    const todayAlg = `${nowAlgS.getUTCFullYear()}-${String(nowAlgS.getUTCMonth()+1).padStart(2,' + "'" + '0' + "'" + ')}-${String(nowAlgS.getUTCDate()).padStart(2,' + "'" + '0' + "'" + ')}`;')
    $newLines.Add("    const total = periodRealBookings.filter((r) => r.status === 'Completed' || r.status === 'Confirmed').length;")
    $newLines.Add("    const pending = periodRealBookings.filter((r) => {")
    $newLines.Add("      if (r.status !== 'Pending') return false;")
    $newLines.Add("      const apptDate = (r.appointment_date as string) ?? '';")
    $newLines.Add("      const endTime  = (r.end_time ?? '').slice(0, 5);")
    $newLines.Add("      return !(apptDate < todayAlg || (apptDate === todayAlg && !!endTime && endTime < nowStrS));")
    $newLines.Add("    }).length;")
    $newLines.Add("    const revenue = periodRealBookings")
    $newLines.Add("      .filter((r) => r.status === 'Completed' || r.status === 'Confirmed')")
    $newLines.Add("      .reduce((sum, r) => { const svc = (r as any).services; return sum + ((svc?.price as number) ?? 0); }, 0);")
    $newLines.Add("    return { total, pending, revenue };")
    $newLines.Add("  }, [periodItems]);")
    $newLines.Add('')
    $newLines.Add('')
    $newLines.Add('  // Update status mutation')
    $newLines.Add('  const updateStatus = useMutation({')
    $newLines.Add('    mutationFn: async ({ id, status }: { id: string; status: string }) => {')
    
    # Continue with the rest of the lines (from brokenLineIdx which is the await line)
    for ($i = $brokenLineIdx; $i -lt $lines.Count; $i++) {
        $newLines.Add($lines[$i])
    }
    
    [System.IO.File]::WriteAllLines($file, $newLines)
    Write-Host "SUCCESS: inserted stats memo and restored updateStatus"
} else {
    Write-Host "FAIL: could not find pattern. insertAfterIdx=$insertAfterIdx, brokenLineIdx=$brokenLineIdx"
}
