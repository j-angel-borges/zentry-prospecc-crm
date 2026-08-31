import React from 'react';
import { 
  TrendingUp, 
  Target, 
  Flame, 
  Users, 
  Award, 
  MapPin, 
  Brain, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { LeadRecord } from '../data/sampleLeads';

interface Props {
  leads: LeadRecord[];
}

export const AnalyticsDashboard: React.FC<Props> = ({ leads }) => {
  const GOAL_LEADS = 120;
  const totalLeads = leads.length;
  const progressPercent = Math.min(100, Math.round((totalLeads / GOAL_LEADS) * 100));

  const calientesCount = leads.filter(l => l.temperatura === 'caliente').length;
  const tibiosCount = leads.filter(l => l.temperatura === 'tibio').length;
  const friosCount = leads.filter(l => l.temperatura === 'frio').length;

  const ganadosCount = leads.filter(l => l.estadoCrm === 'ganado').length;
  const demosCount = leads.filter(l => l.estadoCrm === 'demo_agendada').length;
  const contactadosCount = leads.filter(l => l.estadoCrm === 'contactado').length;

  // Conversion rate (Calientes / Total)
  const highIntentRate = totalLeads > 0 ? Math.round((calientesCount / totalLeads) * 100) : 0;
  const avgPainLevel = totalLeads > 0 
    ? (leads.reduce((acc, l) => acc + (l.nivelPreocupacion || 0), 0) / totalLeads).toFixed(1)
    : '0.0';

  // Advisor Leaderboard
  const advisorCounts: Record<string, number> = {};
  leads.forEach(l => {
    const a = l.asesor || 'No Asignado';
    advisorCounts[a] = (advisorCounts[a] || 0) + 1;
  });
  const sortedAdvisors = Object.entries(advisorCounts).sort((a, b) => b[1] - a[1]);

  // District distribution
  const districtCounts: Record<string, number> = {};
  leads.forEach(l => {
    const d = l.distrito || 'Otro';
    districtCounts[d] = (districtCounts[d] || 0) + 1;
  });
  const sortedDistricts = Object.entries(districtCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Cohort distribution
  const menoresCount = leads.filter(l => l.edadHijos?.includes('Menores')).length;
  const mayoresCount = leads.filter(l => l.edadHijos?.includes('Mayores')).length;
  const ambasCount = leads.filter(l => l.edadHijos?.includes('Ambas')).length;

  return (
    <div className="w-full space-y-6">
      {/* Top Banner Goal & High Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Meta Diaria Card */}
        <div className="glass-panel-glow rounded-2xl p-5 md:col-span-2 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-indigo-400" />
              <h3 className="font-heading font-bold text-white text-base">Meta de Prospección del Evento</h3>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
              {totalLeads} / {GOAL_LEADS} Leads
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span>Progreso de Captación</span>
              <span className="font-bold text-indigo-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              {totalLeads >= GOAL_LEADS 
                ? '🎉 ¡Meta superada! Excelente tracción en el stand de Expo Maternidad.'
                : `Faltan ${GOAL_LEADS - totalLeads} prospectos para alcanzar la meta comercial del día.`}
            </p>
          </div>
        </div>

        {/* Lead Temperature Intent */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-rose-400 mb-2">
            <Flame className="w-5 h-5" />
            <h4 className="font-bold text-sm text-white">Tasa Alta Intención</h4>
          </div>
          <div className="text-3xl font-black text-white font-mono my-2">
            {highIntentRate}%
          </div>
          <p className="text-xs text-slate-400">
            {calientesCount} prospectos catalogados como <strong className="text-rose-400">Calientes 🔥</strong> listos para DemoBook.
          </p>
        </div>

        {/* Dolor Promedio */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-amber-400 mb-2">
            <Brain className="w-5 h-5" />
            <h4 className="font-bold text-sm text-white">Dolor Promedio</h4>
          </div>
          <div className="text-3xl font-black text-white font-mono my-2">
            {avgPainLevel} <span className="text-base text-slate-500 font-normal">/ 10</span>
          </div>
          <p className="text-xs text-slate-400">
            Severidad promedio reportada por padres sobre abuso de pantallas.
          </p>
        </div>
      </div>

      {/* CRM Funnel & Thermal Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Termómetro de Leads */}
        <div className="glass-panel rounded-2xl p-5">
          <h4 className="font-heading font-bold text-base text-white mb-4 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Distribución Térmica</span>
          </h4>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center space-x-1 text-rose-300">
                  <span>🔥 Caliente (Demo Inmediata)</span>
                </span>
                <span className="font-mono font-bold text-rose-400">{calientesCount} ({totalLeads ? Math.round((calientesCount/totalLeads)*100) : 0}%)</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded-full" 
                  style={{ width: `${totalLeads ? (calientesCount/totalLeads)*100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center space-x-1 text-amber-300">
                  <span>⛅ Tibio (Nutrición WhatsApp)</span>
                </span>
                <span className="font-mono font-bold text-amber-400">{tibiosCount} ({totalLeads ? Math.round((tibiosCount/totalLeads)*100) : 0}%)</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full" 
                  style={{ width: `${totalLeads ? (tibiosCount/totalLeads)*100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center space-x-1 text-cyan-300">
                  <span>❄️ Frío (Informativo)</span>
                </span>
                <span className="font-mono font-bold text-cyan-400">{friosCount} ({totalLeads ? Math.round((friosCount/totalLeads)*100) : 0}%)</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full" 
                  style={{ width: `${totalLeads ? (friosCount/totalLeads)*100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Asesores Ranking */}
        <div className="glass-panel rounded-2xl p-5">
          <h4 className="font-heading font-bold text-base text-white mb-4 flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Leaderboard de Asesores</span>
          </h4>

          <div className="space-y-3">
            {sortedAdvisors.length === 0 ? (
              <p className="text-xs text-slate-500">Sin datos de asesores</p>
            ) : (
              sortedAdvisors.map(([advisor, count], idx) => (
                <div key={advisor} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      idx === 0 ? 'bg-amber-400 text-slate-950' : (idx === 1 ? 'bg-slate-300 text-slate-950' : 'bg-slate-800 text-slate-400')
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">{advisor}</span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                    {count} leads
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Distritos */}
        <div className="glass-panel rounded-2xl p-5">
          <h4 className="font-heading font-bold text-base text-white mb-4 flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Top Distritos Lima</span>
          </h4>

          <div className="space-y-3">
            {sortedDistricts.length === 0 ? (
              <p className="text-xs text-slate-500">Sin datos de distritos</p>
            ) : (
              sortedDistricts.map(([district, count]) => (
                <div key={district} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-xs font-medium text-slate-300">{district}</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {count} ({totalLeads ? Math.round((count/totalLeads)*100) : 0}%)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
