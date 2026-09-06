import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp
} from '../firebase';
import {
  LeadData,
  CallLogEntry,
  DEFAULT_SHEET_TABS,
  REAL_LEADS_EXPO_MATERNIDAD,
  LS_SHEET_TABS,
  LS_ACTIVE_SHEET_TAB
} from '../data/realLeads';

export const LEADS_COLLECTION = 'leads_expo_maternidad';
export const SETTINGS_COLLECTION = 'crm_settings';
export const SETTINGS_CONFIG_DOC = 'config';

// ── Cloud Sheet Tabs Synchronization ──────────────────────────────────────────

/**
 * Escucha en tiempo real las pestañas configuradas en la nube.
 * Si no existen aún en Firestore, las inicializa con los defaults y las sincroniza.
 */
export function subscribeToCloudTabs(onTabsChange: (tabs: string[]) => void): () => void {
  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_CONFIG_DOC);

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data?.sheetTabs) && data.sheetTabs.length > 0) {
          const uniqueTabs = Array.from(new Set([...DEFAULT_SHEET_TABS, ...data.sheetTabs]));
          try {
            localStorage.setItem(LS_SHEET_TABS, JSON.stringify(uniqueTabs));
          } catch (e) {}
          onTabsChange(uniqueTabs);
          return;
        }
      }

      // Si no existe el doc en Firestore, intentamos crearlo con los defaults
      setDoc(
        docRef,
        {
          sheetTabs: DEFAULT_SHEET_TABS,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      ).catch((err) => console.warn('Error inicializando pestañas en la nube:', err));

      onTabsChange(DEFAULT_SHEET_TABS);
    },
    (error) => {
      console.warn('Error escuchando pestañas en tiempo real (usando fallback local):', error);
      try {
        const local = localStorage.getItem(LS_SHEET_TABS);
        if (local) {
          onTabsChange(JSON.parse(local));
          return;
        }
      } catch (e) {}
      onTabsChange(DEFAULT_SHEET_TABS);
    }
  );

  return unsubscribe;
}

/**
 * Agrega una nueva pestaña en la nube y la propaga a todos los dispositivos conectados.
 */
export async function addCloudTab(newTabName: string): Promise<string[]> {
  const trimmed = newTabName.trim();
  if (!trimmed) return DEFAULT_SHEET_TABS;

  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_CONFIG_DOC);
  let currentTabs: string[] = DEFAULT_SHEET_TABS;

  try {
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.sheetTabs)) {
      currentTabs = snap.data().sheetTabs;
    }
  } catch (e) {
    console.warn('Error leyendo pestañas antes de agregar:', e);
  }

  const updatedTabs = Array.from(new Set([...currentTabs, trimmed]));

  // Guardar en Firestore para difusión a todos los clientes
  try {
    await setDoc(
      docRef,
      {
        sheetTabs: updatedTabs,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Error guardando nueva pestaña en la nube:', e);
  }

  // Guardar localmente
  try {
    localStorage.setItem(LS_SHEET_TABS, JSON.stringify(updatedTabs));
    localStorage.setItem(LS_ACTIVE_SHEET_TAB, trimmed);
  } catch (e) {}

  return updatedTabs;
}

/**
 * Elimina una pestaña de la nube (evitando borrar las pestañas por defecto).
 */
export async function deleteCloudTab(tabNameToRemove: string): Promise<string[]> {
  if (DEFAULT_SHEET_TABS.includes(tabNameToRemove)) {
    console.warn('No se pueden eliminar las pestañas base.');
    return DEFAULT_SHEET_TABS;
  }

  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_CONFIG_DOC);
  let currentTabs: string[] = DEFAULT_SHEET_TABS;

  try {
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.sheetTabs)) {
      currentTabs = snap.data().sheetTabs;
    }
  } catch (e) {}

  const updatedTabs = currentTabs.filter((t) => t !== tabNameToRemove);

  try {
    await setDoc(
      docRef,
      {
        sheetTabs: updatedTabs,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Error eliminando pestaña en la nube:', e);
  }

  try {
    localStorage.setItem(LS_SHEET_TABS, JSON.stringify(updatedTabs));
  } catch (e) {}

  return updatedTabs;
}

// ── Cloud Leads Real-time Listener & Synchronization ──────────────────────────

/**
 * Escucha en tiempo real todos los leads guardados en Firestore.
 * Hace un merge transparente con los leads base si aún no se han subido.
 */
export function subscribeToCloudLeads(onLeadsChange: (leads: LeadData[]) => void): () => void {
  const q = query(collection(db, LEADS_COLLECTION));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const firestoreLeads: LeadData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as LeadData;
        firestoreLeads.push({
          ...data,
          id: docSnap.id || data.id
        });
      });

      // Evitar duplicados con los leads de respaldo
      const existingIds = new Set(firestoreLeads.map((l) => l.id));
      const combined = [
        ...firestoreLeads,
        ...REAL_LEADS_EXPO_MATERNIDAD.filter((r) => !existingIds.has(r.id))
      ];

      onLeadsChange(combined);
    },
    (error) => {
      console.warn('Error en listener de Firestore Leads (usando respaldo local):', error);
      onLeadsChange(REAL_LEADS_EXPO_MATERNIDAD);
    }
  );

  return unsubscribe;
}

/**
 * Guarda o actualiza un prospecto completamente en la nube utilizando setDoc con merge.
 * Esto asegura que tanto leads existentes como nuevos persistan de inmediato en Firestore.
 */
export async function saveCloudLead(lead: LeadData): Promise<void> {
  if (!lead.id) return;
  const leadRef = doc(db, LEADS_COLLECTION, lead.id);

  try {
    await setDoc(
      leadRef,
      {
        ...lead,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Error guardando prospecto ${lead.id} en la nube:`, err);
    throw err;
  }
}

/**
 * Actualiza un campo específico de un prospecto de forma atómica en la nube.
 */
export async function updateCloudLeadField(
  leadId: string,
  field: keyof LeadData,
  value: any
): Promise<void> {
  if (!leadId) return;
  const leadRef = doc(db, LEADS_COLLECTION, leadId);

  try {
    await setDoc(
      leadRef,
      {
        [field]: value,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Error actualizando campo ${String(field)} para lead ${leadId}:`, err);
    throw err;
  }
}

/**
 * Registra una gestión de llamada en el prospecto con fecha/hora y actualiza el historial en la nube.
 */
export async function addCloudCallLog(
  lead: LeadData,
  newLog: CallLogEntry,
  newEstadoCrm?: LeadData['estadoCrm']
): Promise<LeadData> {
  const currentHistory = lead.callHistory || [];
  const updatedHistory = [newLog, ...currentHistory];

  const updatedLead: LeadData = {
    ...lead,
    gestCall: newLog.code,
    obserCalls: newLog.observation || lead.obserCalls || '',
    callHistory: updatedHistory,
    estadoCrm: newEstadoCrm || (lead.estadoCrm === 'nuevo' ? 'contactado' : lead.estadoCrm)
  };

  await saveCloudLead(updatedLead);
  return updatedLead;
}

/**
 * Elimina un registro del historial de llamadas de un lead en la nube.
 */
export async function deleteCloudCallLog(lead: LeadData, logId: string): Promise<LeadData> {
  const currentHistory = lead.callHistory || [];
  const updatedHistory = currentHistory.filter((h) => h.id !== logId);
  const newLatestGest = updatedHistory.length > 0 ? updatedHistory[0].code : '';
  const newLatestObs = updatedHistory.length > 0 ? updatedHistory[0].observation || '' : '';

  const updatedLead: LeadData = {
    ...lead,
    gestCall: newLatestGest,
    obserCalls: newLatestObs,
    callHistory: updatedHistory
  };

  await saveCloudLead(updatedLead);
  return updatedLead;
}

/**
 * Limpia todos los registros 'NC' del historial de llamadas de un lead en la nube.
 */
export async function clearCloudNCLogs(lead: LeadData): Promise<LeadData> {
  const currentHistory = lead.callHistory || [];
  const updatedHistory = currentHistory.filter(
    (h) => h.code !== 'NC' && h.label !== 'No contestó'
  );
  const newLatestGest = updatedHistory.length > 0 ? updatedHistory[0].code : '';
  const newLatestObs = updatedHistory.length > 0 ? updatedHistory[0].observation || '' : '';

  const updatedLead: LeadData = {
    ...lead,
    gestCall: newLatestGest,
    obserCalls: newLatestObs,
    callHistory: updatedHistory
  };

  await saveCloudLead(updatedLead);
  return updatedLead;
}

/**
 * Elimina permanentemente un prospecto de la base de datos en la nube.
 */
export async function deleteCloudLead(leadId: string): Promise<void> {
  if (!leadId) return;
  try {
    await deleteDoc(doc(db, LEADS_COLLECTION, leadId));
  } catch (err) {
    console.error(`Error eliminando lead ${leadId} en Firestore:`, err);
    throw err;
  }
}
