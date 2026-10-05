import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Starting comprehensive MedCore HMS database seed...');

  // =========================
  // 1. ROLES (All 9 Hospital Roles)
  // =========================
  const roleDefs = [
    { name: 'SUPER_ADMIN', description: 'System administrator with cross-hospital access' },
    { name: 'HOSPITAL_ADMIN', description: 'Hospital executive & administrative operations' },
    { name: 'DOCTOR', description: 'Doctor managing clinical consultations & medical records' },
    { name: 'NURSE', description: 'Nurse managing inpatient care, vitals & ward rounds' },
    { name: 'RECEPTIONIST', description: 'Receptionist managing patient registration & front desk' },
    { name: 'LAB_TECHNICIAN', description: 'Laboratory technician processing diagnostics & reports' },
    { name: 'PHARMACIST', description: 'Pharmacist managing pharmacy inventory & dispensing' },
    { name: 'ACCOUNTANT', description: 'Financial accountant managing billing, invoices & payments' },
    { name: 'PATIENT', description: 'Hospital patient with patient portal access' },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of roleDefs) {
    const roleRecord = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roleMap[r.name] = roleRecord.id;
  }
  console.log('✅ Roles seeded');

  // =========================
  // 2. HOSPITALS
  // =========================
  const apolloHospital = await prisma.hospital.upsert({
    where: { email: 'admin@apollo.com' },
    update: {
      name: 'Apollo Specialty Hospital',
      phone: '+91 80 2630 4050',
    },
    create: {
      name: 'Apollo Specialty Hospital',
      email: 'admin@apollo.com',
      phone: '+91 80 2630 4050',
    },
  });

  const demoHospital = await prisma.hospital.upsert({
    where: { email: 'demo@medcore.com' },
    update: {
      name: 'MedCore Central Hospital',
      phone: '+91 9876543210',
    },
    create: {
      name: 'MedCore Central Hospital',
      email: 'demo@medcore.com',
      phone: '+91 9876543210',
    },
  });
  console.log(`✅ Hospitals seeded: ${apolloHospital.name}, ${demoHospital.name}`);

  // =========================
  // 3. DEPARTMENTS
  // =========================
  const deptDefs = [
    'Cardiology',
    'Neurology',
    'General Medicine',
    'Pediatrics',
    'Orthopedics',
    'Emergency & Critical Care',
  ];

  const deptMap: Record<string, string> = {};
  for (const deptName of deptDefs) {
    const existing = await prisma.department.findFirst({
      where: { name: deptName, hospitalId: apolloHospital.id },
    });
    if (existing) {
      deptMap[deptName] = existing.id;
    } else {
      const created = await prisma.department.create({
        data: {
          name: deptName,
          hospitalId: apolloHospital.id,
        },
      });
      deptMap[deptName] = created.id;
    }
  }
  console.log('✅ Departments seeded');

  // =========================
  // 4. USERS (Preset demo users for all 9 roles)
  // =========================
  const commonPasswordHash = await bcrypt.hash('Password123!', 10);

  const usersToSeed = [
    {
      name: 'Super Administrator',
      email: 'superadmin@medcore.com',
      phone: '+91 9800000001',
      role: 'SUPER_ADMIN',
      hospitalId: demoHospital.id,
    },
    {
      name: 'Dr. Arthur Mitchell (Hospital Admin)',
      email: 'admin@apollo.com',
      phone: '+91 9800000002',
      role: 'HOSPITAL_ADMIN',
      hospitalId: apolloHospital.id,
    },
    {
      name: 'Dr. Rajesh Sharma',
      email: 'doctor@apollo.com',
      phone: '+91 9800000003',
      role: 'DOCTOR',
      hospitalId: apolloHospital.id,
    },
    {
      name: 'Sister Clara Barton',
      email: 'nurse@apollo.com',
      phone: '+91 9800000004',
      role: 'NURSE',
      hospitalId: apolloHospital.id,
    },
    {
      name: 'Rita Deshmukh (Reception Desk)',
      email: 'receptionist@apollo.com',
      phone: '+91 9800000005',
      role: 'RECEPTIONIST',
      hospitalId: apolloHospital.id,
    },
    {
      name: 'Vikram Mehta (Lead Lab Tech)',
      email: 'lab@apollo.com',
      phone: '+91 9800000006',
      role: 'LAB_TECHNICIAN',
      hospitalId: apolloHospital.id,
    },
    {
      name: 'Pooja Kulkarni (Chief Pharmacist)',
      email: 'pharmacy@apollo.com',
      phone: '+91 9800000007',
      role: 'PHARMACIST',
      hospitalId: apolloHospital.id,
    },
    {
      name: 'Rohan Verma (Senior Accountant)',
      email: 'accountant@apollo.com',
      phone: '+91 9800000008',
      role: 'ACCOUNTANT',
      hospitalId: apolloHospital.id,
    },
    {
      name: 'Johnathan Doe (Patient)',
      email: 'patient@apollo.com',
      phone: '+91 9800000009',
      role: 'PATIENT',
      hospitalId: apolloHospital.id,
    },
  ];

  const userRecordMap: Record<string, string> = {};
  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        phone: u.phone,
        passwordHash: commonPasswordHash,
        roleId: roleMap[u.role],
        hospitalId: u.hospitalId,
        emailVerified: true,
      },
      create: {
        name: u.name,
        email: u.email,
        phone: u.phone,
        passwordHash: commonPasswordHash,
        roleId: roleMap[u.role],
        hospitalId: u.hospitalId,
        emailVerified: true,
      },
    });
    userRecordMap[u.email] = user.id;
  }
  console.log('✅ All 9 demo users seeded');

  // =========================
  // 5. DOCTOR RECORD & AVAILABILITY
  // =========================
  const doctorUserId = userRecordMap['doctor@apollo.com'];
  let doctorRecord = await prisma.doctor.findUnique({
    where: { userId: doctorUserId },
  });

  if (!doctorRecord) {
    doctorRecord = await prisma.doctor.create({
      data: {
        userId: doctorUserId,
        departmentId: deptMap['Cardiology'],
        specialization: 'Senior Interventional Cardiologist',
        licenseNumber: 'MCI-CARD-99214',
        consultationFee: 800.0,
      },
    });
  } else {
    doctorRecord = await prisma.doctor.update({
      where: { id: doctorRecord.id },
      data: {
        departmentId: deptMap['Cardiology'],
        specialization: 'Senior Interventional Cardiologist',
        consultationFee: 800.0,
      },
    });
  }

  // Doctor availability (all 7 days for hospital clinical coverage)
  for (let day = 0; day <= 6; day++) {
    const existingAvail = await prisma.doctorAvailability.findFirst({
      where: { doctorId: doctorRecord.id, dayOfWeek: day },
    });
    if (!existingAvail) {
      await prisma.doctorAvailability.create({
        data: {
          doctorId: doctorRecord.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          slotMinutes: 30,
        },
      });
    }
  }
  console.log('✅ Doctor profile and schedule seeded');

  // =========================
  // 6. PATIENT RECORD
  // =========================
  const patientUserId = userRecordMap['patient@apollo.com'];
  let primaryPatient = await prisma.patient.findUnique({
    where: { userId: patientUserId },
  });

  if (!primaryPatient) {
    primaryPatient = await prisma.patient.create({
      data: {
        userId: patientUserId,
        hospitalId: apolloHospital.id,
        dateOfBirth: new Date('1988-06-15'),
        gender: 'Male',
        bloodGroup: 'O+',
        emergencyContactName: 'Mary Doe',
        emergencyContactPhone: '+91 9800000099',
      },
    });
  }

  // Add 2 more sample patients for list views
  const extraPatients = [
    {
      name: 'Ananya Deshpande',
      email: 'ananya.d@example.com',
      gender: 'Female',
      bloodGroup: 'B+',
      dob: '1995-11-20',
      phone: '+91 9765432101',
    },
    {
      name: 'Robert Miller',
      email: 'robert.m@example.com',
      gender: 'Male',
      bloodGroup: 'A+',
      dob: '1974-03-10',
      phone: '+91 9765432102',
    },
  ];

  for (const ep of extraPatients) {
    let u = await prisma.user.findUnique({ where: { email: ep.email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          name: ep.name,
          email: ep.email,
          phone: ep.phone,
          passwordHash: commonPasswordHash,
          roleId: roleMap['PATIENT'],
          hospitalId: apolloHospital.id,
          emailVerified: true,
        },
      });
    }
    const pat = await prisma.patient.findUnique({ where: { userId: u.id } });
    if (!pat) {
      await prisma.patient.create({
        data: {
          userId: u.id,
          hospitalId: apolloHospital.id,
          dateOfBirth: new Date(ep.dob),
          gender: ep.gender,
          bloodGroup: ep.bloodGroup,
          emergencyContactName: 'Family Contact',
          emergencyContactPhone: ep.phone,
        },
      });
    }
  }
  console.log('✅ Patients seeded');

  // =========================
  // 7. APPOINTMENTS & MEDICAL RECORDS
  // =========================
  let sampleAppt = await prisma.appointment.findFirst({
    where: { patientId: primaryPatient.id, doctorId: doctorRecord.id },
  });

  const now = new Date();
  const startTime = new Date(now.getTime() - 2 * 3600 * 1000);
  const endTime = new Date(now.getTime() - 1.5 * 3600 * 1000);

  if (!sampleAppt) {
    sampleAppt = await prisma.appointment.create({
      data: {
        doctorId: doctorRecord.id,
        patientId: primaryPatient.id,
        departmentId: deptMap['Cardiology'],
        appointmentDate: now,
        startTime,
        endTime,
        status: 'COMPLETED',
        type: 'REGULAR',
        reason: 'Periodic Cardiac Review & Blood Pressure Monitoring',
        notes: 'Patient reports mild exertional shortness of breath over past 2 weeks.',
      },
    });
  }

  // Medical Record for sample appointment
  let medicalRecord = await prisma.medicalRecord.findUnique({
    where: { appointmentId: sampleAppt.id },
  });

  if (!medicalRecord) {
    medicalRecord = await prisma.medicalRecord.create({
      data: {
        appointmentId: sampleAppt.id,
        patientId: primaryPatient.id,
        doctorId: doctorRecord.id,
        chiefComplaint: 'Mild exertional dyspnea and occasional dizziness.',
        symptoms: 'Fatigue, elevated systolic BP during morning readings, mild ankle edema.',
        diagnosis: 'Essential Stage 1 Hypertension with mild sinus tachycardia.',
        icd10Code: 'I10',
        treatmentPlan: 'Lifestyle modification, sodium restriction (<2g/day), daily aerobic exercise, ACE inhibitor therapy.',
        allergies: 'Penicillin (mild cutaneous rash)',
        adverseDrugReactions: 'None documented',
        bloodPressure: '138/88',
        pulse: 78,
        temperature: 98.4,
        spo2: 98,
        height: 178,
        weight: 76.5,
        bmi: 24.1,
        familyHistory: 'Paternal history of myocardial infarction at age 58.',
        notes: 'Follow up in 4 weeks for repeat blood pressure check and electrolyte evaluation.',
      },
    });
  }
  console.log('✅ Appointments & Medical Records seeded');

  // =========================
  // 8. MEDICINES & PHARMACY INVENTORY
  // =========================
  const meds = [
    { name: 'Telmisartan 40mg', form: 'TABLET', desc: 'Angiotensin II receptor antagonist for hypertension', unitCost: 4.5, mrp: 12.0, qty: 500 },
    { name: 'Amlodipine 5mg', form: 'TABLET', desc: 'Calcium channel blocker for hypertension and angina', unitCost: 2.1, mrp: 7.5, qty: 350 },
    { name: 'Metformin 500mg ER', form: 'TABLET', desc: 'First-line anti-hyperglycemic agent', unitCost: 3.0, mrp: 8.0, qty: 400 },
    { name: 'Atorvastatin 10mg', form: 'TABLET', desc: 'HMG-CoA reductase inhibitor for dyslipidemia', unitCost: 5.5, mrp: 16.0, qty: 300 },
    { name: 'Amoxicillin + Clavulanate 625mg', form: 'TABLET', desc: 'Broad spectrum beta-lactam antibacterial', unitCost: 12.0, mrp: 30.0, qty: 150 },
    { name: 'Paracetamol 650mg', form: 'TABLET', desc: 'Analgesic and antipyretic for mild pain and fever', unitCost: 1.0, mrp: 3.5, qty: 1200 },
  ];

  const medicineRecords: Record<string, string> = {};
  for (const m of meds) {
    let medRec = await prisma.medicine.findFirst({
      where: { name: m.name, hospitalId: apolloHospital.id },
    });
    if (!medRec) {
      medRec = await prisma.medicine.create({
        data: {
          hospitalId: apolloHospital.id,
          name: m.name,
          form: m.form,
          description: m.desc,
          reorderLevel: 50,
          isActive: true,
        },
      });
      // create inventory batch
      await prisma.medicineBatch.create({
        data: {
          medicineId: medRec.id,
          batchNumber: `BT-${Math.floor(100000 + Math.random() * 900000)}`,
          manufacturingDate: new Date('2026-01-15'),
          expiryDate: new Date('2028-06-30'),
          quantity: m.qty,
          unitCost: m.unitCost,
          mrp: m.mrp,
        },
      });
    }
    medicineRecords[m.name] = medRec.id;
  }
  console.log('✅ Pharmacy medicines and stock batches seeded');

  // =========================
  // 9. PRESCRIPTION FOR MEDICAL RECORD
  // =========================
  let prescription = await prisma.prescription.findFirst({
    where: { medicalRecordId: medicalRecord.id },
  });

  if (!prescription) {
    prescription = await prisma.prescription.create({
      data: {
        medicalRecordId: medicalRecord.id,
        status: 'DISPENSED',
        digitalSignature: 'DIGISIG-DR-SHARMA-99214-VALID',
      },
    });

    if (medicineRecords['Telmisartan 40mg']) {
      await prisma.prescriptionItem.create({
        data: {
          prescriptionId: prescription.id,
          medicineId: medicineRecords['Telmisartan 40mg'],
          dosage: '40mg',
          frequency: 'Once Daily (OD) in morning',
          durationDays: 30,
          dispensedQuantity: 30,
          specialInstructions: 'Take before breakfast with a glass of water.',
        },
      });
    }

    if (medicineRecords['Atorvastatin 10mg']) {
      await prisma.prescriptionItem.create({
        data: {
          prescriptionId: prescription.id,
          medicineId: medicineRecords['Atorvastatin 10mg'],
          dosage: '10mg',
          frequency: 'Once Daily (OD) at bedtime',
          durationDays: 30,
          dispensedQuantity: 30,
          specialInstructions: 'Take at night after food.',
        },
      });
    }
  }
  console.log('✅ Prescriptions and items seeded');

  // =========================
  // 10. LAB TESTS & LAB ORDERS
  // =========================
  const labTests = [
    { name: 'Complete Blood Count (CBC)', unit: 'cells/mcL', min: 4000, max: 11000, desc: 'WBC, RBC, Platelet and Hemoglobin panel' },
    { name: 'Lipid Profile Screen', unit: 'mg/dL', min: 125, max: 200, desc: 'Cholesterol, Triglycerides, HDL, LDL assessment' },
    { name: 'Serum Creatinine & eGFR', unit: 'mg/dL', min: 0.7, max: 1.3, desc: 'Renal function evaluation' },
    { name: 'Fasting Blood Glucose', unit: 'mg/dL', min: 70, max: 99, desc: 'Overnight fasting plasma glucose' },
    { name: 'Serum Electrolytes (Na/K/Cl)', unit: 'mEq/L', min: 135, max: 145, desc: 'Electrolyte balance check' },
  ];

  const labTestRecords: Record<string, string> = {};
  for (const lt of labTests) {
    let ltRec = await prisma.labTest.findFirst({
      where: { name: lt.name, hospitalId: apolloHospital.id },
    });
    if (!ltRec) {
      ltRec = await prisma.labTest.create({
        data: {
          hospitalId: apolloHospital.id,
          name: lt.name,
          unit: lt.unit,
          referenceMin: lt.min,
          referenceMax: lt.max,
          description: lt.desc,
        },
      });
    }
    labTestRecords[lt.name] = ltRec.id;
  }

  // Create sample lab order
  const lipidTestId = labTestRecords['Lipid Profile Screen'];
  if (lipidTestId) {
    const existingOrder = await prisma.labOrder.findFirst({
      where: { medicalRecordId: medicalRecord.id, labTestId: lipidTestId },
    });
    if (!existingOrder) {
      await prisma.labOrder.create({
        data: {
          medicalRecordId: medicalRecord.id,
          labTestId: lipidTestId,
          status: 'COMPLETED',
          result: 'Total Cholesterol: 188 mg/dL, HDL: 46 mg/dL, LDL: 118 mg/dL, Triglycerides: 145 mg/dL. Mild hyperlipidemia.',
          resultValue: 188.0,
          sampleCollectedAt: new Date(now.getTime() - 24 * 3600 * 1000),
          reviewedAt: new Date(),
        },
      });
    }
  }
  console.log('✅ Diagnostic Lab tests and orders seeded');

  // =========================
  // 11. INVOICES & PAYMENTS
  // =========================
  let sampleInvoice = await prisma.invoice.findFirst({
    where: { patientId: primaryPatient.id },
  });

  if (!sampleInvoice) {
    sampleInvoice = await prisma.invoice.create({
      data: {
        appointmentId: sampleAppt.id,
        patientId: primaryPatient.id,
        invoiceNumber: 'INV-2026-000101',
        subtotal: 1450.0,
        tax: 72.5,
        discount: 0.0,
        total: 1522.5,
        status: 'PAID',
        issuedAt: new Date(now.getTime() - 2 * 3600 * 1000),
        paidAt: new Date(now.getTime() - 1 * 3600 * 1000),
        items: {
          create: [
            {
              description: 'Cardiology Specialist Consultation',
              category: 'CONSULTATION',
              quantity: 1,
              unitPrice: 800.0,
              total: 800.0,
            },
            {
              description: 'Lipid Profile Screen Laboratory Test',
              category: 'LABORATORY',
              quantity: 1,
              unitPrice: 450.0,
              total: 450.0,
            },
            {
              description: 'Pharmacy Medicines (Telmisartan + Atorvastatin 30-Day)',
              category: 'PHARMACY',
              quantity: 1,
              unitPrice: 200.0,
              total: 200.0,
            },
          ],
        },
      },
    });

    // Payment record for this invoice
    await prisma.payment.create({
      data: {
        invoiceId: sampleInvoice.id,
        hospitalId: apolloHospital.id,
        gateway: 'RAZORPAY',
        gatewayOrderId: 'order_apollo_10101',
        gatewayPaymentId: 'pay_apollo_992144',
        amount: 1522.5,
        currency: 'INR',
        status: 'SUCCESS',
        method: 'UPI',
      },
    });
  }

  // Create one pending invoice for billing demonstration
  const pendingInvNum = 'INV-2026-000102';
  const existingPending = await prisma.invoice.findUnique({
    where: { invoiceNumber: pendingInvNum },
  });
  if (!existingPending) {
    await prisma.invoice.create({
      data: {
        patientId: primaryPatient.id,
        invoiceNumber: pendingInvNum,
        subtotal: 650.0,
        tax: 32.5,
        discount: 0.0,
        total: 682.5,
        status: 'PENDING',
        issuedAt: new Date(),
        items: {
          create: [
            {
              description: 'Routine ECG & Rhythm Evaluation',
              category: 'INVESTIGATION',
              quantity: 1,
              unitPrice: 650.0,
              total: 650.0,
            },
          ],
        },
      },
    });
  }
  console.log('✅ Invoices & Razorpay payments seeded');

  console.log('🎉 Database seeding completed successfully with all clinical test data!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });