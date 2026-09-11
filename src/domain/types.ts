export type Treatment = {
  id: string;
  name: string;
  recallDays: number | null;
};

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  tags: string[];
  notes: string;
  doNotContact: boolean;
  createdAt: string;
};

export type Visit = {
  id: string;
  patientId: string;
  treatmentId: string;
  date: string;
  notes: string;
};

export type ContactChannel = 'call' | 'whatsapp' | 'email';

export type ContactAttempt = {
  id: string;
  patientId: string;
  date: string;
  channel: ContactChannel;
  snoozeUntil?: string;
};

export type Settings = {
  clinicName: string;
  globalDormantDays: number;
  recallWindowDays: number;
  snoozeDays: number;
  templates: {
    whatsapp: string;
    email: { subject: string; body: string };
  };
  simulatedToday?: string;
};

export type AppState = {
  version: number;
  treatments: Treatment[];
  patients: Patient[];
  visits: Visit[];
  contacts: ContactAttempt[];
  settings: Settings;
};

export type RecallStatus = 'overdue' | 'due';

export type DueInfo = {
  treatment: Treatment | null;
  lastVisitDate: string;
  dueDate: string;
};

export type Recall = DueInfo & {
  patient: Patient;
  daysOverdue: number;
  status: RecallStatus;
};

export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  clinicName: 'Studio Demo',
  globalDormantDays: 180,
  recallWindowDays: 14,
  snoozeDays: 30,
  templates: {
    whatsapp:
      'Ciao {nome}, sono {clinica}. Sono passati circa {mesi} mesi dal tuo ultimo {trattamento}: vuoi prenotare un controllo? Rispondi pure a questo messaggio.',
    email: {
      subject: 'Il tuo prossimo appuntamento da {clinica}',
      body:
        'Gentile {nome},\n\nsono passati circa {mesi} mesi dal tuo ultimo trattamento ({trattamento}). Saremmo felici di rivederti per un controllo.\n\nRispondi a questa email o chiamaci per fissare un appuntamento.\n\nA presto,\n{clinica}',
    },
  },
};
