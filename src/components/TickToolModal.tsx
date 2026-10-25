import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LeadData, DEFAULT_SHEET_TABS } from '../data/realLeads';
import { saveCloudLead } from '../services/cloudCrm';
import {
  FollowUpStep,
  WhatsAppCampaign,
  WhatsAppOutboxItem,
  normalizePeruPhone,
  extractLeadNames,
  renderDynamicMessage,
  createCampaignAndOutbox,
  subscribeToCampaigns,
  subscribeToOutbox,
  updateOutboxItemStatus,
  handleInboundProspectReply,
  toggleCampaignStatus,
  deleteCampaignAndOutbox
} from '../services/whatsappCampaigns';

interface TickToolModalProps {
  leads: LeadData[];
  sheetTabs?: string[];
  preselectedLeadIds?: string[];
  initialSourceTab?: string;
  activeSourceTab?: string;
  onSelectTab?: (tab: string) => void;
  isStandalone?: boolean;
  onClose?: () => void;
  onAddManualLead?: (lead: LeadData) => void;
}

const toLocalDateTimeInputValue = (epochMs: number): string => {
  const d = new Date(epochMs || Date.now() + 5 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const safeFormatTime = (val?: number | string | null): string => {
  if (!val) return '';
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const safeFormatDateTime = (val?: number | string | null): string => {
  if (!val) return '';
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const DELAY_PRESETS: Array<{
  label: string;
  displayLabel: string;
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'datetime';
  ms: number;
}> = [
  { label: '1 min', displayLabel: '+1 min', value: 1, unit: 'minutes', ms: 60 * 1000 },
  { label: '5 min', displayLabel: '+5 min', value: 5, unit: 'minutes', ms: 5 * 60 * 1000 },
  { label: '10 min', displayLabel: '+10 min', value: 10, unit: 'minutes', ms: 10 * 60 * 1000 },
  { label: '15 min', displayLabel: '+15 min', value: 15, unit: 'minutes', ms: 15 * 60 * 1000 },
  { label: '30 min', displayLabel: '+30 min', value: 30, unit: 'minutes', ms: 30 * 60 * 1000 },
  { label: '1 hour', displayLabel: '+1 hora', value: 1, unit: 'hours', ms: 3600 * 1000 },
  { label: '6 hours', displayLabel: '+6 horas', value: 6, unit: 'hours', ms: 6 * 3600 * 1000 },
  { label: '12 hours', displayLabel: '+12 horas', value: 12, unit: 'hours', ms: 12 * 3600 * 1000 },
  { label: '24 hours', displayLabel: '+24 horas', value: 24, unit: 'hours', ms: 24 * 3600 * 1000 },
  { label: '2 days', displayLabel: '+48 horas', value: 2, unit: 'days', ms: 48 * 3600 * 1000 },
  { label: '3 days', displayLabel: '+72 horas', value: 3, unit: 'days', ms: 72 * 3600 * 1000 },
  { label: 'custom_rel', displayLabel: 'Tiempo exacto', value: 5, unit: 'minutes', ms: 5 * 60 * 1000 },
  { label: 'custom_datetime', displayLabel: 'Fecha y Hora', value: 0, unit: 'datetime', ms: 5 * 60 * 1000 }
];

const SvgIcon = {
  Zap: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Layers: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Inbox: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  Cpu: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  Tag: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  Globe: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Paperclip: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  File: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  GitBranch: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  ),
  Clock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Calendar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Refresh: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Archive: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Play: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Send: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  MessageSquare: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Folder: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Maximize: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ),
  Edit3: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Save: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  UserPlus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  Check: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
};

export interface CustomCampaignTemplate {
  id: string;
  title: string;
  body: string;
  attachments?: Array<{ id: string; name: string; type: string; size: number; dataUrl: string }>;
  createdAt?: number;
}

const LS_CAMPAIGN_DRAFT = 'zentry_campaign_draft_v1';

const DEFAULT_MESSAGE_TEMPLATES: CustomCampaignTemplate[] = [
  {
    id: 'tpl-expo-maternidad',
    title: 'Post-Evento Expo Maternidad',
    body: 'Hola {First Name}, te saluda José Ángel del equipo de ZentryOS. Qué gusto haber conversado contigo en {Origen}. Te escribo al {Phone} para compartirte el acceso a la evaluación privada de bienestar digital para tu familia en {Distrito}. ¿Te queda bien si te envío el resumen por aquí?',
    attachments: [],
    createdAt: 1700000000000
  },
  {
    id: 'tpl-demo-virtual',
    title: 'Agendar Demo Virtual',
    body: 'Hola {First Name}, espero que todo vaya excelente en casa. Revisando tu ficha de {Origen}, reservamos 2 cupos esta semana para mostrarte en vivo cómo ZentryOS protege la atención de tus hijos sin peleas en casa. ¿Prefieres jueves 7:30 pm o sábado por la mañana?',
    attachments: [],
    createdAt: 1700000001000
  },
  {
    id: 'tpl-reactivacion-directa',
    title: 'Reactivación Directa',
    body: '¡Hola {Display Name}! Te escribimos desde ZentryOS. Sabemos que la rutina familiar es intensa; solo quería confirmar si pudiste revisar la propuesta o si prefieres que coordinemos una breve llamada de 5 minutos.',
    attachments: [],
    createdAt: 1700000002000
  }
];

export const TickToolModal: React.FC<TickToolModalProps> = ({
  leads,
  sheetTabs = DEFAULT_SHEET_TABS,
  preselectedLeadIds = [],
  initialSourceTab = 'Expo M (JA)',
  activeSourceTab,
  onSelectTab,
  isStandalone = false,
  onClose,
  onAddManualLead
}) => {
  // Top navigation tabs: Wizard | Outbox Queue | Extension Preview
  const [activeSection, setActiveSection] = useState<'wizard' | 'queue' | 'preview'>('wizard');

  // Recuperar borrador si existe en localStorage
  const savedDraft = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(LS_CAMPAIGN_DRAFT);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.campaignName || parsed.initialMessage || (parsed.selectedIds && parsed.selectedIds.length > 0))) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading campaign draft:', e);
    }
    return null;
  }, []);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(() => {
    if (savedDraft?.wizardStep && savedDraft.wizardStep >= 1 && savedDraft.wizardStep <= 4) {
      return savedDraft.wizardStep as 1 | 2 | 3 | 4;
    }
    return 1;
  });

  // Extra manually added leads (stored locally & synced to cloud)
  const [extraLeads, setExtraLeads] = useState<LeadData[]>(() => {
    try {
      const raw = localStorage.getItem('zentry_manual_leads_v2');
      const parsed = raw ? JSON.parse(raw) : [];
      const validOnly = Array.isArray(parsed)
        ? parsed.filter((l: LeadData) => Boolean(l.celular && l.celular.trim().length >= 8))
        : [];
      if (validOnly.length !== parsed.length) {
        try {
          localStorage.setItem('zentry_manual_leads_v2', JSON.stringify(validOnly));
        } catch (_) {}
      }
      return validOnly;
    } catch {
      return [];
    }
  });

  const allLeads = useMemo(() => {
    const ids = new Set(leads.map((l) => l.id));
    const uniqueExtras = extraLeads.filter((el) => !ids.has(el.id));
    return [...leads, ...uniqueExtras];
  }, [leads, extraLeads]);

  // Step 1: Audience State
  const [audienceMode, setAudienceMode] = useState<'tab' | 'manual'>(
    preselectedLeadIds.length > 0 ? 'manual' : 'tab'
  );
  const [selectedOriginTab, setSelectedOriginTab] = useState<string>(() => {
    if (savedDraft?.selectedOriginTab) return savedDraft.selectedOriginTab;
    return activeSourceTab || initialSourceTab || 'Expo M (JA)';
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (savedDraft?.selectedIds && Array.isArray(savedDraft.selectedIds) && savedDraft.selectedIds.length > 0) {
      return new Set(savedDraft.selectedIds);
    }
    if (preselectedLeadIds && preselectedLeadIds.length > 0) {
      return new Set(preselectedLeadIds);
    }
    const defaultTab = savedDraft?.selectedOriginTab || activeSourceTab || initialSourceTab || 'Expo M (JA)';
    const matching = leads.filter((l) => (defaultTab === '__ALL__' ? true : (l.sheetTab || 'Expo M (JA)') === defaultTab));
    return new Set(matching.map((l) => l.id));
  });
  const [audienceSearch, setAudienceSearch] = useState<string>('');
  const audTableRef = useRef<HTMLDivElement | null>(null);
  const isInitialMount = useRef<boolean>(true);

  // Sync selected origin tab when activeSourceTab changes from parent bottom tabs
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (savedDraft?.selectedOriginTab) {
        return; // Respetar la pestaña del borrador al montar
      }
    }
    if (activeSourceTab !== undefined) {
      setSelectedOriginTab(activeSourceTab);
      setAudienceMode('tab');
    }
  }, [activeSourceTab]);

  // Outbox Queue Filters, Selection & Archiving State
  const [outboxStatusFilter, setOutboxStatusFilter] = useState<string>('all');
  const [outboxCampaignFilter, setOutboxCampaignFilter] = useState<string>('all');
  const [outboxSearch, setOutboxSearch] = useState<string>('');
  const [selectedOutboxIds, setSelectedOutboxIds] = useState<Set<string>>(() => new Set());
  const [archivedOutboxIds, setArchivedOutboxIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('zentry_archived_outbox_v1');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });

  const persistArchivedSet = (nextSet: Set<string>) => {
    setArchivedOutboxIds(nextSet);
    try {
      localStorage.setItem('zentry_archived_outbox_v1', JSON.stringify(Array.from(nextSet)));
    } catch {
      // ignore storage errors
    }
  };

  // Templates State with localStorage persistence
  const [templates, setTemplates] = useState<CustomCampaignTemplate[]>(() => {
    try {
      const raw = localStorage.getItem('zentry_custom_templates_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.warn('Error reading saved templates:', err);
    }
    return DEFAULT_MESSAGE_TEMPLATES;
  });

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('zentry_custom_templates_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
      }
    } catch {}
    return DEFAULT_MESSAGE_TEMPLATES[0].id;
  });

  // Modals & UI helpers state
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState<boolean>(false);
  const [saveTemplateTitle, setSaveTemplateTitle] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<CustomCampaignTemplate | null>(null);
  const [editTemplateTitle, setEditTemplateTitle] = useState<string>('');
  const [editTemplateBody, setEditTemplateBody] = useState<string>('');

  const [isManualNumberModalOpen, setIsManualNumberModalOpen] = useState<boolean>(false);
  const [manualPhoneInput, setManualPhoneInput] = useState<string>('');
  const [manualNameInput, setManualNameInput] = useState<string>('');
  const [manualDistrictInput, setManualDistrictInput] = useState<string>('');
  const [manualTabInput, setManualTabInput] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const persistTemplates = (next: CustomCampaignTemplate[]) => {
    setTemplates(next);
    try {
      localStorage.setItem('zentry_custom_templates_v2', JSON.stringify(next));
    } catch (err) {
      console.warn('LocalStorage limit reached, saving lightweight templates:', err);
      try {
        const lightweight = next.map((t) => ({
          ...t,
          attachments: (t.attachments || []).map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            size: a.size,
            dataUrl: a.dataUrl && a.dataUrl.length > 50000 ? '' : a.dataUrl
          }))
        }));
        localStorage.setItem('zentry_custom_templates_v2', JSON.stringify(lightweight));
      } catch (err2) {
        console.error('Error saving templates to storage:', err2);
      }
    }
  };

  const handleApplyTemplate = (tpl: CustomCampaignTemplate) => {
    setActiveTemplateId(tpl.id);
    setInitialMessage(tpl.body);
    if (tpl.attachments && tpl.attachments.length > 0) {
      setCampaignAttachments(tpl.attachments);
    }
    showToast(`Plantilla "${tpl.title}" cargada`);
  };

  const handleSaveAsTemplate = () => {
    const trimmedTitle = saveTemplateTitle.trim();
    if (!trimmedTitle) {
      alert('Por favor ingresa un título para la plantilla.');
      return;
    }
    if (!initialMessage.trim()) {
      alert('El mensaje de la plantilla no puede estar vacío.');
      return;
    }

    const newTpl: CustomCampaignTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: trimmedTitle,
      body: initialMessage,
      attachments: campaignAttachments.length > 0 ? [...campaignAttachments] : [],
      createdAt: Date.now()
    };

    const nextTemplates = [...templates, newTpl];
    persistTemplates(nextTemplates);
    setActiveTemplateId(newTpl.id);
    setIsSaveTemplateModalOpen(false);
    setSaveTemplateTitle('');
    showToast(`✅ Plantilla "${newTpl.title}" guardada con éxito`);
  };

  const handleStartEditTemplate = (tpl: CustomCampaignTemplate) => {
    setEditingTemplate(tpl);
    setEditTemplateTitle(tpl.title);
    setEditTemplateBody(tpl.body);
  };

  const handleSaveEditedTemplate = () => {
    if (!editingTemplate) return;
    const trimmedTitle = editTemplateTitle.trim();
    if (!trimmedTitle) {
      alert('El título no puede estar vacío.');
      return;
    }

    const updated = templates.map((t) => {
      if (t.id === editingTemplate.id) {
        return {
          ...t,
          title: trimmedTitle,
          body: editTemplateBody
        };
      }
      return t;
    });

    persistTemplates(updated);
    setEditingTemplate(null);
    showToast(`Plantilla "${trimmedTitle}" actualizada`);
  };

  const handleDeleteTemplate = (tpl: CustomCampaignTemplate) => {
    if (window.confirm(`¿Estás seguro de eliminar la plantilla "${tpl.title}"?`)) {
      const filtered = templates.filter((t) => t.id !== tpl.id);
      persistTemplates(filtered);
      if (activeTemplateId === tpl.id) {
        setActiveTemplateId(null);
      }
      showToast(`Plantilla "${tpl.title}" eliminada`);
    }
  };

  const handleAddManualLead = async (phone: string, name?: string, tab?: string, district?: string) => {
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length < 8) {
      alert('Ingresa un número telefónico válido de al menos 8 dígitos.');
      return;
    }

    const norm = normalizePeruPhone(phone);
    const finalPhone = norm.valid ? norm.digits : (cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits);
    const finalName = name && name.trim() ? name.trim() : `Contacto ${cleanDigits.slice(-9)}`;
    // Asignar el prospecto directo a la pestaña activa para garantizar que aparezca visible de inmediato
    const finalTab = (tab && tab !== 'Directo / Manual')
      ? tab
      : (selectedOriginTab === '__ALL__' ? (initialSourceTab || 'Expo M (JA)') : selectedOriginTab) || 'Expo M (JA)';
    const finalDistrito = district && district.trim() ? district.trim() : 'Lima';
    const newId = `lead-manual-${Date.now()}-${cleanDigits.slice(-4)}`;

    const newLead: LeadData = {
      id: newId,
      nombreMadre: finalName,
      celular: finalPhone,
      sheetTab: finalTab,
      distrito: finalDistrito,
      rawEstado: 'Nuevo / Agregado Manual',
      timestamp: Date.now()
    };

    // 1. Extra leads state & localStorage
    const nextExtras = [newLead, ...extraLeads];
    setExtraLeads(nextExtras);
    try {
      localStorage.setItem('zentry_manual_leads_v2', JSON.stringify(nextExtras));
    } catch (e) {
      console.warn('LocalStorage error saving manual leads:', e);
    }

    // 2. Automatically select this lead
    setSelectedIds((prev) => new Set([...prev, newLead.id]));
    setAudienceMode('manual');

    // 3. Save to cloud Firestore CRM
    try {
      await saveCloudLead(newLead);
    } catch (e) {
      console.warn('Cloud save lead error:', e);
    }

    // 4. Update parent
    if (onAddManualLead) {
      onAddManualLead(newLead);
    }

    // 5. Clean up UI states
    setIsManualNumberModalOpen(false);
    setManualPhoneInput('');
    setManualNameInput('');
    setManualDistrictInput('');
    setAudienceSearch('');

    showToast(`Contacto ${finalName} (${finalPhone}) agregado a la campaña`);
  };

  // Step 2: Message & Follow-ups State
  const [campaignName, setCampaignName] = useState<string>(() => {
    return savedDraft?.campaignName || `Campaña Zentry — ${initialSourceTab || 'Expo M'}`;
  });
  const [initialMessage, setInitialMessage] = useState<string>(() => {
    return savedDraft?.initialMessage || templates[0]?.body || DEFAULT_MESSAGE_TEMPLATES[0].body;
  });
  const [followUps, setFollowUps] = useState<FollowUpStep[]>(() => {
    if (savedDraft?.followUps && Array.isArray(savedDraft.followUps) && savedDraft.followUps.length > 0) {
      return savedDraft.followUps;
    }
    return [
      {
        id: 'fu-1',
        stepNumber: 1,
        delayValue: 24,
        delayUnit: 'hours',
        delayLabel: '24 hours',
        delayMs: 24 * 3600 * 1000,
        customDateTime: toLocalDateTimeInputValue(Date.now() + 24 * 3600 * 1000),
        messageTemplate:
          'Hola {First Name}, solo pasaba por aquí para saber si pudiste ver mi mensaje anterior sobre ZentryOS. Quedo atento por si tienes alguna consulta.'
      }
    ];
  });
  const [stopOnReply, setStopOnReply] = useState<boolean>(true);
  const [previewLeadIndex, setPreviewLeadIndex] = useState<number>(0);
  const [campaignAttachments, setCampaignAttachments] = useState<
    Array<{ id: string; name: string; type: string; size: number; dataUrl: string }>
  >([]);

  const handleCampaignFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setCampaignAttachments((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: f.name,
            type: f.type || 'application/octet-stream',
            size: f.size,
            dataUrl: String(reader.result || '')
          }
        ]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  // Step 3: Timing & Anti-Ban Jitter State
  const [timingMode, setTimingMode] = useState<'now' | 'scheduled'>(() => {
    return savedDraft?.timingMode || 'now';
  });
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    if (savedDraft?.scheduledDate) return savedDraft.scheduledDate;
    const d = new Date(Date.now() + 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [scheduledTime, setScheduledTime] = useState<string>(() => {
    return savedDraft?.scheduledTime || '18:30';
  });
  const [jitterMinSec, setJitterMinSec] = useState<number>(() => {
    return savedDraft?.jitterMinSec || 45;
  });
  const [jitterMaxSec, setJitterMaxSec] = useState<number>(() => {
    return savedDraft?.jitterMaxSec || 110;
  });
  const [dailyBatchLimit, setDailyBatchLimit] = useState<number>(() => {
    return savedDraft?.dailyBatchLimit || 35;
  });

  // Step 4 & Live Firestore State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [outbox, setOutbox] = useState<WhatsAppOutboxItem[]>([]);

  // Live Preview / Simulator State
  const [simPaused, setSimPaused] = useState<boolean>(false);
  const [simJitterCountdown, setSimJitterCountdown] = useState<number>(0);
  const [simActiveItem, setSimActiveItem] = useState<WhatsAppOutboxItem | null>(null);
  const [simLog, setSimLog] = useState<string[]>([
    '[zentry-ws-dispatcher] Service Worker inicializado.',
    '[Anti-Ban Engine] Jitter calibrado: 45s - 110s.',
    '[Firestore Sync] Conectado a whatsapp_campaigns y whatsapp_outbox.'
  ]);

  // Subscribe to Firestore collections
  useEffect(() => {
    const unsubCampaigns = subscribeToCampaigns(setCampaigns);
    const unsubOutbox = subscribeToOutbox(setOutbox);
    return () => {
      unsubCampaigns();
      unsubOutbox();
    };
  }, []);

  // Auto-guardado en segundo plano de borrador para evitar pérdida de progreso al cambiar de vista o cerrar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const draftData = {
        wizardStep,
        campaignName,
        selectedOriginTab,
        selectedIds: Array.from(selectedIds),
        initialMessage,
        followUps,
        timingMode,
        scheduledDate,
        scheduledTime,
        jitterMinSec,
        jitterMaxSec,
        dailyBatchLimit,
        updatedAt: Date.now()
      };
      localStorage.setItem(LS_CAMPAIGN_DRAFT, JSON.stringify(draftData));
    } catch (e) {
      console.warn('Error guardando borrador:', e);
    }
  }, [
    wizardStep,
    campaignName,
    selectedOriginTab,
    selectedIds,
    initialMessage,
    followUps,
    timingMode,
    scheduledDate,
    scheduledTime,
    jitterMinSec,
    jitterMaxSec,
    dailyBatchLimit
  ]);

  const handleDiscardDraft = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LS_CAMPAIGN_DRAFT);
    }
    setWizardStep(1);
    setCampaignName(`Campaña Zentry — ${initialSourceTab || 'Expo M'}`);
    setInitialMessage(templates[0]?.body || DEFAULT_MESSAGE_TEMPLATES[0].body);
    setSelectedIds(new Set(preselectedLeadIds));
    showToast('Borrador descartado');
  };

  // Listen for CRM selection events from parent/iframe postMessage
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'ZENTRY_CRM_SELECTION' && Array.isArray(e.data.leadIds)) {
        if (e.data.leadIds.length > 0) {
          setAudienceMode('manual');
          setSelectedIds(new Set(e.data.leadIds));
        }
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  // Sync audience selection when switching origin tab in 'tab' mode
  const getLeadTab = (l: LeadData) => (l.sheetTab && l.sheetTab.trim() !== '' ? l.sheetTab : 'Expo M (JA)');

  useEffect(() => {
    if (audienceMode === 'tab' || selectedIds.size === 0) {
      const matching = allLeads.filter((l) =>
        selectedOriginTab === '__ALL__' ? true : getLeadTab(l) === selectedOriginTab
      );
      if (matching.length > 0 && (audienceMode === 'tab' || selectedIds.size === 0)) {
        setSelectedIds(new Set(matching.map((l) => l.id)));
      }
      setCampaignName(
        `Campaña WS — ${selectedOriginTab === '__ALL__' ? 'Base General' : selectedOriginTab}`
      );
      if (audTableRef.current) {
        audTableRef.current.scrollTop = 0;
      }
    }
  }, [audienceMode, selectedOriginTab, allLeads]);

  // Filtered and sorted leads for Step 1 table (strictly respects selected bottom tab filter!)
  const visibleAudienceLeads = useMemo(() => {
    const q = audienceSearch.trim().toLowerCase();
    const cleanDigits = q.replace(/\D/g, '');
    const filtered = allLeads.filter((l) => {
      // Si el usuario escribe una búsqueda, buscar a través de TODAS las pestañas para no ocultar contactos directos ni números existentes
      if (!q && selectedOriginTab !== '__ALL__' && getLeadTab(l) !== selectedOriginTab) {
        return false;
      }
      if (!q) return true;
      const lPhoneDigits = (l.celular || '').replace(/\D/g, '');
      const matchPhone = cleanDigits.length >= 4 && lPhoneDigits.includes(cleanDigits);
      const matchName = (l.nombreMadre || '').toLowerCase().includes(q);
      const matchTab = getLeadTab(l).toLowerCase().includes(q);
      const matchDist = (l.distrito || '').toLowerCase().includes(q);
      return matchPhone || matchName || matchTab || matchDist;
    });
    return filtered.slice().sort((a, b) => {
      const aSel = selectedIds.has(a.id) ? 1 : 0;
      const bSel = selectedIds.has(b.id) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      return 0;
    });
  }, [allLeads, selectedIds, selectedOriginTab, audienceSearch]);

  const selectedLeadsList = useMemo(() => {
    return allLeads.filter((l) => selectedIds.has(l.id));
  }, [allLeads, selectedIds]);

  const validSelectedLeads = useMemo(() => {
    return selectedLeadsList.filter((l) => normalizePeruPhone(l.celular).valid);
  }, [selectedLeadsList]);

  const invalidSelectedCount = selectedLeadsList.length - validSelectedLeads.length;

  const samplePreviewLead: LeadData = useMemo(() => {
    if (validSelectedLeads.length > 0) {
      return validSelectedLeads[previewLeadIndex % validSelectedLeads.length];
    }
    return (
      allLeads[0] || {
        id: 'demo-1',
        nombreMadre: 'Cindy Huarcaya Castañeda',
        celular: '984549686',
        distrito: 'Bellavista Callao',
        sheetTab: 'Expo M (JA)',
        timestamp: '',
        nivelPreocupacion: 10,
        conocimientoDano: '',
        edadHijos: '',
        preguntaCondicional: '',
        respuestaCondicional: '',
        interesSolucion: 'Sí',
        observaciones: ''
      }
    );
  }, [validSelectedLeads, previewLeadIndex, allLeads]);

  // Follow-up handlers
  const handleAddFollowUp = () => {
    const nextNum = followUps.length + 1;
    setFollowUps((prev) => [
      ...prev,
      {
        id: `fu-${Date.now()}`,
        stepNumber: nextNum,
        delayValue: 5,
        delayUnit: 'minutes',
        delayLabel: '5 min',
        delayMs: 5 * 60 * 1000,
        customDateTime: toLocalDateTimeInputValue(Date.now() + 5 * 60 * 1000),
        messageTemplate:
          'Hola {First Name}, ¿tuviste oportunidad de revisar el mensaje anterior? Quedo atento para apoyarte.'
      }
    ]);
  };

  const handleUpdateFollowUpDelay = (id: string, presetLabel: string) => {
    const preset = DELAY_PRESETS.find((p) => p.label === presetLabel) || DELAY_PRESETS[1];
    setFollowUps((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        if (presetLabel === 'custom_datetime') {
          const defaultDt = f.customDateTime || toLocalDateTimeInputValue(Date.now() + 5 * 60 * 1000);
          const parsed = new Date(defaultDt).getTime();
          const diffMs = !isNaN(parsed) ? Math.max(60 * 1000, parsed - Date.now()) : 5 * 60 * 1000;
          return {
            ...f,
            delayLabel: 'custom_datetime',
            delayUnit: 'datetime',
            customDateTime: defaultDt,
            delayMs: diffMs
          };
        }
        if (presetLabel === 'custom_rel') {
          const val = Math.max(1, f.delayValue || 5);
          const unit: 'minutes' | 'hours' | 'days' =
            f.delayUnit === 'minutes' || f.delayUnit === 'hours' || f.delayUnit === 'days' ? f.delayUnit : 'minutes';
          const unitMs = unit === 'minutes' ? 60 * 1000 : unit === 'days' ? 24 * 3600 * 1000 : 3600 * 1000;
          return {
            ...f,
            delayLabel: 'custom_rel',
            delayValue: val,
            delayUnit: unit,
            delayMs: val * unitMs
          };
        }
        return {
          ...f,
          delayValue: preset.value,
          delayUnit: preset.unit,
          delayLabel: preset.label,
          delayMs: preset.ms
        };
      })
    );
  };

  const handleUpdateFollowUpCustomRel = (
    id: string,
    newVal: number,
    newUnit: 'minutes' | 'hours' | 'days'
  ) => {
    const val = Math.max(1, Number(newVal) || 1);
    const unitMs = newUnit === 'minutes' ? 60 * 1000 : newUnit === 'days' ? 24 * 3600 * 1000 : 3600 * 1000;
    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              delayLabel: 'custom_rel',
              delayValue: val,
              delayUnit: newUnit,
              delayMs: val * unitMs
            }
          : f
      )
    );
  };

  const handleUpdateFollowUpDateTime = (id: string, newDateTime: string) => {
    const parsed = new Date(newDateTime).getTime();
    const diffMs = !isNaN(parsed) ? Math.max(30 * 1000, parsed - Date.now()) : 5 * 60 * 1000;
    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              delayLabel: 'custom_datetime',
              delayUnit: 'datetime',
              customDateTime: newDateTime,
              delayMs: diffMs
            }
          : f
      )
    );
  };

  const handleUpdateFollowUpText = (id: string, text: string) => {
    setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, messageTemplate: text } : f)));
  };

  const handleRemoveFollowUp = (id: string) => {
    setFollowUps((prev) =>
      prev
        .filter((f) => f.id !== id)
        .map((f, idx) => ({
          ...f,
          stepNumber: idx + 1
        }))
    );
  };

  const insertPlaceholder = (placeholder: string) => {
    setInitialMessage((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${placeholder}`);
  };

  // Save Campaign to Firestore
  const handleSaveCampaign = async () => {
    if (validSelectedLeads.length === 0) {
      alert('⚠️ No hay contactos válidos seleccionados para esta campaña. Por favor selecciona al menos un prospecto en el Paso 1.');
      setWizardStep(1);
      return;
    }
    setIsSaving(true);
    setSaveSuccessBanner(null);

    let scheduledStartAt = Date.now();
    if (timingMode === 'scheduled' && scheduledDate && scheduledTime) {
      const parsed = new Date(`${scheduledDate}T${scheduledTime}:00`).getTime();
      if (!isNaN(parsed)) scheduledStartAt = parsed;
    }

    const result = await createCampaignAndOutbox({
      name: campaignName.trim() || 'Campaña Zentry WS',
      audienceSource: audienceMode === 'tab' ? selectedOriginTab : 'Selección Manual',
      leads: validSelectedLeads,
      initialMessage,
      followUps,
      attachments: campaignAttachments,
      stopOnReply,
      timingMode,
      scheduledStartAt,
      jitterMinSec,
      jitterMaxSec,
      dailyBatchLimit
    });

    // Actualización optimista local inmediata para que la cola se refleje al 100% al instante sin depender del tiempo de respuesta del listener
    setCampaigns((prev) => [result.campaign, ...prev.filter((c) => c.id !== result.campaign.id)]);
    setOutbox((prev) => [...result.outboxItems, ...prev.filter((o) => o.campaignId !== result.campaign.id)]);
    setOutboxCampaignFilter('all');
    setOutboxStatusFilter('all');
    setOutboxSearch('');

    // Notify Chrome extension if installed + push full outbox items with attachments
    try {
      window.postMessage(
        {
          type: 'ZENTRY_TICKTOOL_PUSH_QUEUE',
          items: result.outboxItems,
          dispatchImmediately: timingMode === 'now'
        },
        '*'
      );
      window.postMessage(
        {
          type: 'ZENTRY_WS_DISPATCH_CAMPAIGN',
          campaignId: result.campaign.id,
          totalQueued: result.outboxItems.length
        },
        '*'
      );
    } catch (e) {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(LS_CAMPAIGN_DRAFT);
      } catch {}
    }
    const timeTimingDetail = timingMode === 'scheduled' && scheduledDate && scheduledTime
      ? ` • Inicio programado: ${scheduledDate.split('-').reverse().join('/')} ${scheduledTime} hrs`
      : ` • Envíos iniciados: ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;

    setIsSaving(false);
    setSaveSuccessBanner(
      `Campaña "${result.campaign.name}" guardada • ${result.campaign.totalContacts} contactos, ${result.outboxItems.length} mensajes en cola${timeTimingDetail}.`
    );
    setTimeout(() => {
      setActiveSection('queue');
    }, 1100);
  };

  // Simulator helper: simulate dispatching next pending message with jitter
  const handleSimulateNextDispatch = async () => {
    if (simPaused) return;
    const nextPending = outbox.find((item) => item.status === 'pending');
    if (!nextPending) {
      setSimLog((prev) => [`[${new Date().toLocaleTimeString()}] Sin mensajes pendientes en cola.`, ...prev]);
      return;
    }

    const jitterMs = Math.floor(Math.random() * (110000 - 45000 + 1)) + 45000;
    const jitterSec = Math.round(jitterMs / 1000);
    setSimActiveItem(nextPending);
    setSimJitterCountdown(jitterSec);

    setSimLog((prev) => [
      `[Jitter] Delay aleatorio: ${jitterSec}s para ${nextPending.displayName} +${nextPending.normalizedPhone}`,
      `[WhatsApp Web] web.whatsapp.com/send?phone=${nextPending.normalizedPhone}`,
      ...prev
    ]);

    await updateOutboxItemStatus(nextPending.id, 'dispatched');
    setSimLog((prev) => [
      `[Enviado] ${nextPending.displayName} • ${nextPending.stepLabel} -> dispatched.`,
      ...prev
    ]);
  };

  // Simulator helper: simulate inbound reply trigger
  const handleSimulateInboundReply = async (item: WhatsAppOutboxItem) => {
    const res = await handleInboundProspectReply(
      item.normalizedPhone,
      `¡Hola! Sí me interesa agendar la demo de ZentryOS para mis hijos.`
    );
    setSimLog((prev) => [
      `[Inbound Stop] Respuesta detectada de ${item.displayName} +${item.normalizedPhone}.`,
      `[Firestore] Marcado como replied y ${res.cancelledFollowUps} seguimientos cancelados.`,
      ...prev
    ]);
  };

  const isItemArchived = (item: WhatsAppOutboxItem) =>
    archivedOutboxIds.has(item.id) || Boolean((item as any).archived);

  const activeOutboxItems = useMemo(
    () => outbox.filter((i) => !isItemArchived(i)),
    [outbox, archivedOutboxIds]
  );
  const archivedOutboxCount = useMemo(
    () => outbox.filter((i) => isItemArchived(i)).length,
    [outbox, archivedOutboxIds]
  );

  const pendingOutboxCount = activeOutboxItems.filter((i) => i.status === 'pending').length;
  const dispatchedOutboxCount = activeOutboxItems.filter((i) => i.status === 'dispatched').length;
  const repliedOutboxCount = activeOutboxItems.filter((i) => i.status === 'replied').length;
  const cancelledOutboxCount = activeOutboxItems.filter((i) => i.status === 'cancelled').length;
  const activeBatchProgress = Math.min(dailyBatchLimit, dispatchedOutboxCount + repliedOutboxCount);

  const campaignTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c) => {
      if (c.id) map[c.id] = c.name || c.id;
    });
    outbox.forEach((o) => {
      if (o.campaignId && !map[o.campaignId]) {
        map[o.campaignId] = o.campaignName || `Campaña (${o.campaignId.slice(-6)})`;
      }
    });
    return map;
  }, [campaigns, outbox]);

  const filteredOutbox = useMemo(() => {
    const q = outboxSearch.trim().toLowerCase();
    return outbox.filter((item) => {
      const archived = isItemArchived(item);
      if (outboxStatusFilter === 'archived') {
        if (!archived) return false;
      } else {
        if (archived) return false;
        if (outboxStatusFilter !== 'all' && item.status !== outboxStatusFilter) return false;
      }
      if (outboxCampaignFilter !== 'all' && item.campaignId !== outboxCampaignFilter) return false;
      if (q) {
        const hay = `${item.displayName || ''} ${item.normalizedPhone || ''} ${item.renderedMessage || ''} ${campaignTitleMap[item.campaignId] || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [outbox, archivedOutboxIds, outboxStatusFilter, outboxCampaignFilter, outboxSearch, campaignTitleMap]);

  const handleArchiveIds = (ids: string[]) => {
    if (ids.length === 0) return;
    const next = new Set(archivedOutboxIds);
    ids.forEach((id) => next.add(id));
    persistArchivedSet(next);
    setSelectedOutboxIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  };

  const handleUnarchiveIds = (ids: string[]) => {
    if (ids.length === 0) return;
    const next = new Set(archivedOutboxIds);
    ids.forEach((id) => next.delete(id));
    persistArchivedSet(next);
    setSelectedOutboxIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  };

  const contentNode = (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: isStandalone ? '0' : '16px',
        width: '100%',
        maxWidth: isStandalone ? '100%' : '1060px',
        height: isStandalone ? '100%' : 'auto',
        minHeight: isStandalone ? '0' : 'auto',
        maxHeight: isStandalone ? '100%' : '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isStandalone ? 'none' : '0 24px 60px rgba(15, 23, 42, 0.25)',
        border: isStandalone ? 'none' : '1px solid #E2E8F0',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        flex: isStandalone ? 1 : undefined
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #311042 100%)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34D399'
            }}
          >
            <SvgIcon.Zap />
          </div>
          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
            Campañas WhatsApp
          </h3>
        </div>

        {/* Navigation Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveSection('wizard')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeSection === 'wizard' ? '#10B981' : 'rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <SvgIcon.Layers />
            <span>Campañas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('queue')}
            style={{
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeSection === 'queue' ? '#10B981' : 'rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <SvgIcon.Inbox />
            <span>Cola</span>
            <span
              style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '1px 6px',
                borderRadius: '999px',
                fontSize: '0.68rem'
              }}
            >
              {pendingOutboxCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('preview')}
            style={{
              border: '1px solid rgba(194, 244, 231, 0.35)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeSection === 'preview' ? '#533B87' : 'rgba(83, 59, 135, 0.35)',
              color: '#EBF1F5',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <SvgIcon.Cpu />
            <span>Extensión</span>
          </button>
          {onClose && !isStandalone && (
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.12)',
                color: '#FFFFFF',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700
              }}
              title="Cerrar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Banner de Borrador Restaurado */}
      {savedDraft && (
        <div
          style={{
            background: '#FEF3C7',
            borderBottom: '1px solid #FCD34D',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            color: '#92400E'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📝</span>
            <span><strong>Borrador recuperado:</strong> Se han restaurado tus avances y configuración de campaña previa.</span>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#B45309',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Descartar borrador
          </button>
        </div>
      )}

      {/* Sub-bar with Stepper when in Wizard mode */}
      {activeSection === 'wizard' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            padding: '10px 20px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0'
          }}
        >
          {[
            { step: 1, title: '1. Audiencia', sub: `${validSelectedLeads.length} válidos` },
            { step: 2, title: '2. Mensaje', sub: `1 + ${followUps.length} seguimiento` },
            { step: 3, title: '3. Envío', sub: `${jitterMinSec}s–${jitterMaxSec}s • ${dailyBatchLimit}/día` },
            { step: 4, title: '4. Confirmar', sub: 'Guardar y Encolar' }
          ].map((item) => {
            const isCurrent = wizardStep === item.step;
            const isDone = wizardStep > item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setWizardStep(item.step as 1 | 2 | 3 | 4)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: isCurrent
                    ? '1.5px solid #533B87'
                    : isDone
                    ? '1px solid #86EFAC'
                    : '1px solid #E2E8F0',
                  background: isCurrent ? '#F5F3FF' : isDone ? '#F0FDF4' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: isCurrent ? '#533B87' : isDone ? '#15803D' : '#334155'
                  }}
                >
                  {isDone ? '✓ ' : ''}
                  {item.title}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>{item.sub}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Scrollable Content Area */}
      <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, background: '#F8FAFC' }}>
        {saveSuccessBanner && (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#ECFDF5',
              border: '1px solid #6EE7B7',
              color: '#065F46',
              fontSize: '0.84rem',
              fontWeight: 700
            }}
          >
            {saveSuccessBanner}
          </div>
        )}

        {/* ==================== SECTION 1: WIZARD 4 PASOS ==================== */}
        {activeSection === 'wizard' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* PASO 1: AUDIENCE */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    flex: 1,
                    minHeight: 0
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#0F172A', fontWeight: 800 }}>
                        Audiencia
                      </h4>
                      {/* Pestañas interactivas de origen sincronizadas con la barra inferior */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {sheetTabs.map((t) => {
                          const isSel = selectedOriginTab === t;
                          const count = allLeads.filter((l) => getLeadTab(l) === t).length;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                const matching = allLeads.filter((l) => getLeadTab(l) === t);
                                setSelectedOriginTab(t);
                                setAudienceMode('tab');
                                setSelectedIds(new Set(matching.map((l) => l.id)));
                                onSelectTab?.(t);
                              }}
                              style={{
                                border: isSel ? '1.5px solid #10B981' : '1px solid #CBD5E1',
                                background: isSel ? '#ECFDF5' : '#F8FAFC',
                                color: isSel ? '#065F46' : '#475569',
                                fontWeight: isSel ? 800 : 600,
                                fontSize: '0.73rem',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: isSel ? '0 1px 3px rgba(16,185,129,0.15)' : 'none',
                                transition: 'all 0.12s ease'
                              }}
                              title={`Filtrar por ${t} (${count} contactos)`}
                            >
                              <span>{t}</span>
                              <span
                                style={{
                                  background: isSel ? '#10B981' : '#E2E8F0',
                                  color: isSel ? '#FFFFFF' : '#475569',
                                  fontSize: '0.64rem',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '8px'
                                }}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOriginTab('__ALL__');
                            setAudienceMode('tab');
                            setSelectedIds(new Set(allLeads.map((l) => l.id)));
                            onSelectTab?.('__ALL__');
                          }}
                          style={{
                            border: selectedOriginTab === '__ALL__' ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                            background: selectedOriginTab === '__ALL__' ? '#EFF6FF' : '#F8FAFC',
                            color: selectedOriginTab === '__ALL__' ? '#1E40AF' : '#475569',
                            fontWeight: selectedOriginTab === '__ALL__' ? 800 : 600,
                            fontSize: '0.73rem',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: selectedOriginTab === '__ALL__' ? '0 1px 3px rgba(37,99,235,0.15)' : 'none'
                          }}
                          title={`Ver toda la base (${allLeads.length} contactos)`}
                        >
                          <span>Ver Todo</span>
                          <span
                            style={{
                              background: selectedOriginTab === '__ALL__' ? '#2563EB' : '#E2E8F0',
                              color: selectedOriginTab === '__ALL__' ? '#FFFFFF' : '#475569',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '8px'
                            }}
                          >
                            {allLeads.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Audience Stats Pills */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          background: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #A7F3D0',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '0.76rem',
                          fontWeight: 800
                        }}
                      >
                        ✓ {validSelectedLeads.length} válidos
                      </span>
                      {invalidSelectedCount > 0 && (
                        <span
                          style={{
                            background: '#FEF2F2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}
                        >
                          {invalidSelectedCount} inválidos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Search & Manual Checkbox Controls */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      background: '#F8FAFC',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          pointerEvents: 'none'
                        }}
                      >
                        <SvgIcon.Search />
                      </span>
                      <input
                        type="text"
                        value={audienceSearch}
                        onChange={(e) => setAudienceSearch(e.target.value)}
                        placeholder="Buscar contacto, teléfono, grupo o distrito..."
                        style={{
                          width: '100%',
                          padding: '7px 30px 7px 32px',
                          borderRadius: '8px',
                          border: '1.5px solid #CBD5E1',
                          fontSize: '0.78rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      {audienceSearch && (
                        <button
                          type="button"
                          onClick={() => setAudienceSearch('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            color: '#64748B',
                            fontWeight: 900,
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAudienceMode('manual');
                        setSelectedIds(new Set(visibleAudienceLeads.map((l) => l.id)));
                      }}
                      style={{
                        padding: '7px 11px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: '#2563EB'
                      }}
                    >
                      Seleccionar todos • {visibleAudienceLeads.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAudienceMode('manual');
                        setSelectedIds(new Set());
                      }}
                      style={{
                        padding: '7px 11px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: '#64748B'
                      }}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const digits = audienceSearch.replace(/\D/g, '');
                        setManualPhoneInput(digits || audienceSearch.trim());
                        setManualNameInput('');
                        setManualDistrictInput('');
                        setManualTabInput(selectedOriginTab === '__ALL__' ? (initialSourceTab || 'Expo M (JA)') : selectedOriginTab);
                        setIsManualNumberModalOpen(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #059669',
                        background: '#ECFDF5',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        color: '#065F46'
                      }}
                    >
                      <SvgIcon.UserPlus />
                      <span>+ Número directo</span>
                    </button>
                  </div>

                  {/* Smart Prompt when search is empty or number not found */}
                  {visibleAudienceLeads.length === 0 && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: '#F0F9FF',
                        border: '1.5px solid #BAE6FD',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.3rem' }}>📱</span>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0369A1' }}>
                            {audienceSearch.trim()
                              ? `El número o búsqueda "${audienceSearch.trim()}" no está en esta lista de leads`
                              : 'No hay leads para el filtro seleccionado'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#0284C7' }}>
                            Puedes agregar este número directamente para que reciba la campaña y sus seguimientos programados.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const digits = audienceSearch.replace(/\D/g, '');
                          setManualPhoneInput(digits || audienceSearch.trim());
                          setManualNameInput('');
                          setManualDistrictInput('');
                          setManualTabInput(selectedOriginTab === '__ALL__' ? (initialSourceTab || 'Expo M (JA)') : selectedOriginTab);
                          setIsManualNumberModalOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#0284C7',
                          color: '#FFFFFF',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(2,132,199,0.25)'
                        }}
                      >
                        <SvgIcon.UserPlus />
                        <span>+ Agregar "{audienceSearch.trim() || 'Número'}" al flujo</span>
                      </button>
                    </div>
                  )}

                  {/* Contact Checkbox Table (Fills complete vertical height) */}
                  <div
                    ref={audTableRef}
                    style={{
                      flex: 1,
                      minHeight: isStandalone ? 'calc(100vh - 420px)' : '340px',
                      maxHeight: isStandalone ? 'calc(100vh - 380px)' : '520px',
                      overflowY: 'auto',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead style={{ background: '#F1F5F9', position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'left', width: '36px' }}>✓</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Contacto</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>WhatsApp</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Origen</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Distrito</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAudienceLeads.map((lead) => {
                          const isChecked = selectedIds.has(lead.id);
                          const phoneInfo = normalizePeruPhone(lead.celular);
                          return (
                            <tr
                              key={lead.id}
                              onClick={() => {
                                setAudienceMode('manual');
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(lead.id)) next.delete(lead.id);
                                  else next.add(lead.id);
                                  return next;
                                });
                              }}
                              style={{
                                borderTop: '1px solid #F1F5F9',
                                background: isChecked ? '#F5F3FF' : '#FFFFFF',
                                cursor: 'pointer'
                              }}
                            >
                              <td style={{ padding: '7px 10px' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{ accentColor: '#533B87', cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0F172A' }}>
                                {lead.nombreMadre}
                                {lead.id.startsWith('lead-manual-') && (
                                  <span
                                    style={{
                                      marginLeft: '6px',
                                      fontSize: '0.62rem',
                                      background: '#FEF3C7',
                                      color: '#92400E',
                                      border: '1px solid #FCD34D',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontWeight: 800
                                    }}
                                  >
                                    Directo
                                  </span>
                                )}
                                {isChecked && (
                                  <span
                                    style={{
                                      marginLeft: '6px',
                                      fontSize: '0.64rem',
                                      background: '#DDD6FE',
                                      color: '#533B87',
                                      padding: '1px 6px',
                                      borderRadius: '999px',
                                      fontWeight: 800
                                    }}
                                  >
                                    Seleccionado
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#334155' }}>
                                {phoneInfo.display || lead.celular}
                              </td>
                              <td style={{ padding: '7px 10px' }}>
                                <span
                                  style={{
                                    background: '#EFF6FF',
                                    color: '#2563EB',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700
                                  }}
                                >
                                  {getLeadTab(lead)}
                                </span>
                              </td>
                              <td style={{ padding: '7px 10px', color: '#64748B' }}>{lead.distrito || '-'}</td>
                              <td style={{ padding: '7px 10px' }}>
                                {phoneInfo.valid ? (
                                  <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.72rem' }}>
                                    ● Válido
                                  </span>
                                ) : (
                                  <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.72rem' }}>
                                    ✕ Inválido
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={validSelectedLeads.length === 0}
                    onClick={() => setWizardStep(2)}
                    style={{
                      background: '#533B87',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: validSelectedLeads.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: validSelectedLeads.length > 0 ? 1 : 0.5
                    }}
                  >
                    Siguiente: Mensaje ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 2: MESSAGE & FOLLOW-UPS */}
            {wizardStep === 2 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '16px',
                  alignItems: 'start'
                }}
              >
                {/* Left Column: Message Editor & Follow-up Tree */}
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Nombre de la Campaña
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Quick Templates with CRUD */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>📋 Plantillas Disponibles ({templates.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setInitialMessage('');
                          setCampaignAttachments([]);
                          setActiveTemplateId(null);
                          showToast('Editor reiniciado en blanco');
                        }}
                        style={{
                          fontSize: '0.68rem',
                          background: 'transparent',
                          border: 'none',
                          color: '#6366F1',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 4px'
                        }}
                      >
                        + Mensaje en blanco
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {templates.map((tpl) => {
                        const isActive = activeTemplateId === tpl.id;
                        const hasAttachments = Boolean(tpl.attachments && tpl.attachments.length > 0);
                        return (
                          <div
                            key={tpl.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: '8px',
                              border: isActive ? '1.5px solid #6366F1' : '1px solid #E2E8F0',
                              background: isActive ? '#EEF2FF' : '#F8FAFC',
                              padding: '2px 4px 2px 8px',
                              gap: '4px',
                              boxShadow: isActive ? '0 1px 3px rgba(99,102,241,0.15)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleApplyTemplate(tpl)}
                              title="Haz clic para cargar mensaje y sus archivos adjuntos"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: isActive ? '#4338CA' : '#1E293B',
                                fontSize: '0.72rem',
                                fontWeight: isActive ? 800 : 600,
                                cursor: 'pointer',
                                padding: '2px 0',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span>{tpl.title}</span>
                              {hasAttachments && (
                                <span
                                  title={`${tpl.attachments?.length} archivo(s) adjunto(s)`}
                                  style={{
                                    fontSize: '0.62rem',
                                    background: isActive ? '#4338CA' : '#E2E8F0',
                                    color: isActive ? '#FFFFFF' : '#475569',
                                    padding: '1px 5px',
                                    borderRadius: '6px',
                                    fontWeight: 800
                                  }}
                                >
                                  📎 {tpl.attachments?.length}
                                </span>
                              )}
                            </button>

                            {/* Edit Template Title / Content */}
                            <button
                              type="button"
                              title="Editar o renombrar plantilla"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditTemplate(tpl);
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#64748B',
                                cursor: 'pointer',
                                padding: '3px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <SvgIcon.Edit3 />
                            </button>

                            {/* Delete Template */}
                            <button
                              type="button"
                              title="Eliminar plantilla"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(tpl);
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94A3B8',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 800
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#94A3B8')}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Placeholders */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>
                        Mensaje Inicial
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {['{First Name}', '{Display Name}', '{Phone}', '{Distrito}', '{Origen}'].map((ph) => (
                          <button
                            key={ph}
                            type="button"
                            onClick={() => insertPlaceholder(ph)}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#F8FAFC',
                              color: '#1E293B',
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            + {ph}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '0.82rem',
                        lineHeight: 1.45,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                      }}
                    />

                    {/* File Attachment Box for Campaign */}
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#F8FAFC',
                        border: '1px dashed #94A3B8',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <SvgIcon.Paperclip />
                          <span>Adjuntar Archivos</span>
                        </span>
                        <label
                          style={{
                            padding: '5px 12px',
                            borderRadius: '7px',
                            background: '#0F172A',
                            color: '#FFFFFF',
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          + Adjuntar
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            onChange={handleCampaignFileChange}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                      {campaignAttachments.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {campaignAttachments.map((att) => (
                            <div
                              key={att.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 9px',
                                borderRadius: '7px',
                                background: '#ECFDF5',
                                border: '1px solid #6EE7B7',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#065F46'
                              }}
                            >
                              {att.type.startsWith('image/') && att.dataUrl ? (
                                <img
                                  src={att.dataUrl}
                                  alt={att.name}
                                  style={{ width: '22px', height: '22px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                              ) : (
                                <SvgIcon.File />
                              )}
                              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {att.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCampaignAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#DC2626',
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                  padding: '0 2px'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Guardar como Plantilla Button & Update Active */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!initialMessage.trim()) {
                            alert('Escribe un mensaje antes de guardarlo como plantilla.');
                            return;
                          }
                          setSaveTemplateTitle('');
                          setIsSaveTemplateModalOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #6366F1',
                          background: '#EEF2FF',
                          color: '#4338CA',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <SvgIcon.Save />
                        <span>Guardar como plantilla</span>
                        {campaignAttachments.length > 0 && (
                          <span
                            style={{
                              background: '#4338CA',
                              color: '#FFFFFF',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              fontSize: '0.64rem',
                              fontWeight: 800
                            }}
                          >
                            +{campaignAttachments.length} {campaignAttachments.length === 1 ? 'adjunto' : 'adjuntos'}
                          </span>
                        )}
                      </button>

                      {activeTemplateId && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = templates.find((t) => t.id === activeTemplateId);
                            if (!target) return;
                            const updated = templates.map((t) =>
                              t.id === activeTemplateId
                                ? { ...t, body: initialMessage, attachments: campaignAttachments }
                                : t
                            );
                            persistTemplates(updated);
                            showToast(`Plantilla "${target.title}" actualizada con los cambios actuales`);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: '#4F46E5',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <span>↻ Actualizar plantilla seleccionada</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Follow-ups Chain */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <SvgIcon.GitBranch />
                        <span>Seguimientos • {followUps.length}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleAddFollowUp}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid #10B981',
                          background: '#ECFDF5',
                          color: '#059669',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        + Añadir
                      </button>
                    </div>

                    {followUps.map((fu, idx) => {
                      const humanTimingLabel =
                        fu.delayLabel === 'custom_datetime' && fu.customDateTime
                          ? `${new Date(fu.customDateTime).toLocaleString('es-PE', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}`
                          : fu.delayLabel === 'custom_rel'
                          ? `+${fu.delayValue} ${
                              fu.delayUnit === 'minutes' ? 'min' : fu.delayUnit === 'days' ? 'días' : 'h'
                            }`
                          : DELAY_PRESETS.find((p) => p.label === fu.delayLabel)?.displayLabel || `+${fu.delayLabel}`;

                      return (
                        <div
                          key={fu.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            borderLeft: '4px solid #533B87',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#533B87' }}>
                                Seguimiento #{idx + 1}
                              </span>
                              <select
                                value={fu.delayLabel}
                                onChange={(e) => handleUpdateFollowUpDelay(fu.id, e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  fontSize: '0.73rem',
                                  fontWeight: 700,
                                  background: '#FFFFFF',
                                  color: '#0F172A'
                                }}
                              >
                                {DELAY_PRESETS.map((p) => (
                                  <option key={p.label} value={p.label}>
                                    {p.displayLabel}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFollowUp(fu.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#EF4444',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}
                            >
                              Eliminar
                            </button>
                          </div>

                          {/* Custom Relative Delay Inputs */}
                          {fu.delayLabel === 'custom_rel' && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: '#EEF2FF',
                                border: '1px solid #C7D2FE',
                                flexWrap: 'wrap'
                              }}
                            >
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3730A3', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <SvgIcon.Clock />
                                <span>Enviar tras:</span>
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={999}
                                value={fu.delayValue || 5}
                                onChange={(e) =>
                                  handleUpdateFollowUpCustomRel(
                                    fu.id,
                                    Number(e.target.value) || 1,
                                    fu.delayUnit === 'minutes' || fu.delayUnit === 'hours' || fu.delayUnit === 'days'
                                      ? fu.delayUnit
                                      : 'minutes'
                                  )
                                }
                                style={{
                                  width: '64px',
                                  padding: '4px 7px',
                                  borderRadius: '6px',
                                  border: '1px solid #818CF8',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  color: '#1E1B4B'
                                }}
                              />
                              <select
                                value={
                                  fu.delayUnit === 'minutes' || fu.delayUnit === 'hours' || fu.delayUnit === 'days'
                                    ? fu.delayUnit
                                    : 'minutes'
                                }
                                onChange={(e) =>
                                  handleUpdateFollowUpCustomRel(
                                    fu.id,
                                    fu.delayValue || 5,
                                    e.target.value as 'minutes' | 'hours' | 'days'
                                  )
                                }
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #818CF8',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  background: '#FFFFFF',
                                  color: '#1E1B4B'
                                }}
                              >
                                <option value="minutes">minutos</option>
                                <option value="hours">horas</option>
                                <option value="days">días</option>
                              </select>
                            </div>
                          )}

                          {/* Exact Date & Time Picker */}
                          {fu.delayLabel === 'custom_datetime' && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: '#ECFDF5',
                                border: '1px solid #6EE7B7',
                                flexWrap: 'wrap'
                              }}
                            >
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065F46', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <SvgIcon.Calendar />
                                <span>Fecha y hora:</span>
                              </span>
                              <input
                                type="datetime-local"
                                value={fu.customDateTime || toLocalDateTimeInputValue(Date.now() + 5 * 60 * 1000)}
                                onChange={(e) => handleUpdateFollowUpDateTime(fu.id, e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #10B981',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  background: '#FFFFFF',
                                  color: '#064E3B'
                                }}
                              />
                            </div>
                          )}

                          {/* Quick Timing Shortcut Pills */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            {[
                              { k: '1 min', lbl: '+1 min' },
                              { k: '5 min', lbl: '+5 min' },
                              { k: '15 min', lbl: '+15 min' },
                              { k: '1 hour', lbl: '+1h' },
                              { k: '24 hours', lbl: '+24h' },
                              { k: 'custom_datetime', lbl: 'Calendario' }
                            ].map((qp) => {
                              const active = fu.delayLabel === qp.k;
                              return (
                                <button
                                  key={qp.k}
                                  type="button"
                                  onClick={() => handleUpdateFollowUpDelay(fu.id, qp.k)}
                                  style={{
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    border: active ? '1px solid #533B87' : '1px solid #CBD5E1',
                                    background: active ? '#533B87' : '#FFFFFF',
                                    color: active ? '#FFFFFF' : '#475569',
                                    fontSize: '0.67rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {qp.lbl}
                                </button>
                              );
                            })}
                            <span
                              style={{
                                marginLeft: 'auto',
                                fontSize: '0.67rem',
                                color: '#059669',
                                fontWeight: 800,
                                background: '#ECFDF5',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                border: '1px solid #A7F3D0'
                              }}
                            >
                              {humanTimingLabel}
                            </span>
                          </div>

                          <textarea
                            value={fu.messageTemplate}
                            onChange={(e) => handleUpdateFollowUpText(fu.id, e.target.value)}
                            rows={2}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.78rem',
                              fontFamily: 'inherit',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Stop on Reply Switch */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: stopOnReply ? '#ECFDF5' : '#F8FAFC',
                      border: `1px solid ${stopOnReply ? '#6EE7B7' : '#E2E8F0'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SvgIcon.Shield />
                      <span>Detener seguimiento al recibir respuesta</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={stopOnReply}
                      onChange={(e) => setStopOnReply(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#10B981', cursor: 'pointer' }}
                    />
                  </label>
                </div>

                {/* Right Column: Real-Time WhatsApp Bubble Preview */}
                <div
                  style={{
                    background: '#EFEAE2',
                    borderRadius: '14px',
                    border: '1px solid #CBD5E1',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* WhatsApp Header */}
                  <div
                    style={{
                      background: '#075E54',
                      color: '#FFFFFF',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: '#128C7E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}
                      >
                        {extractLeadNames(samplePreviewLead).firstName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                          {extractLeadNames(samplePreviewLead).displayName}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#A7F3D0' }}>
                          {normalizePeruPhone(samplePreviewLead.celular).display} • en línea
                        </div>
                      </div>
                    </div>

                    {validSelectedLeads.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPreviewLeadIndex((i) => i + 1)}
                        style={{
                          border: '1px solid rgba(255,255,255,0.3)',
                          background: 'rgba(255,255,255,0.12)',
                          color: '#FFFFFF',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.68rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <SvgIcon.Refresh />
                        <span>{(previewLeadIndex % validSelectedLeads.length) + 1}/{validSelectedLeads.length}</span>
                      </button>
                    )}
                  </div>

                  {/* Chat Bubbles Canvas */}
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '290px' }}>
                    {/* Initial Message Bubble */}
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        maxWidth: '88%',
                        background: '#D9FDD3',
                        color: '#111B21',
                        padding: '8px 12px',
                        borderRadius: '10px 0 10px 10px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                        fontSize: '0.8rem',
                        lineHeight: 1.45,
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#059669', marginBottom: '3px' }}>
                        MENSAJE INICIAL
                      </div>
                      {campaignAttachments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                          {campaignAttachments.map((att) =>
                            att.type.startsWith('image/') && att.dataUrl ? (
                              <img
                                key={att.id}
                                src={att.dataUrl}
                                alt={att.name}
                                style={{
                                  width: '100%',
                                  maxHeight: '130px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(0,0,0,0.08)'
                                }}
                              />
                            ) : (
                              <div
                                key={att.id}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(255,255,255,0.75)',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: '#0F172A',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <SvgIcon.Paperclip />
                                <span>{att.name}</span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                      {renderDynamicMessage(initialMessage, samplePreviewLead)}
                      <div style={{ fontSize: '0.64rem', color: '#667781', textAlign: 'right', marginTop: '4px' }}>
                        11:45 a.m. ✓✓
                      </div>
                    </div>

                    {/* Follow-up Bubbles */}
                    {followUps.map((fu, idx) => {
                      const humanBubbleLabel =
                        fu.delayLabel === 'custom_datetime' && fu.customDateTime
                          ? `${new Date(fu.customDateTime).toLocaleString('es-PE', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}`
                          : fu.delayLabel === 'custom_rel'
                          ? `+${fu.delayValue} ${
                              fu.delayUnit === 'minutes' ? 'min' : fu.delayUnit === 'days' ? 'días' : 'h'
                            }`
                          : DELAY_PRESETS.find((p) => p.label === fu.delayLabel)?.displayLabel || `+${fu.delayLabel}`;

                      return (
                        <div
                          key={fu.id}
                          style={{
                            alignSelf: 'flex-end',
                            maxWidth: '88%',
                            background: '#E7F8E3',
                            border: '1px dashed #10B981',
                            color: '#111B21',
                            padding: '8px 12px',
                            borderRadius: '10px 0 10px 10px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            fontSize: '0.78rem',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#533B87', marginBottom: '3px' }}>
                            SEGUIMIENTO #{idx + 1} • {humanBubbleLabel}
                          </div>
                          {renderDynamicMessage(fu.messageTemplate, samplePreviewLead)}
                          <div style={{ fontSize: '0.64rem', color: '#667781', textAlign: 'right', marginTop: '4px' }}>
                            {humanBubbleLabel} ✓✓
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Step Navigation Footer */}
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      borderTop: '1px solid #E2E8F0',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ⬅ Atrás
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#533B87',
                        color: '#FFFFFF',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Siguiente: Envío ➔
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: TIMING & CADENCIA ANTI-BANEO */}
            {wizardStep === 3 && (
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '18px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0F172A', fontWeight: 800 }}>
                    Paso 3: Envío y Cadencia
                  </h4>
                </div>

                {/* Start Mode Radio Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div
                    onClick={() => setTimingMode('now')}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: timingMode === 'now' ? '2px solid #10B981' : '1px solid #CBD5E1',
                      background: timingMode === 'now' ? '#ECFDF5' : '#F8FAFC',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SvgIcon.Zap /> Enviar ahora
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                      Inicia el despacho escalonado entre {jitterMinSec}s y {jitterMaxSec}s.
                    </div>
                  </div>

                  <div
                    onClick={() => setTimingMode('scheduled')}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: timingMode === 'scheduled' ? '2px solid #533B87' : '1px solid #CBD5E1',
                      background: timingMode === 'scheduled' ? '#F5F3FF' : '#F8FAFC',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SvgIcon.Calendar /> Programar inicio
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                      Ejecutar en la fecha y hora elegida.
                    </div>
                    {timingMode === 'scheduled' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem' }}
                        />
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Jitter & Daily Batch Configuration */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  <div style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SvgIcon.Clock /> Intervalo Aleatorio
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Mínimo seg</label>
                        <input
                          type="number"
                          min={20}
                          max={300}
                          value={jitterMinSec}
                          onChange={(e) => setJitterMinSec(Number(e.target.value) || 45)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                        />
                      </div>
                      <span style={{ fontWeight: 800, marginTop: '14px' }}>a</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Máximo seg</label>
                        <input
                          type="number"
                          min={30}
                          max={600}
                          value={jitterMaxSec}
                          onChange={(e) => setJitterMaxSec(Number(e.target.value) || 110)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SvgIcon.Shield /> Límite Diario
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min={5}
                        max={200}
                        value={dailyBatchLimit}
                        onChange={(e) => setDailyBatchLimit(Number(e.target.value) || 35)}
                        style={{ width: '110px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 800 }}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>
                        mensajes / día
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ⬅ Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#533B87',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Siguiente: Confirmar ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 4: REVIEW & GUARDAR EN FIRESTORE */}
            {wizardStep === 4 && (
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '18px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#0F172A', fontWeight: 800 }}>
                    Paso 4: Confirmar Campaña
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Audiencia</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                      {validSelectedLeads.length} contactos
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                      {audienceMode === 'tab' ? selectedOriginTab : 'Selección Manual'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Secuencia Total</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#533B87' }}>
                      {validSelectedLeads.length * (1 + followUps.length)} mensajes
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      1 Inicial + {followUps.length} Follow-up
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Cadencia y Lote</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669' }}>
                      {jitterMinSec}s – {jitterMaxSec}s
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      Máx. {dailyBatchLimit} envíos/día • {stopOnReply ? 'Auto-Stop ON' : 'Auto-Stop OFF'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '10px', background: timingMode === 'scheduled' ? '#EFF6FF' : '#F8FAFC', border: timingMode === 'scheduled' ? '1.5px solid #93C5FD' : '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.7rem', color: timingMode === 'scheduled' ? '#1E40AF' : '#64748B', fontWeight: 700 }}>
                      Hora / Momento de Envío
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: timingMode === 'scheduled' ? '#1D4ED8' : '#0F172A' }}>
                      {timingMode === 'scheduled'
                        ? `${scheduledDate.split('-').reverse().join('/')} ${scheduledTime} hrs`
                        : 'Envío Inmediato'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: timingMode === 'scheduled' ? '#2563EB' : '#059669', fontWeight: 600 }}>
                      {timingMode === 'scheduled'
                        ? `⏰ Programada para activarse a las ${scheduledTime} hrs`
                        : `⚡ Despacho activo desde ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                    Resumen de Secuencia:
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>• Inicial:</strong> {initialMessage}
                  </div>
                  {followUps.map((f, i) => (
                    <div key={f.id} style={{ marginBottom: '4px', color: '#334155' }}>
                      <strong>• Follow-up #{i + 1} +{f.delayLabel}:</strong> {f.messageTemplate}
                    </div>
                  ))}
                </div>

                {validSelectedLeads.length === 0 && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1.5px solid #FECACA',
                      borderRadius: '10px',
                      padding: '14px 18px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#991B1B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚠️</span>
                        <span>No hay contactos válidos seleccionados</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#B91C1C', marginTop: '2px' }}>
                        El borrador tenía 0 contactos o deseleccionaste todos. Haz clic a la derecha para recargar la audiencia de esta campaña.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(1);
                        setAudienceMode('tab');
                        const matching = allLeads.filter((l) =>
                          selectedOriginTab === '__ALL__' ? true : getLeadTab(l) === selectedOriginTab
                        );
                        setSelectedIds(new Set(matching.map((l) => l.id)));
                      }}
                      style={{
                        background: '#DC2626',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Restablecer Contactos en Paso 1 ➔
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ⬅ Atrás
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || validSelectedLeads.length === 0}
                    onClick={handleSaveCampaign}
                    style={{
                      padding: '11px 22px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <SvgIcon.Send />
                    {isSaving ? 'Guardando...' : 'Guardar y Activar Cola'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== SECTION 2: OUTBOX QUEUE & CAMPAIGNS ==================== */}
        {activeSection === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Status Summary Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              {[
                { key: 'pending', label: 'Pendientes', count: pendingOutboxCount, bg: '#EFF6FF', color: '#2563EB' },
                { key: 'dispatched', label: 'Enviados', count: dispatchedOutboxCount, bg: '#ECFDF5', color: '#059669' },
                { key: 'replied', label: 'Respondidos', count: repliedOutboxCount, bg: '#F5F3FF', color: '#533B87' },
                { key: 'cancelled', label: 'Cancelados', count: cancelledOutboxCount, bg: '#FEF2F2', color: '#DC2626' },
                { key: 'archived', label: 'Archivados', count: archivedOutboxCount, bg: '#F1F5F9', color: '#475569' }
              ].map((st) => (
                <div
                  key={st.key}
                  onClick={() => setOutboxStatusFilter(outboxStatusFilter === st.key ? 'all' : st.key)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: st.bg,
                    border: outboxStatusFilter === st.key ? `2px solid ${st.color}` : '1px solid rgba(0,0,0,0.06)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: st.color }}>{st.label}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: st.color }}>{st.count}</div>
                </div>
              ))}
            </div>

            {/* Active Campaigns List */}
            {campaigns.length > 0 && (
              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SvgIcon.Folder /> Campañas Activas: {campaigns.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {campaigns.slice(0, 6).map((cmp) => {
                    const isFiltered = outboxCampaignFilter === cmp.id;
                    return (
                      <div
                        key={cmp.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: isFiltered ? '#F5F3FF' : '#F8FAFC',
                          border: isFiltered ? '1.5px solid #533B87' : '1px solid #E2E8F0',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <div
                          onClick={() => setOutboxCampaignFilter(isFiltered ? 'all' : cmp.id)}
                          style={{ cursor: 'pointer', flex: 1 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.82rem', color: '#0F172A' }}>
                              {cmp.name}
                            </strong>
                            {cmp.scheduledStartAt && cmp.timingMode === 'scheduled' ? (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 800 }}>
                                ⏰ Programada: {new Date(cmp.scheduledStartAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#ECFDF5', color: '#059669', fontWeight: 800 }}>
                                ⚡ Envío: Inmediato ({cmp.createdAt ? new Date(cmp.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'Activo'})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{cmp.totalContacts} contactos • {cmp.jitterMinSec}s–{cmp.jitterMaxSec}s • Lote {cmp.dailyBatchLimit}/día</span>
                            {cmp.createdAt && (
                              <span style={{ color: '#94A3B8' }}>
                                • Registrada: {new Date(cmp.createdAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setOutboxCampaignFilter(isFiltered ? 'all' : cmp.id)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #DDD6FE',
                              background: isFiltered ? '#533B87' : '#FFFFFF',
                              color: isFiltered ? '#FFFFFF' : '#533B87',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {isFiltered ? 'Filtrando' : 'Filtrar'}
                          </button>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: cmp.status === 'paused' ? '#FEF3C7' : '#ECFDF5',
                              color: cmp.status === 'paused' ? '#D97706' : '#059669'
                            }}
                          >
                            {cmp.status.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              toggleCampaignStatus(cmp.id, cmp.status === 'paused' ? 'active' : 'paused')
                            }
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {cmp.status === 'paused' ? <><SvgIcon.Play /> Reanudar</> : <><SvgIcon.Pause /> Pausar</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCampaignAndOutbox(cmp.id)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #FECACA',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            title="Eliminar campaña"
                          >
                            <SvgIcon.Trash />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Outbox Messages Table */}
            <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SvgIcon.Inbox /> Cola de Mensajes: {filteredOutbox.length}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {outboxStatusFilter === 'archived' ? (
                    <button
                      type="button"
                      disabled={selectedOutboxIds.size === 0}
                      onClick={() => handleUnarchiveIds(Array.from(selectedOutboxIds))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #2563EB',
                        background: selectedOutboxIds.size > 0 ? '#EFF6FF' : '#F8FAFC',
                        color: selectedOutboxIds.size > 0 ? '#2563EB' : '#94A3B8',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        cursor: selectedOutboxIds.size > 0 ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <SvgIcon.Refresh /> Restaurar: {selectedOutboxIds.size}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={selectedOutboxIds.size === 0}
                      onClick={() => handleArchiveIds(Array.from(selectedOutboxIds))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #475569',
                        background: selectedOutboxIds.size > 0 ? '#0F172A' : '#F1F5F9',
                        color: selectedOutboxIds.size > 0 ? '#FFFFFF' : '#94A3B8',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        cursor: selectedOutboxIds.size > 0 ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <SvgIcon.Archive /> Archivar: {selectedOutboxIds.size}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSimulateNextDispatch}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <SvgIcon.Zap /> Despachar Siguiente
                  </button>
                </div>
              </div>

              {/* Filter by Campaign, Search & Status Filter Pills */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  background: '#F8FAFC',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>Campaña:</span>
                  <select
                    value={outboxCampaignFilter}
                    onChange={(e) => setOutboxCampaignFilter(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      background: '#FFFFFF',
                      maxWidth: '250px'
                    }}
                  >
                    <option value="all">Todas: {Object.keys(campaignTitleMap).length}</option>
                    {Object.entries(campaignTitleMap).map(([cid, cname]) => (
                      <option key={cid} value={cid}>
                        {cname}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={outboxSearch}
                  onChange={(e) => setOutboxSearch(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o mensaje..."
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.75rem'
                  }}
                />

                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[
                    { k: 'all', l: `Todos: ${activeOutboxItems.length}` },
                    { k: 'pending', l: `Pendientes: ${pendingOutboxCount}` },
                    { k: 'dispatched', l: `Enviados: ${dispatchedOutboxCount}` },
                    { k: 'replied', l: `Respondidos: ${repliedOutboxCount}` },
                    { k: 'cancelled', l: `Cancelados: ${cancelledOutboxCount}` },
                    { k: 'archived', l: `Archivados: ${archivedOutboxCount}` }
                  ].map((f) => (
                    <button
                      key={f.k}
                      type="button"
                      onClick={() => setOutboxStatusFilter(f.k)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: '7px',
                        border: outboxStatusFilter === f.k ? '1.5px solid #533B87' : '1px solid #CBD5E1',
                        background: outboxStatusFilter === f.k ? '#533B87' : '#FFFFFF',
                        color: outboxStatusFilter === f.k ? '#FFFFFF' : '#475569',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead style={{ background: '#F1F5F9', position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left', width: '32px' }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredOutbox.length > 0 &&
                            filteredOutbox.slice(0, 80).every((i) => selectedOutboxIds.has(i.id))
                          }
                          onChange={(e) => {
                            const visibleIds = filteredOutbox.slice(0, 80).map((i) => i.id);
                            if (e.target.checked) {
                              setSelectedOutboxIds((prev) => {
                                const n = new Set(prev);
                                visibleIds.forEach((id) => n.add(id));
                                return n;
                              });
                            } else {
                              setSelectedOutboxIds((prev) => {
                                const n = new Set(prev);
                                visibleIds.forEach((id) => n.delete(id));
                                return n;
                              });
                            }
                          }}
                          style={{ accentColor: '#533B87', cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Contacto</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Campaña / Paso</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Mensaje</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Delay</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Estado</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOutbox.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: '#94A3B8' }}>
                          No hay mensajes para este filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredOutbox.slice(0, 80).map((item) => {
                        const isChecked = selectedOutboxIds.has(item.id);
                        const isArchived = isItemArchived(item);
                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderTop: '1px solid #F1F5F9',
                              background: isChecked ? '#F5F3FF' : '#FFFFFF'
                            }}
                          >
                            <td style={{ padding: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setSelectedOutboxIds((prev) => {
                                    const n = new Set(prev);
                                    if (e.target.checked) n.add(item.id);
                                    else n.delete(item.id);
                                    return n;
                                  });
                                }}
                                style={{ accentColor: '#533B87', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '8px', fontWeight: 700 }}>
                              <div>{item.displayName}</div>
                              <div style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'monospace' }}>
                                +{item.normalizedPhone}
                              </div>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  color: '#64748B',
                                  maxWidth: '150px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={campaignTitleMap[item.campaignId] || item.campaignId}
                              >
                                {campaignTitleMap[item.campaignId] || 'Campaña'}
                              </div>
                              <div style={{ color: '#533B87', fontWeight: 700 }}>{item.stepLabel}</div>
                            </td>
                            <td style={{ padding: '8px', maxWidth: '240px', color: '#334155' }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.renderedMessage}>
                                {item.renderedMessage}
                              </div>
                            </td>
                            <td style={{ padding: '8px', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>
                              +{item.jitterSec}s
                            </td>
                            <td style={{ padding: '8px' }}>
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '999px',
                                  fontWeight: 800,
                                  fontSize: '0.68rem',
                                  background:
                                    item.status === 'dispatched'
                                      ? '#ECFDF5'
                                      : item.status === 'replied'
                                      ? '#F5F3FF'
                                      : item.status === 'cancelled'
                                      ? '#FEF2F2'
                                      : '#EFF6FF',
                                  color:
                                    item.status === 'dispatched'
                                      ? '#059669'
                                      : item.status === 'replied'
                                      ? '#533B87'
                                      : item.status === 'cancelled'
                                      ? '#DC2626'
                                      : '#2563EB'
                                }}
                              >
                                {item.status === 'dispatched' ? 'Enviado' : item.status === 'replied' ? 'Respondido' : item.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                              </span>
                              <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: '3px', whiteSpace: 'nowrap' }}>
                                {item.status === 'dispatched' && (item.dispatchedAt || item.updatedAt) ? (
                                  <span style={{ color: '#059669', fontWeight: 700 }}>🕒 Enviado: {safeFormatTime(item.dispatchedAt || item.updatedAt)}</span>
                                ) : item.status === 'replied' && (item.repliedAt || item.updatedAt) ? (
                                  <span style={{ color: '#533B87', fontWeight: 700 }}>💬 Respondido: {safeFormatTime(item.repliedAt || item.updatedAt)}</span>
                                ) : item.status === 'cancelled' && (item.cancelledAt || item.updatedAt) ? (
                                  <span style={{ color: '#DC2626' }}>🛑 Cancelado: {safeFormatTime(item.cancelledAt || item.updatedAt)}</span>
                                ) : item.scheduledFor ? (
                                  <span>📅 Previsto: {safeFormatDateTime(item.scheduledFor)}</span>
                                ) : null}
                              </div>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {item.status === 'pending' && (
                                  <a
                                    href={`https://web.whatsapp.com/send?phone=${item.normalizedPhone}&text=${encodeURIComponent(item.renderedMessage)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => updateOutboxItemStatus(item.id, 'dispatched')}
                                    style={{
                                      padding: '3px 7px',
                                      borderRadius: '6px',
                                      background: '#10B981',
                                      color: '#FFFFFF',
                                      textDecoration: 'none',
                                      fontSize: '0.68rem',
                                      fontWeight: 700
                                    }}
                                  >
                                    ↗ Enviar
                                  </a>
                                )}
                                {item.status !== 'replied' && (
                                  <button
                                    type="button"
                                    onClick={() => handleSimulateInboundReply(item)}
                                    style={{
                                      padding: '3px 7px',
                                      borderRadius: '6px',
                                      border: '1px solid #DDD6FE',
                                      background: '#F5F3FF',
                                      color: '#533B87',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="Marcar respuesta entrante"
                                  >
                                    <SvgIcon.MessageSquare /> Respuesta
                                  </button>
                                )}
                                {isArchived ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUnarchiveIds([item.id])}
                                    style={{
                                      padding: '4px 6px',
                                      borderRadius: '6px',
                                      border: '1px solid #BFDBFE',
                                      background: '#EFF6FF',
                                      color: '#2563EB',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    title="Restaurar mensaje"
                                  >
                                    <SvgIcon.Refresh />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveIds([item.id])}
                                    style={{
                                      padding: '4px 6px',
                                      borderRadius: '6px',
                                      border: '1px solid #CBD5E1',
                                      background: '#F8FAFC',
                                      color: '#475569',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    title="Archivar mensaje"
                                  >
                                    <SvgIcon.Archive />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== SECTION 3: PREVIEW TICK TOOL & EXTENSIÓN CHROME ==================== */}
        {activeSection === 'preview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px', alignItems: 'start' }}>
            {/* Extension Popup Live Preview */}
            <div
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                borderRadius: '14px',
                padding: '16px',
                border: '1px solid #334155',
                boxShadow: '0 14px 30px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.04em' }}>
                  EXTENSIÓN • POPUP PREVIEW
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(16,185,129,0.18)',
                    color: '#6EE7B7',
                    fontWeight: 700
                  }}
                >
                  Manifest V3
                </span>
              </div>

              {/* Status Indicators */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', background: '#1E293B' }}>
                  <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>Estado Sesión</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10B981' }}>● WhatsApp Web Conectado</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', background: '#1E293B' }}>
                  <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>Campaña Activa</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#C2F4E7' }}>
                    {campaigns[0]?.name ? campaigns[0].name.slice(0, 24) : 'Lista para despachar'}
                  </span>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#1E293B' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>Lote en Progreso</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38BDF8' }}>
                      {activeBatchProgress}/{dailyBatchLimit}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#0F172A', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (activeBatchProgress / dailyBatchLimit) * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10B981, #38BDF8)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Pause Button */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSimPaused(!simPaused)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: simPaused ? '#10B981' : '#EF4444',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {simPaused ? <><SvgIcon.Play /> Reanudar</> : <><SvgIcon.Pause /> Pausa</>}
                </button>
                <button
                  type="button"
                  onClick={handleSimulateNextDispatch}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1E293B',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <SvgIcon.Zap /> Simular Tick
                </button>
              </div>
            </div>

            {/* Live Console & Installation Guide */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                padding: '16px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SvgIcon.Cpu /> Consola Anti-Baneo
              </div>
              <div
                style={{
                  background: '#0F172A',
                  color: '#A7F3D0',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  padding: '10px',
                  borderRadius: '8px',
                  maxHeight: '165px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}
              >
                {simLog.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#475569', background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <strong>Ruta Extensión Chrome:</strong>
                <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#533B87', marginTop: '4px', wordBreak: 'break-all' }}>
                  D:\1_jose_angel\1_GitHub\Quarz\QZ-HUB\extensions\zentry-ws-dispatcher
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Guardar como Plantilla */}
        {isSaveTemplateModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setIsSaveTemplateModalOpen(false)}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '480px',
                padding: '20px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#EEF2FF', padding: '6px', borderRadius: '8px', color: '#4F46E5', display: 'flex' }}>
                    <SvgIcon.Save />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                      Guardar como Plantilla
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
                      Reutiliza este mensaje y sus archivos en futuras campañas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSaveTemplateModalOpen(false)}
                  style={{ border: 'none', background: 'transparent', fontSize: '1rem', color: '#94A3B8', cursor: 'pointer', fontWeight: 900 }}
                >
                  ✕
                </button>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Plantilla *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={saveTemplateTitle}
                  onChange={(e) => setSaveTemplateTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAsTemplate();
                  }}
                  placeholder="Ej: Demo con Catálogo en PDF..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B' }}>
                  Resumen de la plantilla a guardar:
                </div>
                <div style={{ fontSize: '0.75rem', color: '#1E293B', fontStyle: 'italic', maxHeight: '60px', overflowY: 'auto' }}>
                  "{initialMessage.length > 130 ? `${initialMessage.slice(0, 130)}...` : initialMessage}"
                </div>
                {campaignAttachments.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
                      📎 {campaignAttachments.length} {campaignAttachments.length === 1 ? 'archivo adjunto incluido' : 'archivos adjuntos incluidos'}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                    Sin archivos adjuntos
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsSaveTemplateModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  disabled={!saveTemplateTitle.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: saveTemplateTitle.trim() ? '#4F46E5' : '#CBD5E1',
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: saveTemplateTitle.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: saveTemplateTitle.trim() ? '0 2px 4px rgba(79,70,229,0.3)' : 'none'
                  }}
                >
                  Guardar Plantilla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Editar Plantilla */}
        {editingTemplate && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setEditingTemplate(null)}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '480px',
                padding: '20px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#F5F3FF', padding: '6px', borderRadius: '8px', color: '#533B87', display: 'flex' }}>
                    <SvgIcon.Edit3 />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                    Editar Plantilla
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  style={{ border: 'none', background: 'transparent', fontSize: '1rem', color: '#94A3B8', cursor: 'pointer', fontWeight: 900 }}
                >
                  ✕
                </button>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Plantilla
                </label>
                <input
                  type="text"
                  value={editTemplateTitle}
                  onChange={(e) => setEditTemplateTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Mensaje
                </label>
                <textarea
                  value={editTemplateBody}
                  onChange={(e) => setEditTemplateBody(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedTemplate}
                  disabled={!editTemplateTitle.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#533B87',
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Agregar Número Directo */}
        {isManualNumberModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setIsManualNumberModalOpen(false)}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '460px',
                padding: '22px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#ECFDF5', padding: '6px', borderRadius: '8px', color: '#059669', display: 'flex' }}>
                    <SvgIcon.UserPlus />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>
                      Agregar Número Directo a la Campaña
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
                      Participará en el envío masivo y los seguimientos automáticos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualNumberModalOpen(false)}
                  style={{ border: 'none', background: 'transparent', fontSize: '1rem', color: '#94A3B8', cursor: 'pointer', fontWeight: 900 }}
                >
                  ✕
                </button>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={manualPhoneInput}
                  onChange={(e) => setManualPhoneInput(e.target.value)}
                  placeholder="Ej: 942 575 425 o +51 942575425"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.84rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Nombre del Contacto (opcional)
                </label>
                <input
                  type="text"
                  value={manualNameInput}
                  onChange={(e) => setManualNameInput(e.target.value)}
                  placeholder="Ej: José Silva"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Origen / Pestaña
                  </label>
                  <select
                    value={manualTabInput || (selectedOriginTab === '__ALL__' ? (initialSourceTab || 'Expo M (JA)') : selectedOriginTab)}
                    onChange={(e) => setManualTabInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.78rem',
                      boxSizing: 'border-box',
                      background: '#FFFFFF'
                    }}
                  >
                    {sheetTabs.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="Directo / Manual">Directo / Manual</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Distrito (opcional)
                  </label>
                  <input
                    type="text"
                    value={manualDistrictInput}
                    onChange={(e) => setManualDistrictInput(e.target.value)}
                    placeholder="Ej: Santiago de Surco"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsManualNumberModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleAddManualLead(manualPhoneInput, manualNameInput, manualTabInput, manualDistrictInput)}
                  disabled={!manualPhoneInput.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: manualPhoneInput.trim() ? '#059669' : '#CBD5E1',
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: manualPhoneInput.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: manualPhoneInput.trim() ? '0 2px 4px rgba(5,150,105,0.3)' : 'none'
                  }}
                >
                  + Agregar y Seleccionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Notification Toast */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              background: '#0F172A',
              color: '#FFFFFF',
              padding: '10px 18px',
              borderRadius: '10px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10001
            }}
          >
            <span style={{ color: '#10B981', display: 'flex' }}>
              <SvgIcon.Check />
            </span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (isStandalone) {
    return contentNode;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      {contentNode}
    </div>
  );
};
