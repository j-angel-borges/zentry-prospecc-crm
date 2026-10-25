import { LeadData } from '../data/realLeads';
import { saveCloudLead } from './cloudCrm';

export interface GoogleContact {
  resourceName: string;
  name: string;
  phoneRaw: string;
  phoneNormalized: string; // últimos 9 dígitos
}

export const LS_CONTACTS_CACHE = 'zentry_google_contacts_cache_v1';
export const LS_CONTACTS_TIMESTAMP = 'zentry_google_contacts_timestamp_v1';

/**
 * Normaliza cualquier formato de teléfono a los últimos 9 dígitos
 * Ejemplos:
 * '+51 981 290 633' -> '981290633'
 * '51981290633'     -> '981290633'
 * '981290633'       -> '981290633'
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

/**
 * Obtener contactos cacheados en localStorage
 */
export function getCachedContacts(): GoogleContact[] {
  try {
    const raw = localStorage.getItem(LS_CONTACTS_CACHE);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

/**
 * Guardar contactos en caché
 */
export function setCachedContacts(contacts: GoogleContact[]) {
  try {
    localStorage.setItem(LS_CONTACTS_CACHE, JSON.stringify(contacts));
    localStorage.setItem(LS_CONTACTS_TIMESTAMP, String(Date.now()));
  } catch {}
}

/**
 * Consultar contactos desde Google People API con el access token de OAuth
 */
export async function fetchGoogleContacts(accessToken: string): Promise<GoogleContact[]> {
  const contacts: GoogleContact[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const url = new URL('https://people.googleapis.com/v1/people/me/connections');
      url.searchParams.set('personFields', 'names,phoneNumbers');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Google People API HTTP error:', res.status, errorText);
        if (res.status === 401) {
          throw new Error('401: Sesión de Google expirada. Por favor reconecta tu cuenta.');
        }
        throw new Error(`Google People API (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const connections = data.connections || [];

      for (const person of connections) {
        const name = person.names?.[0]?.displayName || 'Sin Nombre';
        const phones = person.phoneNumbers || [];
        for (const p of phones) {
          const raw = p.value || '';
          const norm = normalizePhone(raw);
          if (norm && norm.length >= 7) {
            contacts.push({
              resourceName: person.resourceName || '',
              name,
              phoneRaw: raw,
              phoneNormalized: norm
            });
          }
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    setCachedContacts(contacts);
    return contacts;
  } catch (err: any) {
    console.error('Error fetching Google Contacts:', err);
    throw err;
  }
}

/**
 * Sincronización inteligente de Google Contacts con los leads del CRM:
 * 1. Los prospectos en el CRM que NO estén en Google Contacts se conservan intactos.
 * 2. Si coinciden por número de celular, se actualiza el nombre en el CRM y se persiste en Firestore.
 */
export async function syncGoogleContactsWithLeads(
  currentLeads: LeadData[],
  accessToken: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{
  totalGoogleContacts: number;
  matchedCount: number;
  updatedLeads: LeadData[];
}> {
  const contacts = await fetchGoogleContacts(accessToken);

  // Mapear contactos de Google por teléfono normalizado (9 dígitos)
  const phoneToContact = new Map<string, GoogleContact>();
  for (const c of contacts) {
    if (c.phoneNormalized && !phoneToContact.has(c.phoneNormalized)) {
      phoneToContact.set(c.phoneNormalized, c);
    }
  }

  const updatedLeads: LeadData[] = [];
  let matchedCount = 0;

  for (let i = 0; i < currentLeads.length; i++) {
    const lead = currentLeads[i];
    const norm = normalizePhone(lead.celular);

    if (norm && phoneToContact.has(norm)) {
      matchedCount++;
      const googleContact = phoneToContact.get(norm)!;

      // Si el nombre en Google Contacts es diferente al del CRM, enriquecerlo
      if (googleContact.name && googleContact.name !== lead.nombreMadre && googleContact.name !== 'Sin Nombre') {
        const updatedLead: LeadData = {
          ...lead,
          nombreMadre: googleContact.name
        };
        try {
          await saveCloudLead(updatedLead);
          updatedLeads.push(updatedLead);
        } catch (e) {
          console.warn(`No se pudo persistir la actualización del lead ${lead.id}:`, e);
        }
      }
    }

    if (onProgress) {
      onProgress(i + 1, currentLeads.length);
    }
  }

  return {
    totalGoogleContacts: contacts.length,
    matchedCount,
    updatedLeads
  };
}
