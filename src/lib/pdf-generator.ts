import { PDFDocument, rgb, PDFFont, radians } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { readFile } from "fs/promises";
import { join } from "path";
import { CanvasElement } from "@/types/canvas";

// Cache font bytes globally to avoid reading from disk on every request
let cachedSarabunBytes: Uint8Array | null = null;
let cachedSymbolsBytes: Uint8Array | null = null;

export async function generatePdf(
    fileUrl: string,
    elements: CanvasElement[],
    dataContext: any,
    fileType: string = 'pdf'
) {
    // Helper to evaluate scripts safely
    const evaluateScript = (script: string, data: any, currentValue?: any) => {
        if (!script) return currentValue || "";
        try {
            const context = { ...data, value: currentValue };
            const trimmed = script.trim();
            const body = (trimmed.startsWith("return") || trimmed.includes(";"))
                ? trimmed
                : `return (${trimmed});`;

            const fn = new Function('data', 'value', `try { ${body} } catch (e) { return "Error: " + e.message; }`);
            const result = fn(context, currentValue);
            return result === undefined || result === null ? "" : String(result);
        } catch (e: any) {
            console.error(`[PDF Gen] Script evaluation failed: ${script}`, e);
            return "Script Error";
        }
    };


    // Helper to fetch image bytes
    const fetchImageBytes = async (urlOrBase64: string): Promise<Uint8Array | null> => {
        try {
            if (!urlOrBase64) return null;
            const sanitizedUrl = urlOrBase64.trim();
            if (sanitizedUrl.startsWith("data:image")) {
                const parts = sanitizedUrl.split(",");
                if (parts.length < 2) return null;
                return Uint8Array.from(Buffer.from(parts[1], "base64"));
            }
            if (sanitizedUrl.startsWith("http")) {
                const res = await fetch(sanitizedUrl);
                if (!res.ok) return null;
                return new Uint8Array(await res.arrayBuffer());
            }
            if (sanitizedUrl.startsWith("/")) {
                const clean = sanitizedUrl.replace(/\/+/g, "/").replace(/^\/+/, "");
                return await readFile(join(process.cwd(), "public", clean));
            }
            return null;
        } catch (e) {
            console.error("Fetch image error", e);
            return null;
        }
    };

    // 1. Create a NEW PDF with Standard Dimensions (Editor 800x1100)
    // This ensures consistency regardless of input (PDF or Image)
    const pdfDoc = await PDFDocument.create();
    const canvasWidth = 800;
    const canvasHeight = 1100;

    // Load Source File
    const filePath = join(process.cwd(), "public", fileUrl);
    const fileBuffer = await readFile(filePath);
    const isPdf = fileType === 'pdf' || fileType.toLowerCase().includes('pdf');

    if (isPdf) {
        // Embed PDF and use its original sizes
        try {
            const srcPdf = await PDFDocument.load(fileBuffer);
            const copiedEmbeds = await pdfDoc.embedPdf(srcPdf);

            copiedEmbeds.forEach((embeddedPage) => {
                // Use the original dimensions of the embedded page
                const { width, height } = embeddedPage;
                const page = pdfDoc.addPage([width, height]);

                page.drawPage(embeddedPage, {
                    x: 0,
                    y: 0,
                    width: width,
                    height: height
                });
            });
            console.log(`[PDF Gen] Embedded ${copiedEmbeds.length} PDF pages with original dimensions`);
        } catch (e) {
            console.error("Failed to load/embed source PDF", e);
            pdfDoc.addPage([canvasWidth, canvasHeight]); // Fallback blank page
        }
    } else {
        // Embed Image and Scale
        // Same logic as before but now strictly forcing 800x1100
        try {
            let image;
            try {
                image = await pdfDoc.embedPng(fileBuffer);
            } catch {
                image = await pdfDoc.embedJpg(fileBuffer);
            }

            const page = pdfDoc.addPage([canvasWidth, canvasHeight]);

            // Calculate Object Contain positioning (matching Editor's object-contain)
            const imgWidth = image.width;
            const imgHeight = image.height;
            const ratio = imgWidth / imgHeight;
            const canvasRatio = canvasWidth / canvasHeight;

            let drawWidth = canvasWidth;
            let drawHeight = canvasHeight;
            let drawX = 0;
            let drawY = 0;

            if (ratio > canvasRatio) {
                // Width constrained - centered vertically
                drawHeight = canvasWidth / ratio;
                drawY = (canvasHeight - drawHeight) / 2;
            } else {
                // Height constrained - centered horizontally
                drawWidth = canvasHeight * ratio;
                drawX = (canvasWidth - drawWidth) / 2;
            }

            page.drawImage(image, {
                x: drawX,
                y: drawY,
                width: drawWidth,
                height: drawHeight
            });
            console.log(`[PDF Gen] Embedded Image with object-contain at ${drawX},${drawY} dims ${drawWidth}x${drawHeight}`);

        } catch (e) {
            console.error("Failed to embed background image", e);
            pdfDoc.addPage([canvasWidth, canvasHeight]);
        }
    }

    // Register fontkit to support custom fonts
    pdfDoc.registerFontkit(fontkit);

    // Embed Fonts (Sarabun & Symbols)
    if (!cachedSarabunBytes) {
        cachedSarabunBytes = await readFile(join(process.cwd(), "public", "fonts", "Sarabun-Regular.ttf"));
    }
    const sarabunFont = await pdfDoc.embedFont(cachedSarabunBytes, { subset: true });

    if (!cachedSymbolsBytes) {
        cachedSymbolsBytes = await readFile(join(process.cwd(), "public", "fonts", "NotoSansSymbols2-Regular.ttf"));
    }
    const symbolsFont = await pdfDoc.embedFont(cachedSymbolsBytes, { subset: true });

    // Determine number of pages
    const totalPages = pdfDoc.getPageCount();

    // Helper to draw text with font switching
    const drawRichText = (page: any, text: string, x: number, y: number, fontSize: number, rotation: number = 0) => {
        let currentX = x;
        const rad = (rotation * Math.PI) / 180;

        const getFontForChar = (char: string): PDFFont => {
            const code = char.charCodeAt(0);
            if (code > 0x2000) return symbolsFont;
            return sarabunFont;
        };

        if (text.length === 0) return;

        let segments: { text: string; font: PDFFont }[] = [];
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

        for (const segment of segments) {
            page.drawText(segment.text, {
                x: currentX,
                y: y,
                size: fontSize,
                font: segment.font,
                color: rgb(0, 0, 0),
                rotate: radians(rotation)
            });
            currentX += segment.font.widthOfTextAtSize(segment.text, fontSize);
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

            // Resolve Value: Chain (DB Mapping -> Formula -> Script)
            let resolvedValue: any = "";
            const fieldName = element.fieldName;

            // 1. Database Mapping (Base Value)
            if (dataContext && fieldName) {
                if (dataContext[fieldName] !== undefined) {
                    resolvedValue = dataContext[fieldName];
                } else if (fieldName.includes('.') && element.type !== 'table') {
                    const parts = fieldName.split('.');
                    const shortFieldName = parts[parts.length - 1];
                    if (dataContext[shortFieldName] !== undefined) {
                        resolvedValue = dataContext[shortFieldName];
                    }
                }
            }

            // 2. Formula (Chain result from DB)
            if (element.formula && dataContext) {
                resolvedValue = evaluateScript(element.formula, dataContext, resolvedValue);
                console.log(`[PDF Gen] Formula result for ${element.id}: "${resolvedValue}"`);
            }

            // 3. Script (Chain result from Formula/DB)
            if (element.script && dataContext) {
                resolvedValue = evaluateScript(element.script, dataContext, resolvedValue);
                console.log(`[PDF Gen] Script result for ${element.id}: "${resolvedValue}"`);
            }

            if (resolvedValue === undefined || resolvedValue === null || resolvedValue === "") {
                // Final fallback
                resolvedValue = element.fieldValue || element.label || "";
            }

            // Ensure string for remaining processing
            resolvedValue = String(resolvedValue);

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
                // Calculate vertical center:
                // Middle of box = y - (element.height / 2)
                // Adjustment for baseline ~ (fontSize / 3)
                const centeredY = y - (element.height / 2) - (fontSize / 3);

                // Add padding to x to match 'px-2' (approx 8px)
                const paddedX = x + 8;

                drawRichText(
                    page,
                    resolvedValue || "",
                    paddedX,
                    centeredY,
                    fontSize,
                    rotationDegrees
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
                const metadata = element.metadata || {};
                const columns = Array.isArray(metadata) ? metadata : (metadata.columns || []);
                const rowHeight = metadata.rowHeight || 22;
                console.log(`[PDF Gen] Table columns:`, columns.length, "rowHeight:", rowHeight);
                if (columns.length > 0) {
                    const tableKey = element.fieldName?.split('.')[0];
                    let tableData: any[] = [];
                    console.log(`[PDF Gen] tableKey:`, columns);

                    console.log(`[PDF Gen] Table Processing: Element ID=${element.id}, FieldName="${element.fieldName}"`);
                    console.log(`[PDF Gen] Available Keys in DataContext:`, Object.keys(dataContext || {}));

                    // Fallback to "Table" only if tableKey is null/undefined/empty string
                    // const keyToUse = "Table";
                    const keyToUse = tableKey || "Table";
                    console.log(`[PDF Gen] Looking for data with key: "${keyToUse}"`);

                    if (dataContext && Array.isArray(dataContext[keyToUse])) {
                        tableData = dataContext[keyToUse];
                        console.log(`[PDF Gen] Found data for "${keyToUse}". Rows: ${tableData.length}`);
                    } else {
                        console.warn(`[PDF Gen] Data NOT found or not an array for key: "${keyToUse}". Value:`, dataContext ? dataContext[keyToUse] : "No Context");
                    }

                    console.log(`[PDF Gen] Table Debug: key="Table", dataLength=${tableData.length}`);

                    const rowHeight = element.metadata?.rowHeight || 22;
                    const fontSize = element.fontSize || 10;
                    let currentY = y;

                    // Draw Table Body
                    for (let i = 0; i < tableData.length; i++) {
                        const rowData = tableData[i];
                        let currentX = x;

                        if (i * rowHeight > element.height) break;
                        const rowY = currentY - (i * rowHeight);

                        // Row Border
                        // page.drawRectangle({
                        //     x: x,
                        //     y: rowY - rowHeight,
                        //     width: element.width,
                        //     height: rowHeight,
                        //     borderWidth: 0.5,
                        //     borderColor: rgb(0.7, 0.7, 0.7),
                        // });

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
                                rowY - (rowHeight / 2) - (fontSize / 3),
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
