export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const newM = (totalMinutes % 60).toString().padStart(2, '0');
  return `${newH}:${newM}`;
}
