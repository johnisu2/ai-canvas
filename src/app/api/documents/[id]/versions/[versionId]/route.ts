import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; versionId: string }> } // id is docId, but we might just need versionId
) {
    try {
        const { versionId } = await params;
        // Note: versionId here corresponds to the PK 'id' of DocumentVersionHistory, 
        // NOT the sequential 'versionNumber'.
        const vId = parseInt(versionId);

        const version = await prisma.documentVersionHistory.findUnique({
            where: { id: vId },
            // Here we want the elements
        });

        if (!version) {
            return NextResponse.json({ error: "Version not found" }, { status: 404 });
        }

        return NextResponse.json(version);

    } catch (error) {
        console.error("Get Version Detail Error:", error);
        return NextResponse.json({ error: "Failed to fetch version detail" }, { status: 500 });
    }
}
