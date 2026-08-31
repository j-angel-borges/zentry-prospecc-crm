import React, { useState } from 'react';
import { 
  X, 
  Flame, 
  CloudSun, 
  Snowflake, 
  MessageSquare, 
  Phone, 
  MapPin, 
  User, 
  Calendar, 
  Brain, 
  Sparkles, 
  Save, 
  FileText,
  ShieldAlert,
  Send
} from 'lucide-react';
import { LeadRecord } from '../data/sampleLeads';
import { db, doc, updateDoc, LEADS_COLLECTION } from '../firebase';

interface Props {
  lead: LeadRecord;
  onClose: () => void;
  onUpdate: (updatedLead: LeadRecord) => void;
}

export const LeadDetailModal: React.FC<Props> = ({ lead, onClose, onUpdate }) => {
  const [estadoCrm, setEstadoCrm] = useState<LeadRecord['estadoCrm']>(lead.estadoCrm || 'nuevo');
  const [temperatura, setTemperatura] = useState<LeadRecord['temperatura']>(lead.temperatura || 'caliente');
  const [notasCrm, setNotasCrm] = useState<string>(lead.notasCrm || '');
  const [selectedTemplate, setSelectedTemplate] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const cleanPhone = (lead.celular || '').replace(/\D/g, '');

  const getTemplateText = (tplId: number): string => {
    switch (tplId) {
      case 1:
        return `¡Hola ${lead.nombreMadre}! Te saluda ${lead.asesor} del equipo de ZentryOS. Un gusto haber conversado contigo en la Expo Maternidad sobre ${lead.nombreHijo}. Te comparto el brochure explicativo sobre cómo proteger el neurodesarrollo de tus hijos en la era digital: https://zentryos.web.app`;
      case 2:
        return `Estimada ${lead.nombreMadre}, te saluda ${lead.asesor} de ZentryOS. En base a lo que nos comentaste sobre ${lead.nombreHijo} (${lead.edadHijo} años), nos gustaría agendar una Demo interactiva de 15 minutos para que prueben el modo de retos educativos. ¿Qué día de esta semana te queda más cómodo?`;
      case 3:
        return `Hola ${lead.nombreMadre}, ¡esperamos que estés teniendo un excelente día! Te escribe ${lead.asesor} de ZentryOS. Aquí tienes el enlace para probar el diagnóstico familiar y ver cómo la gamificación supera a los bloqueadores tradicionales: https://zentryos.web.app`;
      default:
        return '';
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const updated: LeadRecord = {
      ...lead,
      estadoCrm,
      temperatura,
      notasCrm
    };

    try {
      const docRef = doc(db, LEADS_COLLECTION, lead.id);
      await updateDoc(docRef, {
        estadoCrm,
        temperatura,
        notasCrm
      });
    } catch (err) {
      console.warn("No se pudo actualizar en Firestore:", err);
    }

    onUpdate(updated);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="glass-panel-glow rounded-3xl w-full max-w-3xl overflow-hidden border border-indigo-500/30 my-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-heading font-extrabold text-lg text-white">
                  Ficha Técnica • {lead.nombreMadre}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  {lead.id}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Capturado por <strong className="text-slate-200">{lead.asesor}</strong> • {lead.fechaFormatted || lead.timestamp?.slice(0, 10)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Contact & Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400 uppercase font-mono">WhatsApp</div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-sm text-white">{lead.celular}</span>
                {cleanPhone && (
                  <a
                    href={`https://wa.me/51${cleanPhone}?text=${encodeURIComponent(getTemplateText(selectedTemplate))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                    title="Abrir WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-slate-400 uppercase font-mono">Distrito</div>
              <div className="flex items-center space-x-1 text-sm text-slate-200 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{lead.distrito}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-slate-400 uppercase font-mono">Hijo(a) / Edad</div>
              <div className="flex items-center space-x-1 text-sm text-slate-200 font-medium">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>{lead.nombreHijo} ({lead.edadHijo} años)</span>
              </div>
            </div>
          </div>

          {/* Diagnostic Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-mono tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <Brain className="w-4 h-4" />
              <span>Resultados del Diagnóstico de Campo</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 mb-1">Nivel de Alarma / Dolor:</div>
                <div className="font-bold text-sm text-white">
                  {lead.nivelPreocupacion} / 10
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 mb-1">Cohorte Etario:</div>
                <div className="font-bold text-sm text-white">
                  {lead.edadHijos}
                </div>
              </div>

              <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 mb-1">Percepción del Daño Cognitivo:</div>
                <div className="font-medium text-slate-200">
                  {lead.conocimientoDano}
                </div>
              </div>

              <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 mb-1">Pregunta y Respuesta Específica:</div>
                <div className="font-semibold text-indigo-300 mb-0.5">{lead.preguntaCondicional}</div>
                <div className="text-slate-300 font-medium">"{lead.respuestaCondicional}"</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 mb-1">Intención de Solución (ZentryOS):</div>
                <div className="font-bold text-emerald-400">
                  {lead.interesSolucion}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 mb-1">Observaciones Iniciales del Asesor:</div>
                <div className="text-slate-300 italic">
                  "{lead.observaciones}"
                </div>
              </div>
            </div>
          </div>

          {/* CRM Management Controls */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="text-xs uppercase font-mono tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Gestión de Seguimiento CRM</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Estado en el Pipeline:
                </label>
                <select
                  value={estadoCrm}
                  onChange={(e) => setEstadoCrm(e.target.value as LeadRecord['estadoCrm'])}
                  className="w-full p-2.5 rounded-xl glass-input text-xs"
                >
                  <option value="nuevo" className="bg-slate-900">📥 Nuevo Lead</option>
                  <option value="contactado" className="bg-slate-900">📞 Contactado (En Seguimiento)</option>
                  <option value="demo_agendada" className="bg-slate-900">📅 DemoBook Agendada</option>
                  <option value="ganado" className="bg-slate-900">🏆 Ganado (Cierre de Venta)</option>
                  <option value="descartado" className="bg-slate-900">🚫 Descartado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Temperatura Comercial:
                </label>
                <select
                  value={temperatura}
                  onChange={(e) => setTemperatura(e.target.value as LeadRecord['temperatura'])}
                  className="w-full p-2.5 rounded-xl glass-input text-xs"
                >
                  <option value="caliente" className="bg-slate-900">🔥 Caliente (Alta Urgencia)</option>
                  <option value="tibio" className="bg-slate-900">⛅ Tibio (Interés Moderado)</option>
                  <option value="frio" className="bg-slate-900">❄️ Frío (Informativo)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bitácora de Notas de Seguimiento:
              </label>
              <textarea
                rows={3}
                value={notasCrm}
                onChange={(e) => setNotasCrm(e.target.value)}
                placeholder="Escribe acuerdos de llamadas, fechas de cita o feedback del cliente..."
                className="w-full p-3 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          {/* WhatsApp Direct Messaging Templates */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Generador de Mensaje de WhatsApp</span>
              </span>
              <div className="flex space-x-1 text-[11px]">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedTemplate(num)}
                    className={`px-2 py-0.5 rounded-md ${
                      selectedTemplate === num ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    T{num}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 text-slate-300 text-xs font-mono border border-slate-800">
              "{getTemplateText(selectedTemplate)}"
            </div>

            {cleanPhone && (
              <a
                href={`https://wa.me/51${cleanPhone}?text=${encodeURIComponent(getTemplateText(selectedTemplate))}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Mensaje Seleccionado por WhatsApp</span>
              </a>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cerrar
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30 transition"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
