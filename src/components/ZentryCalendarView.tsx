import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GoogleCalendarEvent,
  fetchCalendarEvents,
  createCalendarEvent,
  patchCalendarEvent,
  deleteCalendarEvent,
  getCachedCalendarEvents
} from '../services/calendarService';
import { getStoredAccessToken } from '../services/authService';
import { LeadData } from '../data/realLeads';

interface ZentryCalendarViewProps {
  leads: LeadData[];
  onConnectGoogle?: () => void;
  currentUserEmail?: string;
  onUpdateLeadStatus?: (leadId: string, newStatus: string, dateStr: string) => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 AM a 9:00 PM
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const ZentryCalendarView: React.FC<ZentryCalendarViewProps> = ({
  leads,
  onConnectGoogle,
  currentUserEmail,
  onUpdateLeadStatus
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [events, setEvents] = useState<GoogleCalendarEvent[]>(() => getCachedCalendarEvents());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal para "+ Agendar Demo / Cita"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createDate, setCreateDate] = useState<string>('');
  const [createStartTime, setCreateStartTime] = useState<string>('16:00');
  const [createEndTime, setCreateEndTime] = useState<string>('17:00');
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createDesc, setCreateDesc] = useState<string>('');
  const [createLocation, setCreateLocation] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Drag & Drop / Resize
  const [draggedEvent, setDraggedEvent] = useState<{
    event: GoogleCalendarEvent;
    type: 'move' | 'resize-bottom';
    initialY: number;
    initialStartMinutes: number;
    initialDurationMinutes: number;
    currentDayIndex: number;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentWeekStart]);

  const loadEvents = async (silent = false) => {
    const token = getStoredAccessToken();
    if (!token) {
      setErrorMessage('Conecta tu cuenta de Google para sincronizar y ver eventos de Google Calendar.');
      return;
    }

    if (!silent) setIsLoading(true);
    setErrorMessage(null);
    try {
      const minIso = new Date(weekDays[0].getTime() - 24 * 3600 * 1000).toISOString();
      const maxIso = new Date(weekDays[6].getTime() + 48 * 3600 * 1000).toISOString();
      const fetched = await fetchCalendarEvents(token, minIso, maxIso);
      setEvents(fetched);
    } catch (err: any) {
      console.warn('Error al cargar eventos de calendario:', err);
      setErrorMessage(err.message || 'Error al conectar con Google Calendar.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();

    const handleTokenUpdated = () => {
      loadEvents(true);
    };

    window.addEventListener('zentry_google_token_updated', handleTokenUpdated);
    return () => {
      window.removeEventListener('zentry_google_token_updated', handleTokenUpdated);
    };
  }, [currentWeekStart]);

  // Navegación Semanal
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleToday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // Apertura del modal con lead pre-seleccionado
  const handleOpenCreateModal = (dateStr?: string, timeStr?: string, lead?: LeadData) => {
    const todayStr = dateStr || new Date().toISOString().split('T')[0];
    setCreateDate(todayStr);
    setCreateStartTime(timeStr || '16:00');

    // Calcular +1 hora para fin
    const [h, m] = (timeStr || '16:00').split(':').map(Number);
    const endH = String((h + 1) % 24).padStart(2, '0');
    setCreateEndTime(`${endH}:${String(m).padStart(2, '0')}`);

    if (lead) {
      setSelectedLeadId(lead.id);
      setCreateTitle(`Demo ZentryOS — ${lead.nombreMadre}`);
      setCreateDesc(`Contacto: ${lead.nombreMadre}\nCelular: ${lead.celular}\nDistrito: ${lead.distrito || 'Lima'}\nNotas: ${lead.observaciones || ''}`);
      setCreateLocation(lead.distrito || 'Virtual / Google Meet');
    } else {
      setSelectedLeadId('');
      setCreateTitle('Demo ZentryOS');
      setCreateDesc('');
      setCreateLocation('Virtual / Google Meet');
    }
    setIsCreateModalOpen(true);
  };

  // Al seleccionar un lead dentro del modal
  const handleSelectLeadInModal = (leadId: string) => {
    setSelectedLeadId(leadId);
    const target = leads.find((l) => l.id === leadId);
    if (target) {
      setCreateTitle(`Demo ZentryOS — ${target.nombreMadre}`);
      setCreateDesc(`Contacto: ${target.nombreMadre}\nCelular: ${target.celular}\nDistrito: ${target.distrito || 'Lima'}\nNotas: ${target.observaciones || ''}`);
      if (target.distrito) setCreateLocation(target.distrito);
    }
  };

  // Enviar nuevo evento a Google Calendar
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredAccessToken();
    if (!token) {
      alert('Debes iniciar sesión con Google para agendar en Calendar.');
      return;
    }

    if (!createTitle.trim()) {
      alert('Por favor ingresa un título para la cita.');
      return;
    }

    setIsSubmitting(true);
    try {
      const startDateTime = new Date(`${createDate}T${createStartTime}:00`).toISOString();
      const endDateTime = new Date(`${createDate}T${createEndTime}:00`).toISOString();

      const created = await createCalendarEvent(token, {
        summary: createTitle.trim(),
        description: createDesc.trim(),
        location: createLocation.trim(),
        startDateTime,
        endDateTime
      });

      setEvents((prev) => [...prev, created]);
      setIsCreateModalOpen(false);

      if (selectedLeadId && onUpdateLeadStatus) {
        onUpdateLeadStatus(selectedLeadId, 'demo_agendada', `${createDate} ${createStartTime}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error al crear evento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar evento
  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta cita de Google Calendar?')) return;
    const token = getStoredAccessToken();
    if (!token) return;

    try {
      await deleteCalendarEvent(token, eventId);
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    } catch (err: any) {
      alert(err.message || 'Error al eliminar cita.');
    }
  };

  // Helper para posicionar bloques en la grilla (7:00 AM a 9:00 PM = 14 horas = 840 minutos)
  const getEventPosition = (event: GoogleCalendarEvent, dayDate: Date) => {
    const evStart = new Date(event.start.dateTime);
    const evEnd = new Date(event.end.dateTime);

    // Mismo día
    const isSameDay =
      evStart.getFullYear() === dayDate.getFullYear() &&
      evStart.getMonth() === dayDate.getMonth() &&
      evStart.getDate() === dayDate.getDate();

    if (!isSameDay) return null;

    const startHour = evStart.getHours();
    const startMin = evStart.getMinutes();
    const totalStartMinutes = (startHour - 7) * 60 + startMin;

    const endHour = evEnd.getHours();
    const endMin = evEnd.getMinutes();
    const totalEndMinutes = (endHour - 7) * 60 + endMin;

    const durationMinutes = Math.max(30, totalEndMinutes - totalStartMinutes);

    // Grilla: cada hora son 60px -> 1px por minuto
    const top = Math.max(0, totalStartMinutes);
    const height = Math.min(840 - top, durationMinutes);

    return { top, height, startStr: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}` };
  };

  const tokenPresent = !!getStoredAccessToken();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC', overflow: 'hidden' }}>
      {/* ── Barra Superior de Navegación del Calendario ──────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleToday}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              background: '#F1F5F9',
              color: '#334155',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Hoy
          </button>
          <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={handlePrevWeek}
              style={{ padding: '6px 10px', background: '#FFFFFF', border: 'none', borderRight: '1px solid #CBD5E1', cursor: 'pointer', fontWeight: 800 }}
              title="Semana anterior"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              style={{ padding: '6px 10px', background: '#FFFFFF', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              title="Semana siguiente"
            >
              ▶
            </button>
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
            {MONTHS_ES[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
            {weekDays[0].getMonth() !== weekDays[6].getMonth() ? ` - ${MONTHS_ES[weekDays[6].getMonth()]}` : ''}
          </span>
          {isLoading && <span style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: 600 }}>Cargando eventos...</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!tokenPresent && onConnectGoogle && (
            <button
              type="button"
              onClick={onConnectGoogle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <span>⚠️</span>
              <span>Conectar Google Calendar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
            }}
          >
            <span>+</span>
            <span>Agendar Demo ZentryOS</span>
          </button>
        </div>
      </div>

      {/* Banner de error o reconexión */}
      {errorMessage && (
        <div style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '8px 18px', color: '#DC2626', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMessage}</span>
          {onConnectGoogle && (
            <button
              type="button"
              onClick={onConnectGoogle}
              style={{ background: '#DC2626', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Reconectar
            </button>
          )}
        </div>
      )}

      {/* ── Grilla Semanal Responsiva ──────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Cabecera de los 7 Días */}
        <div style={{ display: 'flex', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ width: '60px', borderRight: '1px solid #E2E8F0', padding: '8px 4px', textAlign: 'center', fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>
            GMT-5
          </div>
          {weekDays.map((d, idx) => {
            const isToday = new Date().toDateString() === d.toDateString();
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  textAlign: 'center',
                  borderRight: idx < 6 ? '1px solid #E2E8F0' : 'none',
                  background: isToday ? '#EFF6FF' : '#FFFFFF'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: isToday ? '#2563EB' : '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                  {DAYS_ES[d.getDay()]}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isToday ? '#2563EB' : 'transparent',
                    color: isToday ? '#FFFFFF' : '#0F172A',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    marginTop: '2px'
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cuerpo de Horas y Columnas de Días */}
        <div ref={gridRef} style={{ display: 'flex', position: 'relative', minHeight: '840px', background: '#FFFFFF' }}>
          {/* Eje de Horas (Izquierda) */}
          <div style={{ width: '60px', borderRight: '1px solid #E2E8F0', background: '#F8FAFC', userSelect: 'none' }}>
            {HOURS.map((h) => (
              <div
                key={h}
                style={{
                  height: '60px',
                  borderBottom: '1px solid #E2E8F0',
                  padding: '4px 6px 0 0',
                  textAlign: 'right',
                  fontSize: '0.68rem',
                  color: '#64748B',
                  fontWeight: 600,
                  boxSizing: 'border-box'
                }}
              >
                {h % 12 === 0 ? 12 : h % 12} {h < 12 ? 'am' : 'pm'}
              </div>
            ))}
          </div>

          {/* 7 Columnas de Días */}
          {weekDays.map((d, dayIdx) => {
            const dateStr = d.toISOString().split('T')[0];
            return (
              <div
                key={dayIdx}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    const clickedMinutes = Math.floor(offsetY / 15) * 15;
                    const h = Math.min(21, Math.floor(clickedMinutes / 60) + 7);
                    const m = clickedMinutes % 60;
                    handleOpenCreateModal(dateStr, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                  }
                }}
                style={{
                  flex: 1,
                  position: 'relative',
                  borderRight: dayIdx < 6 ? '1px solid #E2E8F0' : 'none',
                  boxSizing: 'border-box'
                }}
              >
                {/* Líneas guía horarias */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{
                      height: '60px',
                      borderBottom: '1px dashed #F1F5F9',
                      pointerEvents: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ))}

                {/* Renderizar Eventos de este Día */}
                {events.map((ev) => {
                  const pos = getEventPosition(ev, d);
                  if (!pos) return null;

                  return (
                    <div
                      key={ev.id}
                      style={{
                        position: 'absolute',
                        top: `${pos.top}px`,
                        height: `${Math.max(26, pos.height)}px`,
                        left: '4px',
                        right: '4px',
                        background: '#2563EB',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                        cursor: 'pointer',
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                      title={`${ev.summary}\n${pos.startStr}\n${ev.description || ''}`}
                    >
                      <div>
                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.summary}
                        </div>
                        <div style={{ fontSize: '0.66rem', opacity: 0.9 }}>{pos.startStr}</div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(ev.id);
                          }}
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '3px',
                            padding: '1px 4px',
                            cursor: 'pointer',
                            fontSize: '0.65rem'
                          }}
                          title="Eliminar de Google Calendar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal Emergente "+ Agendar Demo ZentryOS" ───────────── */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0F172A', fontWeight: 800 }}>
                📅 Agendar Demo ZentryOS
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Vincular con un prospecto del CRM */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Vincular con Prospecto (Opcional)
                </label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => handleSelectLeadInModal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    background: '#FFFFFF'
                  }}
                >
                  <option value="">-- Seleccionar prospecto de Zentry --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombreMadre} ({l.celular}) — {l.sheetTab || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Título del Evento *
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Ej: Demo ZentryOS — Familia González"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Inicio
                  </label>
                  <input
                    type="time"
                    required
                    value={createStartTime}
                    onChange={(e) => setCreateStartTime(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Fin
                  </label>
                  <input
                    type="time"
                    required
                    value={createEndTime}
                    onChange={(e) => setCreateEndTime(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Ubicación o Enlace
                </label>
                <input
                  type="text"
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  placeholder="Virtual (Meet) o Dirección en distrito"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Descripción y Notas
                </label>
                <textarea
                  rows={3}
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Detalles sobre los hijos, edades, temas de interés..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#10B981',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? 'Guardando...' : 'Sincronizar Cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
