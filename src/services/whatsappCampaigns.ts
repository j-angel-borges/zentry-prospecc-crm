import {
  db,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  where
} from '../firebase';
import { LeadData } from '../data/realLeads';

export const CAMPAIGNS_COLLECTION = 'whatsapp_campaigns';
export const OUTBOX_COLLECTION = 'whatsapp_outbox';

export type OutboxStatus = 'pending' | 'dispatched' | 'replied' | 'cancelled';
export type CampaignStatus = 'active' | 'scheduled' | 'paused' | 'completed' | 'cancelled';

export interface FollowUpStep {
  id: string;
  stepNumber: number;
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days' | 'datetime';
  delayLabel: string; // e.g. "5 min", "12 hours", "24 hours", "2 days", "custom_rel", "custom_datetime"
  delayMs: number;
  customDateTime?: string; // YYYY-MM-DDTHH:mm
  messageTemplate: string;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  audienceSource: string; // e.g. "Expo M (JA)", "__MANUAL__", "__ALL__"
  selectedLeadIds: string[];
  initialMessage: string;
  followUps: FollowUpStep[];
  stopOnReply: boolean;
  timingMode: 'now' | 'scheduled';
  scheduledStartAt: number; // epoch ms
  jitterMinSec: number; // default 45
  jitterMaxSec: number; // default 110
  dailyBatchLimit: number; // default 35
  status: CampaignStatus;
  totalContacts: number;
  totalMessagesQueued: number;
  stats: {
    pending: number;
    dispatched: number;
    replied: number;
    cancelled: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface WhatsAppOutboxItem {
  id: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  leadName: string;
  firstName: string;
  displayName: string;
  phone: string;
  normalizedPhone: string; // e.g. "51984549686"
  sheetTab: string;
  distrito: string;
  stepIndex: number; // 0 = initial, 1 = follow-up #1, etc.
  stepLabel: string; // "Mensaje Inicial" | "Follow-up #1 (+5 min)"
  renderedMessage: string;
  attachments?: Array<{ id?: string; name: string; type: string; size: number; dataUrl: string }>;
  stopOnReply: boolean;
  status: OutboxStatus;
  jitterSec: number;
  batchDayIndex: number;
  scheduledFor: number; // epoch ms
  dispatchedAt?: number | null;
  repliedAt?: number | null;
  cancelledAt?: number | null;
  replySnippet?: string;
  createdAt: number;
  updatedAt: number;
}

const LS_CAMPAIGNS_BACKUP = 'zentry_ws_campaigns_v1';
const LS_OUTBOX_BACKUP = 'zentry_ws_outbox_v1';

/**
 * Valida y normaliza un número móvil peruano (+51 9XX XXX XXX o 9 dígitos)
 */
export function normalizePeruPhone(rawPhone?: string): {
  valid: boolean;
  digits: string;
  normalized: string;
  display: string;
} {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) {
    return { valid: false, digits: '', normalized: '', display: '' };
  }

  let localNine = digits;
  if (digits.startsWith('51') && digits.length === 11) {
    localNine = digits.slice(2);
  } else if (digits.length > 9 && digits.endsWith(digits.slice(-9)) && digits.slice(-9).startsWith('9')) {
    localNine = digits.slice(-9);
  }

  const isValidPeruMobile = /^9\d{8}$/.test(localNine);
  const normalized = isValidPeruMobile ? `51${localNine}` : digits;
  const display = isValidPeruMobile
    ? `+51 ${localNine.slice(0, 3)} ${localNine.slice(3, 6)} ${localNine.slice(6)}`
    : rawPhone || '';

  return {
    valid: isValidPeruMobile,
    digits: localNine,
    normalized,
    display
  };
}

/**
 * Extrae First Name y Display Name limpios de un Lead
 */
export function extractLeadNames(lead: Partial<LeadData>): {
  firstName: string;
  displayName: string;
} {
  const rawName = (lead.nombreMadre || '').trim();
  if (!rawName) {
    return { firstName: 'Mamá', displayName: 'Estimada Familia' };
  }
  const formatted = rawName
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const firstName = formatted.split(/\s+/)[0] || formatted;
  return {
    firstName,
    displayName: formatted
  };
}

/**
 * Reemplaza variables dinámicas {First Name}, {Display Name}, {Phone}, {Distrito}, {Origen}
 * Garantiza CERO marcas de agua (sin "Powered by blueticks.co")
 */
export function renderDynamicMessage(template: string, lead: Partial<LeadData>): string {
  const { firstName, displayName } = extractLeadNames(lead);
  const phoneInfo = normalizePeruPhone(lead.celular);
  const distrito = (lead.distrito || 'Lima').replace(/,+$/, '').trim();
  const origen = (lead.sheetTab || 'Expo Maternidad').replace(/\s*\(.*?\)\s*/g, '').trim();

  return (template || '')
    .replace(/\{First Name\}/gi, firstName)
    .replace(/\{Display Name\}/gi, displayName)
    .replace(/\{Phone\}/gi, phoneInfo.display || lead.celular || '')
    .replace(/\{Distrito\}/gi, distrito)
    .replace(/\{Origen\}/gi, origen)
    .replace(/Powered by blueticks\.co/gi, '')
    .trim();
}

/**
 * Generador de Jitter Aleatorio Anti-Baneo (por defecto entre 45,000ms y 110,000ms)
 */
export function generateJitterDelayMs(minSec = 45, maxSec = 110): number {
  const minMs = Math.max(0, minSec) * 1000;
  const maxMs = Math.max(minMs, maxSec * 1000);
  if (maxMs === 0) return 0;
  // Fórmula obligatoria anti-baneo
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Crea una campaña completa en `whatsapp_campaigns` y encola todos los mensajes
 * (iniciales + árbol de follow-ups) en `whatsapp_outbox` con Jitter y límite de lote diario.
 */
export async function createCampaignAndOutbox(params: {
  name: string;
  audienceSource: string;
  leads: LeadData[];
  initialMessage: string;
  followUps: FollowUpStep[];
  attachments?: Array<{ id?: string; name: string; type: string; size: number; dataUrl: string }>;
  stopOnReply: boolean;
  timingMode: 'now' | 'scheduled';
  scheduledStartAt?: number;
  jitterMinSec?: number;
  jitterMaxSec?: number;
  dailyBatchLimit?: number;
}): Promise<{ campaign: WhatsAppCampaign; outboxItems: WhatsAppOutboxItem[] }> {
  const now = Date.now();
  const campaignId = `cmp-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const jitterMinSec = params.jitterMinSec ?? 45;
  const jitterMaxSec = params.jitterMaxSec ?? 110;
  const dailyBatchLimit = params.dailyBatchLimit ?? 35;
  const baseStartTime =
    params.timingMode === 'scheduled' && params.scheduledStartAt && params.scheduledStartAt > now
      ? params.scheduledStartAt
      : now;

  const validLeads = params.leads.filter((l) => normalizePeruPhone(l.celular).valid);
  const outboxItems: WhatsAppOutboxItem[] = [];

  let cumulativeCursorMs = baseStartTime;
  let currentDayIndex = 0;
  let messagesInCurrentDay = 0;

  validLeads.forEach((lead, idx) => {
    const phoneInfo = normalizePeruPhone(lead.celular);
    const { firstName, displayName } = extractLeadNames(lead);

    // Control de lote diario (ej. 35 mensajes/día)
    if (messagesInCurrentDay >= dailyBatchLimit) {
      currentDayIndex += 1;
      messagesInCurrentDay = 0;
      // Saltar 24h al siguiente bloque operativo
      cumulativeCursorMs = baseStartTime + currentDayIndex * 24 * 60 * 60 * 1000;
    }

    const jitterMs = idx === 0 ? 0 : generateJitterDelayMs(jitterMinSec, jitterMaxSec);
    cumulativeCursorMs += jitterMs;
    messagesInCurrentDay += 1;

    const initialScheduledFor = cumulativeCursorMs;

    // Paso 0: Mensaje Inicial
    const initialItem: WhatsAppOutboxItem = {
      id: `out-${campaignId}-${lead.id}-s0`,
      campaignId,
      campaignName: params.name,
      leadId: lead.id,
      leadName: lead.nombreMadre,
      firstName,
      displayName,
      phone: phoneInfo.display,
      normalizedPhone: phoneInfo.normalized,
      sheetTab: lead.sheetTab || 'Expo M (JA)',
      distrito: lead.distrito || '',
      stepIndex: 0,
      stepLabel: 'Mensaje Inicial',
      renderedMessage: renderDynamicMessage(params.initialMessage, lead),
      attachments: Array.isArray(params.attachments) ? params.attachments : [],
      stopOnReply: params.stopOnReply,
      status: 'pending',
      jitterSec: Math.round(jitterMs / 1000),
      batchDayIndex: currentDayIndex + 1,
      scheduledFor: initialScheduledFor,
      dispatchedAt: null,
      repliedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now
    };
    outboxItems.push(initialItem);

    // Pasos 1..N: Árbol de Follow-ups encadenados
    let previousStepTime = initialScheduledFor;
    params.followUps.forEach((fu, fIdx) => {
      let followUpScheduledFor: number;
      let followUpJitterMs = 0;
      let humanLabel = fu.delayLabel;

      if ((fu.delayLabel === 'custom_datetime' || fu.delayUnit === 'datetime') && fu.customDateTime) {
        const parsed = new Date(fu.customDateTime).getTime();
        const leadOffsetMs = Math.max(0, initialScheduledFor - baseStartTime);
        followUpScheduledFor = !isNaN(parsed) ? parsed + leadOffsetMs : previousStepTime + 5 * 60 * 1000;
        followUpJitterMs = 0;
        humanLabel = !isNaN(parsed)
          ? new Date(parsed).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : fu.customDateTime;
      } else {
        const isShortExactDelay = fu.delayMs <= 30 * 60 * 1000;
        followUpJitterMs = isShortExactDelay ? 0 : generateJitterDelayMs(jitterMinSec, jitterMaxSec);
        followUpScheduledFor = previousStepTime + fu.delayMs + followUpJitterMs;
        if (fu.delayLabel === 'custom_rel') {
          const uLabel = fu.delayUnit === 'minutes' ? 'min' : fu.delayUnit === 'days' ? 'días' : 'h';
          humanLabel = `+${fu.delayValue} ${uLabel}`;
        } else {
          humanLabel = `+${fu.delayLabel}`;
        }
      }
      previousStepTime = followUpScheduledFor;

      const followUpItem: WhatsAppOutboxItem = {
        id: `out-${campaignId}-${lead.id}-s${fIdx + 1}`,
        campaignId,
        campaignName: params.name,
        leadId: lead.id,
        leadName: lead.nombreMadre,
        firstName,
        displayName,
        phone: phoneInfo.display,
        normalizedPhone: phoneInfo.normalized,
        sheetTab: lead.sheetTab || 'Expo M (JA)',
        distrito: lead.distrito || '',
        stepIndex: fIdx + 1,
        stepLabel: `Follow-up #${fIdx + 1} (${humanLabel})`,
        renderedMessage: renderDynamicMessage(fu.messageTemplate, lead),
        stopOnReply: params.stopOnReply,
        status: 'pending',
        jitterSec: Math.round(followUpJitterMs / 1000),
        batchDayIndex: currentDayIndex + 1,
        scheduledFor: followUpScheduledFor,
        dispatchedAt: null,
        repliedAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now
      };
      outboxItems.push(followUpItem);
    });
  });

  const campaign: WhatsAppCampaign = {
    id: campaignId,
    name: params.name,
    audienceSource: params.audienceSource,
    selectedLeadIds: validLeads.map((l) => l.id),
    initialMessage: params.initialMessage,
    followUps: params.followUps,
    stopOnReply: params.stopOnReply,
    timingMode: params.timingMode,
    scheduledStartAt: baseStartTime,
    jitterMinSec,
    jitterMaxSec,
    dailyBatchLimit,
    status: params.timingMode === 'scheduled' && baseStartTime > now + 60000 ? 'scheduled' : 'active',
    totalContacts: validLeads.length,
    totalMessagesQueued: outboxItems.length,
    stats: {
      pending: outboxItems.length,
      dispatched: 0,
      replied: 0,
      cancelled: 0
    },
    createdAt: now,
    updatedAt: now
  };

  // Respaldo inmediato en localStorage
  try {
    const prevCampaigns: WhatsAppCampaign[] = JSON.parse(localStorage.getItem(LS_CAMPAIGNS_BACKUP) || '[]');
    localStorage.setItem(LS_CAMPAIGNS_BACKUP, JSON.stringify([campaign, ...prevCampaigns]));
    const prevOutbox: WhatsAppOutboxItem[] = JSON.parse(localStorage.getItem(LS_OUTBOX_BACKUP) || '[]');
    localStorage.setItem(LS_OUTBOX_BACKUP, JSON.stringify([...outboxItems, ...prevOutbox]));
  } catch (e) {}

  // Persistir en Firestore: colección `whatsapp_campaigns` y `whatsapp_outbox`
  try {
    await setDoc(doc(db, CAMPAIGNS_COLLECTION, campaign.id), campaign, { merge: true });
    await Promise.all(
      outboxItems.map((item) => setDoc(doc(db, OUTBOX_COLLECTION, item.id), item, { merge: true }))
    );
  } catch (err) {
    console.warn('Error guardando campaña en Firestore (guardado en caché local):', err);
  }

  return { campaign, outboxItems };
}

/**
 * Suscripción en tiempo real a `whatsapp_campaigns`
 */
export function subscribeToCampaigns(onUpdate: (campaigns: WhatsAppCampaign[]) => void): () => void {
  const q = query(collection(db, CAMPAIGNS_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: WhatsAppCampaign[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...(docSnap.data() as WhatsAppCampaign), id: docSnap.id });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      try {
        localStorage.setItem(LS_CAMPAIGNS_BACKUP, JSON.stringify(list));
      } catch (e) {}
      onUpdate(list);
    },
    () => {
      try {
        const backup = JSON.parse(localStorage.getItem(LS_CAMPAIGNS_BACKUP) || '[]');
        onUpdate(backup);
      } catch {
        onUpdate([]);
      }
    }
  );
}

/**
 * Suscripción en tiempo real a `whatsapp_outbox`
 */
export function subscribeToOutbox(onUpdate: (items: WhatsAppOutboxItem[]) => void): () => void {
  const q = query(collection(db, OUTBOX_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: WhatsAppOutboxItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...(docSnap.data() as WhatsAppOutboxItem), id: docSnap.id });
      });
      list.sort((a, b) => (a.scheduledFor || 0) - (b.scheduledFor || 0));
      try {
        localStorage.setItem(LS_OUTBOX_BACKUP, JSON.stringify(list));
      } catch (e) {}
      onUpdate(list);
    },
    () => {
      try {
        const backup = JSON.parse(localStorage.getItem(LS_OUTBOX_BACKUP) || '[]');
        onUpdate(backup);
      } catch {
        onUpdate([]);
      }
    }
  );
}

/**
 * Actualiza el estado de un mensaje en `whatsapp_outbox` (pending | dispatched | replied | cancelled)
 */
export async function updateOutboxItemStatus(
  itemId: string,
  status: OutboxStatus,
  extra: Partial<WhatsAppOutboxItem> = {}
): Promise<void> {
  const now = Date.now();
  const payload: Partial<WhatsAppOutboxItem> = {
    status,
    updatedAt: now,
    ...extra
  };
  if (status === 'dispatched') payload.dispatchedAt = now;
  if (status === 'replied') payload.repliedAt = now;
  if (status === 'cancelled') payload.cancelledAt = now;

  try {
    await setDoc(doc(db, OUTBOX_COLLECTION, itemId), payload, { merge: true });
  } catch (err) {
    console.warn('Error actualizando item en whatsapp_outbox:', err);
  }
}

/**
 * Trigger de Parada (Detector de Interrupción Inbound):
 * Cuando el prospecto responde, marca su mensaje como `replied` y aborta (`cancelled`)
 * cualquier follow-up pendiente programado para ese número o lead.
 */
export async function handleInboundProspectReply(
  normalizedPhoneOrLeadId: string,
  replySnippet = 'Respuesta entrante detectada en WhatsApp Web'
): Promise<{ repliedCount: number; cancelledFollowUps: number }> {
  const now = Date.now();
  let repliedCount = 0;
  let cancelledFollowUps = 0;

  try {
    const snap = await getDocs(collection(db, OUTBOX_COLLECTION));
    const updates: Promise<void>[] = [];

    snap.forEach((docSnap) => {
      const item = docSnap.data() as WhatsAppOutboxItem;
      const matches =
        item.normalizedPhone === normalizedPhoneOrLeadId.replace(/\D/g, '') ||
        item.leadId === normalizedPhoneOrLeadId;

      if (!matches) return;

      if (item.status === 'dispatched') {
        repliedCount += 1;
        updates.push(
          setDoc(
            doc(db, OUTBOX_COLLECTION, docSnap.id),
            {
              status: 'replied',
              repliedAt: now,
              replySnippet,
              updatedAt: now
            },
            { merge: true }
          )
        );
      } else if (item.status === 'pending' && item.stopOnReply !== false) {
        cancelledFollowUps += 1;
        updates.push(
          setDoc(
            doc(db, OUTBOX_COLLECTION, docSnap.id),
            {
              status: 'cancelled',
              cancelledAt: now,
              replySnippet: 'Follow-up abortado automáticamente porque el prospecto respondió',
              updatedAt: now
            },
            { merge: true }
          )
        );
      }
    });

    await Promise.all(updates);
  } catch (err) {
    console.warn('Error procesando interrupción Inbound en Firestore:', err);
  }

  return { repliedCount, cancelledFollowUps };
}

/**
 * Pausa o reanuda una campaña activa
 */
export async function toggleCampaignStatus(campaignId: string, nextStatus: CampaignStatus): Promise<void> {
  try {
    await setDoc(
      doc(db, CAMPAIGNS_COLLECTION, campaignId),
      { status: nextStatus, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error cambiando estado de campaña:', err);
  }
}

/**
 * Elimina una campaña y sus mensajes pendientes de la cola
 */
export async function deleteCampaignAndOutbox(campaignId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId));
    const snap = await getDocs(query(collection(db, OUTBOX_COLLECTION), where('campaignId', '==', campaignId)));
    const deletions: Promise<void>[] = [];
    snap.forEach((d) => deletions.push(deleteDoc(doc(db, OUTBOX_COLLECTION, d.id))));
    await Promise.all(deletions);
  } catch (err) {
    console.warn('Error eliminando campaña:', err);
  }
}
