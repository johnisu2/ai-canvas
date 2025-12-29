import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePdf } from "@/lib/pdf-generator";
import { CanvasElement } from "@/types/canvas";

export async function POST(request: NextRequest) {
    try {
        const { documentId, json } = await request.json();

        const fullData: any = {}

        console.log(`[API Generate] Request for documentId: ${documentId}`);
        console.log(`[API Generate] JSON Context:`, JSON.stringify(json, null, 2));

        if (!documentId) {
            return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
        }

        const doc = await prisma.document.findUnique({
            where: { id: parseInt(documentId) },
            include: { elements: true }
        });

        console.log("doc :", doc);

        if (doc?.elements && doc.elements.length > 0) {
            const tableIds = Array.from(
                new Set(
                    doc.elements
                        .map(el => el.dbConfigTableId)
                        .filter((id): id is number => typeof id === "number")
                )
            );

            console.log("tableIds : ", tableIds); // [1, 2]

            const findProcedure = await prisma.dbConfigTable.findMany({
                where: { id: { in: tableIds } },
                include: {
                    params: {
                        orderBy: {
                            seq: "asc", // หรือ "desc"
                        },
                    },
                },
            })

            findProcedure.forEach(async (table) => {
                if (table.procedureName) {
                    try {
                        const params: any = [];
                        table.params.forEach((param: any) => {
                            params.push(json[param.paramName] || null);
                        });

                        console.log("params : ", params);

                        const data: any = await prisma.$queryRawUnsafe(`SELECT * FROM ${table.procedureName}(${params?.map((p: any, index: number) => `$${index + 1}`).join(',')});`, ...params);
                        fullData[table.tableName] = data[0];

                        console.log("fullData : ", fullData)
                    } catch (procError) {
                        console.error(`Error executing procedure ${table.procedureName}:`, procError);
                    }
                }
            })
        }

        // return NextResponse.json({ msg: "DONE PROCESS" }, { status: 200 });

        if (doc) {
            console.log(`[API Generate] Found Document: ID=${doc.id}, Type=${doc.fileType}, URL=${doc.fileUrl}`);
        } else {
            console.error(`[API Generate] Document not found for ID: ${documentId}`);
        }

        if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

        // Map Prisma elements to CanvasElement
        const elements: CanvasElement[] = doc.elements.map((el: any) => ({
            id: el.id,
            type: el.type as any,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            label: el.label || undefined,
            fieldName: el.fieldName || undefined,
            dbConfigTableId: el.dbConfigTableId || undefined,
            dbConfigFieldId: el.dbConfigFieldId || undefined,
            fieldValue: el.fieldValue || undefined,
            script: el.script || undefined,
            formula: el.formula || undefined,
            fontSize: el.fontSize,
            alignment: el.alignment as any,
            pageNumber: el.pageNumber,
            rotation: el.rotation || 0,
            metadata: el.metadata || undefined
        }));

        const pdfBytes = await generatePdf(doc.fileUrl, elements, fullData || {}, doc.fileType);

        // Convert Uint8Array to Buffer for Next.js response compatibility
        return new NextResponse(Buffer.from(pdfBytes), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="generated_${doc.id}.pdf"`
            }
        });

    } catch (error) {
        console.error("PDF Generation Error:", error);
        return NextResponse.json({ error: "Generation failed" }, { status: 500 });
    }
}
