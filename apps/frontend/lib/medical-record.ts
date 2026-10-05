import type { MedicalRecord, Vitals, Patient, Doctor } from './types';

/**
 * Normalizes symptoms field (which may be a comma-separated string, string array, or null/undefined)
 * into a clean array of string symptom names.
 */
export function parseSymptoms(symptoms?: string | string[] | null): string[] {
  if (!symptoms) return [];
  if (Array.isArray(symptoms)) {
    return symptoms.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof symptoms === 'string') {
    return symptoms
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Normalizes delimited string or array fields (e.g. allergies, adverse reactions)
 */
export function parseListField(value?: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Resolves vitals from either a nested `vitals` object or flat Prisma columns
 * (bloodPressure, pulse, temperature, spo2, height, weight, bmi).
 */
export function getRecordVitals(record: MedicalRecord): Vitals | null {
  if (record.vitals) {
    return {
      ...record.vitals,
      pulse: record.vitals.pulse ?? record.vitals.heartRate ?? (record.pulse ?? undefined),
      heartRate: record.vitals.heartRate ?? record.vitals.pulse ?? (record.pulse ?? undefined),
      oxygenSaturation: record.vitals.oxygenSaturation ?? (record.spo2 ?? undefined),
      spo2: record.vitals.spo2 ?? record.vitals.oxygenSaturation ?? (record.spo2 ?? undefined),
    };
  }

  const hasAnyVital =
    Boolean(record.bloodPressure) ||
    (record.pulse !== null && record.pulse !== undefined) ||
    (record.temperature !== null && record.temperature !== undefined) ||
    (record.spo2 !== null && record.spo2 !== undefined) ||
    (record.height !== null && record.height !== undefined) ||
    (record.weight !== null && record.weight !== undefined) ||
    (record.bmi !== null && record.bmi !== undefined);

  if (!hasAnyVital) return null;

  return {
    bloodPressure: record.bloodPressure || undefined,
    pulse: record.pulse ?? undefined,
    heartRate: record.pulse ?? undefined,
    temperature:
      record.temperature !== null && record.temperature !== undefined
        ? Number(record.temperature)
        : undefined,
    oxygenSaturation: record.spo2 ?? undefined,
    spo2: record.spo2 ?? undefined,
    height:
      record.height !== null && record.height !== undefined
        ? Number(record.height)
        : undefined,
    weight:
      record.weight !== null && record.weight !== undefined
        ? Number(record.weight)
        : undefined,
    bmi:
      record.bmi !== null && record.bmi !== undefined
        ? Number(record.bmi)
        : undefined,
  };
}

/**
 * Safely resolves patient display name across nested user relation and top-level name.
 */
export function getPatientName(patient?: Patient | null): string {
  if (!patient) return 'Patient';
  return patient.user?.name || patient.name || 'Patient';
}

/**
 * Safely resolves doctor display name across nested user relation.
 */
export function getDoctorName(doctor?: Doctor | null): string {
  if (!doctor) return 'Physician';
  return doctor.user?.name || 'Physician';
}
