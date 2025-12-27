import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { readFile } from "fs/promises";
import { join } from "path";
import { CanvasElement } from "@/types/canvas";

export async function generatePdf(
    fileUrl: string,
    elements: CanvasElement[],
    dataContext: any
) {
    // 1. Load PDF
    const filePath = join(process.cwd(), "public", fileUrl);
    const pdfBuffer = await readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Register fontkit to support custom fonts
    pdfDoc.registerFontkit(fontkit);

    // Embed Thai Font
    const thaiFontPath = join(process.cwd(), "public", "fonts", "NotoSansThai-Regular.ttf");
    const thaiFontBytes = await readFile(thaiFontPath);
    const thaiFont = await pdfDoc.embedFont(thaiFontBytes, { subset: true });

    // 2. Process Elements
    for (const element of elements) {
        try {
            const pages = pdfDoc.getPages();
            const pageIndex = element.pageNumber - 1;

            if (pageIndex < 0 || pageIndex >= pages.length) continue;
            const page = pages[pageIndex];
            const { height: pageHeight } = page.getSize();

            // Resolve Value
            let value = element.fieldValue || element.label || "";
            const fieldName = element.fieldName;

            console.log(`[PDF Gen] Processing element: ${element.id}, Type: ${element.type}, fieldName: "${fieldName}"`);

            // Robust Mapping Logic:
            // 1. Prioritize direct fieldName lookup in dataContext if fieldName exists
            if (dataContext && fieldName && dataContext[fieldName] !== undefined) {
                console.log(`[PDF Gen] Found match for fieldName "${fieldName}" -> "${dataContext[fieldName]}"`);
                value = String(dataContext[fieldName]);
            }
            // 2. Fallback to mustache replacement in the value string
            else if (value && typeof value === 'string' && value.includes("{{") && dataContext) {
                value = value.replace(/\{\{(.*?)\}\}/g, (_, key) => {
                    const k = key.trim();
                    const result = dataContext[k] !== undefined ? String(dataContext[k]) : `{{${k}}}`;
                    console.log(`[PDF Gen] Mustache replace: {{${k}}} -> ${result}`);
                    return result;
                });
            }

            console.log(`[PDF Gen] Resolved final value: "${value}"`);

            if (element.type === "text") {
                const fontSize = element.fontSize || 14;
                page.drawText(value, {
                    x: element.x,
                    y: pageHeight - element.y - (fontSize), // Text baseline roughly
                    size: fontSize,
                    font: thaiFont, // Use Thai font for all text
                    color: rgb(0, 0, 0),
                });
            } else if (element.type === "qr") {
                // Generate QR
                const qrDataUrl = await QRCode.toDataURL(value);
                const qrImage = await pdfDoc.embedPng(qrDataUrl);
                page.drawImage(qrImage, {
                    x: element.x,
                    y: pageHeight - element.y - element.height,
                    width: element.width,
                    height: element.height
                });
            } else if (element.type === "image" || element.type === "signature") {
                if (value && value.startsWith("data:image")) {
                    let image;
                    if (value.startsWith("data:image/png")) {
                        image = await pdfDoc.embedPng(value);
                    } else {
                        image = await pdfDoc.embedJpg(value);
                    }
                    page.drawImage(image, {
                        x: element.x,
                        y: pageHeight - element.y - element.height,
                        width: element.width,
                        height: element.height
                    });
                }
            }
        } catch (err) {
            console.error("Error processing element:", element.id, err);
        }
    }

    return await pdfDoc.save();
}
