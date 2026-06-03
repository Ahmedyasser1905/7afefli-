function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const normalizedM = minutes % (24 * 60);
  const h = Math.floor(normalizedM / 60).toString().padStart(2, '0');
  const m = (normalizedM % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function generateTimeSlots(openTime, closeTime, durationMinutes) {
  const slots = [];
  const open = timeToMinutes(openTime);
  let close = timeToMinutes(closeTime);

  if (close <= open) {
    close += 24 * 60;
  }

  let current = open;
  while (current + durationMinutes <= close) {
    slots.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + durationMinutes),
    });
    current += durationMinutes;
  }
  return slots;
}

console.log(generateTimeSlots("11:00:00", "00:00:00", 40));
