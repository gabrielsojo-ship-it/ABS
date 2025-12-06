import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserPlus, Settings, MessageSquare, 
  Search, AlertTriangle, X,
  Upload, Sun, Moon, Briefcase, 
  Download, ShieldAlert,
  Clock, LayoutDashboard, ClipboardList,
  CheckCircle2, UserX, CalendarDays,
  Copy, UserCheck, Percent, Lightbulb,
  Filter, Pencil, Trash2, FileText, Calendar, Medal,
  Stethoscope, PauseCircle, Activity, Info, Trophy, Star,
  MessageCircle, Target, List, LogOut, Lock, CloudLightning
} from 'lucide-react';
import { Employee, WorkStatus, Incident, ChatMessage, ShiftType, ShiftLogEntry, AttendanceStatus, DayOff, CoachingEntry } from './types';
import * as GeminiService from './services/geminiService';

// ==================================================================================
// PASO 1: PEGA AQUÍ TU URL DE GOOGLE APPS SCRIPT (CUIDADO CON LOS ESPACIOS)
// Debe verse como: "https://script.google.com/macros/s/AKfy.../exec"
// ==================================================================================
// Fix: Explicitly type as string to prevent TS from narrowing to literal type, which causes comparison errors
const GOOGLE_SCRIPT_API_URL: string = "PEGAR_TU_URL_DE_GOOGLE_SCRIPT_AQUI"; 
// ==================================================================================


// --- DATA SERVICE (CONEXIÓN NUBE) ---
const DataService = {
  // CARGAR DATOS (GET)
  loadData: async (): Promise<{ employees: Employee[], logs: ShiftLogEntry[] }> => {
    try {
      // Si el usuario no ha puesto la URL, usamos local
      // Fix: Type narrowing issue resolved by typing GOOGLE_SCRIPT_API_URL as string above
      if(GOOGLE_SCRIPT_API_URL.includes("PEGAR_TU_URL") || GOOGLE_SCRIPT_API_URL === "") {
          console.warn("⚠️ URL de Google no configurada. Usando modo local offline.");
          const local = localStorage.getItem('pm_pro_data');
          return local ? JSON.parse(local) : { employees: [], logs: [] };
      }

      const response = await fetch(GOOGLE_SCRIPT_API_URL);
      const data = await response.json();
      return data;
    } catch (e) {
      console.error("Error cargando datos de la nube:", e);
      // Fallback a local si falla internet
      const local = localStorage.getItem('pm_pro_data');
      return local ? JSON.parse(local) : { employees: [], logs: [] };
    }
  },
  
  // GUARDAR DATOS (POST)
  saveData: async (employees: Employee[], logs: ShiftLogEntry[]) => {
    try {
      const payload = { employees, logs, lastUpdated: new Date().toISOString() };
      
      // 1. Guardado inmediato en el navegador (por seguridad y velocidad)
      localStorage.setItem('pm_pro_data', JSON.stringify(payload));

      if(!GOOGLE_SCRIPT_API_URL.includes("PEGAR_TU_URL") && GOOGLE_SCRIPT_API_URL !== "") {
          // 2. Enviar a Google Drive en segundo plano
          // Usamos mode: 'no-cors' para evitar errores de bloqueo de Google en navegadores.
          // Esto envía los datos, aunque no podemos leer la respuesta "OK", sabemos que llegan.
          await fetch(GOOGLE_SCRIPT_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
              'Content-Type': 'application/json',
            },
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
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if(diffDays < 30) return `${diffDays} días`;
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
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full p-1">
        <X size={20} />
      </button>
      <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {title}
      </h2>
      {children}
    </div>
  </div>
);

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
      active 
      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
    }`}
  >
    <Icon size={18} />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const StatCard = ({ title, value, sub, icon: Icon, color, onClick }: any) => {
  const IconComp = Icon || Info;
  return (
    <div onClick={onClick} className={`glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-transform duration-300 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className={`absolute right-[-10px] top-[-10px] p-6 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
        <IconComp size={80} />
      </div>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{value}</h2>
          {sub && <p className={`text-xs mt-1 font-medium ${color.replace('text-', 'text-')}`}>{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-slate-100 dark:bg-slate-800 ${color}`}>
          <IconComp size={24} />
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [loadingData, setLoadingData] = useState(true);

  // App State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ShiftLogEntry[]>([]);
  
  const [activeTab, setActiveTab] = useState<'control' | 'directory' | 'logs'>('control');
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [compactMode, setCompactMode] = useState(false);

  // Modals & UI
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeTab, setEmployeeTab] = useState<'info' | 'coaching' | 'calendar'>('info');
  const [showChat, setShowChat] = useState(false);
  const [showUploadLegend, setShowUploadLegend] = useState(false);
  
  // Filters & AI
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkStatus | 'All'>('Activo');
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [logInput, setLogInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---

  useEffect(() => {
    if (localStorage.getItem('theme') === 'light') {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const initData = async () => {
        setLoadingData(true);
        const data = await DataService.loadData();
        
        if (data.employees) {
            const sanitized = data.employees.map(e => ({
                ...e,
                coachingHistory: e.coachingHistory || [],
                attendanceHistory: e.attendanceHistory || {},
                incidents: e.incidents || []
            }));
            setEmployees(sanitized);
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
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // --- DATA PROCESSING LOGIC ---

  const activeEmployees = useMemo(() => employees.filter(e => e.statusLaboral === 'Activo'), [employees]);

  const topEmployees = useMemo(() => {
    return [...activeEmployees].sort((a, b) => b.reliabilityScore - a.reliabilityScore).slice(0, 3);
  }, [activeEmployees]);

  const duplicateMap = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(e => {
        if(e.statusLaboral === 'Activo') counts[e.cedula] = (counts[e.cedula] || 0) + 1;
    });
    return counts;
  }, [employees]);

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

    const totalConvocados = convocados.length;
    const workingTotal = totalConvocados - (medical + pnr);
    const efe = workingTotal > 0 ? Math.round((presentes / workingTotal) * 100) : 0;
    const ia = workingTotal > 0 ? Math.round((faltas / workingTotal) * 100) : 0;
    
    const totalDays = activeEmployees.reduce((acc, curr) => {
        const start = new Date(curr.fechaIngreso);
        return acc + Math.ceil(Math.abs(new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    const avgSeniorityDays = activeEmployees.length > 0 ? Math.floor(totalDays / activeEmployees.length) : 0;
    const avgSeniorityStr = avgSeniorityDays > 365 ? `${(avgSeniorityDays/365).toFixed(1)}a` : `${Math.floor(avgSeniorityDays/30)}m`;

    return { totalConvocados, presentes, tardanzas, faltas, medical, pnr, efe, ia, libres, convocadosList: convocados, avgSeniorityStr };
  }, [activeEmployees, selectedDate]);

  const staffingAnalysis = useMemo(() => {
     const counts: Record<string, number> = { LUNES:0, MARTES:0, MIERCOLES:0, JUEVES:0, VIERNES:0, SABADO:0, DOMINGO:0 };
     activeEmployees.forEach(e => { if(counts[e.libranza] !== undefined) counts[e.libranza]++; });
     
     const days = Object.keys(counts);
     const maxDay = days.reduce((a, b) => counts[a] > counts[b] ? a : b);
     const minDay = days.reduce((a, b) => counts[a] < counts[b] ? a : b);
     const avg = activeEmployees.length / 7;
     const coverageData = days.map(day => ({ name: day.substring(0,3), active: activeEmployees.length - counts[day], off: counts[day] }));

     let recommendation = "Balance de días libres óptimo.";
     let type: 'ok' | 'warn' = 'ok';
     if (counts[maxDay] > avg + 2) {
         recommendation = `Alerta: Exceso de personal libre el ${maxDay} (${counts[maxDay]}). Sugerencia: Mover 1-2 francos al ${minDay}.`;
         type = 'warn';
     }
     return { counts, maxDay, minDay, recommendation, type, coverageData };
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
    const newEmployees = employees.map(e => {
        if (e.id === id) return { ...e, attendanceHistory: { ...e.attendanceHistory, [selectedDate]: status } };
        return e;
    });
    persistChanges(newEmployees, shiftLogs);
  };

  const generateReport = async () => {
    const { totalConvocados, presentes, tardanzas, faltas, medical, pnr, efe, ia, libres } = dailyStats;
    const dateStr = new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const report = `📊 *REPORTE OPERATIVO*\n📅 ${dateStr.toUpperCase()}\n\n👥 *Conv:* ${totalConvocados} | ✅ *Asist:* ${presentes}\n⚠️ *Tard:* ${tardanzas} | ❌ *Falta:* ${faltas}\n🏥 *Just:* Med ${medical} / PNR ${pnr}\n\n📈 *KPIs:* EFE ${efe}% | IA ${ia}%\n\n📝 *Logs:*\n${shiftLogs.slice(0,2).map(l => `- ${l.text.substring(0, 40)}...`).join('\n') || 'Sin logs.'}`;
    try { await navigator.clipboard.writeText(report); alert('✅ Reporte copiado.'); } catch (err) { alert('❌ Error copiando.'); }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Nombre", "Cedula", "Turno", "Libranza", "Fecha Ingreso", "Score", "Estado"];
    const rows = filteredEmployees.map(e => [e.id, e.nombre, e.cedula, e.turno, e.libranza, e.fechaIngreso, e.reliabilityScore, e.statusLaboral]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `PM_PRO_DATA.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleAddEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cedula = fd.get('cedula') as string;
    if (duplicateMap[cedula] && !confirm('ATENCIÓN: Cédula duplicada. ¿Registrar igual?')) return;

    const newEmp: Employee = {
      id: crypto.randomUUID(), nombre: fd.get('nombre') as string, cedula: cedula, email: fd.get('email') as string,
      fechaIngreso: fd.get('fechaIngreso') as string, turno: fd.get('turno') as ShiftType, libranza: fd.get('libranza') as any,
      csAsignado: fd.get('csAsignado') as string, statusLaboral: 'Activo',
      statusHistory: [{ status: 'Activo', date: new Date().toISOString().split('T')[0], note: 'Alta' }],
      incidents: [], coachingHistory: [], attendanceHistory: {}, reliabilityScore: 100
    };
    persistChanges([...employees, newEmp], shiftLogs);
    setShowAddModal(false);
  };

  const handleUpdateEmployee = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const id = editingEmployeeId; if (!id) return;
      const updated = employees.map(emp => emp.id === id ? {
          ...emp, nombre: fd.get('nombre') as string, cedula: fd.get('cedula') as string, email: fd.get('email') as string,
          turno: fd.get('turno') as ShiftType, libranza: fd.get('libranza') as any, csAsignado: fd.get('csAsignado') as string,
          fechaIngreso: fd.get('fechaIngreso') as string, fechaFin: fd.get('fechaFin') ? fd.get('fechaFin') as string : undefined,
      } : emp);
      persistChanges(updated, shiftLogs);
      alert('Datos actualizados.');
  };

  const handleDeleteEmployee = () => {
      if(!editingEmployeeId || !confirm('¿Eliminar permanentemente?')) return;
      persistChanges(employees.filter(e => e.id !== editingEmployeeId), shiftLogs);
      setEditingEmployeeId(null);
  };

  const handleAddCoaching = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editingEmployeeId) return;
      const fd = new FormData(e.currentTarget);
      const newCoaching: CoachingEntry = {
          id: crypto.randomUUID(),
          date: fd.get('date') as string,
          topic: fd.get('topic') as any,
          notes: fd.get('notes') as string,
          actionItems: fd.get('actionItems') as string,
          status: 'Pendiente'
      };
      
      const updated = employees.map(emp => {
          if (emp.id === editingEmployeeId) {
              return {
                  ...emp,
                  coachingHistory: [newCoaching, ...(emp.coachingHistory || [])]
              };
          }
          return emp;
      });
      persistChanges(updated, shiftLogs);
      (e.target as HTMLFormElement).reset();
      alert('Coaching registrado.');
  };

  const handleAddIncident = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showIncidentModal) return;
    const fd = new FormData(e.currentTarget);
    const newInc: Incident = { id: crypto.randomUUID(), type: fd.get('type') as any, date: fd.get('date') as string, note: fd.get('note') as string, severity: 'Medium' };
    const updated = employees.map(emp => {
      if (emp.id === showIncidentModal) {
        const upIncs = [...emp.incidents, newInc];
        return { ...emp, incidents: upIncs, reliabilityScore: calculateReliability(upIncs) };
      }
      return emp;
    });
    persistChanges(updated, shiftLogs);
    setShowIncidentModal(null);
  };

  const handleStatusChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showStatusModal) return;
    const fd = new FormData(e.currentTarget);
    const newStatus = fd.get('status') as WorkStatus;
    const updated = employees.map(emp => emp.id === showStatusModal ? {
          ...emp, statusLaboral: newStatus, fechaFin: newStatus === 'Egreso' ? fd.get('date') as string : undefined,
          statusHistory: [...emp.statusHistory, { status: newStatus, date: fd.get('date') as string, note: '' }]
        } : emp);
    persistChanges(updated, shiftLogs);
    setShowStatusModal(null);
  };

  const handleAddLog = () => {
    if (!logInput.trim()) return;
    const newLog: ShiftLogEntry = { id: crypto.randomUUID(), timestamp: new Date().toLocaleString(), text: logInput, author: 'Supervisor' };
    persistChanges(employees, [newLog, ...shiftLogs]);
    setLogInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const newEmployees: Employee[] = [];
        lines.forEach(line => {
          const parts = line.split(/[,;]/).map(p => p.trim());
          if (parts.length < 3 || parts[0].toLowerCase().includes('nombre')) return;
          newEmployees.push({
            id: crypto.randomUUID(), nombre: parts[0], cedula: parts[1], email: parts[2]||'', fechaIngreso: parts[3]||new Date().toISOString().split('T')[0],
            turno: 'PM', libranza: (parts[6] as any)||'DOMINGO', csAsignado: parts[7]||'Sin Asignar',
            reliabilityScore: 100, statusLaboral: 'Activo', statusHistory: [], incidents: [], coachingHistory: [], attendanceHistory: {}
          });
        });
        persistChanges([...employees, ...newEmployees], shiftLogs);
        alert(`Importados ${newEmployees.length} registros.`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    const context = JSON.stringify(activeEmployees.slice(0, 30).map(e => ({ n:e.nombre, s:e.reliabilityScore })));
    const res = await GeminiService.sendChatMessage(chatHistory, userMsg.text, context);
    setChatHistory(prev => [...prev, { role: 'model', text: res, timestamp: new Date() }]);
    setIsChatLoading(false);
  };

  // --- RENDER ---

  if (loadingData) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white animate-pulse">
        <div className="flex flex-col items-center gap-4">
            <CloudLightning size={48} className="text-indigo-500 animate-bounce" />
            <span className="text-xl font-bold">Conectando a Google Cloud...</span>
        </div>
    </div>;
  }

  return (
    <div className="min-h-screen pb-20 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="glass-panel sticky top-0 z-40 border-b border-white/10 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-400">
                Personal Manager <span className="text-indigo-500">Pro</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                 <CloudLightning size={10} className="text-emerald-500"/> Cloud Mode
              </p>
            </div>
          </div>

          <nav className="hidden md:flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl">
            <TabButton active={activeTab === 'control'} onClick={() => setActiveTab('control')} icon={LayoutDashboard} label="Control Diario" />
            <TabButton active={activeTab === 'directory'} onClick={() => setActiveTab('directory')} icon={Users} label="Directorio" />
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={ClipboardList} label="Bitácora" />
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        {/* --- VIEW: CONTROL CENTER (DAILY OPS) --- */}
        {activeTab === 'control' && (
           <div className="space-y-6 animate-fade-in">
              <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                      <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-500"><CalendarDays size={24} /></div>
                      <div>
                          <label className="text-xs text-slate-500 uppercase font-bold">Fecha de Operación</label>
                          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-xl font-bold text-slate-800 dark:text-white outline-none block"/>
                      </div>
                  </div>
                  <button onClick={generateReport} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"><Copy size={16} /> Reporte WhatsApp</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                 <StatCard title="Convocados" value={dailyStats.totalConvocados} icon={Users} color="text-indigo-500" />
                 <StatCard title="Asistencia" value={dailyStats.presentes} icon={UserCheck} color="text-emerald-500" />
                 <StatCard title="Tardanzas" value={dailyStats.tardanzas} icon={Clock} color="text-amber-500" />
                 <StatCard title="Faltas (IA)" value={dailyStats.faltas} icon={UserX} color="text-rose-500" />
                 <StatCard title="Médico (CMP)" value={dailyStats.medical} icon={Stethoscope} color="text-purple-500" />
                 <StatCard title="PNR (Permiso)" value={dailyStats.pnr} icon={PauseCircle} color="text-blue-500" />
                 <div className="glass-panel p-5 rounded-2xl relative overflow-hidden flex flex-col justify-center items-center"><div className="absolute top-2 right-2 text-indigo-500 opacity-20"><Percent size={40}/></div><h3 className="text-3xl font-bold text-indigo-500">{dailyStats.efe}%</h3><p className="text-xs text-slate-500 font-bold uppercase mt-1">EFE</p></div>
                 <div className="glass-panel p-5 rounded-2xl relative overflow-hidden flex flex-col justify-center items-center cursor-help" title="Antigüedad Promedio"><div className="absolute top-2 right-2 text-purple-500 opacity-20"><Medal size={40}/></div><h3 className="text-xl font-bold text-purple-500 whitespace-nowrap">{dailyStats.avgSeniorityStr}</h3><p className="text-xs text-slate-500 font-bold uppercase mt-1">Antigüedad</p></div>
              </div>
              
              <div className={`glass-panel p-4 rounded-xl border-l-4 ${staffingAnalysis.type === 'warn' ? 'border-amber-500 bg-amber-500/5' : 'border-emerald-500 bg-emerald-500/5'} flex items-center gap-4`}>
                 <div className={`p-3 rounded-full ${staffingAnalysis.type === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}><Lightbulb size={24} /></div>
                 <div className="flex-1"><h4 className="font-bold text-slate-800 dark:text-white">Balance AI</h4><p className="text-sm text-slate-600 dark:text-slate-300">{staffingAnalysis.recommendation}</p></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="glass-panel p-6 rounded-2xl col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3"><h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><UserCheck size={18} className="text-emerald-500"/> Asistencia</h3><button onClick={() => setCompactMode(!compactMode)} className={`p-1.5 rounded-md text-xs font-bold flex items-center gap-1 border ${compactMode ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-transparent text-slate-500 border-slate-600'}`} title="Modo Denso"><List size={14} /> Vista</button></div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2">
                        {dailyStats.convocadosList.map(emp => {
                            const status = emp.attendanceHistory?.[selectedDate];
                            return (
                                <div key={emp.id} className={`flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-500/30 transition-colors ${compactMode ? 'p-1.5' : 'p-3'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`rounded-full flex items-center justify-center text-sm font-bold text-white transition-colors ${compactMode ? 'w-8 h-8 text-xs' : 'w-10 h-10'} ${status === 'Presente' ? 'bg-emerald-500' : status === 'Tardanza' ? 'bg-amber-500' : status === 'Falta' ? 'bg-rose-500' : status === 'Medical' ? 'bg-purple-500' : status === 'PNR' ? 'bg-blue-500' : 'bg-slate-400'}`}>
                                            {status === 'Medical' ? <Stethoscope size={compactMode ? 14 : 18}/> : status === 'PNR' ? <PauseCircle size={compactMode ? 14 : 18}/> : emp.nombre.charAt(0)}
                                        </div>
                                        <div><div className={`font-bold dark:text-white ${compactMode ? 'text-xs' : 'text-sm'}`}>{emp.nombre}</div>{!compactMode && <div className="text-[10px] text-slate-500">{emp.cedula}</div>}</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAttendance(emp.id, 'Presente')} title="Presente" className={`rounded-lg transition-colors ${compactMode ? 'p-1' : 'p-2'} ${status === 'Presente' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:text-emerald-500'}`}><CheckCircle2 size={compactMode ? 14 : 18}/></button>
                                        <button onClick={() => handleAttendance(emp.id, 'Tardanza')} title="Tardanza" className={`rounded-lg transition-colors ${compactMode ? 'p-1' : 'p-2'} ${status === 'Tardanza' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:text-amber-500'}`}><Clock size={compactMode ? 14 : 18}/></button>
                                        <button onClick={() => handleAttendance(emp.id, 'Falta')} title="Falta" className={`rounded-lg transition-colors ${compactMode ? 'p-1' : 'p-2'} ${status === 'Falta' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:text-rose-500'}`}><UserX size={compactMode ? 14 : 18}/></button>
                                        <div className="w-px h-8 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                        <button onClick={() => handleAttendance(emp.id, 'Medical')} title="CMP" className={`rounded-lg transition-colors ${compactMode ? 'p-1' : 'p-2'} ${status === 'Medical' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:text-purple-500'}`}><Stethoscope size={compactMode ? 14 : 18}/></button>
                                        <button onClick={() => handleAttendance(emp.id, 'PNR')} title="PNR" className={`rounded-lg transition-colors ${compactMode ? 'p-1' : 'p-2'} ${status === 'PNR' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:text-blue-500'}`}><PauseCircle size={compactMode ? 14 : 18}/></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                 </div>

                 <div className="glass-panel p-6 rounded-2xl h-full flex flex-col bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-2"><h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Briefcase size={18} className="text-indigo-400"/> Día Libre</h3><span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-bold">{dailyStats.libres.length}</span></div>
                    <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">{dailyStats.libres.map(emp => (<div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm opacity-80"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">{emp.nombre.charAt(0)}</div><div className="flex flex-col"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{emp.nombre}</span><span className="text-[10px] text-slate-400">{emp.csAsignado}</span></div></div>))}</div>
                 </div>
              </div>
           </div>
        )}

        {/* --- VIEW: DIRECTORY --- */}
        {activeTab === 'directory' && (
          <div className="space-y-6 animate-fade-in">
             <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 w-full md:w-auto flex-1">
                   <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="glass-input w-full pl-10 pr-4 py-2 rounded-lg text-sm"/></div>
                   <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="glass-input px-3 py-2 rounded-lg text-sm w-32 bg-transparent"><option value="Activo">Activos</option><option value="Egreso">Egresos</option><option value="All">Todos</option></select>
                </div>
                <div className="flex gap-2 relative">
                   {showUploadLegend && <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl border border-slate-700 z-50"><strong>TXT:</strong> Nombre,Cedula,Correo,FechaIngreso,Mesa,Turno,DiaLibre,CS</div>}
                   <button onMouseEnter={() => setShowUploadLegend(true)} onMouseLeave={() => setShowUploadLegend(false)} className="text-slate-400 hover:text-white p-2"><Info size={16}/></button>
                   <button onClick={() => setShowOnlyDuplicates(!showOnlyDuplicates)} className={`px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-colors ${showOnlyDuplicates ? 'bg-rose-500 text-white border-rose-600' : 'bg-white/5 border-slate-300 dark:border-slate-700 text-slate-500'}`}><Filter size={16}/> DUP</button>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv"/><button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-sm font-medium flex items-center gap-2"><Upload size={16}/></button>
                   <button onClick={handleExportCSV} className="px-3 py-2 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 text-sm font-medium flex items-center gap-2 border border-emerald-600/20"><Download size={16}/></button>
                   <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20"><UserPlus size={16}/> Nuevo</button>
                </div>
             </div>

             <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider"><tr><th className="px-6 py-4">Empleado</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Día Libre</th><th className="px-6 py-4">Antigüedad</th><th className="px-6 py-4 text-center">Score ABS</th><th className="px-6 py-4 text-right">Acciones</th></tr></thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                         {filteredEmployees.map(emp => {
                            const isRisk = emp.reliabilityScore < 75;
                            const isDuplicate = duplicateMap[emp.cedula] > 1;
                            return (
                               <tr key={emp.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isDuplicate ? 'bg-rose-500/20 dark:bg-rose-500/10 border-l-4 border-rose-500' : isRisk ? 'bg-amber-500/5' : ''}`}>
                                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isDuplicate ? 'bg-rose-600 animate-pulse' : isRisk ? 'bg-amber-500' : 'bg-slate-500 dark:bg-slate-700'}`}>{isDuplicate ? '!' : emp.nombre.charAt(0)}</div><div><div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">{emp.nombre}{isDuplicate && <span className="text-[10px] bg-rose-500 text-white px-1.5 rounded uppercase">DUP</span>}{isRisk && <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded uppercase flex items-center gap-1" title="Riesgo"><AlertTriangle size={8}/></span>}</div><div className="text-xs text-slate-500 dark:text-slate-400">{emp.cedula} | {emp.csAsignado}</div></div></div></td>
                                  <td className="px-6 py-4"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${emp.statusLaboral === 'Activo' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>{emp.statusLaboral === 'Activo' ? <CheckCircle2 size={12} /> : <UserX size={12} />} {emp.statusLaboral}</span></td>
                                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{emp.libranza}</td>
                                  <td className="px-6 py-4 text-indigo-500 font-bold">{getSeniority(emp.fechaIngreso)}</td>
                                  <td className="px-6 py-4 text-center"><span className={`font-bold ${emp.reliabilityScore === 100 ? 'text-emerald-500' : emp.reliabilityScore > 80 ? 'text-amber-500' : 'text-rose-500'}`}>{emp.reliabilityScore}</span></td>
                                  <td className="px-6 py-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => { setEditingEmployeeId(emp.id); setEmployeeTab('info'); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-indigo-500" title="Editar"><Pencil size={16} /></button>
                                     <button onClick={() => setShowIncidentModal(emp.id)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-amber-500" title="Incidencia"><AlertTriangle size={16} /></button>
                                     <button onClick={() => setShowStatusModal(emp.id)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-rose-500" title="Baja/Estado"><Settings size={16} /></button>
                                  </td>
                               </tr>
                            )
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {/* --- VIEW: LOGS --- */}
        {activeTab === 'logs' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className="glass-panel p-6 rounded-2xl h-min sticky top-24">
                 <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex gap-2 items-center"><Briefcase size={18}/> Nueva Entrada</h3>
                 <textarea value={logInput} onChange={e => setLogInput(e.target.value)} className="glass-input w-full h-32 p-3 rounded-xl mb-4 resize-none" placeholder="Registrar novedad operativa..."></textarea>
                 <button onClick={handleAddLog} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform">Guardar en Bitácora</button>
              </div>
              <div className="md:col-span-2 space-y-4">
                 {shiftLogs.map(log => (
                    <div key={log.id} className="glass-panel p-5 rounded-xl border-l-4 border-indigo-500 hover:translate-x-1 transition-transform">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{log.author}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {log.timestamp}</span>
                       </div>
                       <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{log.text}</p>
                    </div>
                 ))}
              </div>
           </div>
        )}

      </main>

      {/* --- MODALS --- */}
      
      {showAddModal && (
        <Modal title="Alta de Empleado" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input name="nombre" placeholder="Nombre Completo" required className="glass-input w-full p-3 rounded-xl" />
              <input name="cedula" placeholder="Cédula / ID" required className="glass-input w-full p-3 rounded-xl" />
            </div>
            <input name="email" type="email" placeholder="Correo Electrónico" className="glass-input w-full p-3 rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
               <select name="turno" className="glass-input w-full p-3 rounded-xl bg-transparent text-slate-500">
                  <option value="PM">Turno PM</option><option value="AM">Turno AM</option>
               </select>
               <select name="libranza" className="glass-input w-full p-3 rounded-xl bg-transparent text-slate-500">
                  <option value="DOMINGO">Domingo</option><option value="SABADO">Sábado</option><option value="VIERNES">Viernes</option>
               </select>
            </div>
            <input name="csAsignado" placeholder="CS Líder" required className="glass-input w-full p-3 rounded-xl" />
            <div>
               <label className="text-xs text-slate-500 font-bold ml-1">Fecha Ingreso</label>
               <input name="fechaIngreso" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-3 rounded-xl" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mt-4">Registrar Empleado</button>
          </form>
        </Modal>
      )}

      {/* Editing Modal - Full Profile */}
      {editingEmployeeId && (
          <Modal title="Ficha del Empleado" onClose={() => setEditingEmployeeId(null)} maxWidth="max-w-2xl">
              {(() => {
                  const emp = employees.find(e => e.id === editingEmployeeId);
                  if(!emp) return null;
                  return (
                      <div className="flex flex-col h-[70vh]">
                          <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-4 pb-2">
                              <button onClick={() => setEmployeeTab('info')} className={`pb-2 px-2 text-sm font-bold ${employeeTab === 'info' ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-500'}`}>Datos Personales</button>
                              <button onClick={() => setEmployeeTab('coaching')} className={`pb-2 px-2 text-sm font-bold ${employeeTab === 'coaching' ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-500'}`}>Coaching & Feedback</button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto pr-2">
                              {employeeTab === 'info' && (
                                  <form onSubmit={handleUpdateEmployee} className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                          <div><label className="text-xs font-bold text-slate-500">Nombre</label><input name="nombre" defaultValue={emp.nombre} className="glass-input w-full p-2 rounded-lg" /></div>
                                          <div><label className="text-xs font-bold text-slate-500">Cédula</label><input name="cedula" defaultValue={emp.cedula} className="glass-input w-full p-2 rounded-lg" /></div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div><label className="text-xs font-bold text-slate-500">Email</label><input name="email" defaultValue={emp.email} className="glass-input w-full p-2 rounded-lg" /></div>
                                          <div><label className="text-xs font-bold text-slate-500">CS Líder</label><input name="csAsignado" defaultValue={emp.csAsignado} className="glass-input w-full p-2 rounded-lg" /></div>
                                      </div>
                                      <div className="grid grid-cols-3 gap-4">
                                          <div><label className="text-xs font-bold text-slate-500">Turno</label><select name="turno" defaultValue={emp.turno} className="glass-input w-full p-2 rounded-lg bg-transparent"><option value="PM">PM</option><option value="AM">AM</option></select></div>
                                          <div><label className="text-xs font-bold text-slate-500">Día Libre</label><select name="libranza" defaultValue={emp.libranza} className="glass-input w-full p-2 rounded-lg bg-transparent"><option value="DOMINGO">Domingo</option><option value="SABADO">Sábado</option><option value="LUNES">Lunes</option><option value="MARTES">Martes</option><option value="MIERCOLES">Miércoles</option><option value="JUEVES">Jueves</option><option value="VIERNES">Viernes</option></select></div>
                                          <div><label className="text-xs font-bold text-emerald-500">Ingreso</label><input name="fechaIngreso" type="date" defaultValue={emp.fechaIngreso} className="glass-input w-full p-2 rounded-lg" /></div>
                                      </div>
                                      {emp.statusLaboral !== 'Activo' && (
                                          <div><label className="text-xs font-bold text-rose-500">Fecha Baja</label><input name="fechaFin" type="date" defaultValue={emp.fechaFin} className="glass-input w-full p-2 rounded-lg border-rose-500/50" /></div>
                                      )}
                                      <div className="pt-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 mt-4">
                                          <button type="button" onClick={handleDeleteEmployee} className="text-rose-500 text-xs font-bold flex items-center gap-1 hover:bg-rose-500/10 p-2 rounded"><Trash2 size={14}/> Eliminar Registro</button>
                                          <button className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg">Guardar Cambios</button>
                                      </div>
                                  </form>
                              )}

                              {employeeTab === 'coaching' && (
                                  <div className="space-y-6">
                                      <form onSubmit={handleAddCoaching} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                          <h4 className="font-bold text-sm text-indigo-500 flex items-center gap-2"><MessageCircle size={16}/> Nuevo Registro</h4>
                                          <div className="grid grid-cols-2 gap-3">
                                              <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-2 rounded-lg text-xs" />
                                              <select name="topic" className="glass-input w-full p-2 rounded-lg text-xs bg-transparent"><option value="Rendimiento">Rendimiento</option><option value="Asistencia">Asistencia</option><option value="Actitud">Actitud</option><option value="1-on-1">1-on-1</option></select>
                                          </div>
                                          <textarea name="notes" placeholder="Resumen de la conversación..." required className="glass-input w-full p-2 rounded-lg text-xs h-20 resize-none"></textarea>
                                          <input name="actionItems" placeholder="Acuerdos / Compromisos" className="glass-input w-full p-2 rounded-lg text-xs" />
                                          <button className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg text-xs">Guardar Feedback</button>
                                      </form>
                                      <div className="space-y-3">
                                          {(emp.coachingHistory || []).map(entry => (
                                              <div key={entry.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                                  <div className={`absolute top-0 left-0 w-1 h-full ${entry.topic === 'Rendimiento' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                                  <div className="flex justify-between items-start mb-2">
                                                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{entry.topic}</span>
                                                      <span className="text-xs text-slate-400">{entry.date}</span>
                                                  </div>
                                                  <p className="text-sm text-slate-800 dark:text-slate-200 mb-2">{entry.notes}</p>
                                                  {entry.actionItems && <div className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-2 rounded mt-2 flex gap-2"><Target size={14}/> <strong>Acuerdo:</strong> {entry.actionItems}</div>}
                                              </div>
                                          ))}
                                          {(!emp.coachingHistory || emp.coachingHistory.length === 0) && <p className="text-center text-slate-500 text-xs italic py-4">No hay registros de coaching.</p>}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  );
              })()}
          </Modal>
      )}

      {showIncidentModal && (
        <Modal title="Registrar Incidencia" onClose={() => setShowIncidentModal(null)}>
          <form onSubmit={handleAddIncident} className="space-y-4">
            <div>
               <label className="text-xs font-bold text-slate-500">Tipo de Incidencia</label>
               <select name="type" className="glass-input w-full p-3 rounded-xl bg-transparent mt-1">
                 <option value="Tardanza">Tardanza (-5 pts)</option>
                 <option value="Ausencia">Ausencia Injustificada (-15 pts)</option>
                 <option value="Conducta">Falta de Conducta (-20 pts)</option>
                 <option value="Felicitacion">Felicitación (+5 pts)</option>
               </select>
            </div>
            <div>
               <label className="text-xs font-bold text-slate-500">Fecha</label>
               <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-3 rounded-xl mt-1" />
            </div>
            <div>
               <label className="text-xs font-bold text-slate-500">Gravedad</label>
               <select name="severity" className="glass-input w-full p-3 rounded-xl bg-transparent mt-1">
                 <option value="Low">Baja</option><option value="Medium">Media</option><option value="High">Alta</option>
               </select>
            </div>
            <textarea name="note" placeholder="Detalle de lo ocurrido..." className="glass-input w-full p-3 rounded-xl h-24 resize-none" />
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">Registrar</button>
          </form>
        </Modal>
      )}

      {showStatusModal && (
        <Modal title="Cambio de Estado" onClose={() => setShowStatusModal(null)}>
          <form onSubmit={handleStatusChange} className="space-y-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-3 rounded-xl text-xs flex gap-2">
               <AlertTriangle size={16}/> Esta acción cambiará el estado operativo del empleado.
            </div>
            <select name="status" className="glass-input w-full p-3 rounded-xl bg-transparent">
              <option value="Egreso">Baja Definitiva (Egreso)</option>
              <option value="Licencia">Licencia / Reposo</option>
              <option value="CambioArea">Cambio de Área</option>
              <option value="Activo">Reactivar Empleado</option>
            </select>
            <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="glass-input w-full p-3 rounded-xl" />
            <textarea name="note" placeholder="Motivo del cambio..." className="glass-input w-full p-3 rounded-xl h-24 resize-none" />
            <button type="submit" className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl">Confirmar Cambio</button>
          </form>
        </Modal>
      )}
      
      {/* Chat Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!showChat && (
          <button onClick={() => setShowChat(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center gap-2">
            <MessageSquare size={24} />
          </button>
        )}
        
        {showChat && (
          <div className="glass-panel w-80 h-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in mb-4 mr-4">
            <div className="bg-indigo-600 p-3 text-white flex justify-between items-center font-bold text-sm">
              <span className="flex items-center gap-2"><Settings size={14} className="animate-spin-slow"/> Asistente IA</span>
              <button onClick={() => setShowChat(false)}><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-900/50">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`p-2 rounded-lg text-xs max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 ml-auto' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                  {msg.text}
                </div>
              ))}
              {isChatLoading && <div className="text-xs text-slate-400 italic text-center animate-pulse">Analizando datos...</div>}
            </div>
            <form onSubmit={handleChat} className="p-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Pregúntame algo..." className="flex-1 bg-transparent text-xs outline-none text-slate-700 dark:text-white"/>
              <button type="submit" className="text-indigo-500"><MessageSquare size={16}/></button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}