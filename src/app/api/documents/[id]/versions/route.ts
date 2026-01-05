import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const documentId = parseInt(id);
        const body = await request.json();
        const { elements, changeLog } = body;

        // 1. Get latest version number
        const lastVersion = await prisma.documentVersionHistory.findFirst({
            where: { documentId },
            orderBy: { versionNumber: 'desc' },
            select: { versionNumber: true }
        });

        const nextVersion = (lastVersion?.versionNumber || 0) + 1;

        // 2. Create new version
        const newVersion = await prisma.documentVersionHistory.create({
            data: {
                documentId,
                versionNumber: nextVersion,
                elements: elements, // Save full JSON
                changeLog: changeLog || `Version ${nextVersion}`
            }
        });

        return NextResponse.json({ success: true, version: newVersion });

    } catch (error) {
        console.error("Create Version Error:", error);
        return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const documentId = parseInt(id);

        // 1. Get History List
        // [PERFORMANCE] Select ONLY metadata, NOT the elements JSON
        const history = await prisma.documentVersionHistory.findMany({
            where: { documentId },
            orderBy: { versionNumber: 'desc' },
            select: {
                id: true,
                versionNumber: true,
                createdAt: true,
                changeLog: true,
                // elements: false  <-- IMPORTANT: DO NOT SELECT THIS
            }
        });

        return NextResponse.json(history);

    } catch (error) {
        console.error("Get History Error:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}
