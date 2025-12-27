import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const mappings = await prisma.dbConfigTable.findMany({
            include: {
                fields: true
            }
        });
        return NextResponse.json(mappings);
    } catch (error) {
        console.error('API Error /config/mappings:', error);
        return NextResponse.json({ error: 'Failed to fetch mappings', details: String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    return NextResponse.json({ error: 'Not Implemented - Use Seed or direct DB access for now' }, { status: 501 });
}
