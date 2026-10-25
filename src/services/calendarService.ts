/**
 * Servicio para sincronización bidireccional con Google Calendar API v3 en Zentry Prospecc
 */

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  htmlLink?: string;
  leadId?: string;
  colorId?: string;
}

const LS_CALENDAR_CACHE = 'zentry_google_calendar_cache_v1';
const LS_GOOGLE_ACCESS_TOKEN = 'zentry_google_access_token_v2';

export function getCachedCalendarEvents(): GoogleCalendarEvent[] {
  try {
    const raw = localStorage.getItem(LS_CALENDAR_CACHE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedCalendarEvents(events: GoogleCalendarEvent[]): void {
  try {
    localStorage.setItem(LS_CALENDAR_CACHE, JSON.stringify(events));
  } catch {}
}

/**
 * Obtener eventos del calendario primario de Google Calendar
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  try {
    const min = timeMin || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const max = timeMax || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', min);
    url.searchParams.set('timeMax', max);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Google Calendar API fetch error:', res.status, errText);
      if (res.status === 401) {
        try {
          localStorage.removeItem(LS_GOOGLE_ACCESS_TOKEN);
        } catch {}
        throw new Error('401: Credenciales de Google inválidas o expiradas. Por favor reconecta tu cuenta.');
      }
      if (res.status === 403) {
        throw new Error('403: Permisos insuficientes de Google Calendar. Por favor acepta los permisos solicitados.');
      }
      throw new Error(`Google Calendar API (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const items = data.items || [];

    const mapped: GoogleCalendarEvent[] = items
      .filter((it: any) => it.start && (it.start.dateTime || it.start.date))
      .map((it: any) => {
        const startIso = it.start.dateTime || `${it.start.date}T09:00:00`;
        const endIso = it.end?.dateTime || it.end?.date ? (it.end.dateTime || `${it.end.date}T10:00:00`) : new Date(new Date(startIso).getTime() + 3600000).toISOString();
        return {
          id: it.id,
          summary: it.summary || 'Demo ZentryOS',
          description: it.description || '',
          location: it.location || '',
          start: { dateTime: startIso, timeZone: it.start.timeZone },
          end: { dateTime: endIso, timeZone: it.end.timeZone },
          htmlLink: it.htmlLink,
          colorId: it.colorId
        };
      });

    setCachedCalendarEvents(mapped);
    return mapped;
  } catch (err: any) {
    console.error('Error fetching Calendar events:', err);
    throw err;
  }
}

/**
 * Crear un nuevo evento en Google Calendar
 */
export async function createCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: string; // ISO string
    endDateTime: string;   // ISO string
    timeZone?: string;
  }
): Promise<GoogleCalendarEvent> {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const tz = event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';

  const body = {
    summary: event.summary,
    description: event.description || '',
    location: event.location || '',
    start: {
      dateTime: event.startDateTime,
      timeZone: tz
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: tz
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      try {
        localStorage.removeItem(LS_GOOGLE_ACCESS_TOKEN);
      } catch {}
      throw new Error('401: Sesión expirada al crear evento.');
    }
    throw new Error(`Error creando evento (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    summary: data.summary,
    description: data.description,
    location: data.location,
    start: data.start,
    end: data.end,
    htmlLink: data.htmlLink
  };
}

/**
 * Actualizar horario o datos de un evento (Drag & Drop o Resize)
 */
export async function patchCalendarEvent(
  accessToken: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    startDateTime?: string;
    endDateTime?: string;
    timeZone?: string;
  }
): Promise<GoogleCalendarEvent> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const tz = updates.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';

  const body: any = {};
  if (updates.summary !== undefined) body.summary = updates.summary;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.startDateTime) {
    body.start = { dateTime: updates.startDateTime, timeZone: tz };
  }
  if (updates.endDateTime) {
    body.end = { dateTime: updates.endDateTime, timeZone: tz };
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      try {
        localStorage.removeItem(LS_GOOGLE_ACCESS_TOKEN);
      } catch {}
      throw new Error('401: Sesión expirada al modificar evento.');
    }
    throw new Error(`Error actualizando evento (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    summary: data.summary,
    description: data.description,
    location: data.location,
    start: data.start,
    end: data.end,
    htmlLink: data.htmlLink
  };
}

/**
 * Eliminar un evento del calendario
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Error eliminando evento (${res.status}): ${errText}`);
  }
}
