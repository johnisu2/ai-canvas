
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding ...')

  // 1. Seed Patients
  const patient1 = await prisma.patient.upsert({
    where: { hn: 'HN001' },
    update: {},
    create: {
      hn: 'HN001',
      firstName: 'John',
      lastName: 'Doe',
      gender: 'Male',
      phone: '0812345678',
      address: '123 Main St, Bangkok',
      dob: new Date('1980-01-01'),
      bloodGroup: 'O',
      idCard: '1234567890123',
      allergies: 'Penicillin',
      image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', // Dummy image
    },
  })

  const patient2 = await prisma.patient.upsert({
    where: { hn: 'HN002' },
    update: {},
    create: {
      hn: 'HN002',
      firstName: 'Jane',
      lastName: 'Smith',
      gender: 'Female',
      phone: '0898765432',
      address: '456 Second Rd, Chiang Mai',
      dob: new Date('1992-05-15'),
      bloodGroup: 'A',
      idCard: '9876543210987',
      allergies: 'None',
      image: 'https://cdn-icons-png.flaticon.com/512/3135/3135789.png', // Dummy image
    },
  })

  // 2. Seed Drugs
  const drug1 = await prisma.drug.upsert({
    where: { code: 'D001' },
    update: {},
    create: {
      code: 'D001',
      name: 'Amoxicillin 500mg',
      tradeName: 'Amoxil',
      dosage: '500mg',
      usage: '1 tablet 3 times a day',
      unit: 'tab',
      category: 'Antibiotic',
      price: 5.00,
    },
  })

   const drug2 = await prisma.drug.upsert({
    where: { code: 'D002' },
    update: {},
    create: {
      code: 'D002',
      name: 'Paracetamol 500mg',
      tradeName: 'Tylenol',
      dosage: '500mg',
      usage: '1 tablet every 4-6 hours for pain/fever',
      unit: 'tab',
      category: 'Analgesic',
      price: 1.50,
    },
  })

  // 3. Seed Prescriptions
  const rx1 = await prisma.prescription.upsert({
    where: { rxNo: 'RX2023120101' },
    update: {},
    create: {
      rxNo: 'RX2023120101',
      date: new Date(),
      doctorName: 'Dr. Somchai',
      totalAmount: 100.00,
      patientHn: patient1.hn,
      items: {
        create: [
          {
            drugCode: drug1.code,
            qty: 20,
            amount: 100.00,
          }
        ]
      }
    },
  })

  // 4. Seed Document (Optional, just to have one if needed)
  // Note: We don't have a fileUrl valid without upload, but this structure fits
  // const doc1 = await prisma.document.create({
  //   data: {
  //     title: 'Sample Medical Certificate',
  //     fileUrl: '/sample.pdf', // Placeholder
  //     fileType: 'application/pdf',
  //   }
  // })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
