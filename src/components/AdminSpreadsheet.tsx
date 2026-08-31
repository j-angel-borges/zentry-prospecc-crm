import React, { useState, useMemo } from 'react';
import { 
  Table, 
  Search, 
  Download, 
  RefreshCw, 
  Filter, 
  Flame, 
  CloudSun, 
  Snowflake, 
  MessageSquare, 
  Eye, 
  Trash2, 
  Database,
  ArrowUpDown,
  PhoneCall,
  User,
  MapPin,
  Clock,
  Sparkles
} from 'lucide-react';
import { LeadRecord, DISTRITOS_LIMA, ASESORES_EQUIPO, SAMPLE_LEADS_EXPO_MATERNIDAD } from '../data/sampleLeads';
import { db, collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, LEADS_COLLECTION } from '../firebase';

interface Props {
  leads: LeadRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectLead: (lead: LeadRecord) => void;
  onSeedSampleData: () => Promise<void>;
}

export const AdminSpreadsheet: React.FC<Props> = ({
  leads,
  isLoading,
  onRefresh,
  onSelectLead,
  onSeedSampleData
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterAsesor, setFilterAsesor] = useState<string>('todos');
  const [filterTemperatura, setFilterTemperatura] = useState<string>('todos');
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [filterDistrito, setFilterDistrito] = useState<string>('todos');
  const [sortField, setSortField] = useState<keyof LeadRecord>('timestamp');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch = 
          !searchTerm ||
          lead.nombreMadre?.toLowerCase().includes(q) ||
          lead.celular?.toLowerCase().includes(q) ||
          lead.asesor?.toLowerCase().includes(q) ||
          lead.distrito?.toLowerCase().includes(q) ||
          lead.nombreHijo?.toLowerCase().includes(q) ||
          lead.id?.toLowerCase().includes(q);

        const matchesAsesor = filterAsesor === 'todos' || lead.asesor === filterAsesor;
        const matchesTemperatura = filterTemperatura === 'todos' || lead.temperatura === filterTemperatura;
        const matchesEstado = filterEstado === 'todos' || lead.estadoCrm === filterEstado;
        const matchesDistrito = filterDistrito === 'todos' || lead.distrito === filterDistrito;

        return matchesSearch && matchesAsesor && matchesTemperatura && matchesEstado && matchesDistrito;
      })
      .sort((a, b) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [leads, searchTerm, filterAsesor, filterTemperatura, filterEstado, filterDistrito, sortField, sortAsc]);

  const handleSort = (field: keyof LeadRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadRecord['estadoCrm']) => {
    try {
      const docRef = doc(db, LEADS_COLLECTION, leadId);
      await updateDoc(docRef, {
        estadoCrm: newStatus
      });
    } catch (err) {
      console.warn("No se pudo actualizar en Firestore, actualizando en memoria:", err);
    }
  };

  const handleTemperatureChange = async (leadId: string, newTemp: LeadRecord['temperatura']) => {
    try {
      const docRef = doc(db, LEADS_COLLECTION, leadId);
      await updateDoc(docRef, {
        temperatura: newTemp
      });
    } catch (err) {
      console.warn("No se pudo actualizar temperatura en Firestore:", err);
    }
  };

  const handleDelete = async (leadId: string, leadName: string) => {
    if (confirm(`¿Estás seguro de eliminar el registro de ${leadName}?`)) {
      try {
        const docRef = doc(db, LEADS_COLLECTION, leadId);
        await deleteDoc(docRef);
        onRefresh();
      } catch (err) {
        console.error("Error al eliminar documento:", err);
        alert("Error al eliminar de Firestore: " + (err as Error).message);
      }
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const headers = [
      "ID",
      "Timestamp",
      "Fecha_Formateada",
      "Asesor",
      "Nivel_Preocupacion",
      "Conocimiento_Dano",
      "Edad_Hijos",
      "Pregunta_Condicional",
      "Respuesta_Condicional",
      "Interes_Solucion",
      "Nombre_Madre",
      "Celular",
      "Distrito",
      "Nombre_Hijo",
      "Edad_Hijo",
      "Observaciones",
      "Temperatura",
      "Estado_CRM",
      "Notas_CRM",
      "Origen"
    ];

    const csvRows = [headers.join(",")];

    leads.forEach((l) => {
      const row = [
        `"${l.id || ''}"`,
        `"${l.timestamp || ''}"`,
        `"${l.fechaFormatted || ''}"`,
        `"${l.asesor || ''}"`,
        `"${l.nivelPreocupacion || ''}"`,
        `"${(l.conocimientoDano || '').replace(/"/g, '""')}"`,
        `"${l.edadHijos || ''}"`,
        `"${(l.preguntaCondicional || '').replace(/"/g, '""')}"`,
        `"${(l.respuestaCondicional || '').replace(/"/g, '""')}"`,
        `"${l.interesSolucion || ''}"`,
        `"${(l.nombreMadre || '').replace(/"/g, '""')}"`,
        `"${l.celular || ''}"`,
        `"${l.distrito || ''}"`,
        `"${(l.nombreHijo || '').replace(/"/g, '""')}"`,
        `"${l.edadHijo || ''}"`,
        `"${(l.observaciones || '').replace(/"/g, '""')}"`,
        `"${l.temperatura || ''}"`,
        `"${l.estadoCrm || ''}"`,
        `"${(l.notasCrm || '').replace(/"/g, '""')}"`,
        `"${l.origen || 'Expo Maternidad'}"`
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Zentry_Leads_ExpoMaternidad_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSeed = async () => {
    if (confirm("¿Deseas sembrar el dataset de muestra oficial de la Expo Maternidad en Firestore?")) {
      setIsSeeding(true);
      await onSeedSampleData();
      setIsSeeding(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Control Header & Filters */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Table className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Hoja de Cálculo • Leads_ExpoMaternidad</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {filteredLeads.length} de {leads.length} registros
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Espejo directo de Google Sheets / Firestore con edición en vivo y sincronización multi-dispositivo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
              title="Descargar archivo CSV estructurado"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="px-3.5 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-200 text-xs font-semibold flex items-center space-x-1.5 border border-indigo-700/60 transition"
              title="Cargar registros muestra de Expo Maternidad"
            >
              <Database className="w-4 h-4 text-indigo-400" />
              <span>{isSeeding ? "Sembrando..." : "Cargar Muestra (Expo)"}</span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-4">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, celular, asesor, distrito o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl glass-input text-xs"
            />
          </div>

          <div>
            <select
              value={filterAsesor}
              onChange={(e) => setFilterAsesor(e.target.value)}
              className="w-full py-2 px-3 rounded-xl glass-input text-xs"
            >
              <option value="todos" className="bg-slate-900">Todos los Asesores</option>
              {ASESORES_EQUIPO.map((a) => (
                <option key={a} value={a} className="bg-slate-900">{a}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterTemperatura}
              onChange={(e) => setFilterTemperatura(e.target.value)}
              className="w-full py-2 px-3 rounded-xl glass-input text-xs"
            >
              <option value="todos" className="bg-slate-900">Todas las Temperaturas</option>
              <option value="caliente" className="bg-slate-900">🔥 Caliente (Alta Intención)</option>
              <option value="tibio" className="bg-slate-900">⛅ Tibio (Interesado)</option>
              <option value="frio" className="bg-slate-900">❄️ Frío (Informativo)</option>
            </select>
          </div>

          <div>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full py-2 px-3 rounded-xl glass-input text-xs"
            >
              <option value="todos" className="bg-slate-900">Todos los Estados CRM</option>
              <option value="nuevo" className="bg-slate-900">📥 Nuevo</option>
              <option value="contactado" className="bg-slate-900">📞 Contactado</option>
              <option value="demo_agendada" className="bg-slate-900">📅 Demo Agendada</option>
              <option value="ganado" className="bg-slate-900">🏆 Ganado (Cerrado)</option>
              <option value="descartado" className="bg-slate-900">🚫 Descartado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 z-10 text-slate-300 font-mono text-[11px] uppercase border-b border-slate-800 tracking-wider">
              <tr>
                <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleSort('id')}>
                  <div className="flex items-center space-x-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center space-x-1">
                    <span>Fecha</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleSort('asesor')}>
                  <div className="flex items-center space-x-1">
                    <span>Asesor</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 whitespace-nowrap cursor-pointer hover:text-white" onClick={() => handleSort('nombreMadre')}>
                  <div className="flex items-center space-x-1">
                    <span>Padre / Madre</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 whitespace-nowrap">WhatsApp / Celular</th>
                <th className="p-3 whitespace-nowrap">Distrito</th>
                <th className="p-3 whitespace-nowrap">Hijo(a)</th>
                <th className="p-3 whitespace-nowrap text-center cursor-pointer hover:text-white" onClick={() => handleSort('nivelPreocupacion')}>
                  <div className="flex items-center justify-center space-x-1">
                    <span>Dolor (1-10)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 whitespace-nowrap">Cohorte</th>
                <th className="p-3 whitespace-nowrap">Interés Solución</th>
                <th className="p-3 whitespace-nowrap text-center">Temperatura</th>
                <th className="p-3 whitespace-nowrap">Estado CRM</th>
                <th className="p-3 whitespace-nowrap min-w-[180px]">Observaciones</th>
                <th className="p-3 whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-3">
                      <Database className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="text-sm font-semibold text-slate-300">No se encontraron leads registrados</p>
                      <p className="text-xs text-slate-500">
                        {leads.length === 0 
                          ? "Haz clic en 'Cargar Muestra (Expo)' para importar 12 leads de prueba o registra uno nuevo desde el Modo Prospección."
                          : "Intenta ajustar los filtros de búsqueda."}
                      </p>
                      {leads.length === 0 && (
                        <button
                          onClick={handleSeed}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                        >
                          Cargar Datos Muestra Expo Maternidad
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const cleanPhone = (lead.celular || '').replace(/\D/g, '');
                  const waMessage = encodeURIComponent(
                    `¡Hola ${lead.nombreMadre}! Te saluda ${lead.asesor} de ZentryOS. Fue un gusto conversar contigo en la Expo Maternidad. ¿Cómo te fue con el diagnóstico de bienestar digital para ${lead.nombreHijo}?`
                  );

                  return (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-indigo-950/20 transition group"
                    >
                      <td className="p-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {lead.id}
                      </td>
                      <td className="p-3 text-slate-300 whitespace-nowrap text-[11px]">
                        {lead.fechaFormatted || lead.timestamp?.slice(0, 10)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                          {lead.asesor}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-semibold text-white">
                        {lead.nombreMadre}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                          <span>{lead.celular}</span>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/51${cleanPhone}?text=${waMessage}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded bg-emerald-950/80 hover:bg-emerald-800 text-emerald-400 border border-emerald-700/50 transition"
                              title="Enviar WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-300">
                        {lead.distrito}
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-300">
                        {lead.nombreHijo} {lead.edadHijo ? `(${lead.edadHijo}a)` : ''}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          lead.nivelPreocupacion >= 8 
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50' 
                            : (lead.nivelPreocupacion >= 5 
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' 
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50')
                        }`}>
                          {lead.nivelPreocupacion}/10
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-400 text-[11px]">
                        {lead.edadHijos}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lead.interesSolucion === 'Sí' 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : (lead.interesSolucion === 'Más Info' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400')
                        }`}>
                          {lead.interesSolucion}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            const nextTemp = lead.temperatura === 'caliente' ? 'tibio' : (lead.temperatura === 'tibio' ? 'frio' : 'caliente');
                            handleTemperatureChange(lead.id, nextTemp);
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 border transition ${
                            lead.temperatura === 'caliente'
                              ? 'bg-rose-950/70 border-rose-700/50 text-rose-300 hover:bg-rose-900/80'
                              : (lead.temperatura === 'tibio'
                                ? 'bg-amber-950/70 border-amber-700/50 text-amber-300 hover:bg-amber-900/80'
                                : 'bg-cyan-950/70 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/80')
                          }`}
                          title="Clic para cambiar temperatura"
                        >
                          {lead.temperatura === 'caliente' && <><Flame className="w-3 h-3 text-rose-400" /><span>Caliente</span></>}
                          {lead.temperatura === 'tibio' && <><CloudSun className="w-3 h-3 text-amber-400" /><span>Tibio</span></>}
                          {lead.temperatura === 'frio' && <><Snowflake className="w-3 h-3 text-cyan-400" /><span>Frío</span></>}
                        </button>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <select
                          value={lead.estadoCrm || 'nuevo'}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadRecord['estadoCrm'])}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold border ${
                            lead.estadoCrm === 'ganado'
                              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                              : (lead.estadoCrm === 'demo_agendada'
                                ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
                                : (lead.estadoCrm === 'contactado'
                                  ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                                  : (lead.estadoCrm === 'descartado'
                                    ? 'bg-slate-900 border-slate-700 text-slate-500'
                                    : 'bg-slate-800 border-slate-700 text-slate-300')))
                          }`}
                        >
                          <option value="nuevo" className="bg-slate-900 text-white">📥 Nuevo</option>
                          <option value="contactado" className="bg-slate-900 text-white">📞 Contactado</option>
                          <option value="demo_agendada" className="bg-slate-900 text-white">📅 Demo Agendada</option>
                          <option value="ganado" className="bg-slate-900 text-white">🏆 Ganado (Cerrado)</option>
                          <option value="descartado" className="bg-slate-900 text-white">🚫 Descartado</option>
                        </select>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px] truncate max-w-[200px]" title={lead.observaciones}>
                        {lead.observaciones}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onSelectLead(lead)}
                            className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/50 transition"
                            title="Ver Ficha Técnica Completa"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(lead.id, lead.nombreMadre)}
                            className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 transition"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
  );
};
