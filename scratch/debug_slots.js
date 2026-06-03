const https = require('https');

const supabaseUrl = 'https://phfwutugsyiutqgippqg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnd1dHVnc3lpdXRxZ2lwcHFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk5OTU4NiwiZXhwIjoyMDk1NTc1NTg2fQ.TZN0y4RHtZqVQ8cqzPV6VM5M0knhIgGZY6ZZmjN7mAw';

const salonId = '5f8d9447-1116-4580-aa12-9852d62873e2';
const serviceId = '1175dd68-9ad7-4817-821e-e1efb2560ebe';
const dateStr = '2026-06-03';

function requestSupabase(path) {
  return new Promise((resolve, reject) => {
    const url = `${supabaseUrl}/rest/v1/${path}`;
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

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

function isSlotBooked(slot, bookedSlots) {
  let slotStart = timeToMinutes(slot.startTime);
  let slotEnd = timeToMinutes(slot.endTime);
  if (slotEnd <= slotStart) slotEnd += 24 * 60;

  return bookedSlots.some(booked => {
    let bookedStart = timeToMinutes(booked.start_time);
    let bookedEnd = timeToMinutes(booked.end_time);
    if (bookedEnd <= bookedStart) bookedEnd += 24 * 60;
    return slotStart < bookedEnd && slotEnd > bookedStart;
  });
}

async function run() {
  try {
    const serviceResult = await requestSupabase(`services?id=eq.${serviceId}&salon_id=eq.${salonId}&select=duration_minutes`);
    const salonResult = await requestSupabase(`salons?id=eq.${salonId}&select=open_time,close_time,working_days`);
    
    if (!serviceResult || serviceResult.length === 0) {
      console.log('Service not found');
      return;
    }
    if (!salonResult || salonResult.length === 0) {
      console.log('Salon not found');
      return;
    }

    const duration = serviceResult[0].duration_minutes;
    const openTime = salonResult[0].open_time;
    const closeTime = salonResult[0].close_time;
    const workingDays = salonResult[0].working_days;

    const requestedDay = new Date(dateStr).getDay();
    if (workingDays && !workingDays.includes(requestedDay)) {
      console.log(`Salon is closed on requested day of week: ${requestedDay}`);
      return;
    }

    const bookedSlots = await requestSupabase(`reservations?salon_id=eq.${salonId}&appointment_date=eq.${dateStr}&status=in.("Pending","Confirmed")&select=start_time,end_time`);

    const allSlots = generateTimeSlots(openTime, closeTime, duration);
    const finalSlots = allSlots.map(slot => ({
      ...slot,
      isAvailable: !isSlotBooked(slot, bookedSlots || []),
    }));

    console.log('Calculated slots count:', finalSlots.length);
    console.log('Slots:', finalSlots);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
