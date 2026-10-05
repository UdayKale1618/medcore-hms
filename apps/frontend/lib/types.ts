// ============================================================
// MEDCORE HMS - TYPESCRIPT DATA MODELS & API CONTRACTS
// ============================================================

export type UserRole =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'LAB_TECHNICIAN'
  | 'PHARMACIST'
  | 'ACCOUNTANT'
  | 'PATIENT';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  hospitalId: string;
  roleId: string;
  role?: string;
  hospital?: Hospital;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  userId: string;
  id?: string;
  name?: string;
  email: string;
  phone?: string | null;
  roleId: string;
  role: UserRole;
  hospitalId: string;
  hospitalName?: string;
  hospital?: Hospital | { id: string; name: string; code?: string };
}

export interface Hospital {
  id: string;
  name: string;
  email: string;
  code?: string;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  code: string;
  description?: string | null;
  headOfDepartment?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

export interface Patient {
  id: string;
  hospitalId: string;
  userId?: string | null;
  mrn: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender: string;
  bloodGroup?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string[];
  medicalHistory?: string | null;
  isActive: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentType = 'CONSULTATION' | 'FOLLOW_UP' | 'EMERGENCY' | 'ROUTINE';

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string;
  date?: string;
  timeSlot: string;
  type: AppointmentType | string;
  status: AppointmentStatus;
  reason?: string | null;
  notes?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  patient?: Patient;
  doctor?: Doctor;
  department?: Department;
  medicalRecord?: MedicalRecord;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  departmentId: string;
  specialization: string;
  licenseNumber: string;
  consultationFee: number | string;
  experienceYears?: number;
  qualifications?: string;
  isActive: boolean;
  user?: User;
  department?: Department;
  availability?: DoctorAvailability[];
}

export interface DoctorAvailability {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday...
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  slotDurationMinutes: number;
  isAvailable: boolean;
}

export interface Vitals {
  bloodPressure?: string;
  heartRate?: number;
  pulse?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  spo2?: number;
  height?: number;
  weight?: number;
  bmi?: number;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  chiefComplaint?: string | null;
  symptoms?: string | string[] | null;
  diagnosis?: string | null;
  icd10Code?: string | null;
  treatmentPlan?: string | null;
  allergies?: string | string[] | null;
  adverseDrugReactions?: string | string[] | null;
  adverseReactions?: string | string[] | null;
  bloodPressure?: string | null;
  pulse?: number | null;
  temperature?: number | string | null;
  spo2?: number | null;
  height?: number | string | null;
  weight?: number | string | null;
  bmi?: number | string | null;
  vitals?: Vitals | null;
  familyHistory?: string | null;
  notes?: string | null;
  patient?: Patient;
  doctor?: Doctor;
  appointment?: Appointment;
  prescriptions?: Prescription[];
  labOrders?: LabOrder[];
  createdAt: string;
  updatedAt: string;
}

export type PrescriptionStatus = 'PRESCRIBED' | 'PARTIALLY_FULFILLED' | 'FULFILLED';

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
  quantity: number;
  dispensedQuantity: number;
  medicine?: Medicine;
}

export interface Prescription {
  id: string;
  medicalRecordId: string;
  status: PrescriptionStatus;
  notes?: string | null;
  items: PrescriptionItem[];
  medicalRecord?: MedicalRecord;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Medicine {
  id: string;
  hospitalId: string;
  name: string;
  genericName?: string | null;
  brand?: string | null;
  category?: string | null;
  form: string;
  strength?: string | null;
  unit: string;
  minStockLevel: number;
  isActive: boolean;
  batches?: MedicineBatch[];
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePrice?: number | string;
  sellingPrice: number | string;
  manufacturer?: string | null;
  createdAt: string;
  updatedAt: string;
  medicine?: Medicine;
}

export interface PharmacyInventoryItem extends Medicine {
  currentStock: number;
  availableStock: number;
  isLowStock: boolean;
  expiredBatchesCount: number;
  batches: (MedicineBatch & { isExpired: boolean; daysToExpiry: number })[];
}

export type LabOrderStatus =
  | 'PENDING'
  | 'SAMPLE_COLLECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface LabTest {
  id: string;
  hospitalId: string;
  name: string;
  code: string;
  category: string;
  price: number | string;
  turnaroundHours?: number;
  normalRange?: string | null;
  unit?: string | null;
  isActive: boolean;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  testId: string;
  result: string;
  normalRange?: string | null;
  unit?: string | null;
  interpretation?: string | null;
  notes?: string | null;
  reportUrl?: string | null;
  completedAt: string;
  test?: LabTest;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  hospitalId: string;
  patientId: string;
  medicalRecordId?: string | null;
  status: LabOrderStatus;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  notes?: string | null;
  orderedAt: string;
  sampleCollectedAt?: string | null;
  completedAt?: string | null;
  patient?: Patient;
  results?: LabResult[];
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number | string;
  total: number | string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  appointmentId?: string | null;
  subtotal: number | string;
  tax: number | string;
  discount: number | string;
  total: number | string;
  status: InvoiceStatus;
  issuedAt?: string | null;
  paidAt?: string | null;
  patient?: Patient;
  appointment?: Appointment;
  items: InvoiceItem[];
  payments?: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  hospitalId: string;
  gateway: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  amount: number | string;
  currency: string;
  status: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  method?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  hospitalId?: string | null;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
