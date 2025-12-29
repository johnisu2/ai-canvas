import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);

        // 1. Get original document
        const originalDoc = await prisma.document.findUnique({
            where: { id },
            include: { elements: true }
        });

        if (!originalDoc) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // 2. Wrap in transaction
        const clonedDoc = await prisma.$transaction(async (tx) => {
            // Create New Document
            const newDoc = await tx.document.create({
                data: {
                    title: `${originalDoc.title} (Clone)`,
                    fileUrl: originalDoc.fileUrl,
                    fileType: originalDoc.fileType,
                }
            });

            // Clone Elements
            if (originalDoc.elements.length > 0) {
                await tx.canvasElement.createMany({
                    data: originalDoc.elements.map(el => ({
                        documentId: newDoc.id,
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
                        rotation: el.rotation,
                        metadata: el.metadata || undefined
                    }))
                });
            }

            return newDoc;
        });

        return NextResponse.json({
            success: true,
            newId: clonedDoc.id
        });

    } catch (error) {
        console.error("Clone error:", error);
        return NextResponse.json({ error: "Failed to clone document" }, { status: 500 });
    }
}
