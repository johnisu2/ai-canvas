
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const patients = await prisma.patient.findMany({
            select: {
                hn: true,
                firstName: true,
                lastName: true,
                gender: true,
            },
            orderBy: { hn: 'asc' }
        });
        return NextResponse.json(patients);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }
}
