import React, { useState } from 'react';
import { LeadData } from '../data/realLeads';
import { db, doc, deleteDoc, updateDoc, LEADS_COLLECTION } from '../firebase';

interface Props {
  leads: LeadData[];
  onClose: () => void;
  onUpdateLead: (lead: LeadData) => void;
  onDeleteLead: (leadId: string) => void;
}

// Inline Lightweight SVGs
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  )
};

// Component for expandable text with down arrow button
const ExpandableText: React.FC<{ 
  text?: string; 
  maxChars?: number; 
  className?: string; 
  style?: React.CSSProperties;
  forceExpandAll?: boolean;
}> = ({
  text = '',
  maxChars = 32,
  className = '',
  style = {},
  forceExpandAll = false
}) => {
  const [localExpanded, setLocalExpanded] = useState<boolean>(false);

  if (!text || text.trim() === '' || text === '-') {
    return <span style={{ color: '#94A3B8' }}>-</span>;
  }

  const isExpanded = forceExpandAll || localExpanded;
  const isLong = text.length > maxChars;

  return (
    <div style={{ ...style, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '100%' }} className={className}>
      <span style={{ 
        whiteSpace: isExpanded ? 'normal' : 'nowrap', 
        overflow: isExpanded ? 'visible' : 'hidden', 
        textOverflow: isExpanded ? 'clip' : 'ellipsis',
        maxWidth: isExpanded ? '320px' : '200px',
        lineHeight: '1.45',
        wordBreak: isExpanded ? 'break-word' : 'normal',
        fontSize: '0.85rem'
      }}>
        {isExpanded ? text : (isLong ? `${text.slice(0, maxChars)}...` : text)}
      </span>
      {isLong && !forceExpandAll && (
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

export const OriginalAdmin: React.FC<Props> = ({ leads, onClose, onUpdateLead, onDeleteLead }) => {
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'crm'>('spreadsheet');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDistrito, setFilterDistrito] = useState<string>('todos');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [expandAllTexts, setExpandAllTexts] = useState<boolean>(false);

  // Extract unique districts
  const distritos = Array.from(new Set(leads.map(l => l.distrito).filter(Boolean)));

  const filteredLeads = leads.filter(lead => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      (lead.nombreMadre || '').toLowerCase().includes(term) ||
      (lead.celular || '').includes(term) ||
      (lead.distrito || '').toLowerCase().includes(term) ||
      (lead.observaciones || '').toLowerCase().includes(term) ||
      (lead.gestCall || '').toLowerCase().includes(term) ||
      (lead.obserCalls || '').toLowerCase().includes(term) ||
      (lead.conocimientoDano || '').toLowerCase().includes(term);

    const matchDistrito = filterDistrito === 'todos' || lead.distrito === filterDistrito;
    return matchSearch && matchDistrito;
  });

  const handleDelete = async (leadId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este lead?')) return;
    try {
      await deleteDoc(doc(db, LEADS_COLLECTION, leadId));
    } catch (e) {
      console.warn('Error al borrar en Firestore:', e);
    }
    onDeleteLead(leadId);
  };

  const handleUpdateStatus = async (leadId: string, newStatus: LeadData['estadoCrm']) => {
    const target = leads.find(l => l.id === leadId);
    if (!target) return;
    const updated: LeadData = { ...target, estadoCrm: newStatus };
    try {
      await updateDoc(doc(db, LEADS_COLLECTION, leadId), { estadoCrm: newStatus });
    } catch (e) {
      console.warn('Error actualizando estado:', e);
    }
    onUpdateLead(updated);
  };

  const handleSaveNotes = async (leadId: string) => {
    const target = leads.find(l => l.id === leadId);
    if (!target) return;
    const updated: LeadData = { ...target, gestCall: tempNotes };
    try {
      await updateDoc(doc(db, LEADS_COLLECTION, leadId), { gestCall: tempNotes });
    } catch (e) {
      console.warn('Error guardando notas:', e);
    }
    onUpdateLead(updated);
    setEditingNotesId(null);
  };

  const exportCSV = () => {
    if (leads.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,Fecha,Nivel Preocupacion,Conocimiento Dano,Edad Hijos,Pregunta Condicional,Respuesta Condicional,Interes Solucion,Nombre Madre,Celular,Distrito,Observaciones,Gestion Call,Observaciones Calls,Estado CRM\n";

    leads.forEach(l => {
      const row = [
        `"${l.id}"`,
        `"${l.timestamp || ''}"`,
        `"${l.nivelPreocupacion || ''}"`,
        `"${(l.conocimientoDano || '').replace(/"/g, '""')}"`,
        `"${l.edadHijos || ''}"`,
        `"${(l.preguntaCondicional || '').replace(/"/g, '""')}"`,
        `"${(l.respuestaCondicional || '').replace(/"/g, '""')}"`,
        `"${l.interesSolucion || ''}"`,
        `"${(l.nombreMadre || '').replace(/"/g, '""')}"`,
        `"${l.celular || ''}"`,
        `"${(l.distrito || '').replace(/"/g, '""')}"`,
        `"${(l.observaciones || '').replace(/"/g, '""')}"`,
        `"${(l.gestCall || '').replace(/"/g, '""')}"`,
        `"${(l.obserCalls || '').replace(/"/g, '""')}"`,
        `"${l.estadoCrm || 'nuevo'}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Leads_ExpoMaternidad_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const crmStages: { key: LeadData['estadoCrm']; label: string; count: number; color: string }[] = [
    { key: 'nuevo', label: '📥 Nuevos Leads', count: leads.filter(l => (l.estadoCrm || 'nuevo') === 'nuevo').length, color: '#4A90E2' },
    { key: 'contactado', label: '📞 Contactados', count: leads.filter(l => l.estadoCrm === 'contactado').length, color: '#F59E0B' },
    { key: 'demo_agendada', label: '📅 Demo Agendada', count: leads.filter(l => l.estadoCrm === 'demo_agendada').length, color: '#8B5CF6' },
    { key: 'ganado', label: '🏆 Ventas Cerradas', count: leads.filter(l => l.estadoCrm === 'ganado').length, color: '#10B981' },
    { key: 'descartado', label: '🚫 Descartados', count: leads.filter(l => l.estadoCrm === 'descartado').length, color: '#EF4444' }
  ];

  return (
    <div className="admin-panel-container">
      {/* Top Header */}
      <div className="admin-header-row">
        <div>
          <h2>Panel de Administración • Leads_ExpoMaternidad</h2>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
            Base de datos oficial y gestión comercial del evento Expo Maternidad ({leads.length} leads registrados).
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', background: '#E2E8F0', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setViewMode('spreadsheet')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                background: viewMode === 'spreadsheet' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'spreadsheet' ? '#4A90E2' : '#64748B',
                boxShadow: viewMode === 'spreadsheet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Icons.Table />
              <span>Spreadsheet</span>
            </button>
            <button
              onClick={() => setViewMode('crm')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                background: viewMode === 'crm' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'crm' ? '#4A90E2' : '#64748B',
                boxShadow: viewMode === 'crm' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Icons.Kanban />
              <span>CRM Pipeline</span>
            </button>
          </div>

          {/* Toggle Expand all texts button */}
          {viewMode === 'spreadsheet' && (
            <button
              onClick={() => setExpandAllTexts(!expandAllTexts)}
              style={{
                background: expandAllTexts ? '#EFF6FF' : '#FFFFFF',
                color: '#2563EB',
                border: '1.5px solid #93C5FD',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Expandir o contraer todos los textos largos de la tabla"
            >
              {expandAllTexts ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
              <span>{expandAllTexts ? 'Contraer Todo' : 'Expandir Todo'}</span>
            </button>
          )}

          <button
            onClick={exportCSV}
            style={{
              background: '#FFFFFF',
              color: '#4A90E2',
              border: '1.5px solid #4A90E2',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Icons.Download />
            <span>Exportar CSV</span>
          </button>

          <a
            href="https://docs.google.com/spreadsheets/d/1AM2PYEB8LbqvFU2QUSbmpaKdJDYqtuXN-dm5DApmouk/edit?gid=0#gid=0"
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#FFFFFF',
              color: '#10B981',
              border: '1.5px solid #10B981',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Abrir Google Sheet Oficial"
          >
            <Icons.ExternalLink />
            <span>Google Sheets</span>
          </a>

          <button
            onClick={onClose}
            style={{
              background: '#475569',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Icons.ArrowLeft />
            <span>Volver</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <div style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }}>
            <Icons.Search />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, celular, distrito u observaciones..."
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
      </div>

      {/* VIEW 1: SPREADSHEET TABLE */}
      {viewMode === 'spreadsheet' && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflowX: 'auto', flex: 1 }}>
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nombre Madre</th>
                <th>Celular / WhatsApp</th>
                <th>Distrito</th>
                <th>Edad Hijos</th>
                <th>Nivel</th>
                <th>Conocimiento Daño</th>
                <th>Pregunta Condicional</th>
                <th>Respuesta</th>
                <th>Interés</th>
                <th>Observaciones Stand</th>
                <th>Gestión Call / CRM</th>
                <th>Observaciones Calls</th>
                <th>Estado CRM</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    No se encontraron leads con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const cleanPhone = (lead.celular || '').replace(/\D/g, '');
                  const waUrl = `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola ${lead.nombreMadre}, te saluda el equipo de ZentryOS. Un gusto saludarte tras la Expo Maternidad.`)}`;

                  return (
                    <tr key={lead.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#64748B' }}>
                        {lead.timestamp}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1E293B' }}>
                        {lead.nombreMadre}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{lead.celular}</span>
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
                      <td>{lead.distrito}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: lead.edadHijos?.includes('Menores') ? '#EFF6FF' : (lead.edadHijos?.includes('Mayores') ? '#FDF2F8' : '#F0FDF4'),
                          color: lead.edadHijos?.includes('Menores') ? '#2563EB' : (lead.edadHijos?.includes('Mayores') ? '#DB2777' : '#16A34A'),
                          fontWeight: 600
                        }}>
                          {lead.edadHijos}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: Number(lead.nivelPreocupacion) >= 8 ? '#EF4444' : '#F59E0B' }}>
                        {lead.nivelPreocupacion}
                      </td>

                      {/* Expandable: Conocimiento Daño */}
                      <td>
                        <ExpandableText
                          text={lead.conocimientoDano}
                          maxChars={28}
                          forceExpandAll={expandAllTexts}
                        />
                      </td>

                      {/* Expandable: Pregunta Condicional */}
                      <td>
                        <ExpandableText
                          text={lead.preguntaCondicional}
                          maxChars={24}
                          forceExpandAll={expandAllTexts}
                          style={{ color: '#64748B' }}
                        />
                      </td>

                      {/* Expandable: Respuesta Condicional */}
                      <td>
                        <ExpandableText
                          text={lead.respuestaCondicional}
                          maxChars={20}
                          forceExpandAll={expandAllTexts}
                          style={{ fontWeight: 500 }}
                        />
                      </td>

                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: lead.interesSolucion === 'Sí' ? '#16A34A' : '#DC2626'
                        }}>
                          {lead.interesSolucion}
                        </span>
                      </td>

                      {/* Expandable: Observaciones Stand */}
                      <td>
                        <ExpandableText
                          text={lead.observaciones}
                          maxChars={28}
                          forceExpandAll={expandAllTexts}
                          style={{ fontStyle: 'italic', color: '#475569' }}
                        />
                      </td>

                      {/* Expandable / Editable: Gestión Call */}
                      <td>
                        {editingNotesId === lead.id ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              style={{ width: '140px', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid #4A90E2', borderRadius: '4px' }}
                            />
                            <button
                              onClick={() => handleSaveNotes(lead.id)}
                              style={{ border: 'none', background: '#10B981', color: 'white', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}
                            >
                              <Icons.Check />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                            <ExpandableText
                              text={lead.gestCall}
                              maxChars={26}
                              forceExpandAll={expandAllTexts}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNotesId(lead.id);
                                setTempNotes(lead.gestCall || '');
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#94A3B8' }}
                              title="Editar notas de llamada"
                            >
                              <Icons.Edit2 />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Expandable: Observaciones Calls */}
                      <td>
                        <ExpandableText
                          text={lead.obserCalls}
                          maxChars={24}
                          forceExpandAll={expandAllTexts}
                          style={{ color: '#0F766E', fontSize: '0.8rem' }}
                        />
                      </td>

                      <td>
                        <select
                          value={lead.estadoCrm || 'nuevo'}
                          onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadData['estadoCrm'])}
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 6px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            fontWeight: 600,
                            color: '#334155'
                          }}
                        >
                          <option value="nuevo">📥 Nuevo</option>
                          <option value="contactado">📞 Contactado</option>
                          <option value="demo_agendada">📅 Demo Agendada</option>
                          <option value="ganado">🏆 Ganado</option>
                          <option value="descartado">🚫 Descartado</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
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

      {/* VIEW 2: CRM KANBAN PIPELINE */}
      {viewMode === 'crm' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', flex: 1 }}>
          {crmStages.map(stage => {
            const stageLeads = filteredLeads.filter(l => (l.estadoCrm || 'nuevo') === stage.key);
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
                {/* Column Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E293B' }}>{stage.label}</span>
                  <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards List */}
                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {stageLeads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94A3B8', fontSize: '0.8rem', border: '1px dashed #E2E8F0', borderRadius: '8px' }}>
                      Sin prospectos
                    </div>
                  ) : (
                    stageLeads.map(lead => {
                      const cleanPhone = (lead.celular || '').replace(/\D/g, '');
                      const waUrl = `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola ${lead.nombreMadre}, te saluda el equipo de ZentryOS. Te contactamos sobre lo conversado en la Expo Maternidad.`)}`;

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
                            <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{lead.nombreMadre}</strong>
                            <span style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 700 }}>Dolor: {lead.nivelPreocupacion}/10</span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            <div>📍 {lead.distrito} • 👶 {lead.edadHijos}</div>
                            <div style={{ marginTop: '2px' }}>📞 {lead.celular}</div>
                          </div>

                          {lead.observaciones && (
                            <div style={{ fontSize: '0.75rem', color: '#475569', background: '#FFFFFF', padding: '5px', borderRadius: '4px', border: '1px solid #F1F5F9' }}>
                              <ExpandableText text={lead.observaciones} maxChars={35} style={{ fontStyle: 'italic' }} />
                            </div>
                          )}

                          {lead.gestCall && (
                            <div style={{ fontSize: '0.75rem', color: '#2563EB', background: '#EFF6FF', padding: '5px', borderRadius: '4px' }}>
                              📝 <ExpandableText text={lead.gestCall} maxChars={35} />
                            </div>
                          )}

                          {lead.obserCalls && (
                            <div style={{ fontSize: '0.75rem', color: '#0F766E', background: '#F0FDFA', padding: '5px', borderRadius: '4px' }}>
                              💡 <ExpandableText text={lead.obserCalls} maxChars={35} />
                            </div>
                          )}

                          {/* Quick Actions */}
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

                            {/* Move Stage Quick Shift */}
                            <select
                              value={lead.estadoCrm || 'nuevo'}
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
    </div>
  );
};
