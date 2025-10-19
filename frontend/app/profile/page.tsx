'use client';

import { useEffect, useMemo, useState } from 'react';
import CountrySelect from '@/components/CountrySelect';

/* =========================
   Types: Patient Profile
   ========================= */

type PatientProfile = {
  patient_id: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null; // YYYY-MM-DD
  sex?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null; // ISO-3166-1 alpha-2
};

type PatientUpdateIn = Partial<Omit<PatientProfile, 'patient_id'>>;

/* =========================
   Types: Clinical Intake JSON
   (stored in encounter_notes.data)
   ========================= */

type TreatmentTried = {
  name: string;
  dose?: string;
  route?: string;
  datetime?: string; // ISO
  effect?: 'none' | 'partial' | 'complete' | '';
};

type ClinicalIntakeData = {
  schema: 'clinical-intake-hpi.v1';
  chief_complaint: string;
  primary_body_system:
    | 'skin' | 'eyes' | 'ent' | 'dental' | 'respiratory' | 'cardiovascular'
    | 'gastrointestinal' | 'genitourinary' | 'musculoskeletal' | 'neurologic'
    | 'endocrine' | 'mental' | 'general' | 'unsure';
  primary_body_part: {
    free_text: string;
    code?: { system: string; code: string; display: string } | null;
  };
  opqrst: {
    onset: {
      start_datetime?: string;
      sudden_or_gradual?: 'sudden' | 'gradual' | 'not_sure' | '';
      first_event_context?: string;
      course_since_onset?: 'improving' | 'worsening' | 'unchanged' | '';
    };
    provocation_palliation: {
      worse_with: string[];
      better_with: string[];
      treatments_tried: TreatmentTried[];
    };
    quality: {
      descriptors: string[];
      notes?: string;
    };
    radiation: {
      present: boolean;
      to_locations: string[];
    };
    severity: {
      now_0_to_10: number;
      worst_0_to_10: number;
      best_0_to_10: number;
    };
    timing: {
      pattern: 'constant' | 'intermittent' | 'waxing_waning' | '';
      episode_duration_minutes?: number | null;
      frequency_per_day?: number | null;
      time_of_day?: string;
      progression?: 'increasing frequency' | 'decreasing frequency' | 'unchanged' | '';
    };
  };
  associated_symptoms: {
    selected: string[];
    negatives: string[];
    other_text?: string;
  };
  impact_on_life: {
    limits_activity: boolean;
    sleep_disruption: boolean;
    missed_work_or_school: boolean;
  };
  safety_flags: {
    red_flags_reported: string[];
    pregnancy_status: 'yes' | 'no' | 'na' | null;
  };
  context_risk_factors: {
    recent_injury: boolean;
    recent_surgery_or_immobilization: boolean;
    recent_travel: boolean;
    sick_contacts: boolean;
    known_cardiac_or_pulmonary_history: string[];
    smoking_status: 'never' | 'former' | 'current' | '';
    alcohol_or_drug_use_relevant: boolean;
  };
  patient_priorities: {
    main_concern: string;
    expectations: string;
  };
  free_text_summary: string;
  metadata: {
    collected_at: string; // ISO
    author_type: 'patient';
    locale: string;
    version: number;
  };
};

type IntakeEnvelope = {
  encounter_id?: string;
  note_id?: string;
  chief_complaint?: string;
  content?: string; // free text narrative
  data?: ClinicalIntakeData;
};

type SaveIntakePayload = {
  chief_complaint: string;
  content: string;
  data: ClinicalIntakeData;
};

/* =========================
   API Helper
   ========================= */

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

/* =========================
   Constants
   ========================= */

const SYMPTOMS_BY_SYSTEM: Record<string, string[]> = {
  cardiovascular: ['shortness of breath', 'palpitations', 'dizziness', 'fainting', 'nausea', 'sweating', 'leg swelling'],
  respiratory: ['cough', 'wheeze', 'shortness of breath', 'fever', 'chills', 'chest tightness'],
  gastrointestinal: ['nausea', 'vomiting', 'diarrhea', 'constipation', 'blood in stool', 'abdominal bloating'],
  neurologic: ['headache', 'weakness', 'numbness', 'tingling', 'vision changes', 'confusion'],
  musculoskeletal: ['joint swelling', 'stiffness', 'limited range of motion', 'muscle cramps'],
  general: ['fever', 'chills', 'fatigue', 'weight loss', 'night sweats'],
  genitourinary: ['painful urination', 'blood in urine', 'frequency', 'urgency', 'flank pain'],
  endocrine: ['excessive thirst', 'frequent urination', 'weight gain', 'heat intolerance'],
  mental: ['low mood', 'anxiety', 'sleep disturbance', 'loss of interest'],
  skin: ['rash', 'itching', 'redness', 'swelling'],
  ent: ['sore throat', 'ear pain', 'nasal congestion', 'sinus pressure'],
  dental: ['tooth pain', 'gum swelling', 'sensitivity', 'bad breath'],
  unsure: [],
  eyes: ['redness', 'discharge', 'blurred vision', 'light sensitivity'],
};

const WORSENERS = ['exercise', 'movement', 'deep breath', 'eating', 'stress', 'lying flat', 'cold', 'heat', 'other'];
const RELIEVERS = ['rest', 'sitting up', 'lying down', 'medications', 'ice', 'heat', 'other'];
const QUALITY_CHOICES = ['sharp', 'dull', 'pressure', 'tightness', 'burning', 'aching', 'cramping', 'stabbing', 'throbbing', 'tingling', 'numbness', 'other'];
const RADIATION_LOCS = ['left arm', 'right arm', 'jaw', 'back', 'abdomen', 'groin', 'head', 'other'];
const RED_FLAGS = [
  'fainting', 'new confusion', 'blue/gray lips/skin', 'severe trouble breathing', 'coughing up blood',
  'chest pain at rest >10 minutes', 'sudden severe weakness on one side', 'worst headache of life',
  'vomiting blood/black stools', 'severe abdominal pain'
];

/* =========================
   Component
   ========================= */

export default function ProfilePage() {
  const [tab, setTab] = useState<'profile' | 'intake'>('profile');

  // ---------- Profile state ----------
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null);
  const [initial, setInitial] = useState<PatientProfile | null>(null);

  const [form, setForm] = useState<PatientUpdateIn>({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country_code: 'US',
  });

  // ---------- Intake state ----------
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeSaving, setIntakeSaving] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeSuccess, setIntakeSuccess] = useState<string | null>(null);

  const [intakeContent, setIntakeContent] = useState(''); // narrative free-text
  const [intakeJSONView, setIntakeJSONView] = useState<'wizard' | 'json'>('wizard');
  const [wizardStep, setWizardStep] = useState(0);

  const emptyIntake: ClinicalIntakeData = {
    schema: 'clinical-intake-hpi.v1',
    chief_complaint: '',
    primary_body_system: 'unsure',
    primary_body_part: { free_text: '', code: null as any },
    opqrst: {
      onset: { start_datetime: '', sudden_or_gradual: '', first_event_context: '', course_since_onset: '' },
      provocation_palliation: { worse_with: [], better_with: [], treatments_tried: [] },
      quality: { descriptors: [], notes: '' },
      radiation: { present: false, to_locations: [] },
      severity: { now_0_to_10: 0, worst_0_to_10: 0, best_0_to_10: 0 },
      timing: { pattern: '', episode_duration_minutes: null, frequency_per_day: null, time_of_day: '', progression: '' },
    },
    associated_symptoms: { selected: [], negatives: [], other_text: '' },
    impact_on_life: { limits_activity: false, sleep_disruption: false, missed_work_or_school: false },
    safety_flags: { red_flags_reported: [], pregnancy_status: null },
    context_risk_factors: {
      recent_injury: false, recent_surgery_or_immobilization: false, recent_travel: false, sick_contacts: false,
      known_cardiac_or_pulmonary_history: [], smoking_status: '', alcohol_or_drug_use_relevant: false
    },
    patient_priorities: { main_concern: '', expectations: '' },
    free_text_summary: '',
    metadata: { collected_at: new Date().toISOString(), author_type: 'patient', locale: 'en-US', version: 1 },
  };

  const [intake, setIntake] = useState<ClinicalIntakeData>(emptyIntake);
  const [rawJSON, setRawJSON] = useState<string>(JSON.stringify(emptyIntake, null, 2));

  /* =========================
     Load Profile
     ========================= */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setSuccess(null);
      setRefreshInfo(null);
      setLoading(true);
      try {
        const profile = await api<PatientProfile | null>('/me/patient');
        if (!mounted) return;
        setInitial(profile);
        setForm({
          first_name: profile?.first_name ?? '',
          middle_name: profile?.middle_name ?? '',
          last_name: profile?.last_name ?? '',
          date_of_birth: profile?.date_of_birth ?? '',
          sex: profile?.sex ?? '',
          email: profile?.email ?? '',
          phone: profile?.phone ?? '',
          address_line1: profile?.address_line1 ?? '',
          address_line2: profile?.address_line2 ?? '',
          city: profile?.city ?? '',
          state: profile?.state ?? '',
          postal_code: profile?.postal_code ?? '',
          country_code: profile?.country_code ?? 'US',
        });
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* =========================
     Load Intake (if any)
     ========================= */
  useEffect(() => {
    let mounted = true;
    if (tab !== 'intake') return;
    (async () => {
      setIntakeError(null);
      setIntakeSuccess(null);
      setIntakeLoading(true);
      try {
        // Optional backend: GET latest saved intake for this user
        // If your backend isn’t ready, this will 404 — which we swallow gracefully.
        const env = await api<IntakeEnvelope | null>('/me/intake').catch(() => null);
        if (!mounted) return;
        if (env?.data) {
          setIntake(env.data);
          setIntakeContent(env.content ?? '');
          setRawJSON(JSON.stringify(env.data, null, 2));
        } else {
          setIntake(emptyIntake);
          setIntakeContent('');
          setRawJSON(JSON.stringify(emptyIntake, null, 2));
        }
      } catch (e: any) {
        setIntakeError('Clinical intake not available yet. Your admin may need to enable it.');
      } finally {
        setIntakeLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* =========================
     Profile form helpers
     ========================= */
  const onChange = (name: keyof PatientUpdateIn) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [name]: e.target.value }));
    };

  const isCreating = !initial;
  const dirty = useMemo(() => {
    if (!initial) return Object.values(form).some((v) => (v ?? '') !== '');
    const fields = Object.keys(form) as (keyof PatientUpdateIn)[];
    return fields.some((k) => (form[k] ?? '') !== (initial[k as keyof PatientProfile] ?? ''));
  }, [form, initial]);

  const dobMissing = isCreating && (!form.date_of_birth || String(form.date_of_birth).trim() === '');
  const canSave = dirty && !saving && (!isCreating || !dobMissing);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null); setRefreshInfo(null);
    if (dobMissing) {
      setError('Date of birth is required to create your profile.');
      return;
    }
    setSaving(true);
    try {
      const payload: PatientUpdateIn = {};
      (Object.keys(form) as (keyof PatientUpdateIn)[]).forEach((k) => {
        const v = form[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') payload[k] = v;
      });
      await api('/me/patient', { method: 'PUT', body: JSON.stringify(payload) });
      setSuccess('Profile saved.');
      try {
        const updated = await api<PatientProfile | null>('/me/patient');
        setInitial(updated);
        setForm({
          first_name: updated?.first_name ?? '',
          middle_name: updated?.middle_name ?? '',
          last_name: updated?.last_name ?? '',
          date_of_birth: updated?.date_of_birth ?? '',
          sex: updated?.sex ?? '',
          email: updated?.email ?? '',
          phone: updated?.phone ?? '',
          address_line1: updated?.address_line1 ?? '',
          address_line2: updated?.address_line2 ?? '',
          city: updated?.city ?? '',
          state: updated?.state ?? '',
          postal_code: updated?.postal_code ?? '',
          country_code: updated?.country_code ?? 'US',
        });
      } catch {
        setRefreshInfo('Saved, but could not refresh profile. Try reloading the page.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     Intake: helpers
     ========================= */

  function syncRawFromState(next?: ClinicalIntakeData) {
    setRawJSON(JSON.stringify(next ?? intake, null, 2));
  }

  function applyJSONToState() {
    try {
      const parsed = JSON.parse(rawJSON) as ClinicalIntakeData;
      if (!parsed || parsed.schema !== 'clinical-intake-hpi.v1') {
        setIntakeError('JSON must include schema: "clinical-intake-hpi.v1".');
        return;
      }
      setIntake(parsed);
      setIntakeSuccess('JSON applied to wizard.');
    } catch (e: any) {
      setIntakeError('Invalid JSON. Please fix formatting and try again.');
    }
  }

  const intakeDirty = useMemo(() => {
    // dirty if chief complaint or any intake field differs from the last loaded JSON string
    const current = JSON.stringify(intake);
    return rawJSON.trim() !== JSON.stringify(JSON.parse(rawJSON || '{}'), null, 2) || current !== rawJSON;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawJSON, intake]);

  const canSaveIntake = !intakeSaving && (intake.chief_complaint?.trim().length > 0);

  async function saveIntake() {
    setIntakeError(null);
    setIntakeSuccess(null);
    setIntakeSaving(true);
    try {
      const payload: SaveIntakePayload = {
        chief_complaint: intake.chief_complaint,
        content: intakeContent,
        data: intake,
      };
      // Suggested backend endpoint (idempotent upsert for current open encounter):
      // POST /me/intake  body: { chief_complaint, content, data }
      await api('/me/intake', { method: 'POST', body: JSON.stringify(payload) });
      setIntakeSuccess('Clinical intake saved.');
    } catch (e: any) {
      // If backend not ready, be explicit it’s a server setup issue (not the user’s fault).
      setIntakeError(
        e?.message?.includes('404')
          ? 'Clinical intake service is not yet enabled server-side. Please contact support to enable /me/intake.'
          : (e?.message || 'Failed to save intake.')
      );
    } finally {
      setIntakeSaving(false);
    }
  }

  /* =========================
     UI
     ========================= */

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      {/* Tabs */}
      <div className="mt-6 border-b">
        <nav className="-mb-px flex gap-6">
          <Tab label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
          <Tab label="Clinical Intake" active={tab === 'intake'} onClick={() => setTab('intake')} />
        </nav>
      </div>

      {tab === 'profile' ? (
        <>
          {loading ? (
            <LoadingSkel />
          ) : (
            <form onSubmit={onSave} className="mt-6 space-y-6">
              {error && <Alert kind="error">{error}</Alert>}
              {success && <Alert kind="success">{success}</Alert>}
              {refreshInfo && <Alert kind="info">{refreshInfo}</Alert>}

              {!initial && !success && (
                <Alert kind="warn">No profile found yet. Fill in the details below and click <b>Save</b> to create your profile.</Alert>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First name" value={form.first_name ?? ''} onChange={onChange('first_name')} />
                <Field label="Last name" value={form.last_name ?? ''} onChange={onChange('last_name')} />
                <Field label="Middle name" value={form.middle_name ?? ''} onChange={onChange('middle_name')} />

                <Field label="Date of birth" type="date" value={form.date_of_birth ?? ''} onChange={onChange('date_of_birth')} />
                <Select
                  label="Sex"
                  value={form.sex ?? ''}
                  onChange={onChange('sex')}
                  options={[
                    { value: '', label: '—' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'intersex', label: 'Intersex' },
                    { value: 'other', label: 'Other' },
                    { value: 'unknown', label: 'Unknown' },
                  ]}
                />

                <Field label="Phone" value={form.phone ?? ''} onChange={onChange('phone')} />
                <Field label="Email" type="email" value={form.email ?? ''} onChange={onChange('email')} />
                <Field label="Address line 1" value={form.address_line1 ?? ''} onChange={onChange('address_line1')} />
                <Field label="Address line 2" value={form.address_line2 ?? ''} onChange={onChange('address_line2')} />
                <Field label="City" value={form.city ?? ''} onChange={onChange('city')} />
                <Field label="State" value={form.state ?? ''} onChange={onChange('state')} />
                <Field label="Postal code" value={form.postal_code ?? ''} onChange={onChange('postal_code')} />

                <div className="sm:col-span-2">
                  <CountrySelect
                    label="Country"
                    value={form.country_code ?? 'US'}
                    onChange={(code) => setForm((f) => ({ ...f, country_code: code }))}
                  />
                </div>
              </div>

              {dobMissing && <p className="text-sm text-red-600">Date of birth is required to create your profile.</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!canSave}
                  className={`rounded-lg px-4 py-2 text-white ${!canSave ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} transition`}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {!dirty && <span className="text-sm text-gray-500">No changes to save</span>}
              </div>
            </form>
          )}
        </>
      ) : (
        <section className="mt-6 space-y-6">
          {intakeError && <Alert kind="error">{intakeError}</Alert>}
          {intakeSuccess && <Alert kind="success">{intakeSuccess}</Alert>}

          {/* Sub-tabs for wizard vs JSON */}
          <div className="flex items-center gap-3">
            <SubTab label="Wizard" active={intakeJSONView === 'wizard'} onClick={() => { setIntakeJSONView('wizard'); syncRawFromState(); }} />
            <SubTab label="Raw JSON" active={intakeJSONView === 'json'} onClick={() => { setIntakeJSONView('json'); syncRawFromState(); }} />
          </div>

          {intakeLoading ? (
            <LoadingSkel />
          ) : intakeJSONView === 'json' ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Power users can edit the structured intake JSON directly. This mirrors the wizard and is saved exactly to the database.
              </p>
              <textarea
                className="w-full h-96 rounded-lg border border-gray-300 p-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={rawJSON}
                onChange={(e) => setRawJSON(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={applyJSONToState}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 transition"
                >
                  Apply JSON to Wizard
                </button>
                <button
                  type="button"
                  onClick={saveIntake}
                  disabled={!canSaveIntake || intakeSaving}
                  className={`rounded-lg px-4 py-2 text-white ${!canSaveIntake || intakeSaving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} transition`}
                >
                  {intakeSaving ? 'Saving…' : 'Save Intake'}
                </button>
              </div>
            </div>
          ) : (
            <Wizard
              intake={intake}
              setIntake={(next) => { setIntake(next); syncRawFromState(next); }}
              intakeContent={intakeContent}
              setIntakeContent={setIntakeContent}
              wizardStep={wizardStep}
              setWizardStep={setWizardStep}
            />
          )}

          {/* Save controls (visible for wizard too) */}
          {intakeJSONView === 'wizard' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveIntake}
                disabled={!canSaveIntake || intakeSaving}
                className={`rounded-lg px-4 py-2 text-white ${!canSaveIntake || intakeSaving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} transition`}
              >
                {intakeSaving ? 'Saving…' : 'Save Intake'}
              </button>
              <p className="text-sm text-gray-500">Your responses create a clinical encounter and a structured patient note.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* =========================
   Wizard Component
   ========================= */

function Wizard(props: {
  intake: ClinicalIntakeData;
  setIntake: (d: ClinicalIntakeData) => void;
  intakeContent: string;
  setIntakeContent: (s: string) => void;
  wizardStep: number;
  setWizardStep: (n: number) => void;
}) {
  const { intake, setIntake, intakeContent, setIntakeContent, wizardStep, setWizardStep } = props;

  const steps = [
    'About Your Main Symptom',
    'Onset (O)',
    'Provocation & Palliation (P)',
    'Quality (Q)',
    'Radiation (R)',
    'Severity (S)',
    'Timing (T)',
    'Associated Symptoms',
    'Impact on Daily Life',
    'Safety Checks (Red Flags)',
    'Context & Risk Factors',
    'Your Priorities',
    'Review & Summary',
  ];

  function next() { setWizardStep(Math.min(steps.length - 1, wizardStep + 1)); }
  function prev() { setWizardStep(Math.max(0, wizardStep - 1)); }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">{steps[wizardStep]}</p>
          <p className="text-xs text-gray-500">Step {wizardStep + 1} of {steps.length}</p>
        </div>
        <div className="w-48 h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${((wizardStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step body */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        {wizardStep === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="1) What is the main problem you’d like help with today?"
              value={intake.chief_complaint}
              onChange={(e) => setIntake({ ...intake, chief_complaint: e.target.value })}
              placeholder="e.g., Chest pain"
            />
            <Select
              label="Which body system does this seem related to?"
              value={intake.primary_body_system}
              onChange={(e) => setIntake({ ...intake, primary_body_system: e.target.value as ClinicalIntakeData['primary_body_system'] })}
              options={[
                { value: 'unsure', label: 'Not sure' },
                { value: 'cardiovascular', label: 'Cardiovascular (heart/blood vessels)' },
                { value: 'respiratory', label: 'Respiratory (lungs/breathing)' },
                { value: 'gastrointestinal', label: 'Gastrointestinal' },
                { value: 'genitourinary', label: 'Genitourinary' },
                { value: 'musculoskeletal', label: 'Musculoskeletal' },
                { value: 'neurologic', label: 'Neurologic' },
                { value: 'endocrine', label: 'Endocrine/Metabolic' },
                { value: 'mental', label: 'Mental Health' },
                { value: 'skin', label: 'Skin' },
                { value: 'eyes', label: 'Eyes' },
                { value: 'ent', label: 'ENT (ear/nose/throat)' },
                { value: 'dental', label: 'Dental' },
                { value: 'general', label: 'General/Constitutional' },
              ]}
            />
            <Field
              label="Where on your body is the problem?"
              value={intake.primary_body_part.free_text}
              onChange={(e) => setIntake({ ...intake, primary_body_part: { ...intake.primary_body_part, free_text: e.target.value } })}
              placeholder="e.g., center of chest"
            />
          </div>
        )}

        {wizardStep === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="When did this start?"
              type="datetime-local"
              value={intake.opqrst.onset.start_datetime ?? ''}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, onset: { ...intake.opqrst.onset, start_datetime: e.target.value } } })}
            />
            <Select label="Did it begin suddenly or gradually?"
              value={intake.opqrst.onset.sudden_or_gradual ?? ''}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, onset: { ...intake.opqrst.onset, sudden_or_gradual: e.target.value as any } } })}
              options={[
                { value: '', label: '—' },
                { value: 'sudden', label: 'Sudden' },
                { value: 'gradual', label: 'Gradual' },
                { value: 'not_sure', label: 'Not sure' },
              ]}
            />
            <Field label="What were you doing when it started?"
              value={intake.opqrst.onset.first_event_context ?? ''}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, onset: { ...intake.opqrst.onset, first_event_context: e.target.value } } })}
            />
            <Select label="Since it started, has it been getting better, worse, or unchanged?"
              value={intake.opqrst.onset.course_since_onset ?? ''}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, onset: { ...intake.opqrst.onset, course_since_onset: e.target.value as any } } })}
              options={[
                { value: '', label: '—' },
                { value: 'improving', label: 'Improving' },
                { value: 'worsening', label: 'Worsening' },
                { value: 'unchanged', label: 'Unchanged' },
              ]}
            />
          </div>
        )}

        {wizardStep === 2 && (
          <div className="grid grid-cols-1 gap-4">
            <Chips
              label="What makes it worse?"
              choices={WORSENERS}
              values={intake.opqrst.provocation_palliation.worse_with}
              onToggle={(val) => {
                const set = new Set(intake.opqrst.provocation_palliation.worse_with);
                set.has(val) ? set.delete(val) : set.add(val);
                setIntake({ ...intake, opqrst: { ...intake.opqrst, provocation_palliation: { ...intake.opqrst.provocation_palliation, worse_with: Array.from(set) } } });
              }}
            />
            <Chips
              label="What makes it better?"
              choices={RELIEVERS}
              values={intake.opqrst.provocation_palliation.better_with}
              onToggle={(val) => {
                const set = new Set(intake.opqrst.provocation_palliation.better_with);
                set.has(val) ? set.delete(val) : set.add(val);
                setIntake({ ...intake, opqrst: { ...intake.opqrst, provocation_palliation: { ...intake.opqrst.provocation_palliation, better_with: Array.from(set) } } });
              }}
            />
            <TreatmentsTried
              items={intake.opqrst.provocation_palliation.treatments_tried}
              onChange={(items) => setIntake({ ...intake, opqrst: { ...intake.opqrst, provocation_palliation: { ...intake.opqrst.provocation_palliation, treatments_tried: items } } })}
            />
          </div>
        )}

        {wizardStep === 3 && (
          <div className="grid grid-cols-1 gap-4">
            <Chips
              label="How would you describe the feeling?"
              choices={QUALITY_CHOICES}
              values={intake.opqrst.quality.descriptors}
              onToggle={(val) => {
                const set = new Set(intake.opqrst.quality.descriptors);
                set.has(val) ? set.delete(val) : set.add(val);
                setIntake({ ...intake, opqrst: { ...intake.opqrst, quality: { ...intake.opqrst.quality, descriptors: Array.from(set) } } });
              }}
            />
            <Field
              label="Anything else about how it feels?"
              value={intake.opqrst.quality.notes ?? ''}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, quality: { ...intake.opqrst.quality, notes: e.target.value } } })}
            />
          </div>
        )}

        {wizardStep === 4 && (
          <div className="grid grid-cols-1 gap-4">
            <Select
              label="Does the feeling move or spread anywhere else?"
              value={intake.opqrst.radiation.present ? 'yes' : 'no'}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, radiation: { ...intake.opqrst.radiation, present: e.target.value === 'yes' } } })}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            />
            {intake.opqrst.radiation.present && (
              <Chips
                label="Where does it go?"
                choices={RADIATION_LOCS}
                values={intake.opqrst.radiation.to_locations}
                onToggle={(val) => {
                  const set = new Set(intake.opqrst.radiation.to_locations);
                  set.has(val) ? set.delete(val) : set.add(val);
                  setIntake({ ...intake, opqrst: { ...intake.opqrst, radiation: { ...intake.opqrst.radiation, to_locations: Array.from(set) } } });
                }}
              />
            )}
          </div>
        )}

        {wizardStep === 5 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <RangeField
              label="Right now (0–10)"
              value={intake.opqrst.severity.now_0_to_10}
              onChange={(v) => setIntake({ ...intake, opqrst: { ...intake.opqrst, severity: { ...intake.opqrst.severity, now_0_to_10: v } } })}
            />
            <RangeField
              label="Worst (0–10)"
              value={intake.opqrst.severity.worst_0_to_10}
              onChange={(v) => setIntake({ ...intake, opqrst: { ...intake.opqrst, severity: { ...intake.opqrst.severity, worst_0_to_10: v } } })}
            />
            <RangeField
              label="Best (0–10)"
              value={intake.opqrst.severity.best_0_to_10}
              onChange={(v) => setIntake({ ...intake, opqrst: { ...intake.opqrst, severity: { ...intake.opqrst.severity, best_0_to_10: v } } })}
            />
          </div>
        )}

        {wizardStep === 6 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Is it constant or does it come and go?"
              value={intake.opqrst.timing.pattern}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, timing: { ...intake.opqrst.timing, pattern: e.target.value as any } } })}
              options={[
                { value: '', label: '—' },
                { value: 'constant', label: 'Constant' },
                { value: 'intermittent', label: 'Intermittent' },
                { value: 'waxing_waning', label: 'Waxing & waning' },
              ]}
            />
            <Field
              label="If it comes and goes, about how long does each episode last? (minutes)"
              type="number"
              value={String(intake.opqrst.timing.episode_duration_minutes ?? '')}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, timing: { ...intake.opqrst.timing, episode_duration_minutes: e.target.value ? Number(e.target.value) : null } } })}
            />
            <Field
              label="How often does it happen in a day?"
              type="number"
              value={String(intake.opqrst.timing.frequency_per_day ?? '')}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, timing: { ...intake.opqrst.timing, frequency_per_day: e.target.value ? Number(e.target.value) : null } } })}
            />
            <Field
              label="Does it occur at certain times or after certain activities?"
              value={intake.opqrst.timing.time_of_day ?? ''}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, timing: { ...intake.opqrst.timing, time_of_day: e.target.value } } })}
              placeholder="e.g., evening, after meals, with exertion"
            />
            <Select
              label="Overall, is it getting more frequent, less frequent, or unchanged?"
              value={intake.opqrst.timing.progression ?? ''}
              onChange={(e) => setIntake({ ...intake, opqrst: { ...intake.opqrst, timing: { ...intake.opqrst.timing, progression: e.target.value as any } } })}
              options={[
                { value: '', label: '—' },
                { value: 'increasing frequency', label: 'Increasing frequency' },
                { value: 'decreasing frequency', label: 'Decreasing frequency' },
                { value: 'unchanged', label: 'Unchanged' },
              ]}
            />
          </div>
        )}

        {wizardStep === 7 && (
          <div className="grid grid-cols-1 gap-4">
            <Chips
              label="Have you noticed any of these with your main symptom?"
              choices={SYMPTOMS_BY_SYSTEM[intake.primary_body_system] ?? []}
              values={intake.associated_symptoms.selected}
              onToggle={(val) => {
                const set = new Set(intake.associated_symptoms.selected);
                set.has(val) ? set.delete(val) : set.add(val);
                setIntake({ ...intake, associated_symptoms: { ...intake.associated_symptoms, selected: Array.from(set) } });
              }}
            />
            <Chips
              label="Are there symptoms you specifically have NOT had?"
              choices={SYMPTOMS_BY_SYSTEM[intake.primary_body_system] ?? []}
              values={intake.associated_symptoms.negatives}
              onToggle={(val) => {
                const set = new Set(intake.associated_symptoms.negatives);
                set.has(val) ? set.delete(val) : set.add(val);
                setIntake({ ...intake, associated_symptoms: { ...intake.associated_symptoms, negatives: Array.from(set) } });
              }}
            />
            <Field
              label="Anything else you want to mention?"
              value={intake.associated_symptoms.other_text ?? ''}
              onChange={(e) => setIntake({ ...intake, associated_symptoms: { ...intake.associated_symptoms, other_text: e.target.value } })}
            />
          </div>
        )}

        {wizardStep === 8 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Toggle label="Is this limiting your normal activities?" value={intake.impact_on_life.limits_activity}
              onChange={(v) => setIntake({ ...intake, impact_on_life: { ...intake.impact_on_life, limits_activity: v } })}
            />
            <Toggle label="Is it affecting your sleep?" value={intake.impact_on_life.sleep_disruption}
              onChange={(v) => setIntake({ ...intake, impact_on_life: { ...intake.impact_on_life, sleep_disruption: v } })}
            />
            <Toggle label="Have you missed work/school due to this?" value={intake.impact_on_life.missed_work_or_school}
              onChange={(v) => setIntake({ ...intake, impact_on_life: { ...intake.impact_on_life, missed_work_or_school: v } })}
            />
          </div>
        )}

        {wizardStep === 9 && (
          <div className="grid grid-cols-1 gap-4">
            <Chips
              label="Have you had any of the following? (red flags)"
              choices={RED_FLAGS}
              values={intake.safety_flags.red_flags_reported}
              onToggle={(val) => {
                const set = new Set(intake.safety_flags.red_flags_reported);
                set.has(val) ? set.delete(val) : set.add(val);
                setIntake({ ...intake, safety_flags: { ...intake.safety_flags, red_flags_reported: Array.from(set) } });
              }}
            />
            <Select
              label="Is there any chance you could be pregnant?"
              value={intake.safety_flags.pregnancy_status ?? 'na'}
              onChange={(e) => setIntake({ ...intake, safety_flags: { ...intake.safety_flags, pregnancy_status: e.target.value as any } })}
              options={[
                { value: 'na', label: 'Not applicable' },
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
          </div>
        )}

        {wizardStep === 10 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Toggle label="Recent injury" value={intake.context_risk_factors.recent_injury}
              onChange={(v) => setIntake({ ...intake, context_risk_factors: { ...intake.context_risk_factors, recent_injury: v } })}
            />
            <Toggle label="Recent surgery or immobilization" value={intake.context_risk_factors.recent_surgery_or_immobilization}
              onChange={(v) => setIntake({ ...intake, context_risk_factors: { ...intake.context_risk_factors, recent_surgery_or_immobilization: v } })}
            />
            <Toggle label="Recent travel" value={intake.context_risk_factors.recent_travel}
              onChange={(v) => setIntake({ ...intake, context_risk_factors: { ...intake.context_risk_factors, recent_travel: v } })}
            />
            <Toggle label="Recent sick contacts" value={intake.context_risk_factors.sick_contacts}
              onChange={(v) => setIntake({ ...intake, context_risk_factors: { ...intake.context_risk_factors, sick_contacts: v } })}
            />
            <Field
              label="Known heart or lung conditions (if any)"
              value={intake.context_risk_factors.known_cardiac_or_pulmonary_history.join(', ')}
              onChange={(e) =>
                setIntake({
                  ...intake,
                  context_risk_factors: {
                    ...intake.context_risk_factors,
                    known_cardiac_or_pulmonary_history: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              placeholder="e.g., hypertension, asthma"
            />
            <Select
              label="Do you smoke or vape?"
              value={intake.context_risk_factors.smoking_status}
              onChange={(e) => setIntake({ ...intake, context_risk_factors: { ...intake.context_risk_factors, smoking_status: e.target.value as any } })}
              options={[
                { value: '', label: '—' },
                { value: 'never', label: 'Never' },
                { value: 'former', label: 'Former' },
                { value: 'current', label: 'Current' },
              ]}
            />
            <Toggle
              label="Any alcohol or drug use that could be related to this symptom?"
              value={intake.context_risk_factors.alcohol_or_drug_use_relevant}
              onChange={(v) => setIntake({ ...intake, context_risk_factors: { ...intake.context_risk_factors, alcohol_or_drug_use_relevant: v } })}
            />
          </div>
        )}

        {wizardStep === 11 && (
          <div className="grid grid-cols-1 gap-4">
            <Field
              label="What worries you most about this?"
              value={intake.patient_priorities.main_concern}
              onChange={(e) => setIntake({ ...intake, patient_priorities: { ...intake.patient_priorities, main_concern: e.target.value } })}
            />
            <Field
              label="What are you hoping to get from today’s visit?"
              value={intake.patient_priorities.expectations}
              onChange={(e) => setIntake({ ...intake, patient_priorities: { ...intake.patient_priorities, expectations: e.target.value } })}
            />
          </div>
        )}

        {wizardStep === 12 && (
          <div className="grid grid-cols-1 gap-4">
            <Textarea
              label="Optional: Add a short summary in your own words (free text)"
              value={intakeContent}
              onChange={(e) => setIntakeContent(e.target.value)}
              placeholder="e.g., Chest pressure while jogging, worse with exertion, lasts ~10 minutes."
            />
            <Alert kind="info">
              Review your answers. You can go back to adjust any step, or switch to <b>Raw JSON</b> to edit the structured payload directly.
            </Alert>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={wizardStep === 0}
          className={`rounded-lg px-4 py-2 ${wizardStep === 0 ? 'bg-gray-200 text-gray-500' : 'bg-slate-700 text-white hover:bg-slate-800'} transition`}
        >
          Back
        </button>
        <button
          type="button"
          onClick={next}
          disabled={wizardStep === 12}
          className={`rounded-lg px-4 py-2 ${wizardStep === 12 ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'} transition`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* =========================
   Small UI Primitives
   ========================= */

function Tab(props: { label: string; active: boolean; onClick: () => void }) {
  const { label, active, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  );
}

function SubTab(props: { label: string; active: boolean; onClick: () => void }) {
  const { label, active, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
      {label}
    </button>
  );
}

function LoadingSkel() {
  return (
    <div className="mt-6 animate-pulse space-y-3">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
    </div>
  );
}

function Alert(props: { kind: 'error' | 'success' | 'info' | 'warn'; children: React.ReactNode }) {
  const { kind, children } = props;
  const map: Record<typeof kind, string> = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-green-200 bg-green-50 text-green-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
  } as any;
  return <div className={`rounded-lg border px-4 py-3 text-sm ${map[kind]}`}>{children}</div>;
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  const { label, value, onChange, type = 'text', placeholder } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        type={type}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

function Textarea(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  const { label, value, onChange, placeholder } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <textarea
        className="min-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  const { label, value, onChange, options } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <select
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

function Chips(props: {
  label: string;
  choices: string[];
  values: string[];
  onToggle: (val: string) => void;
}) {
  const { label, choices, values, onToggle } = props;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => {
          const active = values.includes(c);
          return (
            <button
              type="button"
              key={c}
              onClick={() => onToggle(c)}
              className={`rounded-full px-3 py-1 text-sm ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { label, value, onChange } = props;
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        className={`h-6 w-12 rounded-full transition ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className={`block h-6 w-6 transform rounded-full bg-white shadow transition ${value ? 'translate-x-6' : ''}`} />
      </button>
    </div>
  );
}

function RangeField(props: { label: string; value: number; onChange: (v: number) => void }) {
  const { label, value, onChange } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label} — <b>{value}</b></span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function TreatmentsTried(props: {
  items: TreatmentTried[];
  onChange: (items: TreatmentTried[]) => void;
}) {
  const { items, onChange } = props;

  function add() {
    onChange([...items, { name: '', dose: '', route: '', datetime: '', effect: '' }]);
  }
  function update(i: number, patch: Partial<TreatmentTried>) {
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = items.slice();
    next.splice(i, 1);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700">Treatments or medicines tried</span>
        <button type="button" onClick={add} className="rounded-lg bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-800">Add</button>
      </div>
      {items.length === 0 && <p className="text-sm text-gray-500">No treatments added yet.</p>}
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-6">
          <input className="col-span-2 rounded border p-2 text-sm" placeholder="Name (e.g., ibuprofen)"
            value={it.name} onChange={(e) => update(i, { name: e.target.value })} />
          <input className="rounded border p-2 text-sm" placeholder="Dose"
            value={it.dose ?? ''} onChange={(e) => update(i, { dose: e.target.value })} />
          <input className="rounded border p-2 text-sm" placeholder="Route"
            value={it.route ?? ''} onChange={(e) => update(i, { route: e.target.value })} />
          <input className="rounded border p-2 text-sm" placeholder="When" type="datetime-local"
            value={it.datetime ?? ''} onChange={(e) => update(i, { datetime: e.target.value })} />
          <select className="rounded border p-2 text-sm"
            value={it.effect ?? ''} onChange={(e) => update(i, { effect: e.target.value as any })}>
            <option value="">Effect…</option>
            <option value="none">None</option>
            <option value="partial">Partial</option>
            <option value="complete">Complete</option>
          </select>
          <div className="sm:col-span-6">
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-600 underline">Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
