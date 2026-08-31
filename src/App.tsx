import React, { useState, useEffect } from 'react';
import { REAL_LEADS_EXPO_MATERNIDAD, LeadData } from './data/realLeads';
import { OriginalWizard } from './components/OriginalWizard';
import { OriginalAdmin } from './components/OriginalAdmin';
import { db, collection, onSnapshot, query, LEADS_COLLECTION } from './firebase';

export function App() {
  const GOAL_LEADS = 120;
  const [leads, setLeads] = useState<LeadData[]>(REAL_LEADS_EXPO_MATERNIDAD);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // Real-time Firestore Listener
  useEffect(() => {
    try {
      const q = query(collection(db, LEADS_COLLECTION));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreLeads: LeadData[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as LeadData;
              firestoreLeads.push({
                ...data,
                id: docSnap.id || data.id,
              });
            });

            // Merge with real leads avoiding duplicate IDs
            const existingIds = new Set(firestoreLeads.map((l) => l.id));
            const combined = [
              ...firestoreLeads,
              ...REAL_LEADS_EXPO_MATERNIDAD.filter((r) => !existingIds.has(r.id))
            ];
            setLeads(combined);
          } else {
            setLeads(REAL_LEADS_EXPO_MATERNIDAD);
          }
        },
        (error) => {
          console.warn("Firestore listener fallback a datos reales:", error);
          setLeads(REAL_LEADS_EXPO_MATERNIDAD);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn("Error conectando Firestore:", err);
      setLeads(REAL_LEADS_EXPO_MATERNIDAD);
    }
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

      {/* Top Right Admin Button */}
      <button 
        className="admin-btn" 
        id="adminBtn"
        onClick={() => setIsAdminOpen(true)}
      >
        🔒 ADMIN
      </button>

      {/* Prospecting Slides Wizard */}
      <OriginalWizard
        onLeadSaved={handleLeadSaved}
        totalLeadsCount={leads.length}
      />

      {/* Admin Panel (Spreadsheet + CRM) */}
      {isAdminOpen && (
        <OriginalAdmin
          leads={leads}
          onClose={() => setIsAdminOpen(false)}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
        />
      )}
    </div>
  );
}

export default App;
