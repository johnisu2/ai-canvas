import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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
        // Create unique filename: timestamp_safename
        const filename = `asset_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const uploadDir = join(process.cwd(), "public/uploads");

        // Ensure dir exists
        await mkdir(uploadDir, { recursive: true });

        await writeFile(join(uploadDir, filename), buffer);

        const fileUrl = `/uploads/${filename}`;

        return NextResponse.json({
            success: true,
            fileUrl: fileUrl
        });

    } catch (error) {
        console.error("Asset Upload Error:", error);
        return NextResponse.json(
            { error: "Upload failed." },
            { status: 500 }
        );
    }
}
