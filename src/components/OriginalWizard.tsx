import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { LeadData, getSavedSheetTabs, LS_ACTIVE_SHEET_TAB } from '../data/realLeads';
import { subscribeToCloudTabs, addCloudTab, saveCloudLead } from '../services/cloudCrm';

interface Props {
  onLeadSaved: (newLead: LeadData) => void;
  totalLeadsCount: number;
}

export const OriginalWizard: React.FC<Props> = ({ onLeadSaved }) => {
  const [currentSlide, setCurrentSlide] = useState<string>('slide0');
  const [prevSlide, setPrevSlide] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Tabs de Pestañas sincronizadas en la nube
  const [sheetTabs, setSheetTabs] = useState<string[]>(() => getSavedSheetTabs());
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    try {
      const active = localStorage.getItem(LS_ACTIVE_SHEET_TAB);
      return active || 'Expo M (JA)';
    } catch {
      return 'Expo M (JA)';
    }
  });
  const [isCustomTab, setIsCustomTab] = useState<boolean>(false);
  const [customTabName, setCustomTabName] = useState<string>('');

  // Form State
  const [nivelPreocupacion, setNivelPreocupacion] = useState<number | null>(null);
  const [conocimientoDano, setConocimientoDano] = useState<string>('');
  const [edadHijos, setEdadHijos] = useState<string>('');
  const [preguntaCondicional, setPreguntaCondicional] = useState<string>('');
  const [respuestaCondicional, setRespuestaCondicional] = useState<string>('');
  const [inputEscuela, setInputEscuela] = useState<string>('');
  const [interesSolucion, setInteresSolucion] = useState<string>('');
  const [nombreMadre, setNombreMadre] = useState<string>('');
  const [celular, setCelular] = useState<string>('');
  const [distrito, setDistrito] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // Escucha de pestañas en tiempo real desde la nube (Firestore)
  useEffect(() => {
    const unsubscribe = subscribeToCloudTabs((cloudTabs) => {
      setSheetTabs(cloudTabs);
    });
    return () => unsubscribe();
  }, []);

  const goToSlide = (nextSlide: string) => {
    setPrevSlide(currentSlide);
    setCurrentSlide(nextSlide);
  };

  const getSlideClass = (slideId: string) => {
    if (currentSlide === slideId) return 'slide active';
    if (prevSlide === slideId) return 'slide exit';
    return 'slide';
  };

  const resetForm = () => {
    setNivelPreocupacion(null);
    setConocimientoDano('');
    setEdadHijos('');
    setPreguntaCondicional('');
    setRespuestaCondicional('');
    setInputEscuela('');
    setInteresSolucion('');
    setNombreMadre('');
    setCelular('');
    setDistrito('');
    setObservaciones('');
    setContactError(null);
    setIsCustomTab(false);
    setCustomTabName('');
    setIsSubmitting(false);
    goToSlide('slide0');
  };

  const handleScaleClick = (value: number) => {
    setNivelPreocupacion(value);
    goToSlide('slide2');
  };

  // Pregunta 2: Avanza fluidamente sin bloquear con alertas
  const handleConocimientoDanoNext = () => {
    goToSlide('slide3');
  };

  const handleEdadHijosClick = (choice: 'Mayores (+)' | 'Menores (-)' | 'Ambas') => {
    setEdadHijos(choice);
    if (choice === 'Mayores (+)') {
      goToSlide('slide4a');
    } else if (choice === 'Menores (-)') {
      goToSlide('slide4b');
    } else {
      goToSlide('slide4c');
    }
  };

  const handleCondChoice = (question: string, answer: string) => {
    setPreguntaCondicional(question);
    setRespuestaCondicional(answer);
    goToSlide('slide5');
  };

  // Pregunta 4c: Avanza fluidamente sin bloquear con alertas
  const handleCondTextNext = (question: string) => {
    setPreguntaCondicional(question);
    setRespuestaCondicional(inputEscuela.trim() || 'Sin comentarios');
    goToSlide('slide5');
  };

  const handleInteresClick = (answer: string) => {
    setInteresSolucion(answer);
    goToSlide('slide6');
  };

  const handleContactNext = () => {
    if (!nombreMadre.trim() || !celular.trim()) {
      setContactError('Por favor ingresa al menos el Nombre y Celular.');
      return;
    }
    if (celular.trim().length < 6) {
      setContactError('Ingresa un número de celular válido.');
      return;
    }
    setContactError(null);
    goToSlide('slide7');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const now = new Date();
    const formattedDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const generatedId = `id-${Math.random().toString(16).substring(2, 10)}`;

    // Resolver pestaña de destino
    let finalTab = selectedTab;
    if (isCustomTab && customTabName.trim() !== '') {
      finalTab = customTabName.trim();
      try {
        await addCloudTab(finalTab);
      } catch (e) {
        console.warn('Error guardando pestaña personalizada:', e);
      }
    }

    try {
      localStorage.setItem(LS_ACTIVE_SHEET_TAB, finalTab);
    } catch (e) {}

    const newLead: LeadData = {
      id: generatedId,
      timestamp: formattedDate,
      nivelPreocupacion: nivelPreocupacion || 10,
      conocimientoDano: conocimientoDano.trim() || 'No especifica',
      edadHijos: edadHijos,
      preguntaCondicional: preguntaCondicional,
      respuestaCondicional: respuestaCondicional,
      interesSolucion: interesSolucion,
      nombreMadre: nombreMadre.trim(),
      celular: celular.trim(),
      distrito: distrito.trim() || 'No especifica',
      observaciones: observaciones.trim(),
      gestCall: '',
      obserCalls: '',
      sheetTab: finalTab,
      estadoCrm: 'nuevo'
    };

    try {
      await saveCloudLead(newLead);
    } catch (err) {
      console.warn("No se pudo escribir en Firestore, guardando localmente:", err);
    }

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    onLeadSaved(newLead);
    setShowSuccessToast(true);

    setTimeout(() => {
      setShowSuccessToast(false);
      resetForm();
    }, 2200);
  };

  return (
    <>
      {/* Toast no intrusivo de éxito */}
      {showSuccessToast && (
        <div style={{
          position: 'fixed',
          top: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #10B981, #059669)',
          color: 'white',
          padding: '14px 24px',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '1rem',
          fontWeight: 700,
          animation: 'gentle-bounce 0.5s ease'
        }}>
          <span>🎉</span>
          <span>¡Prospecto guardado con éxito!</span>
        </div>
      )}

      {/* Slide 0: Portada */}
      <div className={getSlideClass('slide0')} id="slide0">
        <div className="icon-zentry"></div>
        <h1 className="original-title">Protege la mente de tu hijo en la era digital</h1>
        <p className="original-subtitle">
          Descubre ZentryOS: El primer sistema operativo que bloquea la adicción algorítmica y potencia el aprendizaje.
        </p>

        {/* Selector rápido de Pestaña en portada */}
        <div style={{ margin: '15px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>Destino:</span>
          <select
            value={isCustomTab ? '__NEW__' : selectedTab}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setIsCustomTab(true);
              } else {
                setIsCustomTab(false);
                setSelectedTab(e.target.value);
                try { localStorage.setItem(LS_ACTIVE_SHEET_TAB, e.target.value); } catch (e) {}
              }
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1.5px solid #CBD5E1',
              background: 'rgba(255,255,255,0.85)',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#2563EB',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {sheetTabs.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value="__NEW__">+ ✍️ Escribir nueva pestaña...</option>
          </select>
        </div>

        {isCustomTab && (
          <div style={{ maxWidth: '320px', margin: '0 auto 15px' }}>
            <input
              type="text"
              value={customTabName}
              onChange={(e) => setCustomTabName(e.target.value)}
              placeholder="Nombre de la nueva pestaña..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '2px solid #2563EB',
                fontSize: '0.85rem',
                outline: 'none',
                background: 'white'
              }}
              autoFocus
            />
          </div>
        )}

        <button className="btn-original" onClick={() => goToSlide('slide1')}>
          Evaluar Riesgo
        </button>
      </div>

      {/* Slide 1: Escala 1 a 10 */}
      <div className={getSlideClass('slide1')} id="slide1">
        <p className="original-question">
          ¿En una escala del 1 al 10, qué tan preocupada estás por el impacto de los algoritmos y pantallas en la atención de tu hijo?
        </p>
        <div className="scale-container">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <button
              key={num}
              className={`scale-btn ${nivelPreocupacion === num ? 'selected' : ''}`}
              onClick={() => handleScaleClick(num)}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Slide 2: Daño Percibido (Texto Opcional) */}
      <div className={getSlideClass('slide2')} id="slide2">
        <p className="original-question">
          ¿Ha escuchado alguna vez del daño que puede generar el consumo dentro de los dispositivos para niños y adolescentes?
        </p>
        <div className="form-group-original">
          <textarea
            id="inputDano"
            value={conocimientoDano}
            onChange={(e) => setConocimientoDano(e.target.value)}
            className="form-textarea-original"
            placeholder="Escribe tu respuesta aquí (o pulsa siguiente)..."
          />
        </div>
        <button className="btn-original" onClick={handleConocimientoDanoNext}>
          Siguiente
        </button>
      </div>

      {/* Slide 3: Edad Hijos */}
      <div className={getSlideClass('slide3')} id="slide3">
        <p className="original-question">¿Sus hijos son menores o mayores de 13 años?</p>
        <button className="btn-original" onClick={() => handleEdadHijosClick('Mayores (+)')}>
          Mayores (+)
        </button>
        <button className="btn-original btn-original-outline" onClick={() => handleEdadHijosClick('Menores (-)')}>
          Menores (-)
        </button>
        <button className="btn-original btn-original-outline" onClick={() => handleEdadHijosClick('Ambas')}>
          Ambas
        </button>
      </div>

      {/* Slide 4a: Mayores */}
      <div className={getSlideClass('slide4a')} id="slide4a">
        <p className="original-question">¿Han notado una reducción de conversaciones importantes en familia?</p>
        <button className="btn-original" onClick={() => handleCondChoice('¿Reducción conversaciones?', 'Sí')}>
          Sí
        </button>
        <button className="btn-original btn-original-outline" onClick={() => handleCondChoice('¿Reducción conversaciones?', 'No')}>
          No
        </button>
      </div>

      {/* Slide 4b: Menores */}
      <div className={getSlideClass('slide4b')} id="slide4b">
        <p className="original-question">¿Consideran que para el futuro que se avecina sus hijos deberían dominar herramientas Tech?</p>
        <button className="btn-original" onClick={() => handleCondChoice('¿Dominar Tech?', 'Sí')}>
          Sí
        </button>
        <button className="btn-original btn-original-outline" onClick={() => handleCondChoice('¿Dominar Tech?', 'No')}>
          No
        </button>
      </div>

      {/* Slide 4c: Ambas (Texto Opcional) */}
      <div className={getSlideClass('slide4c')} id="slide4c">
        <p className="original-question">¿Creen que la estructura base de la escuela tradicional garantiza el futuro de sus hijos?</p>
        <div className="form-group-original">
          <textarea
            id="inputEscuela"
            value={inputEscuela}
            onChange={(e) => setInputEscuela(e.target.value)}
            className="form-textarea-original"
            placeholder="Escribe tu opinión (o pulsa siguiente)..."
          />
        </div>
        <button className="btn-original" onClick={() => handleCondTextNext('¿Estructura tradicional garantiza futuro?')}>
          Siguiente
        </button>
      </div>

      {/* Slide 5: Interés en la solución */}
      <div className={getSlideClass('slide5')} id="slide5">
        <p className="original-question">
          Si existiera una solución que le ayude a sus hijos a reducir el consumo negativo y potencie su desarrollo cognitivo, ¿les interesaría conocer más al respecto?
        </p>
        <button className="btn-original" onClick={() => handleInteresClick('Sí')}>
          Sí
        </button>
        <button className="btn-original btn-original-outline" onClick={() => handleInteresClick('No')}>
          No
        </button>
      </div>

      {/* Slide 6: Datos de Contacto */}
      <div className={getSlideClass('slide6')} id="slide6">
        <h2 className="original-title">Último paso</h2>
        <p className="original-subtitle">Registra tus datos de contacto.</p>

        {contactError && (
          <div style={{
            background: '#FEF2F2',
            color: '#DC2626',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '14px',
            border: '1px solid #FECACA'
          }}>
            ⚠️ {contactError}
          </div>
        )}

        <div className="form-group-original">
          <label>Nombre Completo</label>
          <input
            type="text"
            id="inputNombre"
            value={nombreMadre}
            onChange={(e) => {
              setNombreMadre(e.target.value);
              if (contactError) setContactError(null);
            }}
            className="form-control-original"
            placeholder="Ej. María Pérez"
            required
          />
        </div>

        <div className="form-group-original">
          <label>Número de Celular</label>
          <input
            type="tel"
            id="inputCelular"
            value={celular}
            onChange={(e) => {
              setCelular(e.target.value.replace(/[^0-9]/g, ''));
              if (contactError) setContactError(null);
            }}
            className="form-control-original"
            placeholder="Solo números"
            required
          />
        </div>

        <div className="form-group-original">
          <label>Distrito</label>
          <input
            type="text"
            id="inputDistrito"
            value={distrito}
            onChange={(e) => setDistrito(e.target.value)}
            className="form-control-original"
            placeholder="Tu distrito (opcional)"
          />
        </div>

        <button className="btn-original" onClick={handleContactNext}>
          Siguiente
        </button>
      </div>

      {/* Slide 7: vCard, Observaciones y Pestaña de Destino */}
      <div className={`${getSlideClass('slide7')} slide-scrollable`} id="slide7">
        <h1 className="original-title" style={{ marginTop: '20px' }}>¡Casi listo!</h1>
        <p className="original-subtitle" style={{ marginBottom: '10px' }}>
          Escanea mi vCard para estar en contacto.
        </p>

        <img
          id="qr-code-img"
          src="https://raw.githubusercontent.com/j-angel-borges/zentry-assets/main/qr-vcard"
          alt="QR vCard"
        />

        <div className="form-group-original" style={{ width: '100%', maxWidth: '500px', marginTop: '15px' }}>
          <label style={{ textAlign: 'center' }}>Observaciones Adicionales (Post-Charla)</label>
          <textarea
            id="inputObservaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="form-textarea-original"
            placeholder="Anota cualquier detalle relevante sobre este lead..."
          />
        </div>

        {/* Selector de Pestaña de destino en Slide 7 */}
        <div className="form-group-original" style={{ width: '100%', maxWidth: '500px', marginTop: '10px' }}>
          <label style={{ fontWeight: 600, color: '#334155' }}>
            📊 Pestaña de Destino en Admin:
          </label>
          <select
            value={isCustomTab ? '__NEW__' : selectedTab}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setIsCustomTab(true);
              } else {
                setIsCustomTab(false);
                setSelectedTab(e.target.value);
                try { localStorage.setItem(LS_ACTIVE_SHEET_TAB, e.target.value); } catch (e) {}
              }
            }}
            className="form-control-original"
            style={{ padding: '10px 14px', fontSize: '0.92rem', borderRadius: '10px', background: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}
          >
            {sheetTabs.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value="__NEW__">+ ✍️ Escribir nueva pestaña...</option>
          </select>

          {isCustomTab && (
            <div style={{ marginTop: '8px' }}>
              <input
                type="text"
                value={customTabName}
                onChange={(e) => setCustomTabName(e.target.value)}
                placeholder="Escribe el nombre de la nueva pestaña..."
                className="form-control-original"
                style={{ padding: '10px 14px', fontSize: '0.92rem', borderRadius: '10px', border: '2px solid #2563EB', background: 'white' }}
                autoFocus
              />
              <span style={{ fontSize: '0.75rem', color: '#2563EB', marginTop: '4px', display: 'block' }}>
                ℹ️ Esta nueva pestaña se guardará automáticamente para todos los próximos leads.
              </span>
            </div>
          )}
        </div>

        <button
          className="btn-original"
          id="btnSubmit"
          disabled={isSubmitting}
          onClick={handleSubmit}
          style={{ marginBottom: '60px' }}
        >
          <span>{isSubmitting ? 'Guardando...' : 'Subir Lead'}</span>
          {isSubmitting && <div className="spinner-original"></div>}
        </button>
      </div>
    </>
  );
};
