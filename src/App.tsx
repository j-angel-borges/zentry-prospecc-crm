import React, { useState, useEffect } from 'react';
import { REAL_LEADS_EXPO_MATERNIDAD, LeadData } from './data/realLeads';
import { OriginalWizard } from './components/OriginalWizard';
import { OriginalAdmin } from './components/OriginalAdmin';
import { subscribeToCloudLeads } from './services/cloudCrm';

// URL del CRM dedicada si se especifica en variables de entorno (ej: https://zentry-crm.web.app)
const CRM_EXTERNAL_URL = import.meta.env.VITE_CRM_URL || '';

export function App() {
  const GOAL_LEADS = 120;
  const [leads, setLeads] = useState<LeadData[]>(REAL_LEADS_EXPO_MATERNIDAD);

  // Detección automática de la ruta inicial
  const checkIsCrmRoute = (): boolean => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const host = window.location.hostname.toLowerCase();

    return (
      path.startsWith('/crm') ||
      path.startsWith('/admin') ||
      search.includes('view=crm') ||
      search.includes('page=crm') ||
      hash.includes('crm') ||
      host.includes('crm')
    );
  };

  const [isCrmRoute, setIsCrmRoute] = useState<boolean>(() => checkIsCrmRoute());

  // Escucha cambios en el historial de navegación (Botones Atrás / Adelante del navegador)
  useEffect(() => {
    const handlePopState = () => {
      setIsCrmRoute(checkIsCrmRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Escucha en tiempo real de Firestore para todos los clientes (Multi-dispositivo en la nube)
  useEffect(() => {
    const unsubscribe = subscribeToCloudLeads((cloudLeads) => {
      setLeads(cloudLeads);
    });

    return () => unsubscribe();
  }, []);

  const progressPercent = Math.min(100, (leads.length / GOAL_LEADS) * 100);

  const handleLeadSaved = (newLead: LeadData) => {
    setLeads((prev) => [newLead, ...prev.filter((l) => l.id !== newLead.id)]);
  };

  const handleUpdateLead = (updated: LeadData) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  // Redirección o navegación al CRM
  const handleGoToCrm = () => {
    if (CRM_EXTERNAL_URL) {
      window.location.href = CRM_EXTERNAL_URL;
      return;
    }

    try {
      window.history.pushState(null, '', '/crm');
    } catch (e) {}
    setIsCrmRoute(true);
  };

  // Volver del CRM al formulario de prospección
  const handleBackToWizard = () => {
    try {
      window.history.pushState(null, '', '/');
    } catch (e) {}
    setIsCrmRoute(false);
  };

  // ── MODO 1: STANDALONE CRM (.web.app/crm) ──────────────────────────────────
  if (isCrmRoute) {
    return (
      <div id="app-container" style={{ overflowY: 'auto' }}>
        <OriginalAdmin
          leads={leads}
          onClose={handleBackToWizard}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
        />
      </div>
    );
  }

  // ── MODO 2: FORMULARIO DE PROSPECCIÓN (Zentry Prospecc Wizard) ────────────
  return (
    <div id="app-container">
      {/* Background Blobs */}
      <div className="blob blob1"></div>
      <div className="blob blob2"></div>

      {/* Top Progress Bar */}
      <div className="progress-container" id="progressContainer">
        <div 
          className="progress-bar-fill" 
          id="progressBar"
          style={{ width: `${progressPercent}%` }}
        ></div>
        <div className="progress-text" id="progressText">
          {leads.length} / {GOAL_LEADS}
        </div>
      </div>

      {/* Top Right CRM Redirection Button */}
      <button 
        className="admin-btn" 
        id="adminBtn"
        onClick={handleGoToCrm}
        title="Abrir Dashboard CRM y Control de Llamadas"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(255, 255, 255, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}
      >
        <span>📊</span>
        <span>CRM</span>
      </button>

      {/* Prospecting Slides Wizard */}
      <OriginalWizard
        onLeadSaved={handleLeadSaved}
        totalLeadsCount={leads.length}
      />
    </div>
  );
}

export default App;
