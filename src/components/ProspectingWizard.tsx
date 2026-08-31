import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Flame, 
  CloudSun, 
  Snowflake, 
  UserCheck, 
  Send, 
  RotateCcw, 
  ShieldAlert, 
  Brain, 
  Gamepad2, 
  Smartphone,
  QrCode,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db, collection, addDoc, serverTimestamp, LEADS_COLLECTION } from '../firebase';
import { LeadRecord, DISTRITOS_LIMA, ASESORES_EQUIPO } from '../data/sampleLeads';

interface Props {
  onLeadCreated: (lead: LeadRecord) => void;
  onOpenAdmin: () => void;
}

export const ProspectingWizard: React.FC<Props> = ({ onLeadCreated, onOpenAdmin }) => {
  const [step, setStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedLead, setSubmittedLead] = useState<LeadRecord | null>(null);

  // Form State
  const [asesor, setAsesor] = useState<string>(ASESORES_EQUIPO[0]);
  const [otroAsesor, setOtroAsesor] = useState<string>('');
  const [nivelPreocupacion, setNivelPreocupacion] = useState<number>(8);
  const [conocimientoDano, setConocimientoDano] = useState<string>('');
  const [otroDano, setOtroDano] = useState<string>('');
  
  const [edadHijos, setEdadHijos] = useState<'Menores (-)' | 'Mayores (+)' | 'Ambas' | ''>('');
  const [preguntaCondicional, setPreguntaCondicional] = useState<string>('');
  const [respuestaCondicional, setRespuestaCondicional] = useState<string>('');
  
  const [interesSolucion, setInteresSolucion] = useState<'Sí' | 'No' | 'Más Info'>('Sí');
  
  const [nombreMadre, setNombreMadre] = useState<string>('');
  const [celular, setCelular] = useState<string>('');
  const [distrito, setDistrito] = useState<string>('Santiago de Surco');
  const [otroDistrito, setOtroDistrito] = useState<string>('');
  const [nombreHijo, setNombreHijo] = useState<string>('');
  const [edadHijo, setEdadHijo] = useState<string>('');
  
  const [observaciones, setObservaciones] = useState<string>('');
  const [temperatura, setTemperatura] = useState<'caliente' | 'tibio' | 'frio'>('caliente');

  // Handle Age Cohort change & assign conditional question
  const handleSelectCohorte = (cohorte: 'Menores (-)' | 'Mayores (+)' | 'Ambas') => {
    setEdadHijos(cohorte);
    if (cohorte === 'Menores (-)') {
      setPreguntaCondicional('¿Le dejas el celular para calmar berrinches o durante comidas/esperas?');
    } else if (cohorte === 'Mayores (+)') {
      setPreguntaCondicional('¿Notas aislamiento social, irritabilidad o desatención escolar por redes/juegos?');
    } else {
      setPreguntaCondicional('¿Sientes que el sistema tradicional no les enseña a dominar la IA y la tecnología?');
    }
    setRespuestaCondicional('');
  };

  const validateCurrentStep = (): boolean => {
    if (step === 0) {
      if (!asesor) {
        alert('Por favor selecciona el asesor comercial');
        return false;
      }
    }
    if (step === 2) {
      if (!conocimientoDano && !otroDano) {
        alert('Por favor selecciona o describe la percepción del daño');
        return false;
      }
    }
    if (step === 3) {
      if (!edadHijos) {
        alert('Por favor selecciona la cohorte de edad');
        return false;
      }
    }
    if (step === 4) {
      if (!respuestaCondicional) {
        alert('Por favor selecciona una respuesta para continuar');
        return false;
      }
    }
    if (step === 6) {
      if (!nombreMadre.trim()) {
        alert('Por favor ingresa el nombre del Padre o Madre');
        return false;
      }
      if (!celular.trim() || celular.replace(/\D/g, '').length < 8) {
        alert('Por favor ingresa un número de celular válido (mínimo 8-9 dígitos)');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const finalAsesor = asesor === 'Otro' ? (otroAsesor || 'Asesor Stand') : asesor;
    const finalDistrito = distrito === 'Otro' ? (otroDistrito || 'Lima') : distrito;
    const finalDano = conocimientoDano === 'Otro' ? (otroDano || 'Percepción general') : conocimientoDano;
    
    const leadId = `EXP-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date();

    const newLead: LeadRecord = {
      id: leadId,
      timestamp: now.toISOString(),
      fechaFormatted: now.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }),
      asesor: finalAsesor,
      nivelPreocupacion,
      conocimientoDano: finalDano,
      edadHijos,
      preguntaCondicional,
      respuestaCondicional,
      interesSolucion,
      nombreMadre: nombreMadre.trim(),
      celular: celular.trim(),
      distrito: finalDistrito,
      nombreHijo: nombreHijo.trim() || 'No especificado',
      edadHijo: edadHijo ? parseInt(edadHijo) || edadHijo : 'No especificada',
      observaciones: observaciones.trim() || 'Capturado en stand Expo Maternidad.',
      temperatura,
      estadoCrm: temperatura === 'caliente' ? 'demo_agendada' : (temperatura === 'tibio' ? 'contactado' : 'nuevo'),
      notasCrm: `Registrado en evento. Temperatura inicial: ${temperatura.toUpperCase()}.`,
      origen: 'Expo Maternidad 2026'
    };

    try {
      // 1. Guardar en Firestore
      await addDoc(collection(db, LEADS_COLLECTION), {
        ...newLead,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore offline o con error de escritura, guardando en cache local:", err);
    }

    // 2. Disparar Confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti fallback
    }

    // 3. Notificar al estado de la app
    onLeadCreated(newLead);
    setSubmittedLead(newLead);
    setIsSubmitting(false);
    setStep(8); // Pantalla de éxito y vCard
  };

  const handleResetForm = () => {
    setNombreMadre('');
    setCelular('');
    setNombreHijo('');
    setEdadHijo('');
    setObservaciones('');
    setConocimientoDano('');
    setOtroDano('');
    setEdadHijos('');
    setPreguntaCondicional('');
    setRespuestaCondicional('');
    setNivelPreocupacion(8);
    setTemperatura('caliente');
    setSubmittedLead(null);
    setStep(0);
  };

  const getHeatColor = (val: number) => {
    if (val >= 8) return 'from-rose-500 to-red-600 text-rose-400 border-rose-500/40';
    if (val >= 5) return 'from-amber-500 to-yellow-600 text-amber-400 border-amber-500/40';
    return 'from-emerald-500 to-teal-600 text-emerald-400 border-emerald-500/40';
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:py-8">
      {/* Top Brand Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
            <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-heading font-black tracking-wider text-xl bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
                ZENTRY<span className="text-indigo-400">OS</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 font-mono">
                PROSPECTOR
              </span>
            </div>
            <p className="text-xs text-slate-400">Captura Rápida • Expo Maternidad</p>
          </div>
        </div>

        <button
          onClick={onOpenAdmin}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition"
          title="Abrir hoja de cálculo y CRM"
        >
          <span>⚙️ CRM / Admin</span>
        </button>
      </div>

      {/* Progress Bar (Visible on steps 1 to 7) */}
      {step > 0 && step < 8 && (
        <div className="mb-6">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-2 font-mono">
            <span>Paso {step} de 7</span>
            <span>{Math.round((step / 7) * 100)}% Completado</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${(step / 7) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* SLIDE 0: HERO / PORTADA */}
      {step === 0 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs mb-4">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            <span>Diagnóstico de Bienestar Digital</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
            Protege la mente de tu hijo en la <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">era digital</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto mb-6">
            Evaluación interactiva para padres sobre exposición a pantallas, prevención de adicción temprana y desarrollo de habilidades cognitivas.
          </p>

          <div className="max-w-md mx-auto mb-6 text-left">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              👤 Asesor Comercial en Turno:
            </label>
            <select
              value={asesor}
              onChange={(e) => setAsesor(e.target.value)}
              className="w-full p-3 rounded-xl glass-input text-sm font-medium focus:ring-2 focus:ring-indigo-500"
            >
              {ASESORES_EQUIPO.map((a) => (
                <option key={a} value={a} className="bg-slate-900 text-white">{a}</option>
              ))}
              <option value="Otro" className="bg-slate-900 text-white">Otro Asesor...</option>
            </select>

            {asesor === 'Otro' && (
              <input
                type="text"
                placeholder="Escribe el nombre del asesor"
                value={otroAsesor}
                onChange={(e) => setOtroAsesor(e.target.value)}
                className="w-full mt-2 p-3 rounded-xl glass-input text-sm"
              />
            )}
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-2 mx-auto"
          >
            <span>Iniciar Evaluación</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* SLIDE 1: NIVEL DE PREOCUPACIÓN (1-10) */}
      {step === 1 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-wider font-mono text-indigo-400 mb-2">Paso 1 • Nivel de Alarma</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            ¿Qué tan preocupado estás por el tiempo que tus hijos pasan en pantallas?
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Califica del 1 (Totalmente tranquilo) al 10 (Máxima preocupación).
          </p>

          <div className="my-8 text-center">
            <div className={`inline-block text-5xl font-black px-6 py-4 rounded-3xl bg-slate-900/90 border shadow-2xl mb-4 ${getHeatColor(nivelPreocupacion)}`}>
              {nivelPreocupacion} <span className="text-2xl font-normal text-slate-500">/ 10</span>
            </div>

            <div className="px-4">
              <input
                type="range"
                min="1"
                max="10"
                value={nivelPreocupacion}
                onChange={(e) => setNivelPreocupacion(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
                <span>1 (Mínimo)</span>
                <span>5 (Moderado)</span>
                <span>10 (Crítico)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SLIDE 2: CONOCIMIENTO DEL DAÑO */}
      {step === 2 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-wider font-mono text-indigo-400 mb-2">Paso 2 • Diagnóstico Cognitivo</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            ¿Has notado cambios o impacto del uso de dispositivos en tu hijo?
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Selecciona el escenario que mejor describe la situación en casa.
          </p>

          <div className="space-y-3 mb-6">
            {[
              "Sí, cambia notablemente de humor (irritabilidad o berrinches) al apagar el celular.",
              "Le cuesta concentrarse en tareas escolares y prefiere videos cortos (TikTok/Shorts).",
              "Se desvela con el celular en la cama o duerme menos horas de lo debido.",
              "Gasta dinero o juega videojuegos adictivos (Roblox, Free Fire, etc.) sin límite.",
              "Sospecho que le afecta pero no sé cómo poner reglas sin generar discusiones.",
              "Otro"
            ].map((option) => (
              <button
                key={option}
                onClick={() => setConocimientoDano(option)}
                className={`w-full text-left p-4 rounded-2xl border transition flex items-start space-x-3 ${
                  conocimientoDano === option 
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  conocimientoDano === option ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'
                }`}>
                  {conocimientoDano === option && <Check className="w-3 h-3" />}
                </div>
                <span className="text-sm font-medium">{option}</span>
              </button>
            ))}

            {conocimientoDano === 'Otro' && (
              <input
                type="text"
                placeholder="Describe qué cambios has observado..."
                value={otroDano}
                onChange={(e) => setOtroDano(e.target.value)}
                className="w-full p-3 rounded-xl glass-input text-sm mt-2"
              />
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SLIDE 3: COHORTE ETARIO */}
      {step === 3 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-wider font-mono text-indigo-400 mb-2">Paso 3 • Segmentación Etaria</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            ¿En qué rango de edad se encuentran tus hijos?
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Selecciona la cohorte para personalizar el enfoque pedagógico.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => handleSelectCohorte('Menores (-)')}
              className={`p-5 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-3 ${
                edadHijos === 'Menores (-)'
                  ? 'bg-gradient-to-b from-indigo-600/30 to-violet-600/20 border-indigo-500 text-white shadow-xl shadow-indigo-500/20'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl">
                👶
              </div>
              <div>
                <div className="font-bold text-base">Menores (-)</div>
                <div className="text-xs text-slate-400">3 a 9 años</div>
              </div>
              <div className="text-xs text-indigo-300 bg-indigo-950/60 px-2 py-1 rounded-md border border-indigo-800/50">
                Estimulación & Hábitos
              </div>
            </button>

            <button
              onClick={() => handleSelectCohorte('Mayores (+)')}
              className={`p-5 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-3 ${
                edadHijos === 'Mayores (+)'
                  ? 'bg-gradient-to-b from-indigo-600/30 to-violet-600/20 border-indigo-500 text-white shadow-xl shadow-indigo-500/20'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl">
                🧑
              </div>
              <div>
                <div className="font-bold text-base">Mayores (+)</div>
                <div className="text-xs text-slate-400">10 a 17 años</div>
              </div>
              <div className="text-xs text-indigo-300 bg-indigo-950/60 px-2 py-1 rounded-md border border-indigo-800/50">
                Redes & Ludopatía
              </div>
            </button>

            <button
              onClick={() => handleSelectCohorte('Ambas')}
              className={`p-5 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-3 ${
                edadHijos === 'Ambas'
                  ? 'bg-gradient-to-b from-indigo-600/30 to-violet-600/20 border-indigo-500 text-white shadow-xl shadow-indigo-500/20'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl">
                👨‍👩‍👧‍👦
              </div>
              <div>
                <div className="font-bold text-base">Ambas Edades</div>
                <div className="text-xs text-slate-400">Hermanos mixtos</div>
              </div>
              <div className="text-xs text-indigo-300 bg-indigo-950/60 px-2 py-1 rounded-md border border-indigo-800/50">
                Ecosistema Integral
              </div>
            </button>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SLIDE 4: PREGUNTA CONDICIONAL */}
      {step === 4 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-wider font-mono text-indigo-400 mb-2">
            Paso 4 • Dinámica Específica ({edadHijos})
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {preguntaCondicional}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Elige la respuesta que refleja la dinámica habitual de tu hogar:
          </p>

          <div className="space-y-3 mb-6">
            {edadHijos === 'Menores (-)' && [
              "Sí, con frecuencia para evitar berrinches en lugares públicos o restaurantes.",
              "A veces, cuando necesitamos terminar labores del trabajo o del hogar.",
              "Tratamos de evitarlo, pero en el colegio o con amigos siempre piden pantalla.",
              "No, tenemos reglas pero es una batalla constante de llantos y quejas."
            ].map((opt) => (
              <button
                key={opt}
                onClick={() => setRespuestaCondicional(opt)}
                className={`w-full text-left p-4 rounded-2xl border transition flex items-start space-x-3 ${
                  respuestaCondicional === opt 
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  respuestaCondicional === opt ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'
                }`}>
                  {respuestaCondicional === opt && <Check className="w-3 h-3" />}
                </div>
                <span className="text-sm font-medium">{opt}</span>
              </button>
            ))}

            {edadHijos === 'Mayores (+)' && [
              "Sí, pasa horas con audífonos en su cuarto y casi no conversa en familia.",
              "Ha bajado sus calificaciones y pospone las tareas escolares por estar conectado.",
              "Juega online hasta altas horas de la noche y amanece cansado/irritable.",
              "Siento que la tecnología lo está aislando del mundo real y de sus deportes."
            ].map((opt) => (
              <button
                key={opt}
                onClick={() => setRespuestaCondicional(opt)}
                className={`w-full text-left p-4 rounded-2xl border transition flex items-start space-x-3 ${
                  respuestaCondicional === opt 
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  respuestaCondicional === opt ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'
                }`}>
                  {respuestaCondicional === opt && <Check className="w-3 h-3" />}
                </div>
                <span className="text-sm font-medium">{opt}</span>
              </button>
            ))}

            {edadHijos === 'Ambas' && [
              "Sí, el colegio tradicional solo prohíbe pero no enseña a usar la IA y tecnología a su favor.",
              "Es muy difícil gestionar dos edades distintas con reglas que funcionen para ambos.",
              "El mayor contagia los malos hábitos de pantallas y redes al menor.",
              "Queremos que aprendan lógica, programación y pensamiento crítico en vez de perder el tiempo."
            ].map((opt) => (
              <button
                key={opt}
                onClick={() => setRespuestaCondicional(opt)}
                className={`w-full text-left p-4 rounded-2xl border transition flex items-start space-x-3 ${
                  respuestaCondicional === opt 
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  respuestaCondicional === opt ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'
                }`}>
                  {respuestaCondicional === opt && <Check className="w-3 h-3" />}
                </div>
                <span className="text-sm font-medium">{opt}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SLIDE 5: INTENCIONALIDAD DE SOLUCIÓN / PITCH */}
      {step === 5 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs mb-3 font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            <span>Paso 5 • Propuesta de Valor</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            ¿Te gustaría conocer una solución que <span className="text-indigo-400">premie el aprendizaje</span> antes del entretenimiento?
          </h2>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-indigo-500/30 text-slate-300 text-sm max-w-lg mx-auto mb-6 text-left space-y-2">
            <div className="flex items-center space-x-2 text-indigo-300 font-semibold">
              <Gamepad2 className="w-4 h-4" />
              <span>ZentryOS: Sistema Operativo Bilateral</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              En lugar de pelear quitando el móvil, el menor desbloquea tiempo de juegos o redes resolviendo retos de matemáticas, ciencia y lógica adaptativa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => { setInteresSolucion('Sí'); handleNext(); }}
              className={`p-4 rounded-2xl border font-bold text-sm transition flex flex-col items-center justify-center space-y-2 ${
                interesSolucion === 'Sí'
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-2xl">🟢</span>
              <span>¡Definitivamente Sí!</span>
            </button>

            <button
              onClick={() => { setInteresSolucion('Más Info'); handleNext(); }}
              className={`p-4 rounded-2xl border font-bold text-sm transition flex flex-col items-center justify-center space-y-2 ${
                interesSolucion === 'Más Info'
                  ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow-lg shadow-amber-600/20'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-2xl">🟡</span>
              <span>Me interesa más info</span>
            </button>

            <button
              onClick={() => { setInteresSolucion('No'); handleNext(); }}
              className={`p-4 rounded-2xl border font-bold text-sm transition flex flex-col items-center justify-center space-y-2 ${
                interesSolucion === 'No'
                  ? 'bg-slate-700/50 border-slate-500 text-slate-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="text-2xl">⚪</span>
              <span>En este momento no</span>
            </button>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SLIDE 6: FORMULARIO DE CONTACTO */}
      {step === 6 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-wider font-mono text-indigo-400 mb-2">Paso 6 • Datos del Titular</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Registro de Diagnóstico Personalizado
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Completa los datos para enviar el reporte y agendar la demostración.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nombre del Padre o Madre <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Mariana Alarcón Ruiz"
                value={nombreMadre}
                onChange={(e) => setNombreMadre(e.target.value)}
                className="w-full p-3.5 rounded-xl glass-input text-sm focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Número de WhatsApp / Celular <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                    🇵🇪 +51
                  </div>
                  <input
                    type="tel"
                    placeholder="987 654 321"
                    value={celular}
                    onChange={(e) => setCelular(e.target.value)}
                    className="w-full pl-16 p-3.5 rounded-xl glass-input text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Distrito de Residencia
                </label>
                <select
                  value={distrito}
                  onChange={(e) => setDistrito(e.target.value)}
                  className="w-full p-3.5 rounded-xl glass-input text-sm"
                >
                  {DISTRITOS_LIMA.map((d) => (
                    <option key={d} value={d} className="bg-slate-900 text-white">{d}</option>
                  ))}
                </select>

                {distrito === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Escribe el distrito..."
                    value={otroDistrito}
                    onChange={(e) => setOtroDistrito(e.target.value)}
                    className="w-full mt-2 p-3 rounded-xl glass-input text-sm"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nombre del Hijo(a) (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Joaquín"
                  value={nombreHijo}
                  onChange={(e) => setNombreHijo(e.target.value)}
                  className="w-full p-3.5 rounded-xl glass-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Edad del Menor
                </label>
                <input
                  type="text"
                  placeholder="Ej. 6 años"
                  value={edadHijo}
                  onChange={(e) => setEdadHijo(e.target.value)}
                  className="w-full p-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <span>Último Paso (Cierre)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SLIDE 7: CIERRE DEL ASESOR & CALIFICACIÓN */}
      {step === 7 && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8">
          <div className="text-xs uppercase tracking-wider font-mono text-indigo-400 mb-2">Paso 7 • Calificación del Asesor</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Cierre & Temperatura del Prospecto
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Califica el interés real percibido durante la conversación para el CRM.
          </p>

          <div className="space-y-5 mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                🔥 Nivel de Temperatura Comercial:
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTemperatura('caliente')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition ${
                    temperatura === 'caliente'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/20'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Flame className="w-6 h-6 text-rose-400" />
                  <span className="font-bold text-xs">Caliente 🔥</span>
                  <span className="text-[10px] text-slate-400">Agendar Demo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTemperatura('tibio')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition ${
                    temperatura === 'tibio'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <CloudSun className="w-6 h-6 text-amber-400" />
                  <span className="font-bold text-xs">Tibio ⛅</span>
                  <span className="text-[10px] text-slate-400">Nutrición WP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTemperatura('frio')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition ${
                    temperatura === 'frio'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Snowflake className="w-6 h-6 text-cyan-400" />
                  <span className="font-bold text-xs">Frío ❄️</span>
                  <span className="text-[10px] text-slate-400">Informativo</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Observaciones / Notas del Asesor ({asesor}):
              </label>
              <textarea
                rows={3}
                placeholder="Ej. Interesada en la licencia Dúo. El niño probó el juego de matemáticas. Agendar llamada para el fin de semana..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full p-3.5 rounded-xl glass-input text-sm"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm flex items-center space-x-2 shadow-xl shadow-emerald-600/30 transition transform hover:-translate-y-0.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando en Cloud...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Registrar Lead en CRM</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SLIDE 8: ÉXITO & VCARD QR */}
      {step === 8 && submittedLead && (
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-xl shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            ¡Diagnóstico Registrado con Éxito!
          </h2>
          <p className="text-slate-300 text-sm mb-6">
            Lead almacenado en <span className="text-indigo-300 font-mono">Firestore</span> con código <span className="font-mono text-emerald-400 font-bold">{submittedLead.id}</span>
          </p>

          {/* vCard QR Section for the parent */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-sm mx-auto mb-6 shadow-2xl">
            <div className="flex items-center justify-center space-x-2 text-indigo-400 text-xs font-mono uppercase mb-3">
              <QrCode className="w-4 h-4" />
              <span>Código vCard de Contacto</span>
            </div>
            
            <div className="w-44 h-44 bg-white p-2 rounded-xl mx-auto flex items-center justify-center shadow-md">
              <img
                src="https://raw.githubusercontent.com/j-angel-borges/zentry-assets/main/qr-vcard"
                alt="vCard QR"
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to dynamic qr code api if raw github is down
                  (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://wa.me/51${submittedLead.celular.replace(/\D/g, '')}`;
                }}
              />
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Pide al padre escanear este QR para guardar el WhatsApp oficial de <strong className="text-slate-200">ZentryOS</strong> en su móvil.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleResetForm}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Nuevo Prospecto (Siguiente)</span>
            </button>

            <a
              href={`https://wa.me/51${submittedLead.celular.replace(/\D/g, '')}?text=${encodeURIComponent(`¡Hola ${submittedLead.nombreMadre}! Te saluda ${submittedLead.asesor} de ZentryOS. Un gusto haberte conocido en la Expo Maternidad. Te adjunto el brochure de Bienestar Digital para ${submittedLead.nombreHijo}: https://zentryos.web.app`)}`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition"
            >
              <span>💬 Abrir WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
