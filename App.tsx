import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserPlus, Settings, MessageSquare, 
  Search, AlertTriangle, X,
  Upload, Sun, Moon, Briefcase, 
  Download, ShieldAlert,
  Clock, LayoutDashboard, ClipboardList,
  CheckCircle2, UserX, CalendarDays,
  Copy, UserCheck, Percent, Lightbulb,
  Filter, Pencil, Trash2, Medal,
  Stethoscope, PauseCircle, Info, CloudLightning,
  Link as LinkIcon
} from 'lucide-react';
import { Employee, WorkStatus, Incident, ChatMessage, ShiftType, ShiftLogEntry, AttendanceStatus, DayOff, CoachingEntry } from './types';
import * as GeminiService from './services/geminiService';

// --- DATA SERVICE (CONEXIÓN NUBE DINÁMICA) ---
const DataService = {
  getApiUrl: () => localStorage.getItem('google_script_url') || '',
  
  setApiUrl: (url: string) => {
      // Limpieza básica de la URL
      const cleanUrl = url.trim();
      localStorage.setItem('google_script_url', cleanUrl);
      window.location.reload(); // Recargar para aplicar cambios
  },

  loadData: async (): Promise<{ employees: Employee[], logs: ShiftLogEntry[] }> => {
    const API_URL = localStorage.getItem('google_script_url');
    try {
      if(!API_URL) throw new Error("No URL configured");
      
      const response = await fetch(API_URL);
      const data = await response.json();
      return data;
    } catch (e) {
      console.warn("⚠️ Usando modo local offline (No URL o Error de Red).");
      const local = localStorage.getItem('pm_pro_data');
      return local ? JSON.parse(local) : { employees: [], logs: [] };
    }
  },
  
  saveData: async (employees: Employee[], logs: ShiftLogEntry[]) => {
    const API_URL = localStorage.getItem('google_script_url');
    try {
      const payload = { employees, logs, lastUpdated: new Date().toISOString() };
      localStorage.setItem('pm_pro_data', JSON.stringify(payload)); // Backup Local

      if(API_URL) {
          await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          console.log("☁️ Sincronizando con nube...");
      }
    } catch (e) {
      console.error("Error guardando en nube:", e);
    }
  }
};

// --- HELPERS ---

const calculateReliability = (incidents: Incident[]): number => {
  let score = 100;
  incidents.forEach(inc => {
    switch(inc.type) {
      case 'Ausencia': score -= 15; break;
      case 'Tardanza': score -= 5; break;
      case 'Conducta': score -= 20; break;
      case 'Felicitacion': score += 5; break;
      default: break;
    }
  });
  return Math.max(0, Math.min(100, score));
};

const getDayName = (dateStr: string): DayOff => {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  return days[date.getDay()] as DayOff;
};

const getSeniority = (dateStr: string) => {
    if(!dateStr) return 'Reciente';
    const start = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); 
    if(diffDays < 30) return `${diffDays}d`;
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    let result = '';
    if(years > 0) result += `${years}a `;
    if(months > 0) result += `${months}m`;
    return result || '1m';
};

// --- COMPONENTS ---

const Modal = ({ title, onClose, children, maxWidth = "max-w-lg" }: { title: string, onClose: () => void, children?: React.ReactNode, maxWidth?: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
    <div className={`glass-panel w-full ${maxWidth} rounded-2xl p-6 relative bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto max-h-[90vh]`}>
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full p-1"><X size={20} /></button>
      <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">{title}</h2>
      {children}
    </div>
  </div>
);

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}`}>
    <Icon size={18} /><span className="hidden sm:inline">{label}</span>
  </button>
);

const StatCard = ({ title, value, sub, icon: Icon, color, onClick }: any) => {
  const IconComp = Icon || Info;
  return (
    <div onClick={onClick} className={`glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-transform duration-300 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className={`absolute right-[-10px] top-[-10px] p-6 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}><IconComp size={80} /></div>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{value}</h2>
          {sub && <p className={`text-xs mt-1 font-medium ${color.replace('text-', 'text-')}`}>{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-slate-100 dark:bg-slate-800 ${color}`}><IconComp size={24} /></div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [loadingData, setLoadingData] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ShiftLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'control' | 'directory' | 'logs'>('control');
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [compactMode, setCompactMode] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState('');

  // Modals & UI
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeTab, setEmployeeTab] = useState<'info' | 'coaching' | 'calendar'>('info');
  const [showChat, setShowChat] = useState(false);
  const [showUploadLegend, setShowUploadLegend] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkStatus | 'All'>('Activo');
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [logInput, setLogInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'light') { setDarkMode(false); document.documentElement.classList.remove('dark'); }
    else { setDarkMode(true); document.documentElement.classList.add('dark'); }

    // Check configuration
    const url = localStorage.getItem('google_script_url');
    if (!url) setShowConfigModal(true);

    const initData = async () => {
        setLoadingData(true);
        const data = await DataService.loadData();
        if (data.employees) {
            setEmployees(data.employees.map(e => ({...e, coachingHistory: e.coachingHistory || [], attendanceHistory: e.attendanceHistory || {}, incidents: e.incidents || []})));
        }
        if (data.logs) setShiftLogs(data.logs);
        setLoadingData(false);
    };
    initData();
  }, []);

  const persistChanges = (newEmployees: Employee[], newLogs: ShiftLogEntry[]) => {
    setEmployees(newEmployees);
    setShiftLogs(newLogs);
    DataService.saveData(newEmployees, newLogs);
  };

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  };

  // --- DATA PROCESSING ---
  const activeEmployees = useMemo(() => employees.filter(e => e.statusLaboral === 'Activo'), [employees]);
  const topEmployees = useMemo(() => [...activeEmployees].sort((a, b) => b.reliabilityScore - a.reliabilityScore).slice(0, 3), [activeEmployees]);
  const duplicateMap = useMemo(() => { const counts: Record<string, number> = {}; employees.forEach(e => { if(e.statusLaboral === 'Activo') counts[e.cedula] = (counts[e.cedula] || 0) + 1; }); return counts; }, [employees]);

  const dailyStats = useMemo(() => {
    const dayOfWeek = getDayName(selectedDate);
    const convocados = activeEmployees.filter(e => e.libranza !== dayOfWeek);
    const libres = activeEmployees.filter(e => e.libranza === dayOfWeek);
    let presentes = 0, tardanzas = 0, faltas = 0, medical = 0, pnr = 0;

    convocados.forEach(e => {
        const status = e.attendanceHistory?.[selectedDate];
        if (status === 'Presente') presentes++;
        if (status === 'Tardanza') { presentes++; tardanzas++; }
        if (status === 'Falta') faltas++;
        if (status === 'Medical') medical++;
        if (status === 'PNR') pnr++;
    });

    const workingTotal = convocados.length - (medical + pnr);
    const efe = workingTotal > 0 ? Math.round((presentes / workingTotal) * 100) : 0;
    const ia = workingTotal > 0 ? Math.round((faltas / workingTotal) * 100) : 0;
    
    return { totalConvocados: convocados.length, presentes, tardanzas, faltas, medical, pnr, efe, ia, libres, convocadosList: convocados };
  }, [activeEmployees, selectedDate]);

  const staffingAnalysis = useMemo(() => {
     const counts: Record<string, number> = { LUNES:0, MARTES:0, MIERCOLES:0, JUEVES:0, VIERNES:0, SABADO:0, DOMINGO:0 };
     activeEmployees.forEach(e => { if(counts[e.libranza] !== undefined) counts[e.libranza]++; });
     const days = Object.keys(counts);
     const maxDay = days.reduce((a, b) => counts[a] > counts[b] ? a : b);
     const minDay = days.reduce((a, b) => counts[a] < counts[b] ? a : b);
     const avg = activeEmployees.length / 7;
     let recommendation = "Balance de días libres óptimo.";
     let type: 'ok' | 'warn' = 'ok';
     if (counts[maxDay] > avg + 2) { recommendation = `Alerta: Exceso de libres el ${maxDay} (${counts[maxDay]}). Mover a ${minDay}.`; type = 'warn'; }
     return { recommendation, type };
  }, [activeEmployees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (showOnlyDuplicates) return duplicateMap[emp.cedula] > 1;
      if (statusFilter !== 'All' && emp.statusLaboral !== statusFilter) return false;
      const searchLower = searchTerm.toLowerCase();
      return (emp.nombre.toLowerCase().includes(searchLower) || emp.cedula.includes(searchLower) || emp.csAsignado.toLowerCase().includes(searchLower));
    });
  }, [employees, statusFilter, searchTerm, showOnlyDuplicates, duplicateMap]);

  // --- HANDLERS ---
  const handleAttendance = (id: string, status: AttendanceStatus) => {
    const newEmployees = employees.map(e => e.id === id ? { ...e, attendanceHistory: { ...e.attendanceHistory, [selectedDate]: status } } : e);
    persistChanges(newEmployees, shiftLogs);
  };

  const generateReport = async () => {
    const { totalConvocados, presentes, tardanzas, faltas, medical, pnr, efe, ia, libres } = dailyStats;
    const report = `📊 *REPORTE ${selectedDate}*\n👥 Conv: ${totalConvocados} | ✅ Asist: ${presentes}\n⚠️ Tard: ${tardanzas} | ❌ Falta: ${faltas}\n🏥 Med: ${medical} | 🔵 PNR: ${pnr}\n📈 EFE: ${efe}% | IA: ${ia}%\n🏝 Francos: ${libres.length}`;
    try { await navigator.clipboard.writeText(report); alert('✅ Reporte copiado.'); } catch (err) { alert('❌ Error copiando.'); }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Nombre", "Cedula", "Turno", "Libranza", "Ingreso", "Score", "Estado"];
    const rows = filteredEmployees.map(e => [e.id, e.nombre, e.cedula, e.turno, e.libranza, e.fechaIngreso, e.reliabilityScore, e.statusLaboral]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `PM_PRO_DATA.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleAddEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const cedula = fd.get('cedula') as string;
    if (duplicateMap[cedula] && !confirm('Cédula duplicada. ¿Registrar?')) return;
    const newEmp: Employee = {
      id: crypto.randomUUID(), nombre: fd.get('nombre') as string, cedula: cedula, email: fd.get('email') as string,
      fechaIngreso: fd.get('fechaIngreso') as string, turno: fd.get('turno') as ShiftType, libranza: fd.get('libranza') as any,
      csAsignado: fd.get('csAsignado') as string, statusLaboral: 'Activo', statusHistory: [], incidents: [], coachingHistory: [], attendanceHistory: {}, reliabilityScore: 100
    };
    persistChanges([...employees, newEmp], shiftLogs); setShowAddModal(false);
  };

  const handleUpdateEmployee = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault(); const fd = new FormData(e.currentTarget); if (!editingEmployeeId) return;
      const updated = employees.map(emp => emp.id === editingEmployeeId ? { ...emp, nombre: fd.get('nombre') as string, cedula: fd.get('cedula') as string, email: fd.get('email') as string, turno: fd.get('turno') as ShiftType, libranza: fd.get('libranza') as any, csAsignado: fd.get('csAsignado') as string, fechaIngreso: fd.get('fechaIngreso') as string, fechaFin: fd.get('fechaFin') ? fd.get('fechaFin') as string : undefined } : emp);
      persistChanges(updated, shiftLogs); alert('Actualizado.');
  };

  const handleDeleteEmployee = () => { if(editingEmployeeId && confirm('¿Eliminar?')) { persistChanges(employees.filter(e => e.id !== editingEmployeeId), shiftLogs); setEditingEmployeeId(null); } };

  const handleAddCoaching = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault(); if (!editingEmployeeId) return; const fd = new FormData(e.currentTarget);
      const newCoaching: CoachingEntry = { id: crypto.randomUUID(), date: fd.get('date') as string, topic: fd.get('topic') as any, notes: fd.get('notes') as string, actionItems: fd.get('actionItems') as string, status: 'Pendiente' };
      const updated = employees.map(emp => emp.id === editingEmployeeId ? { ...emp, coachingHistory: [newCoaching, ...(emp.coachingHistory || [])] } : emp);
      persistChanges(updated, shiftLogs); (e.target as HTMLFormElement).reset(); alert('Guardado.');
  };

  const handleAddIncident = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!showIncidentModal) return; const fd = new FormData(e.currentTarget);
    const newInc: Incident = { id: crypto.randomUUID(), type: fd.get('type') as any, date: fd.get('date') as string, note: fd.get('note') as string, severity: 'Medium' };
    const updated = employees.map(emp => emp.id === showIncidentModal ? { ...emp, incidents: [...emp.incidents, newInc], reliabilityScore: calculateReliability([...emp.incidents, newInc]) } : emp);
    persistChanges(updated, shiftLogs); setShowIncidentModal(null);
  };

  const handleStatusChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!showStatusModal) return; const fd = new FormData(e.currentTarget); const ns = fd.get('status') as WorkStatus;
    const updated = employees.map(emp => emp.id === showStatusModal ? { ...emp, statusLaboral: ns, fechaFin: ns === 'Egreso' ? fd.get('date') as string : undefined } : emp);
    persistChanges(updated, shiftLogs); setShowStatusModal(null);
  };

  const handleAddLog = () => { if (!logInput.trim()) return; const newLog: ShiftLogEntry = { id: crypto.randomUUID(), timestamp: new Date().toLocaleString(), text: logInput, author: 'Sup' }; persistChanges(employees, [newLog, ...shiftLogs]); setLogInput(''); };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string; const lines = text.split('\n'); const newEmps: Employee[] = [];
        lines.forEach(line => {
          const p = line.split(/[,;]/).map(x => x.trim()); if (p.length < 3 || p[0].toLowerCase().includes('nombre')) return;
          newEmps.push({ id: crypto.randomUUID(), nombre: p[0], cedula: p[1], email: p[2]||'', fechaIngreso: p[3]||new Date().toISOString().split('T')[0], turno: 'PM', libranza: (p[6] as any)||'DOMINGO', csAsignado: p[7]||'SA', reliabilityScore: 100, statusLaboral: 'Activo', statusHistory: [], incidents: [], coachingHistory: [], attendanceHistory: {} });
        });
        persistChanges([...employees, ...newEmps], shiftLogs); alert(`Importados ${newEmps.length}`);
    };
    reader.readAsText(file); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault(); if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: new Date() }; setChatHistory(p => [...p, userMsg]); setChatInput(''); setIsChatLoading(true);
    const context = JSON.stringify(activeEmployees.slice(0, 20).map(e => ({ n:e.nombre, s:e.reliabilityScore })));
    const res = await GeminiService.sendChatMessage(chatHistory, userMsg.text, context);
    setChatHistory(p => [...p, { role: 'model', text: res, timestamp: new Date() }]); setIsChatLoading(false);
  };

  // --- RENDER ---
  if (loadingData) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white"><div className="animate-pulse flex flex-col items-center gap-4"><CloudLightning size={48} className="text-indigo-500 animate-bounce"/><span className="text-xl font-bold">Cargando Nube...</span></div></div>;

  return (
    <div className="min-h-screen pb-20 font-sans selection:bg-indigo-500 selection:text-white">
      <header className="glass-panel sticky top-0 z-40 border-b border-white/10 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg"><ShieldAlert className="text-white" size={24} /></div>
            <div><h1 className="text-xl font-bold text-slate-800 dark:text-white">PM <span className="text-indigo-500">Pro</span></h1><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1"><CloudLightning size={10} className="text-emerald-500"/> Cloud v7</p></div>
          </div>
          <nav className="hidden md:flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl">
            <TabButton active={activeTab === 'control'} onClick={() => setActiveTab('control')} icon={LayoutDashboard} label="Control" />
            <TabButton active={activeTab === 'directory'} onClick={() => setActiveTab('directory')} icon={Users} label="Directorio" />
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={ClipboardList} label="Bitácora" />
          </nav>
          <div className="flex gap-2">
             <button onClick={() => setShowConfigModal(true)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500"><LinkIcon size={18}/></button>
             <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {activeTab === 'control' && (
           <div className="space-y-6 animate-fade-in">
              <div className="glass-panel p-4 rounded-xl flex justify-between items-center gap-4">
                  <div className="flex items-center gap-4"><div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-500"><CalendarDays size={24} /></div><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-xl font-bold text-slate-800 dark:text-white outline-none"/></div>
                  <button onClick={generateReport} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg"><Copy size={16} /> Reporte</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                 <StatCard title="Conv" value={dailyStats.totalConvocados} icon={Users} color="text-indigo-500" />
                 <StatCard title="Asist" value={dailyStats.presentes} icon={UserCheck} color="text-emerald-500" />
                 <StatCard title="Tard" value={dailyStats.tardanzas} icon={Clock} color="text-amber-500" />
                 <StatCard title="Falta" value={dailyStats.faltas} icon={UserX} color="text-rose-500" />
                 <StatCard title="Med" value={dailyStats.medical} icon={Stethoscope} color="text-purple-500" />
                 <StatCard title="PNR" value={dailyStats.pnr} icon={PauseCircle} color="text-blue-500" />
                 <div className="glass-panel p-2 flex flex-col justify-center items-center"><h3 className="text-2xl font-bold text-indigo-500">{dailyStats.efe}%</h3><p className="text-[10px] font-bold">EFE</p></div>
                 <div className="glass-panel p-2 flex flex-col justify-center items-center"><h3 className="text-2xl font-bold text-rose-500">{dailyStats.ia}%</h3><p className="text-[10px] font-bold">IA</p></div>
              </div>
              <div className={`glass-panel p-4 rounded-xl border-l-4 ${staffingAnalysis.type === 'warn' ? 'border-amber-500 bg-amber-500/5' : 'border-emerald-500 bg-emerald-500/5'} flex gap-3`}><Lightbulb size={24} className={staffingAnalysis.type==='warn'?'text-amber-500':'text-emerald-500'}/><p className="text-sm">{staffingAnalysis.recommendation}</p></div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="glass-panel p-4 rounded-2xl col-span-2">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex gap-2"><UserCheck size={18} className="text-emerald-500"/> Asistencia</h3><button onClick={() => setCompactMode(!compactMode)} className="text-xs border px-2 py-1 rounded">Vista {compactMode?'Denso':'Normal'}</button></div>
                    
                    {/* ATTENDANCE LEGEND */}
                    <div className="flex flex-wrap gap-4 mb-4 px-2 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></div> Presente</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-500/20"></div> Tardanza</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-500/20"></div> Falta</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-3 h-3 rounded-full bg-purple-500 ring-2 ring-purple-500/20"></div> Médico</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/20"></div> PNR</div>
                    </div>

                    <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-2">
                        {dailyStats.convocadosList.map(emp => {
                            const status = emp.attendanceHistory?.[selectedDate];
                            return (
                                <div key={emp.id} className={`flex justify-between items-center rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 ${compactMode ? 'p-1.5' : 'p-3'}`}>
                                    <div className="flex items-center gap-3"><div className={`rounded-full flex justify-center items-center text-white font-bold ${compactMode?'w-8 h-8 text-xs':'w-10 h-10'} ${status==='Presente'?'bg-emerald-500':status==='Falta'?'bg-rose-500':status==='Tardanza'?'bg-amber-500':'bg-slate-400'}`}>{status==='Medical'?<Stethoscope size={14}/>:status==='PNR'?<PauseCircle size={14}/>:emp.nombre.charAt(0)}</div><div><div className="font-bold">{emp.nombre}</div></div></div>
                                    <div className="flex gap-1">
                                      {['Presente','Tardanza','Falta','Medical','PNR'].map(s=>(
                                        <button 
                                          key={s} 
                                          onClick={()=>handleAttendance(emp.id, s as any)} 
                                          className={`p-1.5 rounded transition-all hover:scale-110 ${status===s?'bg-white/20 text-indigo-400 border border-indigo-400 ring-2 ring-indigo-500/30':'bg-slate-200 dark:bg-slate-700 opacity-50 hover:opacity-100'}`} 
                                          title={s}
                                        >
                                          <div className={`w-3 h-3 rounded-full ${s==='Presente'?'bg-emerald-500':s==='Tardanza'?'bg-amber-500':s==='Falta'?'bg-rose-500':s==='Medical'?'bg-purple-500':'bg-blue-500'}`}></div>
                                        </button>
                                      ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                 </div>
                 <div className="glass-panel p-4 rounded-2xl flex flex-col"><h3 className="font-bold mb-3 flex gap-2"><Briefcase size={18}/> Francos ({dailyStats.libres.length})</h3><div className="flex-1 overflow-y-auto space-y-2">{dailyStats.libres.map(e => (<div key={e.id} className="p-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold flex gap-2"><div className="w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded-full flex justify-center items-center">{e.nombre.charAt(0)}</div>{e.nombre}</div>))}</div></div>
              </div>
           </div>
        )}

        {/* --- VIEW: DIRECTORY --- */}
        {activeTab === 'directory' && (
          <div className="space-y-6 animate-fade-in">
             <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-4 justify-between items-center">
                <div className="flex gap-2 flex-1"><Search className="text-slate-400"/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="glass-input w-full bg-transparent"/></div>
                <div className="flex gap-2 relative">
                   {showUploadLegend && <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50">TXT: Nombre,Cedula,Correo,Fecha,Mesa,Turno,Libre,CS</div>}
                   <button onMouseEnter={() => setShowUploadLegend(true)} onMouseLeave={() => setShowUploadLegend(false)} className="text-slate-400 hover:text-white p-2"><Info size={16}/></button>
                   <button onClick={() => setShowOnlyDuplicates(!showOnlyDuplicates)} className={`px-3 py-2 rounded text-xs font-bold ${showOnlyDuplicates ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>DUP</button>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv"/><button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-800"><Upload size={16}/></button>
                   <button onClick={handleExportCSV} className="px-3 py-2 rounded bg-emerald-600/10 text-emerald-500 border border-emerald-500/20"><Download size={16}/></button>
                   <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded bg-indigo-600 text-white font-bold flex gap-2"><UserPlus size={16}/> Nuevo</button>
                </div>
             </div>
             <div className="glass-panel rounded-2xl overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 font-bold"><tr><th className="px-6 py-4">Empleado</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Franco</th><th className="px-6 py-4">Antigüedad</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4 text-right">Acción</th></tr></thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                         {filteredEmployees.map(emp => {
                            const isDup = duplicateMap[emp.cedula] > 1;
                            return (
                               <tr key={emp.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/30 ${isDup ? 'bg-rose-500/10' : ''}`}>
                                  <td className="px-6 py-4 flex gap-3 items-center"><div className={`w-8 h-8 rounded-full flex justify-center items-center text-white font-bold ${isDup ? 'bg-rose-600 animate-pulse' : 'bg-slate-500'}`}>{isDup ? '!' : emp.nombre.charAt(0)}</div><div><div className="font-bold">{emp.nombre}</div><div className="text-xs text-slate-500">{emp.cedula}</div></div></td>
                                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${emp.statusLaboral==='Activo'?'bg-emerald-500/10 text-emerald-500':'bg-rose-500/10 text-rose-500'}`}>{emp.statusLaboral}</span></td>
                                  <td className="px-6 py-4 font-mono">{emp.libranza}</td>
                                  <td className="px-6 py-4 text-indigo-500 font-bold">{getSeniority(emp.fechaIngreso)}</td>
                                  <td className="px-6 py-4 text-center font-bold">{emp.reliabilityScore}</td>
                                  <td className="px-6 py-4 text-right flex justify-end gap-2"><button onClick={() => { setEditingEmployeeId(emp.id); setEmployeeTab('info'); }} className="text-indigo-500"><Pencil size={16}/></button><button onClick={() => setShowIncidentModal(emp.id)} className="text-amber-500"><AlertTriangle size={16}/></button><button onClick={() => setShowStatusModal(emp.id)} className="text-rose-500"><Settings size={16}/></button></td>
                               </tr>
                            )
                         })}
                      </tbody>
                   </table>
             </div>
          </div>
        )}

        {/* --- VIEW: LOGS --- */}
        {activeTab === 'logs' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className="glass-panel p-6 rounded-2xl h-min sticky top-24"><textarea value={logInput} onChange={e => setLogInput(e.target.value)} className="glass-input w-full h-32 p-3 rounded-xl mb-4 resize-none" placeholder="Nota..."></textarea><button onClick={handleAddLog} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">Guardar</button></div>
              <div className="md:col-span-2 space-y-4">{shiftLogs.map(log => (<div key={log.id} className="glass-panel p-5 rounded-xl border-l-4 border-indigo-500"><div className="flex justify-between text-xs opacity-50 mb-1"><span>{log.author}</span><span>{log.timestamp}</span></div><p className="text-sm">{log.text}</p></div>))}</div>
           </div>
        )}
      </main>

      {/* --- MODALS --- */}
      {showConfigModal && (
        <Modal title="Conectar Nube" onClose={() => setShowConfigModal(false)}>
           <div className="space-y-4">
              <p className="text-sm text-slate-500">Para sincronizar datos, pega aquí la URL de tu Google Apps Script (la que termina en <code>/exec</code>).</p>
              <input value={apiUrlInput} onChange={e => setApiUrlInput(e.target.value)} placeholder="https://script.google.com/..." className="glass-input w-full p-2 rounded"/>
              <button onClick={() => {DataService.setApiUrl(apiUrlInput); setShowConfigModal(false);}} className="w-full bg-emerald-600 text-white py-2 rounded font-bold">Conectar</button>
              <button onClick={() => setShowConfigModal(false)} className="w-full text-slate-500 text-xs mt-2">Usar modo local (offline)</button>
           </div>
        </Modal>
      )}

      {showAddModal && <Modal title="Alta" onClose={() => setShowAddModal(false)}><form onSubmit={handleAddEmployee} className="space-y-4"><input name="nombre" placeholder="Nombre" required className="glass-input w-full p-2 rounded"/><input name="cedula" placeholder="Cédula" required className="glass-input w-full p-2 rounded"/><div className="grid grid-cols-2 gap-2"><select name="turno" className="glass-input w-full p-2 rounded bg-transparent"><option value="PM">PM</option><option value="AM">AM</option></select><select name="libranza" className="glass-input w-full p-2 rounded bg-transparent"><option value="DOMINGO">Domingo</option><option value="SABADO">Sábado</option></select></div><input name="csAsignado" placeholder="CS" required className="glass-input w-full p-2 rounded"/><input name="fechaIngreso" type="date" required className="glass-input w-full p-2 rounded"/><button className="w-full bg-indigo-600 text-white font-bold py-2 rounded">Guardar</button></form></Modal>}
      
      {editingEmployeeId && (
          <Modal title="Ficha" onClose={() => setEditingEmployeeId(null)} maxWidth="max-w-2xl">
              {(() => {
                  const emp = employees.find(e => e.id === editingEmployeeId); if(!emp) return null;
                  return (
                      <div className="flex flex-col h-[70vh]">
                          <div className="flex gap-4 border-b border-slate-700 mb-4 pb-2"><button onClick={() => setEmployeeTab('info')} className={`text-sm font-bold ${employeeTab === 'info' ? 'text-indigo-500' : ''}`}>Datos</button><button onClick={() => setEmployeeTab('coaching')} className={`text-sm font-bold ${employeeTab === 'coaching' ? 'text-indigo-500' : ''}`}>Coaching</button></div>
                          <div className="flex-1 overflow-y-auto pr-2">
                              {employeeTab === 'info' && <form onSubmit={handleUpdateEmployee} className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold">Nombre</label><input name="nombre" defaultValue={emp.nombre} className="glass-input w-full p-2 rounded"/></div><div><label className="text-xs font-bold">Cédula</label><input name="cedula" defaultValue={emp.cedula} className="glass-input w-full p-2 rounded"/></div></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold">Turno</label><select name="turno" defaultValue={emp.turno} className="glass-input w-full p-2 bg-transparent rounded"><option value="PM">PM</option><option value="AM">AM</option></select></div><div><label className="text-xs font-bold">Franco</label><select name="libranza" defaultValue={emp.libranza} className="glass-input w-full p-2 bg-transparent rounded"><option value="DOMINGO">Domingo</option><option value="SABADO">Sábado</option><option value="LUNES">Lunes</option></select></div></div><div className="flex justify-between pt-4"><button type="button" onClick={handleDeleteEmployee} className="text-rose-500 text-xs font-bold flex gap-1"><Trash2 size={14}/> Eliminar</button><button className="bg-emerald-600 px-4 py-2 rounded text-white font-bold">Guardar</button></div></form>}
                              {employeeTab === 'coaching' && <div className="space-y-4"><form onSubmit={handleAddCoaching} className="bg-slate-800/30 p-3 rounded space-y-2"><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-2 rounded"/><textarea name="notes" placeholder="Nota..." required className="glass-input w-full p-2 rounded h-20"></textarea><button className="bg-indigo-600 text-white w-full py-1 rounded text-xs font-bold">Agregar</button></form><div className="space-y-2">{(emp.coachingHistory||[]).map(c=><div key={c.id} className="p-3 bg-slate-100 dark:bg-slate-800 border-l-4 border-indigo-500 rounded"><div className="text-xs opacity-50 mb-1">{c.date}</div><p className="text-sm">{c.notes}</p></div>)}</div></div>}
                          </div>
                      </div>
                  )
              })()}
          </Modal>
      )}

      {showIncidentModal && <Modal title="Incidencia" onClose={() => setShowIncidentModal(null)}><form onSubmit={handleAddIncident} className="space-y-4"><select name="type" className="glass-input w-full p-2 rounded bg-transparent"><option value="Tardanza">Tardanza</option><option value="Ausencia">Ausencia</option><option value="Conducta">Conducta</option></select><input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-2 rounded"/><button className="w-full bg-indigo-600 text-white font-bold py-2 rounded">Registrar</button></form></Modal>}
      {showStatusModal && <Modal title="Cambio Estado" onClose={() => setShowStatusModal(null)}><form onSubmit={handleStatusChange} className="space-y-4"><select name="status" className="glass-input w-full p-2 rounded bg-transparent"><option value="Egreso">Baja Definitiva</option><option value="Licencia">Licencia</option><option value="Activo">Reactivar</option></select><input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-2 rounded"/><button className="w-full bg-indigo-600 text-white font-bold py-2 rounded">Confirmar</button></form></Modal>}
      
      {/* Chat Bot */}
      <div className="fixed bottom-6 right-6 z-50">
        {!showChat && <button onClick={() => setShowChat(true)} className="bg-indigo-600 text-white p-4 rounded-full shadow-xl"><MessageSquare size={24}/></button>}
        {showChat && <div className="glass-panel w-80 h-96 rounded-2xl shadow-2xl flex flex-col mb-4 mr-4"><div className="bg-indigo-600 p-3 text-white flex justify-between font-bold text-sm"><span>IA HR</span><button onClick={()=>setShowChat(false)}><X size={16}/></button></div><div className="flex-1 overflow-y-auto p-3 space-y-2">{chatHistory.map((m,i)=><div key={i} className={`p-2 rounded text-xs max-w-[85%] ${m.role==='user'?'bg-indigo-100 ml-auto text-indigo-900':'bg-slate-800'}`}>{m.text}</div>)}{isChatLoading&&<div className="text-xs animate-pulse text-center">...</div>}</div><form onSubmit={handleChat} className="p-2 border-t border-slate-700 flex gap-2"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} className="flex-1 bg-transparent text-xs"/><button><MessageSquare size={16} className="text-indigo-500"/></button></form></div>}
      </div>
    </div>
  );
}