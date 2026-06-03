const openTime = '11:00:00';
const closeTime = '00:00:00';
const durationMinutes = 40;

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

  console.log('Open minutes:', open);
  console.log('Close minutes before adjustment:', close);

  // Handle midnight or next-day closing (e.g. 11:00 to 00:00 or 02:00)
  if (close <= open) {
    close += 24 * 60;
  }

  console.log('Close minutes after adjustment:', close);

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

const slots = generateTimeSlots(openTime, closeTime, durationMinutes);
console.log('Generated slots:', slots);
