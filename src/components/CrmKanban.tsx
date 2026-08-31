import React, { useState } from 'react';
import { 
  Flame, 
  CloudSun, 
  Snowflake, 
  MessageSquare, 
  Eye, 
  ChevronRight, 
  ChevronLeft, 
  PhoneCall, 
  Calendar,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  TrendingUp
} from 'lucide-react';
import { LeadRecord } from '../data/sampleLeads';
import { db, doc, updateDoc, LEADS_COLLECTION } from '../firebase';

interface Props {
  leads: LeadRecord[];
  onSelectLead: (lead: LeadRecord) => void;
  onRefresh: () => void;
}

const STAGES: { key: LeadRecord['estadoCrm']; title: string; icon: string; color: string; border: string; bg: string }[] = [
  { key: 'nuevo', title: 'Nuevos Leads', icon: '📥', color: 'text-slate-300', border: 'border-slate-700', bg: 'bg-slate-900/60' },
  { key: 'contactado', title: 'Contactados', icon: '📞', color: 'text-amber-400', border: 'border-amber-700/50', bg: 'bg-amber-950/20' },
  { key: 'demo_agendada', title: 'Demo Agendada', icon: '📅', color: 'text-indigo-400', border: 'border-indigo-700/50', bg: 'bg-indigo-950/20' },
  { key: 'ganado', title: 'Ventas Cerradas', icon: '🏆', color: 'text-emerald-400', border: 'border-emerald-700/50', bg: 'bg-emerald-950/20' },
  { key: 'descartado', title: 'Descartados', icon: '🚫', color: 'text-rose-400', border: 'border-rose-900/50', bg: 'bg-rose-950/20' },
];

export const CrmKanban: React.FC<Props> = ({ leads, onSelectLead, onRefresh }) => {
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  const handleMoveStage = async (leadId: string, currentStage: LeadRecord['estadoCrm'], direction: 'next' | 'prev') => {
    const stageOrder: LeadRecord['estadoCrm'][] = ['nuevo', 'contactado', 'demo_agendada', 'ganado', 'descartado'];
    const currentIndex = stageOrder.indexOf(currentStage || 'nuevo');
    const newIndex = direction === 'next' 
      ? Math.min(stageOrder.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
    
    const newStage = stageOrder[newIndex];
    if (newStage === currentStage) return;

    setMovingLeadId(leadId);
    try {
      const docRef = doc(db, LEADS_COLLECTION, leadId);
      await updateDoc(docRef, {
        estadoCrm: newStage
      });
      onRefresh();
    } catch (err) {
      console.warn("Error al actualizar estado en Firestore:", err);
    } finally {
      setMovingLeadId(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Pipeline Summary Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Pipeline Comercial de Conversión</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Total Leads:</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-700/50">
            {leads.length}
          </span>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => (l.estadoCrm || 'nuevo') === stage.key);

          return (
            <div 
              key={stage.key}
              className={`rounded-2xl border ${stage.border} ${stage.bg} p-3 flex flex-col min-h-[500px] backdrop-blur-md`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center space-x-1.5 font-heading font-bold text-sm">
                  <span>{stage.icon}</span>
                  <span className={stage.color}>{stage.title}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-900/80 text-slate-300 border border-slate-700">
                  {stageLeads.length}
                </span>
              </div>

              {/* Lead Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {stageLeads.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Sin prospectos en esta fase
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const cleanPhone = (lead.celular || '').replace(/\D/g, '');
                    const waMessage = encodeURIComponent(
                      `¡Hola ${lead.nombreMadre}! Te saluda ${lead.asesor} de ZentryOS. Queríamos dar seguimiento a la demostración que conversamos en la Expo Maternidad. ¿Tienes disponibilidad mañana para revisar el panel parental?`
                    );

                    return (
                      <div
                        key={lead.id}
                        className="p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition shadow-lg space-y-2 group"
                      >
                        {/* Top Card: Name & Temperature */}
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-bold text-sm text-white leading-tight">
                            {lead.nombreMadre}
                          </h4>
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            lead.temperatura === 'caliente'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                              : (lead.temperatura === 'tibio'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                                : 'bg-cyan-950 text-cyan-400 border border-cyan-800/60')
                          }`}>
                            {lead.temperatura === 'caliente' ? '🔥 Alta' : (lead.temperatura === 'tibio' ? '⛅ Media' : '❄️ Baja')}
                          </span>
                        </div>

                        {/* Middle info */}
                        <div className="text-[11px] text-slate-400 space-y-1">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3 text-slate-500" />
                            <span>Hijo: <strong className="text-slate-300">{lead.nombreHijo}</strong> ({lead.edadHijo}a)</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{lead.distrito}</span>
                          </div>
                          <div className="text-[10px] text-indigo-400/90 font-mono">
                            Asesor: {lead.asesor}
                          </div>
                        </div>

                        {/* Notes snippet */}
                        {lead.notasCrm && (
                          <p className="text-[10px] text-slate-400 bg-slate-950/60 p-1.5 rounded-md border border-slate-800/80 italic line-clamp-2">
                            "{lead.notasCrm}"
                          </p>
                        )}

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          <div className="flex items-center space-x-1">
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/51${cleanPhone}?text=${waMessage}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-emerald-950 hover:bg-emerald-850 text-emerald-400 border border-emerald-700/60 transition"
                                title="Chat WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3" />
                              </a>
                            )}
                            <button
                              onClick={() => onSelectLead(lead)}
                              className="p-1 rounded bg-indigo-950 hover:bg-indigo-850 text-indigo-400 border border-indigo-700/60 transition"
                              title="Ver ficha completa"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Move stage controls */}
                          <div className="flex items-center space-x-1">
                            {stage.key !== 'nuevo' && (
                              <button
                                onClick={() => handleMoveStage(lead.id, lead.estadoCrm, 'prev')}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                title="Mover a etapa anterior"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                            )}
                            {stage.key !== 'descartado' && stage.key !== 'ganado' && (
                              <button
                                onClick={() => handleMoveStage(lead.id, lead.estadoCrm, 'next')}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                title="Mover a siguiente etapa"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
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
    </div>
  );
};
