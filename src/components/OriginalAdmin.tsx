import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LeadData, CallLogEntry, getSavedSheetTabs, LS_ACTIVE_SHEET_TAB } from '../data/realLeads';
import {
  subscribeToCloudTabs,
  addCloudTab,
  deleteCloudTab,
  saveCloudLead,
  updateCloudLeadField,
  addCloudCallLog,
  deleteCloudCallLog,
  clearCloudNCLogs,
  deleteCloudLead
} from '../services/cloudCrm';

interface Props {
  leads: LeadData[];
  onClose: () => void;
  onUpdateLead: (lead: LeadData) => void;
  onDeleteLead: (leadId: string) => void;
}

// ─── LocalStorage Keys ────────────────────────────────────────────────────────
const LS_COLLAPSED_COLS = 'zentry_admin_collapsed_cols_v2';
const LS_LOCAL_EDITS = 'zentry_admin_local_edits_v2';

export type ColumnKey =
  | 'nombreMadre'
  | 'celular'
  | 'gestCall'
  | 'obserCalls'
  | 'distrito'
  | 'observaciones'
  | 'estadoCrm'
  | 'timestamp'
  | 'edadHijos'
  | 'nivelPreocupacion'
  | 'conocimientoDano'
  | 'preguntaCondicional'
  | 'respuestaCondicional'
  | 'interesSolucion'
  | 'acciones';

interface ColumnMeta {
  key: ColumnKey;
  label: string;
  shortLabel: string;
  minWidth?: string;
  headerBg?: string;
}

// ─── Opciones de Gestión Call ──────────────────────────────────────────────────
export const CALL_STATUS_OPTIONS = [
  { code: 'SC', label: 'Si contestó', color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' },
  { code: 'NC', label: 'No contestó', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
  { code: 'Col', label: 'Colgó', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
  { code: 'Bz', label: 'Buzón', color: '#7C3AED', bg: '#EDE9FE', border: '#D8B4FE' },
  { code: 'll', label: 'Volver a llamar', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
] as const;

export type CallStatusCode = typeof CALL_STATUS_OPTIONS[number]['code'];

// Helper para fecha corta (ej: 01/09/26 10:15am)
export const formatShortDate = (date: Date = new Date()): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}${ampm}`;
};

export const COLUMNS: ColumnMeta[] = [
  { key: 'nombreMadre', label: 'Nombre Madre', shortLabel: 'Nombre', minWidth: '160px' },
  { key: 'celular', label: 'Celular / WhatsApp', shortLabel: 'Celular', minWidth: '140px' },
  { key: 'gestCall', label: 'Gestión Call', shortLabel: 'Gestión Call', minWidth: '200px', headerBg: '#EFF6FF' },
  { key: 'obserCalls', label: 'Observaciones Calls', shortLabel: 'Obs Calls', minWidth: '240px', headerBg: '#EFF6FF' },
  { key: 'distrito', label: 'Distrito', shortLabel: 'Distrito', minWidth: '120px' },
  { key: 'observaciones', label: 'Observaciones Stand', shortLabel: 'Obs Stand', minWidth: '220px' },
  { key: 'estadoCrm', label: 'Estado CRM', shortLabel: 'Estado', minWidth: '135px', headerBg: '#FDF4FF' },
  { key: 'timestamp', label: 'Fecha', shortLabel: 'Fecha', minWidth: '110px' },
  { key: 'edadHijos', label: 'Edad Hijos', shortLabel: 'Edad Hijos', minWidth: '105px', headerBg: '#FFF7ED' },
  { key: 'nivelPreocupacion', label: 'Nivel', shortLabel: 'Nivel', minWidth: '65px', headerBg: '#FFF7ED' },
  { key: 'conocimientoDano', label: 'Conocimiento Daño', shortLabel: 'Daño', minWidth: '180px', headerBg: '#FFF7ED' },
  { key: 'preguntaCondicional', label: 'Pregunta Condicional', shortLabel: 'Pregunta', minWidth: '180px', headerBg: '#FFF7ED' },
  { key: 'respuestaCondicional', label: 'Respuesta', shortLabel: 'Respuesta', minWidth: '85px', headerBg: '#FFF7ED' },
  { key: 'interesSolucion', label: 'Interés', shortLabel: 'Interés', minWidth: '75px', headerBg: '#FFF7ED' },
  { key: 'acciones', label: 'Acciones', shortLabel: 'Acción', minWidth: '60px' }
];

const Icons = {
  Table: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>
    </svg>
  ),
  Kanban: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5v11"/><path d="M12 5v6"/><path d="M18 5v14"/>
    </svg>
  ),
  Download: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  Trash2: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
    </svg>
  ),
  MessageCircle: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    </svg>
  ),
  Edit2: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  ),
  Check: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  Columns: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>
    </svg>
  ),
  MinusSquare: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  PlusSquare: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  History: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Phone: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  MoveRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
};

const ExpandableText: React.FC<{
  text?: string;
  maxChars?: number;
  className?: string;
  style?: React.CSSProperties;
  forceExpandAll?: boolean;
  fullWidth?: boolean;
}> = ({
  text = '',
  maxChars = 60,
  className = '',
  style = {},
  forceExpandAll = false,
  fullWidth = true
}) => {
  const [localExpanded, setLocalExpanded] = useState<boolean>(false);

  if (!text || text.trim() === '' || text === '-') {
    return <span style={{ color: '#94A3B8' }}>-</span>;
  }

  const isExpanded = forceExpandAll || localExpanded;
  const isLong = text.length > maxChars;

  return (
    <div style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: '100%' }} className={className}>
      <span style={{
        whiteSpace: isExpanded || fullWidth ? 'pre-wrap' : 'nowrap',
        overflow: isExpanded || fullWidth ? 'visible' : 'hidden',
        textOverflow: isExpanded || fullWidth ? 'clip' : 'ellipsis',
        width: '100%',
        lineHeight: '1.45',
        wordBreak: 'break-word',
        fontSize: '0.85rem'
      }}>
        {isExpanded || fullWidth ? text : (isLong ? `${text.slice(0, maxChars)}...` : text)}
      </span>
      {isLong && !forceExpandAll && !fullWidth && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLocalExpanded(!localExpanded);
          }}
          style={{
            border: 'none',
            background: '#EFF6FF',
            color: '#2563EB',
            fontSize: '0.7rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            marginTop: '3px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title={isExpanded ? 'Contraer texto' : 'Ver texto completo'}
        >
          {isExpanded ? (
            <>
              <span>Menos</span>
              <Icons.ChevronUp />
            </>
          ) : (
            <>
              <span>Ver más</span>
              <Icons.ChevronDown />
            </>
          )}
        </button>
      )}
    </div>
  );
};

// ─── Inline Editable Text Cell Component ──────────────────────────────────────
interface EditableCellProps {
  leadId: string;
  field: keyof LeadData;
  value: string;
  onSave: (leadId: string, field: keyof LeadData, value: string) => Promise<void>;
  placeholder?: string;
  style?: React.CSSProperties;
  maxChars?: number;
  forceExpandAll?: boolean;
  fullWidth?: boolean;
}

const EditableCell: React.FC<EditableCellProps> = ({
  leadId,
  field,
  value,
  onSave,
  placeholder = 'Añadir nota...',
  style = {},
  maxChars = 60,
  forceExpandAll = false,
  fullWidth = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(68, textareaRef.current.scrollHeight + 4)}px`;
    }
  }, [isEditing, draft]);

  const handleCommit = async () => {
    setIsSaving(true);
    await onSave(leadId, field, draft);
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
    if (e.key === 'Escape') {
      setDraft(value || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: '220px' }} onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          style={{
            width: '100%',
            minHeight: '68px',
            fontSize: '0.85rem',
            lineHeight: '1.45',
            padding: '6px 8px',
            border: '1.5px solid #3B82F6',
            borderRadius: '6px',
            outline: 'none',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.15)',
            background: '#FFFFFF',
            color: '#1E293B',
            whiteSpace: 'pre-wrap'
          }}
        />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCommit}
            disabled={isSaving}
            style={{
              border: 'none',
              background: '#10B981',
              color: 'white',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Guardar cambios (Enter)"
          >
            <Icons.Check />
            <span>Guardar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value || '');
              setIsEditing(false);
            }}
            style={{
              border: 'none',
              background: '#94A3B8',
              color: 'white',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
            title="Cancelar (Esc)"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', cursor: 'pointer', width: '100%' }}
      onDoubleClick={() => setIsEditing(true)}
      title="Doble clic o clic en el lápiz para editar"
    >
      <ExpandableText
        text={value}
        maxChars={maxChars}
        forceExpandAll={forceExpandAll}
        fullWidth={fullWidth}
        style={style}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: '2px 4px',
          color: '#94A3B8',
          opacity: 0.7,
          flexShrink: 0,
          marginTop: '2px'
        }}
        title="Editar texto"
      >
        <Icons.Edit2 />
      </button>
    </div>
  );
};

// ─── Componente Celda de Gestión Call (Selector Minimal + Botón Check + Historial) ─
interface GestCallCellProps {
  lead: LeadData;
  currentCode: string;
  history: CallLogEntry[];
  onConfirmCode: (code: string) => Promise<void>;
  onOpenHistory: (lead: LeadData, mode: 'recent' | 'all') => void;
}

const GestCallCell: React.FC<GestCallCellProps> = ({
  lead,
  currentCode,
  history,
  onConfirmCode,
  onOpenHistory
}) => {
  const [selectedCode, setSelectedCode] = useState<string>(currentCode || '');
  const [isSaving, setIsSaving] = useState(false);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSelectedCode(currentCode || '');
  }, [currentCode]);

  const activeOpt = CALL_STATUS_OPTIONS.find(o => o.code === selectedCode);
  const isDirty = selectedCode !== (currentCode || '');
  const totalLogs = history.length;

  const handleCheck = async () => {
    if (!selectedCode) return;
    setIsSaving(true);
    await onConfirmCode(selectedCode);
    setIsSaving(false);
  };

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onOpenHistory(lead, 'all');
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onOpenHistory(lead, 'recent');
      }, 250);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
      <select
        value={selectedCode}
        onChange={(e) => setSelectedCode(e.target.value)}
        style={{
          flex: 1,
          padding: '4px 6px',
          borderRadius: '6px',
          border: isDirty ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
          background: activeOpt ? activeOpt.bg : '#FFFFFF',
          color: activeOpt ? activeOpt.color : '#334155',
          fontWeight: 700,
          fontSize: '0.78rem',
          outline: 'none',
          cursor: 'pointer',
          boxShadow: isDirty ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
          transition: 'all 0.15s ease'
        }}
        title="Selecciona una opción y da clic en ✓ para guardar la gestión"
      >
        <option value="">-- Sin registrar --</option>
        {CALL_STATUS_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.code} • {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleCheck}
        disabled={!selectedCode || isSaving}
        style={{
          border: 'none',
          background: isDirty ? '#10B981' : (selectedCode ? '#E2E8F0' : '#F1F5F9'),
          color: isDirty ? '#FFFFFF' : (selectedCode ? '#475569' : '#CBD5E1'),
          borderRadius: '6px',
          padding: '5px 8px',
          cursor: isDirty ? 'pointer' : 'default',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDirty ? '0 2px 4px rgba(16, 185, 129, 0.25)' : 'none',
          transition: 'all 0.15s ease'
        }}
        title={isDirty ? 'Aceptar y guardar gestión con fecha y hora actual (✓)' : 'Gestión guardada'}
      >
        <Icons.Check />
      </button>

      <button
        type="button"
        onClick={handleHistoryClick}
        style={{
          border: '1px solid #CBD5E1',
          background: totalLogs > 0 ? '#EFF6FF' : '#FFFFFF',
          color: totalLogs > 0 ? '#2563EB' : '#94A3B8',
          borderRadius: '6px',
          padding: '4px 6px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: '0.72rem',
          fontWeight: 700,
          flexShrink: 0
        }}
        title="1 clic: Últimas 3 gestiones | 2 clics: Histórico completo"
      >
        <Icons.History />
        {totalLogs > 0 && <span>{totalLogs}</span>}
      </button>
    </div>
  );
};

// ─── Modal de Historial Minimalista con eliminación individual y limpieza NC ─
interface CallHistoryModalProps {
  lead: LeadData;
  mode: 'recent' | 'all';
  history: CallLogEntry[];
  onClose: () => void;
  onSetMode: (mode: 'recent' | 'all') => void;
  onAddNewLog: (code: string, obs: string) => Promise<void>;
  onDeleteLog: (logId: string) => Promise<void>;
  onClearNC: () => Promise<void>;
}

const CallHistoryModal: React.FC<CallHistoryModalProps> = ({
  lead,
  mode,
  history,
  onClose,
  onSetMode,
  onAddNewLog,
  onDeleteLog,
  onClearNC
}) => {
  const [newCode, setNewCode] = useState<string>('SC');
  const [newObs, setNewObs] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const displayedLogs = mode === 'recent' ? history.slice(0, 3) : history;
  const hasNC = history.some(l => l.code === 'NC' || l.label === 'No contestó');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode) return;
    setIsSubmitting(true);
    await onAddNewLog(newCode, newObs);
    setNewObs('');
    setIsSubmitting(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Phone />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#0F172A', fontWeight: 700 }}>
                {lead.nombreMadre}
              </h3>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
              Tel: <strong>{lead.celular}</strong> • {lead.distrito} • Pestaña: <span style={{ color: '#2563EB', fontWeight: 700 }}>{lead.sheetTab || 'Expo M (JA)'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: '#F1F5F9', color: '#64748B', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher & Clean NC button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 18px', background: '#FFFFFF', borderBottom: '1px solid #F1F5F9', gap: '6px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onSetMode('recent')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: mode === 'recent' ? '#EFF6FF' : '#F8FAFC',
                color: mode === 'recent' ? '#2563EB' : '#64748B'
              }}
            >
              Últimas 3 Gestiones
            </button>
            <button
              type="button"
              onClick={() => onSetMode('all')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: mode === 'all' ? '#EFF6FF' : '#F8FAFC',
                color: mode === 'all' ? '#2563EB' : '#64748B'
              }}
            >
              Histórico Completo ({history.length})
            </button>
          </div>

          {hasNC && (
            <button
              type="button"
              onClick={onClearNC}
              style={{
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#EF4444',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Eliminar todos los registros NC de este lead"
            >
              <Icons.Trash2 />
              <span>Eliminar NCs</span>
            </button>
          )}
        </div>

        {/* List of Calls */}
        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayedLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94A3B8', fontSize: '0.8rem' }}>
              Sin gestiones registradas aún.
            </div>
          ) : (
            displayedLogs.map((log, idx) => {
              const opt = CALL_STATUS_OPTIONS.find(o => o.code === log.code || o.label === log.code);
              return (
                <div
                  key={log.id || idx}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    background: idx === 0 ? '#F8FAFC' : '#FFFFFF',
                    borderLeft: `3.5px solid ${opt?.color || '#3B82F6'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span
                      style={{
                        background: opt?.bg || '#EFF6FF',
                        color: opt?.color || '#2563EB',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: `1px solid ${opt?.border || '#93C5FD'}`
                      }}
                    >
                      {opt?.code || log.code} • {opt?.label || log.label || 'Gestión'}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {log.datetime}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteLog(log.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#EF4444',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: 0.75
                        }}
                        title="Eliminar este registro del histórico"
                      >
                        <Icons.Trash2 />
                      </button>
                    </div>
                  </div>

                  {log.observation ? (
                    <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: '1.4', marginTop: '3px' }}>
                      {log.observation}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontStyle: 'italic' }}>
                      Sin observaciones
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Minimal Add New Call Bar */}
        <form onSubmit={handleAdd} style={{ padding: '10px 18px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'white',
              outline: 'none'
            }}
          >
            {CALL_STATUS_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>{opt.code} ({opt.label})</option>
            ))}
          </select>
          <input
            type="text"
            value={newObs}
            onChange={(e) => setNewObs(e.target.value)}
            placeholder="Observación de la llamada..."
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.75rem',
              outline: 'none',
              background: 'white'
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              background: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="Guardar nueva gestión (✓)"
          >
            <Icons.Check />
            <span>Guardar</span>
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Main Admin Panel Component ───────────────────────────────────────────────
export const OriginalAdmin: React.FC<Props> = ({ leads, onClose, onUpdateLead, onDeleteLead }) => {
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'crm'>('spreadsheet');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDistrito, setFilterDistrito] = useState<string>('todos');
  const [expandAllTexts, setExpandAllTexts] = useState<boolean>(false);
  const [isColMenuOpen, setIsColMenuOpen] = useState<boolean>(false);

  // ── Sheet Tabs State sincronizado en tiempo real con Firestore ──────────────
  const [sheetTabs, setSheetTabs] = useState<string[]>(() => getSavedSheetTabs());
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const active = localStorage.getItem(LS_ACTIVE_SHEET_TAB);
      return active || 'Expo M (JA)';
    } catch {
      return 'Expo M (JA)';
    }
  });

  // Escucha en tiempo real de pestañas desde la nube
  useEffect(() => {
    const unsubscribe = subscribeToCloudTabs((cloudTabs) => {
      setSheetTabs(cloudTabs);
    });
    return () => unsubscribe();
  }, []);

  // New tab inline creator state
  const [isAddingTab, setIsAddingTab] = useState<boolean>(false);
  const [newTabInput, setNewTabInput] = useState<string>('');

  // Modal de Historial State
  const [activeHistoryModal, setActiveHistoryModal] = useState<{
    lead: LeadData;
    mode: 'recent' | 'all';
  } | null>(null);

  // ── 1. Collapsed columns state with LocalStorage Persistence ────────────────
  const [collapsedCols, setCollapsedCols] = useState<Record<ColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LS_COLLAPSED_COLS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // ── 2. Local Text Edits & Call Logs Cache with LocalStorage Persistence ──────
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<LeadData>>>(() => {
    try {
      const saved = localStorage.getItem(LS_LOCAL_EDITS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save collapsed cols whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED_COLS, JSON.stringify(collapsedCols));
    } catch (e) {
      console.warn('Error saving collapsed columns to localStorage', e);
    }
  }, [collapsedCols]);

  // Save local edits whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(LS_LOCAL_EDITS, JSON.stringify(localEdits));
    } catch (e) {
      console.warn('Error saving local edits to localStorage', e);
    }
  }, [localEdits]);

  // Save active tab
  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(LS_ACTIVE_SHEET_TAB, tab);
    } catch (e) {}
  };

  // Add new sheet tab to cloud
  const handleCreateNewTab = async () => {
    const trimmed = newTabInput.trim();
    if (!trimmed) {
      setIsAddingTab(false);
      return;
    }
    const updated = await addCloudTab(trimmed);
    setSheetTabs(updated);
    handleSelectTab(trimmed);
    setNewTabInput('');
    setIsAddingTab(false);
  };

  // Delete sheet tab from cloud
  const handleDeleteTab = async (tabToDelete: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la pestaña "${tabToDelete}" de la nube?`)) return;
    const updated = await deleteCloudTab(tabToDelete);
    setSheetTabs(updated);
    if (activeTab === tabToDelete) {
      handleSelectTab('Expo M (JA)');
    }
  };

  const isColCollapsed = (key: ColumnKey) => !!collapsedCols[key];

  const toggleCol = (key: ColumnKey) => {
    setCollapsedCols(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const applyPreset = (preset: 'crm' | 'stand' | 'all') => {
    const next: Record<string, boolean> = {};
    if (preset === 'crm') {
      COLUMNS.forEach(col => {
        const keep = ['nombreMadre', 'celular', 'gestCall', 'obserCalls', 'estadoCrm', 'acciones'].includes(col.key);
        next[col.key] = !keep;
      });
    } else if (preset === 'stand') {
      COLUMNS.forEach(col => {
        const keep = ['nombreMadre', 'celular', 'distrito', 'observaciones', 'timestamp', 'acciones'].includes(col.key);
        next[col.key] = !keep;
      });
    } else {
      COLUMNS.forEach(col => {
        next[col.key] = false;
      });
    }
    setCollapsedCols(next as Record<ColumnKey, boolean>);
  };

  const getLeadField = (lead: LeadData, field: keyof LeadData): any => {
    const edit = localEdits[lead.id];
    if (edit && edit[field] !== undefined) {
      return edit[field];
    }
    return lead[field];
  };

  // Resolver a qué pestaña pertenece el lead (por defecto Expo M (JA))
  const getLeadSheetTab = (lead: LeadData): string => {
    const tab = getLeadField(lead, 'sheetTab');
    return tab && tab.trim() !== '' ? tab : 'Expo M (JA)';
  };

  const getLeadHistory = (lead: LeadData): CallLogEntry[] => {
    const edit = localEdits[lead.id];
    if (edit && edit.callHistory !== undefined) {
      return edit.callHistory;
    }
    if (lead.callHistory && lead.callHistory.length > 0) {
      return lead.callHistory;
    }
    if (lead.gestCall && lead.gestCall.trim() !== '') {
      return [
        {
          id: `log-init-${lead.id}`,
          code: lead.gestCall,
          datetime: lead.timestamp || formatShortDate(),
          observation: lead.obserCalls || ''
        }
      ];
    }
    return [];
  };

  // ── 3. Save Text Field Handler (Cloud Firestore + LocalStorage) ────────────
  const handleSaveField = useCallback(async (leadId: string, field: keyof LeadData, value: string) => {
    setLocalEdits(prev => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || {}),
        [field]: value
      }
    }));

    const target = leads.find(l => l.id === leadId);
    if (target) {
      const updatedLead: LeadData = {
        ...target,
        [field]: value
      };
      onUpdateLead(updatedLead);
    }

    try {
      await updateCloudLeadField(leadId, field, value);
    } catch (err) {
      console.warn(`Error actualizando campo en la nube para el lead ${leadId}:`, err);
    }
  }, [leads, onUpdateLead]);

  // ── Traspasar un Lead a otra Pestaña ─────────────────────────────────────────
  const handleMoveLeadToTab = useCallback(async (leadId: string, newTab: string) => {
    await handleSaveField(leadId, 'sheetTab', newTab);
  }, [handleSaveField]);

  // ── 4. Registrar Gestión Call con Fecha y Hora y sincronizar Historial en Nube ─
  const handleRegisterCallLog = useCallback(async (leadId: string, code: string, observation?: string) => {
    const target = leads.find(l => l.id === leadId);
    if (!target) return;

    const shortDatetime = formatShortDate();
    const opt = CALL_STATUS_OPTIONS.find(o => o.code === code);
    const label = opt?.label || code;
    const currentObs = observation !== undefined ? observation : (getLeadField(target, 'obserCalls') || '');

    const newEntry: CallLogEntry = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      label,
      datetime: shortDatetime,
      observation: currentObs
    };

    const currentLeadState: LeadData = {
      ...target,
      ...(localEdits[leadId] || {})
    };

    try {
      const updatedLead = await addCloudCallLog(currentLeadState, newEntry);
      setLocalEdits(prev => ({
        ...prev,
        [leadId]: {
          ...(prev[leadId] || {}),
          gestCall: code,
          obserCalls: currentObs,
          callHistory: updatedLead.callHistory,
          estadoCrm: updatedLead.estadoCrm
        }
      }));
      onUpdateLead(updatedLead);
    } catch (err) {
      console.warn(`Error actualizando historial de llamada en la nube:`, err);
    }
  }, [leads, localEdits, onUpdateLead]);

  // ── 5. Eliminar Entrada Individual del Historial en la Nube ─────────────────
  const handleDeleteLog = useCallback(async (leadId: string, logId: string) => {
    const target = leads.find(l => l.id === leadId);
    if (!target) return;

    const currentLeadState: LeadData = {
      ...target,
      ...(localEdits[leadId] || {})
    };

    try {
      const updatedLead = await deleteCloudCallLog(currentLeadState, logId);
      setLocalEdits(prev => ({
        ...prev,
        [leadId]: {
          ...(prev[leadId] || {}),
          gestCall: updatedLead.gestCall,
          obserCalls: updatedLead.obserCalls,
          callHistory: updatedLead.callHistory
        }
      }));
      onUpdateLead(updatedLead);
    } catch (err) {
      console.warn('Error eliminando log de llamada en la nube:', err);
    }
  }, [leads, localEdits, onUpdateLead]);

  // ── 6. Limpiar Registros NC de un Lead en la Nube ───────────────────────────
  const handleClearNC = useCallback(async (leadId: string) => {
    const target = leads.find(l => l.id === leadId);
    if (!target) return;

    const currentLeadState: LeadData = {
      ...target,
      ...(localEdits[leadId] || {})
    };

    try {
      const updatedLead = await clearCloudNCLogs(currentLeadState);
      setLocalEdits(prev => ({
        ...prev,
        [leadId]: {
          ...(prev[leadId] || {}),
          gestCall: updatedLead.gestCall,
          obserCalls: updatedLead.obserCalls,
          callHistory: updatedLead.callHistory
        }
      }));
      onUpdateLead(updatedLead);
    } catch (err) {
      console.warn('Error limpiando registros NC en la nube:', err);
    }
  }, [leads, localEdits, onUpdateLead]);

  const handleUpdateStatus = async (leadId: string, newStatus: LeadData['estadoCrm']) => {
    await handleSaveField(leadId, 'estadoCrm', newStatus as string);
  };

  const handleDelete = async (leadId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este prospecto permanentemente de la nube?')) return;
    try {
      await deleteCloudLead(leadId);
    } catch (e) {
      console.warn('Error al borrar en la nube:', e);
    }
    setLocalEdits(prev => {
      const next = { ...prev };
      delete next[leadId];
      return next;
    });
    onDeleteLead(leadId);
  };

  const distritos = Array.from(new Set(leads.map(l => l.distrito).filter(Boolean)));

  // Filtrado de leads por pestaña activa + búsqueda + distrito
  const filteredLeads = leads.filter(lead => {
    const leadTab = getLeadSheetTab(lead);

    // Filtrar por pestaña activa (a menos que sea '__ALL__')
    if (activeTab !== '__ALL__' && leadTab !== activeTab) {
      return false;
    }

    const term = searchTerm.toLowerCase();
    const nombre = (getLeadField(lead, 'nombreMadre') || '').toLowerCase();
    const celular = (getLeadField(lead, 'celular') || '');
    const distrito = (getLeadField(lead, 'distrito') || '').toLowerCase();
    const obs = (getLeadField(lead, 'observaciones') || '').toLowerCase();
    const gest = (getLeadField(lead, 'gestCall') || '').toLowerCase();
    const obsCall = (getLeadField(lead, 'obserCalls') || '').toLowerCase();

    const matchSearch =
      nombre.includes(term) ||
      celular.includes(term) ||
      distrito.includes(term) ||
      obs.includes(term) ||
      gest.includes(term) ||
      obsCall.includes(term);

    const matchDistrito = filterDistrito === 'todos' || lead.distrito === filterDistrito;
    return matchSearch && matchDistrito;
  });

  // Conteo de leads por pestaña
  const getTabCount = (tabName: string): number => {
    return leads.filter(l => getLeadSheetTab(l) === tabName).length;
  };

  const exportCSV = () => {
    if (filteredLeads.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'ID,Pestana,Nombre Madre,Celular,Gestion Call,Observaciones Calls,Distrito,Observaciones Stand,Estado CRM,Fecha,Edad Hijos,Nivel Preocupacion,Conocimiento Dano,Pregunta Condicional,Respuesta Condicional,Interes Solucion\n';

    filteredLeads.forEach(l => {
      const row = [
        `"${l.id}"`,
        `"${getLeadSheetTab(l)}"`,
        `"${(getLeadField(l, 'nombreMadre') || '').replace(/"/g, '""')}"`,
        `"${getLeadField(l, 'celular') || ''}"`,
        `"${(getLeadField(l, 'gestCall') || '').replace(/"/g, '""')}"`,
        `"${(getLeadField(l, 'obserCalls') || '').replace(/"/g, '""')}"`,
        `"${(getLeadField(l, 'distrito') || '').replace(/"/g, '""')}"`,
        `"${(getLeadField(l, 'observaciones') || '').replace(/"/g, '""')}"`,
        `"${getLeadField(l, 'estadoCrm') || 'nuevo'}"`,
        `"${l.timestamp || ''}"`,
        `"${l.edadHijos || ''}"`,
        `"${l.nivelPreocupacion || ''}"`,
        `"${(l.conocimientoDano || '').replace(/"/g, '""')}"`,
        `"${(l.preguntaCondicional || '').replace(/"/g, '""')}"`,
        `"${(l.respuestaCondicional || '').replace(/"/g, '""')}"`,
        `"${l.interesSolucion || ''}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const tabSuffix = activeTab === '__ALL__' ? 'Todas_Pestanas' : activeTab.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `Leads_${tabSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const crmStages: { key: LeadData['estadoCrm']; label: string; count: number; color: string }[] = [
    { key: 'nuevo', label: '📥 Nuevos Leads', count: filteredLeads.filter(l => (getLeadField(l, 'estadoCrm') || 'nuevo') === 'nuevo').length, color: '#4A90E2' },
    { key: 'contactado', label: '📞 Contactados', count: filteredLeads.filter(l => getLeadField(l, 'estadoCrm') === 'contactado').length, color: '#F59E0B' },
    { key: 'demo_agendada', label: '📅 Demo Agendada', count: filteredLeads.filter(l => getLeadField(l, 'estadoCrm') === 'demo_agendada').length, color: '#8B5CF6' },
    { key: 'ganado', label: '🏆 Ventas Cerradas', count: filteredLeads.filter(l => getLeadField(l, 'estadoCrm') === 'ganado').length, color: '#10B981' },
    { key: 'descartado', label: '🚫 Descartados', count: filteredLeads.filter(l => getLeadField(l, 'estadoCrm') === 'descartado').length, color: '#EF4444' }
  ];

  const collapsedCount = Object.values(collapsedCols).filter(Boolean).length;

  return (
    <div className="admin-panel-container" style={{ paddingBottom: '0', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header Row ────────────────────────────────────────────────────── */}
      <div className="admin-header-row" style={{ marginBottom: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              🚀 Zentry CRM
            </h2>
            <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #BFDBFE' }}>
              {activeTab === '__ALL__' ? 'Todas' : activeTab} ({filteredLeads.length})
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', background: '#E2E8F0', padding: '2px', borderRadius: '8px' }}>
            <button
              onClick={() => setViewMode('spreadsheet')}
              style={{
                border: 'none',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.78rem',
                background: viewMode === 'spreadsheet' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'spreadsheet' ? '#2563EB' : '#64748B',
                boxShadow: viewMode === 'spreadsheet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Icons.Table />
              <span>Spreadsheet</span>
            </button>
            <button
              onClick={() => setViewMode('crm')}
              style={{
                border: 'none',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.78rem',
                background: viewMode === 'crm' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'crm' ? '#2563EB' : '#64748B',
                boxShadow: viewMode === 'crm' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Icons.Kanban />
              <span>Kanban</span>
            </button>
          </div>

          {/* Toggle Expand all texts button */}
          {viewMode === 'spreadsheet' && (
            <button
              onClick={() => setExpandAllTexts(!expandAllTexts)}
              style={{
                background: expandAllTexts ? '#EFF6FF' : '#FFFFFF',
                color: '#2563EB',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={expandAllTexts ? 'Contraer textos' : 'Expandir textos'}
            >
              {expandAllTexts ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
              <span>{expandAllTexts ? 'Contraer' : 'Expandir'}</span>
            </button>
          )}

          <button
            onClick={exportCSV}
            style={{
              background: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Exportar CSV"
          >
            <Icons.Download />
            <span>CSV</span>
          </button>

          <a
            href="https://docs.google.com/spreadsheets/d/1AM2PYEB8LbqvFU2QUSbmpaKdJDYqtuXN-dm5DApmouk/edit?gid=0#gid=0"
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#FFFFFF',
              color: '#10B981',
              border: '1px solid #86EFAC',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '0.78rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Abrir Google Sheets Oficial"
          >
            <Icons.ExternalLink />
            <span>Sheets</span>
          </a>

          <button
            onClick={onClose}
            style={{
              background: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 5px rgba(37,99,235,0.25)'
            }}
            title="Volver a la herramienta de prospección"
          >
            <Icons.ArrowLeft />
            <span>Prospecc</span>
          </button>
        </div>
      </div>

      {/* ── Filter & Columns Toolbar ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <div style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }}>
            <Icons.Search />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Buscar en ${activeTab === '__ALL__' ? 'todas las pestañas' : activeTab}...`}
            style={{
              width: '100%',
              padding: '8px 10px 8px 34px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              outline: 'none',
              fontSize: '0.85rem'
            }}
          />
        </div>

        {/* District Filter */}
        <select
          value={filterDistrito}
          onChange={(e) => setFilterDistrito(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            outline: 'none',
            fontSize: '0.85rem',
            background: 'white'
          }}
        >
          <option value="todos">Todos los Distritos ({distritos.length})</option>
          {distritos.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Column Visibility Menu */}
        {viewMode === 'spreadsheet' && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsColMenuOpen(!isColMenuOpen)}
              style={{
                background: collapsedCount > 0 ? '#EFF6FF' : '#FFFFFF',
                color: collapsedCount > 0 ? '#2563EB' : '#475569',
                border: `1.5px solid ${collapsedCount > 0 ? '#93C5FD' : '#CBD5E1'}`,
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Ocultar o mostrar columnas de la tabla (como en Excel)"
            >
              <Icons.Columns />
              <span>Columnas {collapsedCount > 0 ? `(${15 - collapsedCount}/15)` : ''}</span>
              <Icons.ChevronDown />
            </button>

            {/* Dropdown Menu */}
            {isColMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  background: 'white',
                  borderRadius: '10px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                  border: '1px solid #E2E8F0',
                  padding: '12px',
                  zIndex: 50,
                  minWidth: '240px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1E293B' }}>Columnas Visibles</span>
                  <button
                    type="button"
                    onClick={() => setIsColMenuOpen(false)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', fontSize: '0.8rem' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Presets */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={() => applyPreset('crm')}
                    style={{ flex: 1, padding: '4px', fontSize: '0.7rem', fontWeight: 600, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Solo CRM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('stand')}
                    style={{ flex: 1, padding: '4px', fontSize: '0.7rem', fontWeight: 600, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Solo Stand
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    style={{ flex: 1, padding: '4px', fontSize: '0.7rem', fontWeight: 600, background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Ver Todo
                  </button>
                </div>

                {/* List of individual columns */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {COLUMNS.map(col => {
                    const isHidden = isColCollapsed(col.key);
                    return (
                      <label
                        key={col.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          background: isHidden ? '#F8FAFC' : 'white',
                          color: isHidden ? '#94A3B8' : '#1E293B',
                          userSelect: 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={() => toggleCol(col.key)}
                          style={{ cursor: 'pointer', accentColor: '#2563EB' }}
                        />
                        <span>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── VIEW 1: SPREADSHEET TABLE ─────────────────────────────────────── */}
      {viewMode === 'spreadsheet' && (
        <div style={{ background: 'white', borderRadius: '12px 12px 0 0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflowX: 'auto', flex: 1, borderBottom: '1px solid #E2E8F0' }}>
          <table className="spreadsheet-table" style={{ width: '100%', minWidth: '100%', borderRadius: 0 }}>
            <thead>
              <tr>
                {COLUMNS.map(col => {
                  const isHidden = isColCollapsed(col.key);

                  if (isHidden) {
                    return (
                      <th
                        key={col.key}
                        onClick={() => toggleCol(col.key)}
                        style={{
                          width: '28px',
                          minWidth: '28px',
                          maxWidth: '32px',
                          padding: '8px 2px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: '#F1F5F9',
                          borderLeft: '2px solid #CBD5E1',
                          borderRight: '2px solid #CBD5E1',
                          color: '#2563EB'
                        }}
                        title={`Expandir columna: ${col.label} (clic para ver)`}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <Icons.PlusSquare />
                        </div>
                      </th>
                    );
                  }

                  return (
                    <th
                      key={col.key}
                      style={{
                        minWidth: col.minWidth || '120px',
                        background: col.headerBg || '#F8FAFC',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span>{col.label}</span>
                        {col.key !== 'acciones' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCol(col.key);
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: '#94A3B8',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            title={`Retraer columna ${col.label}`}
                          >
                            <Icons.MinusSquare />
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No hay prospectos en la pestaña "{activeTab === '__ALL__' ? 'Todas' : activeTab}".</div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '4px' }}>
                      Puedes registrar nuevos leads con el formulario seleccionando esta pestaña o mover prospectos desde otra pestaña.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const cleanPhone = (getLeadField(lead, 'celular') || '').replace(/\D/g, '');
                  const waUrl = `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola ${getLeadField(lead, 'nombreMadre')}, te saluda el equipo de ZentryOS. Un gusto saludarte tras la Expo Maternidad.`)}`;

                  const currentGestCall = getLeadField(lead, 'gestCall') || '';
                  const currentObserCalls = getLeadField(lead, 'obserCalls') || '';
                  const leadHistory = getLeadHistory(lead);
                  const leadTab = getLeadSheetTab(lead);

                  return (
                    <tr key={lead.id}>
                      {/* 1. Nombre Madre + Selector de Pestaña para traspaso */}
                      {isColCollapsed('nombreMadre') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td style={{ verticalAlign: 'top' }}>
                          <EditableCell
                            leadId={lead.id}
                            field="nombreMadre"
                            value={getLeadField(lead, 'nombreMadre')}
                            onSave={handleSaveField}
                            maxChars={25}
                            forceExpandAll={expandAllTexts}
                            fullWidth={false}
                            placeholder="Nombre de la madre..."
                            style={{ fontWeight: 600, color: '#1E293B' }}
                          />
                          {/* Mini Selector de Pestaña para traspasar el lead */}
                          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Pestaña:</span>
                            <select
                              value={leadTab}
                              onChange={(e) => handleMoveLeadToTab(lead.id, e.target.value)}
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 4px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                background: '#F8FAFC',
                                color: '#2563EB',
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                              title="Traspasar este lead a otra pestaña"
                            >
                              {sheetTabs.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      )}

                      {/* 2. Celular / WhatsApp */}
                      {isColCollapsed('celular') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.88rem' }}>
                              {getLeadField(lead, 'celular')}
                            </span>
                            {cleanPhone && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#10B981', display: 'inline-flex' }}
                                title="Chat WhatsApp"
                              >
                                <Icons.MessageCircle />
                              </a>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 3. Gestión Call (Selector minimalista + Botón Check + Historial 1/2 clics) */}
                      {isColCollapsed('gestCall') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td style={{ background: '#EFF6FF', verticalAlign: 'middle' }}>
                          <GestCallCell
                            lead={lead}
                            currentCode={currentGestCall}
                            history={leadHistory}
                            onConfirmCode={(code) => handleRegisterCallLog(lead.id, code)}
                            onOpenHistory={(targetLead, mode) => {
                              setActiveHistoryModal({ lead: targetLead, mode });
                            }}
                          />
                        </td>
                      )}

                      {/* 4. Observaciones Calls */}
                      {isColCollapsed('obserCalls') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td style={{ background: '#F8FAFC', verticalAlign: 'top' }}>
                          <EditableCell
                            leadId={lead.id}
                            field="obserCalls"
                            value={currentObserCalls}
                            onSave={async (lid, f, val) => {
                              await handleSaveField(lid, f, val);
                              const targetLead = leads.find(l => l.id === lid);
                              if (targetLead) {
                                const hist = getLeadHistory(targetLead);
                                if (hist.length > 0) {
                                  hist[0].observation = val;
                                  setLocalEdits(prev => ({
                                    ...prev,
                                    [lid]: {
                                      ...(prev[lid] || {}),
                                      callHistory: [...hist]
                                    }
                                  }));
                                  try {
                                    await updateDoc(doc(db, LEADS_COLLECTION, lid), {
                                      callHistory: hist
                                    });
                                  } catch (e) {}
                                }
                              }
                            }}
                            style={{ color: '#0F766E', fontSize: '0.82rem' }}
                            maxChars={100}
                            forceExpandAll={expandAllTexts}
                            fullWidth={true}
                            placeholder="Observaciones de la llamada..."
                          />
                        </td>
                      )}

                      {/* 5. Distrito */}
                      {isColCollapsed('distrito') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td>
                          <EditableCell
                            leadId={lead.id}
                            field="distrito"
                            value={getLeadField(lead, 'distrito')}
                            onSave={handleSaveField}
                            maxChars={20}
                            forceExpandAll={expandAllTexts}
                            fullWidth={false}
                            placeholder="Distrito..."
                          />
                        </td>
                      )}

                      {/* 6. Observaciones Stand */}
                      {isColCollapsed('observaciones') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td style={{ verticalAlign: 'top' }}>
                          <EditableCell
                            leadId={lead.id}
                            field="observaciones"
                            value={getLeadField(lead, 'observaciones')}
                            onSave={handleSaveField}
                            style={{ fontStyle: 'italic', color: '#475569' }}
                            maxChars={100}
                            forceExpandAll={expandAllTexts}
                            fullWidth={true}
                            placeholder="Observaciones del stand..."
                          />
                        </td>
                      )}

                      {/* 7. Estado CRM */}
                      {isColCollapsed('estadoCrm') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td>
                          <select
                            value={getLeadField(lead, 'estadoCrm') || 'nuevo'}
                            onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadData['estadoCrm'])}
                            style={{
                              fontSize: '0.75rem',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#F8FAFC',
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="nuevo">📥 Nuevo</option>
                            <option value="contactado">📞 Contactado</option>
                            <option value="demo_agendada">📅 Demo Agendada</option>
                            <option value="ganado">🏆 Ganado</option>
                            <option value="descartado">🚫 Descartado</option>
                          </select>
                        </td>
                      )}

                      {/* 8. Fecha */}
                      {isColCollapsed('timestamp') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#64748B' }}>
                          {lead.timestamp}
                        </td>
                      )}

                      {/* 9. Edad Hijos */}
                      {isColCollapsed('edadHijos') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: lead.edadHijos?.includes('Menores') ? '#EFF6FF' : (lead.edadHijos?.includes('Mayores') ? '#FDF2F8' : '#F0FDF4'),
                              color: lead.edadHijos?.includes('Menores') ? '#2563EB' : (lead.edadHijos?.includes('Mayores') ? '#DB2777' : '#16A34A'),
                              fontWeight: 600
                            }}
                          >
                            {lead.edadHijos}
                          </span>
                        </td>
                      )}

                      {/* 10. Nivel Preocupación */}
                      {isColCollapsed('nivelPreocupacion') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td style={{ textAlign: 'center', fontWeight: 700, color: Number(lead.nivelPreocupacion) >= 8 ? '#EF4444' : '#F59E0B' }}>
                          {lead.nivelPreocupacion}
                        </td>
                      )}

                      {/* 11. Conocimiento Daño */}
                      {isColCollapsed('conocimientoDano') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td>
                          <ExpandableText
                            text={lead.conocimientoDano}
                            maxChars={35}
                            forceExpandAll={expandAllTexts}
                            fullWidth={true}
                          />
                        </td>
                      )}

                      {/* 12. Pregunta Condicional */}
                      {isColCollapsed('preguntaCondicional') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td>
                          <ExpandableText
                            text={lead.preguntaCondicional}
                            maxChars={35}
                            forceExpandAll={expandAllTexts}
                            fullWidth={true}
                            style={{ color: '#64748B' }}
                          />
                        </td>
                      )}

                      {/* 13. Respuesta Condicional */}
                      {isColCollapsed('respuestaCondicional') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td>
                          <ExpandableText
                            text={lead.respuestaCondicional}
                            maxChars={25}
                            forceExpandAll={expandAllTexts}
                            fullWidth={true}
                            style={{ fontWeight: 500 }}
                          />
                        </td>
                      )}

                      {/* 14. Interés Solución */}
                      {isColCollapsed('interesSolucion') ? (
                        <td style={{ background: '#F8FAFC', textAlign: 'center', borderLeft: '2px solid #CBD5E1', borderRight: '2px solid #CBD5E1', padding: '4px 0' }} />
                      ) : (
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: lead.interesSolucion === 'Sí' || lead.interesSolucion === 'Si' ? '#16A34A' : '#DC2626'
                            }}
                          >
                            {lead.interesSolucion}
                          </span>
                        </td>
                      )}

                      {/* 15. Acciones */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleDelete(lead.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#EF4444',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          title="Eliminar Lead"
                        >
                          <Icons.Trash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VIEW 2: CRM KANBAN PIPELINE ───────────────────────────────────── */}
      {viewMode === 'crm' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', flex: 1, overflowY: 'auto' }}>
          {crmStages.map(stage => {
            const stageLeads = filteredLeads.filter(l => (getLeadField(l, 'estadoCrm') || 'nuevo') === stage.key);
            return (
              <div
                key={stage.key}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: `1.5px solid #E2E8F0`,
                  borderTop: `4px solid ${stage.color}`,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '75vh'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E293B' }}>{stage.label}</span>
                  <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                    {stageLeads.length}
                  </span>
                </div>

                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {stageLeads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94A3B8', fontSize: '0.8rem', border: '1px dashed #E2E8F0', borderRadius: '8px' }}>
                      Sin prospectos
                    </div>
                  ) : (
                    stageLeads.map(lead => {
                      const cleanPhone = (getLeadField(lead, 'celular') || '').replace(/\D/g, '');
                      const waUrl = `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola ${getLeadField(lead, 'nombreMadre')}, te saluda el equipo de ZentryOS. Te contactamos sobre lo conversado en la Expo Maternidad.`)}`;

                      const gestCallVal = getLeadField(lead, 'gestCall');
                      const gestOpt = CALL_STATUS_OPTIONS.find(o => o.code === gestCallVal || o.label === gestCallVal);
                      const leadTab = getLeadSheetTab(lead);

                      return (
                        <div
                          key={lead.id}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <strong style={{ fontSize: '0.88rem', color: '#0F172A', display: 'block' }}>{getLeadField(lead, 'nombreMadre')}</strong>
                              <span style={{ fontSize: '0.68rem', color: '#2563EB', fontWeight: 700 }}>📂 {leadTab}</span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 700 }}>Dolor: {lead.nivelPreocupacion}/10</span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            <div>📍 {getLeadField(lead, 'distrito')} • 👶 {lead.edadHijos}</div>
                            <div style={{ marginTop: '2px' }}>📞 {getLeadField(lead, 'celular')}</div>
                          </div>

                          {getLeadField(lead, 'observaciones') && (
                            <div style={{ fontSize: '0.75rem', color: '#475569', background: '#FFFFFF', padding: '5px', borderRadius: '4px', border: '1px solid #F1F5F9' }}>
                              <ExpandableText text={getLeadField(lead, 'observaciones')} maxChars={35} style={{ fontStyle: 'italic' }} />
                            </div>
                          )}

                          {gestCallVal && (
                            <div style={{ fontSize: '0.75rem', color: '#2563EB', background: '#EFF6FF', padding: '5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Icons.Phone />
                              <span>Gestión: <strong>{gestOpt ? `${gestOpt.code} (${gestOpt.label})` : gestCallVal}</strong></span>
                            </div>
                          )}

                          {getLeadField(lead, 'obserCalls') && (
                            <div style={{ fontSize: '0.75rem', color: '#0F766E', background: '#F0FDFA', padding: '5px', borderRadius: '4px' }}>
                              💡 <ExpandableText text={getLeadField(lead, 'obserCalls')} maxChars={35} />
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>
                            {cleanPhone && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: '#10B981',
                                  color: 'white',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Icons.MessageCircle />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            <select
                              value={getLeadField(lead, 'estadoCrm') || 'nuevo'}
                              onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadData['estadoCrm'])}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                background: 'white'
                              }}
                            >
                              <option value="nuevo">Nuevo</option>
                              <option value="contactado">Contactado</option>
                              <option value="demo_agendada">Demo</option>
                              <option value="ganado">Ganado</option>
                              <option value="descartado">Descartar</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BARRA INFERIOR DE PESTAÑAS (Estilo Google Sheets / Excel) ──────── */}
      <div
        style={{
          background: '#E2E8F0',
          borderTop: '1px solid #CBD5E1',
          padding: '6px 12px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          position: 'sticky',
          bottom: 0,
          zIndex: 40,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}
      >
        {/* Pestañas a la izquierda */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', overflowX: 'auto', flex: 1, paddingBottom: '0' }}>
          {sheetTabs.map((tab) => {
            const isActive = activeTab === tab;
            const count = getTabCount(tab);
            const isCustom = !['Expo M (JA)', 'Expo M (R)'].includes(tab);
            return (
              <div
                key={tab}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: isActive ? '#FFFFFF' : '#E2E8F0',
                  border: '1px solid #CBD5E1',
                  borderBottom: isActive ? '3px solid #10B981' : 'none',
                  borderRadius: '6px 6px 0 0',
                  boxShadow: isActive ? '0 -2px 6px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectTab(tab)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: isActive ? '#0F172A' : '#64748B',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '0.8rem',
                    padding: '7px 10px 7px 12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                  title={`Ver prospectos de la pestaña ${tab}`}
                >
                  <span>📊 {tab}</span>
                  <span
                    style={{
                      background: isActive ? '#10B981' : '#CBD5E1',
                      color: isActive ? 'white' : '#475569',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}
                  >
                    {count}
                  </span>
                </button>
                {isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTab(tab);
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px 6px 4px 2px',
                      fontSize: '0.72rem',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.7
                    }}
                    title={`Eliminar pestaña "${tab}" de la nube`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {/* Botón "+ Agregar pestaña" */}
          {isAddingTab ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FFFFFF', padding: '4px 8px', borderRadius: '6px 6px 0 0', border: '1.5px solid #2563EB', borderBottom: 'none' }}>
              <input
                type="text"
                value={newTabInput}
                onChange={(e) => setNewTabInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNewTab();
                  if (e.key === 'Escape') setIsAddingTab(false);
                }}
                placeholder="Nombre pestaña..."
                autoFocus
                style={{ fontSize: '0.78rem', padding: '3px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', outline: 'none', width: '130px' }}
              />
              <button
                type="button"
                onClick={handleCreateNewTab}
                style={{ border: 'none', background: '#10B981', color: 'white', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setIsAddingTab(false)}
                style={{ border: 'none', background: '#94A3B8', color: 'white', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', fontSize: '0.72rem' }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingTab(true)}
              style={{
                border: '1px dashed #94A3B8',
                borderBottom: 'none',
                borderRadius: '6px 6px 0 0',
                background: '#F1F5F9',
                color: '#2563EB',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
              title="Añadir una nueva pestaña / evento"
            >
              <Icons.Plus />
              <span>Nueva Pestaña</span>
            </button>
          )}

          {/* Opción para ver todas las pestañas juntas */}
          <button
            type="button"
            onClick={() => handleSelectTab('__ALL__')}
            style={{
              border: '1px solid #CBD5E1',
              borderBottom: activeTab === '__ALL__' ? '3px solid #2563EB' : 'none',
              borderRadius: '6px 6px 0 0',
              background: activeTab === '__ALL__' ? '#FFFFFF' : '#E2E8F0',
              color: activeTab === '__ALL__' ? '#2563EB' : '#64748B',
              fontWeight: activeTab === '__ALL__' ? 800 : 600,
              fontSize: '0.75rem',
              padding: '7px 10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              marginLeft: '8px'
            }}
            title="Ver todos los leads combinados de todas las pestañas"
          >
            <span>Ver Todo ({leads.length})</span>
          </button>
        </div>

        {/* Resumen a la derecha */}
        <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, paddingBottom: '6px', whiteSpace: 'nowrap' }}>
          {activeTab === '__ALL__' ? 'Mostrando todo el registro' : `Pestaña activa: ${activeTab}`}
        </div>
      </div>

      {/* ── Modal Emergente de Historial de Llamadas ──────────────────────── */}
      {activeHistoryModal && (
        <CallHistoryModal
          lead={activeHistoryModal.lead}
          mode={activeHistoryModal.mode}
          history={getLeadHistory(activeHistoryModal.lead)}
          onClose={() => setActiveHistoryModal(null)}
          onSetMode={(m) => setActiveHistoryModal(prev => prev ? { ...prev, mode: m } : null)}
          onAddNewLog={async (code, obs) => {
            await handleRegisterCallLog(activeHistoryModal.lead.id, code, obs);
          }}
          onDeleteLog={async (logId) => {
            await handleDeleteLog(activeHistoryModal.lead.id, logId);
          }}
          onClearNC={async () => {
            await handleClearNC(activeHistoryModal.lead.id);
          }}
        />
      )}
    </div>
  );
};
