
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const document = await prisma.document.findUnique({
            where: { id },
            include: { elements: true },
        });

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        return NextResponse.json(document);
    } catch (error) {
        console.error('Fetch document error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await req.json();
        const { elements, title } = body;
        console.log('[API] PUT Received:', { id, elementsCount: elements?.length, title });
        if (elements && elements.length > 0) {
            console.log('[API] Sample Element:', elements[0]);
        }

        // Transaction: Delete old elements, create new ones (simpler than update for canvas)
        // OR upsert. For simplicity in this editor, we often replace. 
        // But to keep IDs stable if possible... actually replace is fine for this use case mostly, 
        // UNLESS we want to preserve specific IDs. 
        // Let's use deleteMany + createMany for clean slate update or transaction.

        await prisma.$transaction(async (tx: any) => {
            // Update title if needed
            if (title) {
                await tx.document.update({
                    where: { id },
                    data: { title }
                });
            }

            if (elements) {
                // Delete existing
                await tx.canvasElement.deleteMany({
                    where: { documentId: id }
                });

                // Create new
                if (elements.length > 0) {
                    await tx.canvasElement.createMany({
                        data: elements.map((el: any) => ({
                            id: el.id, // PERSIST frontend ID
                            documentId: id,
                            type: el.type || 'rect',
                            x: isNaN(Number(el.x)) ? 0 : Number(el.x),
                            y: isNaN(Number(el.y)) ? 0 : Number(el.y),
                            width: isNaN(Number(el.width)) ? 100 : Number(el.width),
                            height: isNaN(Number(el.height)) ? 50 : Number(el.height),
                            label: el.label,
                            fieldName: el.fieldName,
                            fieldValue: el.fieldValue,
                            // Fix: Add new schema fields
                            script: el.script,
                            formula: el.formula,
                            fontSize: (typeof el.fontSize === 'number' && !isNaN(el.fontSize)) ? el.fontSize : 14,
                            alignment: el.alignment || 'left',
                            pageNumber: el.pageNumber || 1,
                            metadata: el.metadata || {},
                        }))
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update document error:', error);
        // @ts-ignore
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
