// Cliente de Supabase Realtime (autoalojado: public/js/vendor/supabase-js.mjs).
// Sustituye a Socket.IO en Vercel serverless: los cambios en la BD se propagan
// por la replicación de Postgres (publicación supabase_realtime) directamente
// al navegador, sin pasar por el backend.
import { createClient } from '../vendor/supabase-js.mjs';

const SUPABASE_URL = 'https://nminghnjetilraumekeq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kpb52Y9ddgdce5xTyv7cjg_oyg0BBqo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Suscribe a los cambios de reservas/participantes/bloqueos relevantes para el
// dashboard. El callback se invoca con { event, table, row }.
export function subscribeToCalendarChanges(callback) {
  const channel = supabase.channel('dashboard-changes');
  for (const table of ['bookings', 'match_participants', 'blocked_periods', 'waiting_list_entries']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      callback({ event: payload.eventType, table, row: payload.new });
    });
  }
  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('Supabase Realtime no disponible:', status, err?.message || '');
    }
  });
  return channel;
}

// Suscribe al chat de una partida (solo mensajes nuevos de ese booking).
// Devuelve el canal para poder cancelarlo si la página se cierra.
// onStatus recibe los estados del canal (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT...).
export function subscribeToMatchChat(bookingId, callback, onStatus) {
  const channel = supabase.channel(`chat-${bookingId}`);
  channel.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'match_messages',
    filter: `booking_id=eq.${bookingId}`,
  }, (payload) => callback(payload.new));
  channel.subscribe((status, err) => {
    if (onStatus) onStatus(status, err);
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('Supabase Realtime chat no disponible:', status, err?.message || '');
    }
  });
  return channel;
}
