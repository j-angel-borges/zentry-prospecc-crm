import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Table, 
  Kanban, 
  TrendingUp, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  PlusCircle, 
  Database,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { LeadRecord, SAMPLE_LEADS_EXPO_MATERNIDAD } from './data/sampleLeads';
import { ProspectingWizard } from './components/ProspectingWizard';
import { AdminSpreadsheet } from './components/AdminSpreadsheet';
import { CrmKanban } from './components/CrmKanban';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { LeadDetailModal } from './components/LeadDetailModal';
import { 
  db, 
  collection, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  LEADS_COLLECTION 
} from './firebase';

export function App() {
  const [activeTab, setActiveTab] = useState<'wizard' | 'spreadsheet' | 'kanban' | 'analytics'>('wizard');
  const [leads, setLeads] = useState<LeadRecord[]>(SAMPLE_LEADS_EXPO_MATERNIDAD);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);

  // Sync with Firestore in Real-Time
  useEffect(() => {
    setIsLoading(true);
    try {
      const q = query(collection(db, LEADS_COLLECTION));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const fetchedLeads: LeadRecord[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as LeadRecord;
              fetchedLeads.push({
                ...data,
                id: data.id || docSnap.id,
              });
            });

            // Sort by timestamp descending
            fetchedLeads.sort((a, b) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeB - timeA;
            });

            setLeads(fetchedLeads);
            setIsLiveConnected(true);
          } else {
            // If collection is empty, keep the initial sample leads
            console.log("Firestore collection vacía, utilizando dataset muestra de Expo Maternidad.");
            setIsLiveConnected(true);
          }
          setIsLoading(false);
        },
        (error) => {
          console.warn("Firestore listener offline, usando datos locales:", error);
          setIsLiveConnected(false);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn("Error al inicializar listener de Firestore:", err);
      setIsLiveConnected(false);
      setIsLoading(false);
    }
  }, []);

  const handleLeadCreated = (newLead: LeadRecord) => {
    setLeads((prev) => [newLead, ...prev.filter(l => l.id !== newLead.id)]);
  };

  const handleSeedSampleData = async () => {
    try {
      setIsLoading(true);
      for (const sample of SAMPLE_LEADS_EXPO_MATERNIDAD) {
        await addDoc(collection(db, LEADS_COLLECTION), {
          ...sample,
          createdAt: serverTimestamp()
        });
      }
      setIsLiveConnected(true);
      alert("¡12 Leads de muestra de la Expo Maternidad han sido sembrados con éxito en Firestore!");
    } catch (err) {
      console.error("Error sembrando muestra:", err);
      alert("Error al sembrar datos en Firestore: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLead = (updated: LeadRecord) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Ecosystem Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-600/30 border border-indigo-400/40">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-black tracking-wider text-lg text-white">
                  ZENTRY<span className="text-indigo-400">PROSPECC</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-mono border border-indigo-700/50">
                  v2.0 CLOUD
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span>Leads Expo Maternidad</span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  {isLiveConnected ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 font-medium">Firestore En Vivo</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-amber-400 font-medium">Modo Local / Sync</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Switcher */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('wizard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap ${
                activeTab === 'wizard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>🎯 Prospección</span>
            </button>

            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap ${
                activeTab === 'spreadsheet'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>📊 Spreadsheet ({leads.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap ${
                activeTab === 'kanban'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>📋 CRM Pipeline</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>📈 Analítica</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'wizard' && (
          <ProspectingWizard
            onLeadCreated={handleLeadCreated}
            onOpenAdmin={() => setActiveTab('spreadsheet')}
          />
        )}

        {activeTab === 'spreadsheet' && (
          <AdminSpreadsheet
            leads={leads}
            isLoading={isLoading}
            onRefresh={() => setIsLoading(false)}
            onSelectLead={(l) => setSelectedLead(l)}
            onSeedSampleData={handleSeedSampleData}
          />
        )}

        {activeTab === 'kanban' && (
          <CrmKanban
            leads={leads}
            onSelectLead={(l) => setSelectedLead(l)}
            onRefresh={() => setIsLoading(false)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            leads={leads}
          />
        )}
      </main>

      {/* Lead Detail & CRM Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleUpdateLead}
        />
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950/60 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <span>© 2026 ZentryOS • Sistema de Prospección & CRM Cloud</span>
          <span>Google Firestore & Hosting: <strong className="text-indigo-400">zentry-prospecc.web.app</strong></span>
        </div>
      </footer>
    </div>
  );
}

export default App;
