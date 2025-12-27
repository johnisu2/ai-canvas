
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const tables = await prisma.dbConfigTable.findMany({
            include: {
                fields: true,
            },
        });
        return NextResponse.json(tables);
    } catch (error) {
        console.error("Error fetching db config:", error);
        return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
