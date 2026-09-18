import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Starting database seed...');

  // =========================
  // ROLES
  // =========================

  const roles = [
    {
      name: 'SUPER_ADMIN',
      description: 'System administrator with cross-hospital access',
    },
    {
      name: 'HOSPITAL_ADMIN',
      description: 'Hospital administrator',
    },
    {
      name: 'DOCTOR',
      description: 'Doctor managing consultations and medical records',
    },
    {
      name: 'NURSE',
      description: 'Nurse managing patient care',
    },
    {
      name: 'RECEPTIONIST',
      description: 'Receptionist managing patients and appointments',
    },
    {
      name: 'LAB_TECHNICIAN',
      description: 'Laboratory technician managing lab orders and reports',
    },
    {
      name: 'PHARMACIST',
      description: 'Pharmacist managing medicines and prescriptions',
    },
    {
      name: 'ACCOUNTANT',
      description: 'Accountant managing invoices and payments',
    },
    {
      name: 'PATIENT',
      description: 'Hospital patient',
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        name: role.name,
      },
      update: {
        description: role.description,
      },
      create: role,
    });
  }

  console.log('✅ Roles seeded');

  // =========================
  // DEMO HOSPITAL
  // =========================

  const hospital = await prisma.hospital.upsert({
    where: {
      email: 'demo@medcore.com',
    },
    update: {
      name: 'MedCore Demo Hospital',
      phone: '+91 9876543210',
    },
    create: {
      name: 'MedCore Demo Hospital',
      email: 'demo@medcore.com',
      phone: '+91 9876543210',
    },
  });

  console.log(`✅ Hospital seeded: ${hospital.name}`);
  console.log(`🏥 Hospital ID: ${hospital.id}`);

  console.log('🌱 Database seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });