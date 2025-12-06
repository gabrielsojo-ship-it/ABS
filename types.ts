
export type WorkStatus = 'Activo' | 'Egreso' | 'CambioArea' | 'Licencia';
export type ShiftType = 'AM' | 'PM' | 'Intermedio';
export type DayOff = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';
export type AttendanceStatus = 'Presente' | 'Tardanza' | 'Falta' | 'Medical' | 'PNR' | 'Libre';

export interface Incident {
  id: string;
  date: string;
  type: 'Tardanza' | 'Ausencia' | 'Conducta' | 'Felicitacion' | 'Otro';
  note: string;
  severity: 'Low' | 'Medium' | 'High';
}

export interface CoachingEntry {
  id: string;
  date: string;
  topic: 'Rendimiento' | 'Asistencia' | 'Actitud' | '1-on-1' | 'Plan de Mejora';
  notes: string;
  actionItems: string; // Acuerdos
  status: 'Pendiente' | 'Completado';
}

export interface StatusHistory {
  status: WorkStatus;
  date: string;
  note: string;
}

export interface Employee {
  id: string; // Internal UUID
  cedula: string; // Legal ID
  nombre: string;
  email: string;
  fechaIngreso: string;
  fechaFin?: string;
  turno: ShiftType;
  libranza: DayOff;
  csAsignado: string; // Supervisor/Leader
  statusLaboral: WorkStatus;
  statusHistory: StatusHistory[];
  incidents: Incident[];
  coachingHistory: CoachingEntry[]; // NEW: Feedback logs
  reliabilityScore: number; // 0-100 Calculated
  attendanceHistory: Record<string, AttendanceStatus>; // Key: YYYY-MM-DD, Value: Status
  notes?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

// Ops Data
export interface ShiftLogEntry {
  id: string;
  timestamp: string;
  text: string;
  author: string;
}
