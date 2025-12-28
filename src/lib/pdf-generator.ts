import { PDFDocument, rgb, PDFFont, radians } from "pdf-lib";
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

    // Embed Fonts
    // Sarabun: Supports Thai & Latin (English)
    const sarabunPath = join(process.cwd(), "public", "fonts", "Sarabun-Regular.ttf");
    const sarabunBytes = await readFile(sarabunPath);
    const sarabunFont = await pdfDoc.embedFont(sarabunBytes, { subset: true });

    // Noto Sans Symbols 2: Supports symbols like ✔ (U+2714)
    const symbolsPath = join(process.cwd(), "public", "fonts", "NotoSansSymbols2-Regular.ttf");
    const symbolsBytes = await readFile(symbolsPath);
    const symbolsFont = await pdfDoc.embedFont(symbolsBytes, { subset: true });

    // Helper to draw text with font switching (Thai/EN/Symbols)
    const drawRichText = (page: any, text: string, x: number, y: number, fontSize: number) => {
        let currentX = x;

        // Simple glyph detection logic
        // Sarabun covers Thai (0E00-0E7F) and Latin/Common ASCII
        // Noto Sans Symbols covers symbols like ✔ (2714)
        const getFontForChar = (char: string): PDFFont => {
            const code = char.charCodeAt(0);
            // Basic Greek/Symbols/Arrows often in Symbols font
            if (code > 0x2000) return symbolsFont;
            return sarabunFont;
        };

        // Group consecutive characters with the same font for efficiency
        let segments: { text: string; font: PDFFont }[] = [];
        if (text.length === 0) return;

        let currentSegment = { text: text[0], font: getFontForChar(text[0]) };

        for (let i = 1; i < text.length; i++) {
            const font = getFontForChar(text[i]);
            if (font === currentSegment.font) {
                currentSegment.text += text[i];
            } else {
                segments.push(currentSegment);
                currentSegment = { text: text[i], font };
            }
        }
        segments.push(currentSegment);

        // Draw segments
        for (const segment of segments) {
            page.drawText(segment.text, {
                x: currentX,
                y: y,
                size: fontSize,
                font: segment.font,
                color: rgb(0, 0, 0),
            });
            currentX += segment.font.widthOfTextAtSize(segment.text, fontSize);
        }
    };

    // Helper to fetch image bytes from URL or Base64
    const fetchImageBytes = async (urlOrBase64: string): Promise<Uint8Array | null> => {
        try {
            if (!urlOrBase64) return null;
            const sanitizedUrl = urlOrBase64.trim();
            console.log(`[PDF Gen] Fetching image from: ${sanitizedUrl.substring(0, 50)}...`);

            if (sanitizedUrl.startsWith("data:image")) {
                const parts = sanitizedUrl.split(",");
                if (parts.length < 2) throw new Error("Invalid Base64 data");
                const base64Data = parts[1];
                const bytes = Uint8Array.from(Buffer.from(base64Data, "base64"));
                console.log(`[PDF Gen] Decoded Base64, size: ${bytes.length} bytes`);
                return bytes;
            }
            if (sanitizedUrl.startsWith("http")) {
                // Use a controller to timeout if needed, but for now just standard fetch
                const response = await fetch(sanitizedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                if (!response.ok) {
                    console.warn(`[PDF Gen] HTTP Error ${response.status} for ${sanitizedUrl}`);
                    return null;
                }
                const arrayBuffer = await response.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                console.log(`[PDF Gen] Fetched from URL, size: ${bytes.length} bytes`);
                return bytes;
            }
            if (sanitizedUrl.startsWith("/")) {
                // Remove leading slash for join to work correctly with public
                // Also remove any double slashes or spaces that might have sneaked in
                const cleanPath = sanitizedUrl.replace(/\/+/g, "/").replace(/^\/+/, "");
                const localPath = join(process.cwd(), "public", cleanPath);

                try {
                    const buffer = await readFile(localPath);
                    console.log(`[PDF Gen] Loaded local file: ${localPath}, size: ${buffer.length} bytes`);
                    return new Uint8Array(buffer);
                } catch (fsError: any) {
                    if (fsError.code === 'ENOENT') {
                        console.warn(`[PDF Gen] Local file not found: ${localPath}`);
                        return null;
                    }
                    throw fsError;
                }
            }
            console.warn(`[PDF Gen] Unknown image source type: ${sanitizedUrl.substring(0, 20)}`);
            return null;
        } catch (error) {
            console.error(`[PDF Gen] Image fetch failed:`, error);
            return null;
        }
    };

    // Helper to evaluate scripts safely
    const evaluateScript = (script: string, data: any) => {
        if (!script) return "";
        try {
            const trimmed = script.trim();
            // If it already has a return statement, use it as is. 
            // Otherwise, wrap it to make it an expression.
            const body = (trimmed.startsWith("return") || trimmed.includes(";"))
                ? trimmed
                : `return (${trimmed});`;

            const fn = new Function('data', `
                try { 
                    ${body} 
                } catch (e) { 
                    return "Error: " + e.message; 
                }
            `);
            const result = fn(data);
            return result === undefined || result === null ? "" : String(result);
        } catch (e: any) {
            console.error(`[PDF Gen] Script evaluation failed: ${script}`, e);
            return "Script Error";
        }
    };

    // 2. Process Elements
    for (const element of elements) {
        try {
            const pages = pdfDoc.getPages();
            const pageIndex = (element.pageNumber || 1) - 1;

            if (pageIndex < 0 || pageIndex >= pages.length) continue;
            const page = pages[pageIndex];
            const { height: pageHeight } = page.getSize();

            // Resolve Value
            let value = element.fieldValue || element.label || "";
            const fieldName = element.fieldName;

            console.log(`[PDF Gen] Processing Element: ${element.id}, Type: ${element.type}, fieldName: "${fieldName}"`);

            // Robust Mapping Logic
            let resolvedValue = value;

            // 1. Try direct fieldName match
            if (dataContext && fieldName) {
                if (dataContext[fieldName] !== undefined) {
                    resolvedValue = String(dataContext[fieldName]);
                } else if (fieldName.includes('.') && element.type !== 'table') {
                    const parts = fieldName.split('.');
                    const shortFieldName = parts[parts.length - 1];
                    if (dataContext[shortFieldName] !== undefined) {
                        resolvedValue = String(dataContext[shortFieldName]);
                    }
                }
            }

            // 2. Script Evaluation (Priority over mapping)
            if (element.script && dataContext) {
                resolvedValue = evaluateScript(element.script, dataContext);
                console.log(`[PDF Gen] Script evaluated for ${element.id}: "${resolvedValue}"`);
            }

            // 3. Mustache replacement
            if (resolvedValue && typeof resolvedValue === 'string' && resolvedValue.includes("{{") && dataContext) {
                resolvedValue = resolvedValue.replace(/\{\{(.*?)\}\}/g, (_, key) => {
                    const k = key.trim();
                    return dataContext[k] !== undefined ? String(dataContext[k]) : `{{${k}}}`;
                });
            }

            // Common properties
            const x = element.x;
            const y = pageHeight - element.y;
            const rotationDegrees = element.rotation || 0;
            const rad = (rotationDegrees * Math.PI) / 180;

            if (element.type === "text") {
                const fontSize = element.fontSize || 14;
                drawRichText(
                    page,
                    resolvedValue || "",
                    x,
                    y - fontSize,
                    fontSize
                );
            } else if (element.type === "qr") {
                const qrValue = resolvedValue || "";
                let image;

                if (qrValue.startsWith("data:image") || qrValue.startsWith("http") || qrValue.startsWith("/")) {
                    const bytes = await fetchImageBytes(qrValue);
                    if (bytes) {
                        try {
                            const isPng = qrValue.toLowerCase().includes("png");
                            image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
                        } catch {
                            try {
                                image = qrValue.toLowerCase().includes("png") ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
                            } catch { }
                        }
                    }
                }

                if (image) {
                    page.drawImage(image, { x, y: y - element.height, width: element.width, height: element.height, rotate: radians(rad) });
                } else {
                    const qrDataUrl = await QRCode.toDataURL(qrValue || " ");
                    const qrImage = await pdfDoc.embedPng(qrDataUrl);
                    page.drawImage(qrImage, { x, y: y - element.height, width: element.width, height: element.height, rotate: radians(rad) });
                }
            } else if (element.type === "image" || element.type === "signature") {
                if (resolvedValue && (resolvedValue.startsWith("data:image") || resolvedValue.startsWith("http") || resolvedValue.startsWith("/"))) {
                    const bytes = await fetchImageBytes(resolvedValue);
                    if (bytes) {
                        let image;
                        try {
                            if (resolvedValue.toLowerCase().endsWith(".png") || resolvedValue.startsWith("data:image/png")) {
                                image = await pdfDoc.embedPng(bytes);
                            } else {
                                try {
                                    image = await pdfDoc.embedJpg(bytes);
                                } catch {
                                    image = await pdfDoc.embedPng(bytes);
                                }
                            }
                        } catch (e) { console.error("Embedding failed", e); }

                        if (image) {
                            page.drawImage(image, { x, y: y - element.height, width: element.width, height: element.height, rotate: radians(rad) });
                        }
                    }
                }
            } else if (element.type === "table") {
                const columns = Array.isArray(element.metadata) ? element.metadata : [];
                if (columns.length > 0) {
                    const tableKey = element.fieldName?.split('.')[0] || "Table";
                    const tableData = dataContext && Array.isArray(dataContext[tableKey])
                        ? dataContext[tableKey]
                        : [];

                    console.log(`[PDF Gen] Table Debug: key="${tableKey}", dataLength=${tableData.length}`);

                    const rowHeight = 22;
                    const fontSize = element.fontSize || 10;
                    let currentY = y;

                    // Draw Table Body
                    for (let i = 0; i < tableData.length; i++) {
                        const rowData = tableData[i];
                        let currentX = x;

                        if (i * rowHeight > element.height) break;
                        const rowY = currentY - (i * rowHeight);

                        // Row Border
                        page.drawRectangle({
                            x: x,
                            y: rowY - rowHeight,
                            width: element.width,
                            height: rowHeight,
                            borderWidth: 0.5,
                            borderColor: rgb(0.7, 0.7, 0.7),
                        });

                        for (const col of columns) {
                            const colWidthPercent = parseFloat(col.width) || (100 / columns.length);
                            const colWidth = (colWidthPercent / 100) * element.width;

                            let cellValue = rowData[col.field] !== undefined ? String(rowData[col.field]) : "";

                            // Cell Script Evaluation
                            if (col.script) {
                                cellValue = evaluateScript(col.script, rowData);
                            }

                            drawRichText(
                                page,
                                cellValue,
                                currentX + 5,
                                rowY - (rowHeight * 0.75),
                                fontSize
                            );

                            currentX += colWidth;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error processing element:", element.id, err);
        }
    }

    return await pdfDoc.save();
}
