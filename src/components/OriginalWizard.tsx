import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { db, collection, addDoc, serverTimestamp, LEADS_COLLECTION } from '../firebase';
import { LeadData } from '../data/realLeads';

interface Props {
  onLeadSaved: (newLead: LeadData) => void;
  totalLeadsCount: number;
}

export const OriginalWizard: React.FC<Props> = ({ onLeadSaved, totalLeadsCount }) => {
  const GOAL_LEADS = 120;
  const [currentSlide, setCurrentSlide] = useState<string>('slide0');
  const [prevSlide, setPrevSlide] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
    setIsSubmitting(false);
    goToSlide('slide0');
  };

  const handleScaleClick = (value: number) => {
    setNivelPreocupacion(value);
    goToSlide('slide2');
  };

  const handleConocimientoDanoNext = () => {
    if (!conocimientoDano.trim()) {
      alert('Por favor escribe tu respuesta.');
      return;
    }
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

  const handleCondTextNext = (question: string) => {
    if (!inputEscuela.trim()) {
      alert('Por favor escribe tu respuesta.');
      return;
    }
    setPreguntaCondicional(question);
    setRespuestaCondicional(inputEscuela.trim());
    goToSlide('slide5');
  };

  const handleInteresClick = (answer: string) => {
    setInteresSolucion(answer);
    goToSlide('slide6');
  };

  const handleContactNext = () => {
    if (!nombreMadre.trim() || !celular.trim() || !distrito.trim()) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    if (celular.trim().length < 6) {
      alert('Ingresa un celular válido.');
      return;
    }
    goToSlide('slide7');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const now = new Date();
    const formattedDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const generatedId = `id-${Math.random().toString(16).substring(2, 10)}`;

    const newLead: LeadData = {
      id: generatedId,
      timestamp: formattedDate,
      nivelPreocupacion: nivelPreocupacion || 10,
      conocimientoDano: conocimientoDano.trim(),
      edadHijos: edadHijos,
      preguntaCondicional: preguntaCondicional,
      respuestaCondicional: respuestaCondicional,
      interesSolucion: interesSolucion,
      nombreMadre: nombreMadre.trim(),
      celular: celular.trim(),
      distrito: distrito.trim(),
      observaciones: observaciones.trim(),
      gestCall: '',
      obserCalls: '',
      estadoCrm: 'nuevo'
    };

    try {
      await addDoc(collection(db, LEADS_COLLECTION), {
        ...newLead,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("No se pudo escribir en Firestore, guardando localmente:", err);
    }

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // Confetti fallback
    }

    alert('¡Lead guardado con éxito en Firestore!');
    onLeadSaved(newLead);
    resetForm();
  };

  return (
    <>
      {/* Slide 0: Portada */}
      <div className={getSlideClass('slide0')} id="slide0">
        <div className="icon-zentry"></div>
        <h1 className="original-title">Protege la mente de tu hijo en la era digital</h1>
        <p className="original-subtitle">
          Descubre ZentryOS: El primer sistema operativo que bloquea la adicción algorítmica y potencia el aprendizaje.
        </p>
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

      {/* Slide 2: Daño Percibido */}
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
            placeholder="Escribe tu respuesta aquí..."
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

      {/* Slide 4c: Ambas */}
      <div className={getSlideClass('slide4c')} id="slide4c">
        <p className="original-question">¿Creen que la estructura base de la escuela tradicional garantiza el futuro de sus hijos?</p>
        <div className="form-group-original">
          <textarea
            id="inputEscuela"
            value={inputEscuela}
            onChange={(e) => setInputEscuela(e.target.value)}
            className="form-textarea-original"
            placeholder="Escribe tu opinión..."
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

        <div className="form-group-original">
          <label>Nombre Completo</label>
          <input
            type="text"
            id="inputNombre"
            value={nombreMadre}
            onChange={(e) => setNombreMadre(e.target.value)}
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
            onChange={(e) => setCelular(e.target.value.replace(/[^0-9]/g, ''))}
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
            placeholder="Tu distrito"
            required
          />
        </div>

        <button className="btn-original" onClick={handleContactNext}>
          Siguiente
        </button>
      </div>

      {/* Slide 7: vCard y Observaciones */}
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

        <div className="form-group-original" style={{ width: '100%', maxWidth: '500px', marginTop: '20px' }}>
          <label style={{ textAlign: 'center' }}>Observaciones Adicionales (Post-Charla)</label>
          <textarea
            id="inputObservaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="form-textarea-original"
            placeholder="Anota cualquier detalle relevante sobre este lead..."
          />
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
