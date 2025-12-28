import { prisma } from "@/lib/prisma";
import { CanvasEditor } from "@/components/editor/CanvasEditor";
import { notFound } from "next/navigation";
import { CanvasElement } from "@/types/canvas";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    if (isNaN(id)) {
        return <div>Invalid ID</div>;
    }

    const document = await prisma.document.findUnique({
        where: { id },
        include: { elements: true },
    });

    if (!document) {
        notFound();
    }

    // Map DB elements to CanvasElement type
    const initialElements: CanvasElement[] = document.elements.map(el => ({
        id: el.id,
        type: el.type as any, // Cast string to union
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        label: el.label || undefined,
        fieldName: el.fieldName || undefined,
        fieldValue: el.fieldValue || undefined,
        script: el.script || undefined,
        formula: el.formula || undefined,
        fontSize: el.fontSize,
        alignment: el.alignment as any,
        pageNumber: el.pageNumber,
        metadata: el.metadata || undefined
    }));

    return (
        <div className="h-screen flex flex-col">
            {/* Header can be added later or inside CanvasEditor */}
            <div className="flex-1 overflow-hidden">
                <CanvasEditor
                    documentId={idStr}
                    fileUrl={document.fileUrl}
                    fileType={document.fileType}
                    initialElements={initialElements}
                />
            </div>
        </div>
    );
}
