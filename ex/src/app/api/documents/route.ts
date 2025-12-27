import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

// Helper to save file
async function saveFile(file: File): Promise<string> {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if not exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
        await fs.access(uploadDir);
    } catch {
        await fs.mkdir(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, buffer);

    return `/uploads/${filename}`;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const title = formData.get('title') as string || file.name;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
        const fileUrl = await saveFile(file);

        const document = await prisma.document.create({
            data: {
                title,
                fileUrl,
                fileType,
            },
        });

        return NextResponse.json(document);
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const documents = await prisma.document.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(documents);
    } catch (error) {
        console.error('Fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}
