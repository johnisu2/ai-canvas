import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        const body = await request.json();
        const { elements } = body;

        // Simple replacement strategy for prototype
        await prisma.$transaction([
            prisma.canvasElement.deleteMany({ where: { documentId: id } }),
            prisma.canvasElement.createMany({
                data: elements.map((el: any) => ({
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
            })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Save error:", error);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
}
