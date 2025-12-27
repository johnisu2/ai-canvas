import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma"; // Need to create helper
import { v4 as uuidv4 } from "uuid"; // Need uuid or just use random name

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file received." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}_${file.name.replace(/\s/g, "_")}`;
        const uploadDir = join(process.cwd(), "public/uploads");

        // Ensure dir exists - though I created it with mkdir
        // await mkdir(uploadDir, { recursive: true });

        await writeFile(join(uploadDir, filename), buffer);

        const fileUrl = `/uploads/${filename}`;

        // Create Document record
        const document = await prisma.document.create({
            data: {
                title: file.name,
                fileUrl: fileUrl,
                fileType: file.type,
            },
        });

        return NextResponse.json({
            success: true,
            documentId: document.id,
            fileUrl: fileUrl
        });

    } catch (error) {
        console.error("Upload Error:", error);
        return NextResponse.json(
            { error: "Upload failed." },
            { status: 500 }
        );
    }
}
