import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        const body = await request.json();
        const { elements } = body;

        // 1. Get existing elements in DB
        const existingElements = await prisma.canvasElement.findMany({
            where: { documentId: id },
            select: { id: true }
        });
        const existingIds = existingElements.map(el => el.id);

        // 2. Separate incoming elements into Update and Create (Insert)
        const toUpdate = elements.filter((el: any) => typeof el.id === 'number' && existingIds.includes(el.id));
        const toCreate = elements.filter((el: any) => typeof el.id !== 'number');

        // 3. Identify elements to Delete (IDs in DB but not in request)
        const incomingNumericIds = toUpdate.map((el: any) => el.id);
        const toDeleteIds = existingIds.filter(dbId => !incomingNumericIds.includes(dbId));

        await prisma.$transaction([
            // 1. Delete removed elements
            prisma.canvasElement.deleteMany({
                where: {
                    documentId: id,
                    id: { in: toDeleteIds }
                }
            }),
            // 2. Create new elements (if any)
            ...(toCreate.length > 0 ? [prisma.canvasElement.createMany({
                data: toCreate.map((el: any) => ({
                    documentId: id,
                    type: el.type,
                    x: el.x,
                    y: el.y,
                    width: el.width,
                    height: el.height,
                    label: el.label,
                    fieldName: el.fieldName,
                    dbConfigTableId: el.dbConfigTableId,
                    dbConfigFieldId: el.dbConfigFieldId,
                    fieldValue: el.fieldValue,
                    script: el.script,
                    formula: el.formula,
                    fontSize: el.fontSize,
                    alignment: el.alignment,
                    pageNumber: el.pageNumber,
                    rotation: el.rotation || 0,
                    metadata: el.metadata || undefined
                }))
            })] : []),
            // 3. Update existing elements individually (if any)
            ...toUpdate.map((el: any) => prisma.canvasElement.update({
                where: { id: el.id },
                data: {
                    x: el.x,
                    y: el.y,
                    width: el.width,
                    height: el.height,
                    label: el.label,
                    fieldName: el.fieldName,
                    dbConfigTableId: el.dbConfigTableId,
                    dbConfigFieldId: el.dbConfigFieldId,
                    fieldValue: el.fieldValue,
                    script: el.script,
                    formula: el.formula,
                    fontSize: el.fontSize,
                    alignment: el.alignment,
                    pageNumber: el.pageNumber,
                    rotation: el.rotation || 0,
                    metadata: el.metadata || undefined
                }
            }))
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Save error:", error);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
}
