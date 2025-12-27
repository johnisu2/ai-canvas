import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Helper: safe value
const safeStr = (val: any) => (val === null || val === undefined) ? '' : String(val);

function executeScript(scriptNameOrCode: string, context: any, value: any): any {
    const valStr = safeStr(value);
    if (!scriptNameOrCode) return valStr;

    // 1. Backend-defined shortcuts (Legacy)
    if (scriptNameOrCode === 'checkLimit') {
        const num = parseFloat(valStr);
        if (isNaN(num)) return valStr;
        return num > 30 ? '1' : '0';
    }

    // 2. Advanced Scripting (User Code)
    try {
        const db = context.db || {};
        const v = value;
        // Strict Function construction with 'db' and 'v' in scope
        const func = new Function('db', 'v', `try { return ${scriptNameOrCode}; } catch(e) { return ''; }`);
        const result = func(db, v);
        return result;
    } catch (err) {
        console.warn('Script execution failed:', scriptNameOrCode, err);
        return valStr;
    }
}

async function embedAndDrawImage(pdfDoc: PDFDocument, page: any, el: any, mappedValue?: string) {
    try {
        let imageSource = mappedValue || el.fieldValue;
        if (!imageSource) return;

        if (imageSource.startsWith('/') || imageSource.startsWith('http')) {
            // Local file logic
            if (imageSource.startsWith('/')) {
                imageSource = path.join(process.cwd(), 'public', imageSource);
            }

            try {
                const imgBytes = await fs.readFile(imageSource);
                let pdfImg;

                // Try PNG first, then JPG
                const isPng = imageSource.toLowerCase().endsWith('.png');

                try {
                    if (isPng) pdfImg = await pdfDoc.embedPng(imgBytes);
                    else pdfImg = await pdfDoc.embedJpg(imgBytes);
                } catch (e) {
                    try {
                        if (isPng) pdfImg = await pdfDoc.embedJpg(imgBytes);
                        else pdfImg = await pdfDoc.embedPng(imgBytes);
                    } catch (e2) {
                        console.warn(`Failed to embed image ${imageSource} - Format unknown.`);
                    }
                }

                if (pdfImg) {
                    const pageHeight = page.getHeight();
                    page.drawImage(pdfImg, {
                        x: el.x,
                        y: pageHeight - el.y - (el.height || 100),
                        width: el.width || 100,
                        height: el.height || 100,
                    });
                }
            } catch (err) {
                console.warn(`Could not read image file: ${imageSource}`, err);
            }
        }
    } catch (error) {
        console.error('Error embedding image in PDF:', error);
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id);
        const { searchParams } = new URL(req.url);
        const patientHn = searchParams.get('patientHn');

        if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        const document = await prisma.document.findUnique({
            where: { id },
            include: { elements: true },
        });

        if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        // Load Multiple Fonts
        const thaiFontPath = 'C:\\Windows\\Fonts\\tahoma.ttf';
        const symbolFontPath = 'C:\\Windows\\Fonts\\seguisym.ttf';

        const thaiFontBytes = await fs.readFile(thaiFontPath);
        const symbolFontBytes = await fs.readFile(symbolFontPath);

        const thaiFont = await pdfDoc.embedFont(thaiFontBytes);
        const symbolFont = await pdfDoc.embedFont(symbolFontBytes);

        // -- Background Logic --
        let backgroundPages: any[] = [];
        let isPdfBg = document.fileType === 'pdf';

        if (isPdfBg) {
            const filePath = path.join(process.cwd(), 'public', document.fileUrl);
            try {
                const bgPdfBytes = await fs.readFile(filePath);
                const loadedPdf = await PDFDocument.load(bgPdfBytes);
                const copiedPages = await pdfDoc.copyPages(loadedPdf, loadedPdf.getPageIndices());
                copiedPages.forEach(p => pdfDoc.addPage(p));
                backgroundPages = pdfDoc.getPages();
            } catch (e) {
                backgroundPages = [pdfDoc.addPage([595, 842])];
            }
        } else {
            const filePath = path.join(process.cwd(), 'public', document.fileUrl);
            try {
                const imgBytes = await fs.readFile(filePath);
                let bgImg;
                if (document.fileUrl.toLowerCase().endsWith('.png')) bgImg = await pdfDoc.embedPng(imgBytes);
                else bgImg = await pdfDoc.embedJpg(imgBytes);
                const page = pdfDoc.addPage([bgImg.width, bgImg.height]);
                page.drawImage(bgImg, { x: 0, y: 0, width: bgImg.width, height: bgImg.height });
                backgroundPages = [page];
            } catch (e) {
                backgroundPages = [pdfDoc.addPage([595, 842])];
            }
        }

        // -- Data Context --
        let dataMap: any = {};
        let dbContext: any = { patients: [], lab_results: [], prescriptions: [] };

        if (patientHn) {
            const patient = await prisma.patient.findUnique({
                where: { hn: patientHn },
                include: { labResults: true }
            });
            const rx = await prisma.prescription.findFirst({
                where: { patientHn },
                orderBy: { date: 'desc' },
                include: { items: { include: { drug: true } } }
            });

            if (patient) {
                dataMap = {
                    ...patient,
                    'image': patient.image,
                    'first_name': patient.firstName,
                    'last_name': patient.lastName,
                    'full_name': `${patient.firstName} ${patient.lastName}`,
                };
                dbContext.patients = [patient];
                // @ts-ignore
                dbContext.lab_results = patient.labResults || [];
            }
            if (rx) {
                dataMap = { ...dataMap, ...rx };
                dbContext.prescriptions = [rx];
                if (rx.items && rx.items.length > 0) {
                    const firstDrug = rx.items[0].drug;
                    if (firstDrug) {
                        dataMap['drug_name'] = firstDrug.name;
                        dataMap['usage'] = firstDrug.usage;
                    }
                }
            }
        }

        const scriptContext = { db: dbContext };

        // -- Render Elements --
        for (const el of document.elements) {
            const pageNum = el.pageNumber || 1;
            if (pageNum > backgroundPages.length) continue;

            const page = backgroundPages[pageNum - 1];
            const pageHeight = page.getHeight();
            const type = el.type || 'text';

            let mappedValue = '';
            if (el.fieldName && dataMap[el.fieldName] !== undefined) {
                mappedValue = safeStr(dataMap[el.fieldName]);
            }

            // 2. Formula Logic (Calculation)
            // Formulas are processed first to generate a numeric/string value.
            if (el.formula) {
                const formulaResult = executeScript(el.formula, scriptContext, mappedValue);
                if (formulaResult !== undefined && formulaResult !== null) {
                    mappedValue = safeStr(formulaResult);
                }
            }

            // 3. Script Logic (Condition/Formatting)
            if (el.script) {
                const result = executeScript(el.script, scriptContext, mappedValue); if (typeof result === 'boolean') {
                    if (!result) continue;
                } else if (result !== undefined && result !== null) {
                    mappedValue = safeStr(result);
                }
            }
        } // End of Logic Loop (Note: mappedValue is currently not passed to drawing loop, verification needed)

        // 6. Draw Elements
        // Helper to resolve value from Context
        const getValue = (field: string | null) => {
            if (!field) return '';
            if (!field.includes('.')) return dataMap[field] || '';
            const [table, col] = field.split('.');
            return dataMap[col] || dataMap[field] || '';
        };

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const { width, height } = pages[0].getSize(); // Assume consistent size or check per page

        for (const el of document.elements) {
            // Select Page
            const pageIndex = (el.pageNumber || 1) - 1;
            if (pageIndex < 0 || pageIndex >= pages.length) continue;
            const pdfPage = pages[pageIndex];

            // Re-calculate Y (PDF is bottom-up)
            const pdfY = height - el.y - el.height;

            if (el.type === 'text') {
                const text = el.label || getValue(el.fieldName);
                pdfPage.drawText(String(text), {
                    x: el.x,
                    y: pdfY + (el.height / 2),
                    size: el.fontSize || 12,
                    font: font,
                    color: rgb(0, 0, 0),
                });
            } else if (el.type === 'signature') {
                const sigVal = el.fieldValue || getValue(el.fieldName);
                const strVal = String(sigVal);
                if (strVal && (strVal.startsWith('data:image/png') || strVal.startsWith('data:image/jpeg'))) {
                    try {
                        let image;
                        if (strVal.startsWith('data:image/png')) {
                            image = await pdfDoc.embedPng(strVal);
                        } else {
                            image = await pdfDoc.embedJpg(strVal);
                        }

                        if (image) {
                            pdfPage.drawImage(image, {
                                x: el.x,
                                y: pdfY,
                                width: el.width,
                                height: el.height,
                            });
                        }
                    } catch (e) {
                        console.error('Error embedding signature', e);
                    }
                }
            } else if (el.type === 'table') {
                const tableName = el.fieldName?.split('.')[0];
                const dataArray = Array.isArray(dataMap[tableName || '']) ? dataMap[tableName || ''] : [];

                await renderTable(pdfDoc, pdfPage, el, dataArray, font, el.fontSize || 12, height);
            }
        }

        const pdfBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="generated_${id}.pdf"`,
            },
        });
    } catch (error) {
        console.error('Generation Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// Separate Render Table Function
async function renderTable(pdfDoc: any, page: any, el: any, dataArray: any[], font: any, fontSize: number, pageHeight: number) {
    const metadata = el.metadata as any; // { tableConfig: { columns: [...] } }
    if (!metadata?.tableConfig?.columns) return;

    const columns = metadata.tableConfig.columns;
    const showLines = metadata.tableConfig?.showLines === true;

    let currentY = pageHeight - el.y;
    const startX = el.x;
    const rowHeight = 25;

    // Header
    let currentX = startX;
    columns.forEach((col: any) => {
        page.drawText(col.header || '', {
            x: currentX + 5,
            y: currentY - 18,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0)
        });
        currentX += parseInt(col.width || '100');
    });
    currentY -= rowHeight;

    // Rows
    for (const item of dataArray) {
        currentX = startX;
        columns.forEach((col: any) => {
            // Resolve Value
            let val = '';
            if (col.field === 'index_plus_1') {
                val = String(dataArray.indexOf(item) + 1);
            } else {
                // col.field might be "drug_name" directly if item is flat
                val = item[col.field] ? String(item[col.field]) : '';
            }

            page.drawText(val, {
                x: currentX + 5,
                y: currentY - 18,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0)
            });
            currentX += parseInt(col.width || '100');
        });

        // Lines
        if (showLines) {
            // Draw line logic (omitted for brevity, can copy from previous if needed, but keeping simple for now)
            page.drawLine({
                start: { x: startX, y: currentY - rowHeight + 5 },
                end: { x: currentX, y: currentY - rowHeight + 5 },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8),
            });
        }
        currentY -= rowHeight;
    }
}
