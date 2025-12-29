import { PDFDocument, rgb, PDFFont, radians, degrees } from "pdf-lib";
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
    console.log("[PDF Gen] Generating PDF for file: ", fileUrl);
    console.log("[PDF Gen] Generating PDF for elements: ", elements);
    console.log("[PDF Gen] Generating PDF for dataContext: ", dataContext);
    console.log("[PDF Gen] Generating PDF for fileType: ", fileType);
    const _dataContext = {
        patients: {
            hn: 'HN001',
            first_name: 'สมชาย',
            last_name: 'ใจดี',
            gender: 'ชาย',
            phone: '081-234-5678',
            address: '123 ถ.สุขุมวิท กทม.',
            dob: '1985-05-20T00:00:00.000Z',
            blood_group: 'O',
            id_card: '1-1001-01234-56-7',
            allergies: 'Penicillin',
            image: '/uploads/mock_patient.jpg'
        },
        patient: [{
            hn: 'HN001',
            first_name: 'สมชาย',
            last_name: 'ใจดี',
            gender: 'ชาย',
            phone: '081-234-5678',
            address: '123 ถ.สุขุมวิท กทม.',
            dob: '1985-05-20T00:00:00.000Z',
            blood_group: 'O',
            id_card: '1-1001-01234-56-7',
            allergies: 'Penicillin',
            image: '/uploads/mock_patient.jpg'
        }, {
            hn: 'HN001',
            first_name: 'สมชาย',
            last_name: 'ใจดี',
            gender: 'ชาย',
            phone: '081-234-5678',
            address: '123 ถ.สุขุมวิท กทม.',
            dob: '1985-05-20T00:00:00.000Z',
            blood_group: 'O',
            id_card: '1-1001-01234-56-7',
            allergies: 'Penicillin',
            image: '/uploads/mock_patient.jpg'
        }],
        drugs: {
            code: 'D001',
            name: 'พาราเซตามอล',
            trade_name: 'พาราเซตามอล',
            dosage: '1-2 เม็ด',
            usage: 'รับประทานพร้อมน้ำสะอาด',
            unit: '1',
            category: 'ยาใช้ภายใน',
            price: 40
        }
    };
    // FORCE USE MOCK DATA
    // dataContext = _dataContext;
    const data: any = dataContext;
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
    const runFormula = (
        formula: string,
        data: Record<string, any>,
        currentValue?: any
    ): any => {
        if (!formula || typeof formula !== "string") return currentValue ?? "";

        try {
            const expr = formula.trim();

            const fn = new Function(
                "data",
                "value",
                `
            "use strict";
            try {
                const result = (${expr});
                if (Number.isNaN(result) || result === undefined || result === null) {
                    return "";
                }
                return result;
            } catch (err) {
                return "";
            }
        `
            );

            return fn(data, currentValue);
        } catch (err) {
            console.error("[PDF Gen] Formula compile error:", formula, err);
            return "";
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
    const isPdf = fileType?.toLowerCase().includes('pdf') || fileUrl.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        try {
            const srcPdf = await PDFDocument.load(fileBuffer);
            const indices = srcPdf.getPageIndices();
            const copiedPages = await pdfDoc.copyPages(srcPdf, indices);
            copiedPages.forEach((page) => pdfDoc.addPage(page));
            console.log(`[PDF Gen] Copied ${copiedPages.length} PDF pages`);

            if (copiedPages.length === 0) {
                pdfDoc.addPage([canvasWidth, canvasHeight]);
            }
        } catch (e) {
            console.error("Failed to load/copy source PDF", e);
            pdfDoc.addPage([canvasWidth, canvasHeight]);
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

    // Helper to draw text with font switching and optional truncation
    const drawRichText = (page: any, text: string, x: number, y: number, fontSize: number, rotation: number = 0, maxWidth?: number) => {
        const rad = (rotation * Math.PI) / 180;
        let currentX = x;
        let currentY = y;

        const getFontForChar = (char: string): PDFFont => {
            const code = char.charCodeAt(0);
            if (code > 0x2000) return symbolsFont;
            return sarabunFont;
        };

        if (text.length === 0) return;

        let processedText = text;
        if (maxWidth && maxWidth > 0) {
            let widthSum = 0;
            let truncated = "";
            for (const char of text) {
                const charWidth = getFontForChar(char).widthOfTextAtSize(char, fontSize);
                if (widthSum + charWidth > maxWidth) break;
                widthSum += charWidth;
                truncated += char;
            }
            processedText = truncated;
        }

        if (processedText.length === 0) return;

        let segments: { text: string; font: PDFFont }[] = [];
        let currentSegment = { text: processedText[0], font: getFontForChar(processedText[0]) };

        for (let i = 1; i < processedText.length; i++) {
            const font = getFontForChar(processedText[i]);
            if (font === currentSegment.font) {
                currentSegment.text += processedText[i];
            } else {
                segments.push(currentSegment);
                currentSegment = { text: processedText[i], font };
            }
        }
        segments.push(currentSegment);

        for (const segment of segments) {
            page.drawText(segment.text, {
                x: currentX,
                y: currentY,
                size: fontSize,
                font: segment.font,
                color: rgb(0, 0, 0),
                rotate: degrees(rotation)
            });
            const segmentWidth = segment.font.widthOfTextAtSize(segment.text, fontSize);
            // Move currentX and currentY along the rotated vector
            // pdf-lib rotation is counter-clockwise, radians() handles the sign
            currentX += segmentWidth * Math.cos(rad);
            currentY += segmentWidth * Math.sin(rad);
        }
    };

    // 2. Process Elements
    for (const element of elements) {
        try {
            let pages = pdfDoc.getPages();
            const pageIndex = (element.pageNumber || 1) - 1;

            if (pageIndex < 0) continue;

            // Ensure the page exists (if element is on page 2 but base is 1 page)
            while (pageIndex >= pages.length) {
                console.log(`[PDF Gen] Adding extra page for element on page ${pageIndex + 1}`);
                pdfDoc.addPage([canvasWidth, canvasHeight]);
                pages = pdfDoc.getPages();
            }

            const page = pages[pageIndex];
            const { height: pageHeight } = page.getSize();

            // Resolve Value: Chain (DB Mapping -> Formula -> Script)
            let resolvedValue: any = undefined;
            let skipElement = false;
            const fieldName = element.fieldName?.trim(); // Trim whitespace

            console.log(`[PDF Gen] Processing Element ${element.id} (Type: ${element.type}) - FieldName: "${fieldName}"`);

            // 1. Database Mapping (Base Value)
            if (fieldName && data) {
                // Helper to resolve path
                const getPath = (obj: any, path: string) => {
                    const parts = path.split('.');
                    let current = obj;
                    for (const part of parts) {
                        if (current === undefined || current === null) return undefined;
                        if (Array.isArray(current) && isNaN(Number(part))) {
                            current = current.length > 0 ? current[0] : undefined;
                        }
                        if (current === undefined) return undefined;
                        current = current[part];
                    }
                    return current;
                };

                // 1. Try Resolving from Root
                resolvedValue = getPath(data, fieldName);
                console.log(`[PDF Gen]   > Search Root '${fieldName}':`, resolvedValue !== undefined ? `FOUND (${Array.isArray(resolvedValue) ? 'Array len ' + resolvedValue.length : typeof resolvedValue})` : "NOT FOUND");

                // 2. Fallback: Check 'patients' for text fields
                if (resolvedValue === undefined && data.patients) {
                    resolvedValue = getPath(data.patients, fieldName);
                    console.log(`[PDF Gen]   > Search 'patients.${fieldName}':`, resolvedValue !== undefined ? "FOUND" : "NOT FOUND");
                }

                // 3. Special Fallback for Table: If fieldName is 'patient' but data is in 'patients' (or vice versa common mistakes)
                // Just in case user named field 'patient' but meant the object, or named 'patient' and meant the array.
                // Our mock data has 'patient' as Array. logic 1 should find it.

                if (resolvedValue !== undefined) {
                    // Handle Table vs Single Data
                    if (element.type === 'table') {
                        if (Array.isArray(resolvedValue)) {
                            if (resolvedValue.length === 0) {
                                console.log(`[PDF Gen] Table Array "${fieldName}" is empty. Skipping.`);
                                skipElement = true;
                            } else {
                                console.log(`[PDF Gen] Table Data Found. Rows: ${resolvedValue.length}`);
                                // Debug first row keys
                                console.log(`[PDF Gen] Row 1 Keys: ${Object.keys(resolvedValue[0]).join(', ')}`);
                            }
                        } else if (typeof resolvedValue === 'object') {
                            console.log(`[PDF Gen] Table "${fieldName}" single object. Wrapping.`);
                            resolvedValue = [resolvedValue];
                        } else {
                            console.log(`[PDF Gen] Table Field "${fieldName}" invalid type (${typeof resolvedValue}). Skipping.`);
                            skipElement = true;
                        }
                    } else {
                        // Single Value
                        if (Array.isArray(resolvedValue)) {
                            if (resolvedValue.length > 0) resolvedValue = resolvedValue[0];
                            else skipElement = true;
                        }
                    }
                } else {
                    console.log(`[PDF Gen] Field "${fieldName}" NOT FOUND anywhere.`);
                    skipElement = true;
                }
            }

            // CRITICAL: Skip element if data source was required (fieldName exists) but not found
            if (skipElement) {
                if (element.type === 'table') {
                    console.log(`[PDF Gen] Element ${element.id} was marked to SKIP, but proceeding for debugging Table logic. ResolvedValue:`, resolvedValue);
                    skipElement = false;
                } else {
                    console.log(`[PDF Gen] SKIPPING Element ${element.id} (Type: ${element.type}) due to missing data.`);
                    continue;
                }
            }

            // Fallback for elements without fieldName (Static Elements)
            if (resolvedValue === undefined) {
                resolvedValue = element.fieldValue || element.label || "";
                console.log(`[PDF Gen]   > Used Static Value: "${resolvedValue}"`);
            }

            // 2. Formula
            if (element.formula && dataContext) {
                resolvedValue = runFormula(element.formula, dataContext, resolvedValue);
                console.log(`[PDF Gen] Formula result: "${resolvedValue}"`);
            }

            // 3. Script
            if (element.script && dataContext) {
                resolvedValue = evaluateScript(element.script, dataContext, resolvedValue);
                console.log(`[PDF Gen] Script result: "${resolvedValue}"`);
            }

            if (resolvedValue === undefined || resolvedValue === null || resolvedValue === "") {
                // Final fallback
                resolvedValue = element.fieldValue || element.label || "";
            }

            // Ensure string for remaining processing ONLY IF NOT TABLE
            if (element.type !== 'table') {
                resolvedValue = String(resolvedValue);

                // 3. Mustache replacement
                if (resolvedValue && typeof resolvedValue === 'string' && resolvedValue.includes("{{") && dataContext) {
                    resolvedValue = resolvedValue.replace(/\{\{(.*?)\}\}/g, (_, key) => {
                        const k = key.trim();
                        return dataContext[k] !== undefined ? String(dataContext[k]) : `{{${k}}}`;
                    });
                }
            }

            // Geometry & Center-based Rotation Logic
            const w = element.width;
            const h = element.height;
            const rotDeg = element.rotation || 0; // CW in Editor
            const pdfRotDeg = -rotDeg; // pdf-lib uses CCW

            const cx = element.x + w / 2;
            const cy = pageHeight - (element.y + h / 2);

            const rotatePoint = (px: number, py: number) => {
                if (rotDeg === 0) return { x: px, y: py };
                const r = (pdfRotDeg * Math.PI) / 180;
                const dx = px - cx;
                const dy = py - cy;
                return {
                    x: cx + dx * Math.cos(r) - dy * Math.sin(r),
                    y: cy + dx * Math.sin(r) + dy * Math.cos(r)
                };
            };

            if (element.type === "text") {
                const fontSize = element.fontSize || 14;
                const align = element.alignment || 'left';

                let unrotatedX = element.x + 8;
                const textWidth = sarabunFont.widthOfTextAtSize(resolvedValue, fontSize);
                if (align === 'center') {
                    unrotatedX = element.x + (w - textWidth) / 2;
                } else if (align === 'right') {
                    unrotatedX = element.x + w - textWidth - 8;
                }

                const unrotatedY = (pageHeight - (element.y + h / 2)) - (fontSize * 0.15);
                const pos = rotatePoint(unrotatedX, unrotatedY);

                drawRichText(page, resolvedValue, pos.x, pos.y, fontSize, pdfRotDeg);
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
                    const pos = rotatePoint(element.x, (pageHeight - element.y) - h);
                    page.drawImage(image, { x: pos.x, y: pos.y, width: w, height: h, rotate: degrees(pdfRotDeg) });
                } else {
                    const qrDataUrl = await QRCode.toDataURL(qrValue || " ");
                    const qrImage = await pdfDoc.embedPng(qrDataUrl);
                    const pos = rotatePoint(element.x, (pageHeight - element.y) - h);
                    page.drawImage(qrImage, { x: pos.x, y: pos.y, width: w, height: h, rotate: degrees(pdfRotDeg) });
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
                            const pos = rotatePoint(element.x, (pageHeight - element.y) - h);
                            page.drawImage(image, { x: pos.x, y: pos.y, width: w, height: h, rotate: degrees(pdfRotDeg) });
                        }
                    }
                }
            } else if (element.type === "table") {
                console.log(`[PDF Gen] >>> ENTERING TABLE LOGIC for Element ${element.id} <<<`);

                const metadata = element.metadata || {};
                console.log(`[PDF Gen] Metadata:`, JSON.stringify(metadata));

                let columns = Array.isArray(metadata) ? metadata : (metadata.columns || []);
                console.log(`[PDF Gen] Columns Found: ${columns.length}`);

                // Auto-generate columns if missing but data exists
                if (columns.length === 0 && Array.isArray(resolvedValue) && resolvedValue.length > 0) {
                    const firstRow = resolvedValue[0];
                    if (firstRow && typeof firstRow === 'object') {
                        console.log(`[PDF Gen] No columns defined. Auto-generating from keys:`, Object.keys(firstRow));
                        columns = Object.keys(firstRow).map(key => ({
                            header: key,
                            field: key,
                            width: (100 / Object.keys(firstRow).length).toString()
                        }));
                    }
                }

                const rowHeight = metadata.rowHeight || 22;

                if (columns.length > 0) {
                    const tableData = Array.isArray(resolvedValue) ? resolvedValue : [];
                    console.log(`[PDF Gen] Table Data Rows: ${tableData.length}`);

                    const fontSize = element.fontSize || 10;

                    for (let i = 0; i < tableData.length; i++) {
                        console.log(`[PDF Gen] --- Process Row ${i} ---`);
                        const rowData = tableData[i];
                        const rowVisualTop = element.y + (i * rowHeight);
                        if ((i + 1) * rowHeight > element.height) {
                            console.log(`[PDF Gen] STOP: Table Overflow at row ${i} (VisualTop: ${rowVisualTop}, MaxH: ${element.height})`);
                            break;
                        }

                        let currentColX = element.x;
                        for (const col of columns) {
                            const colWidthPercent = parseFloat(col.width) || (100 / columns.length);
                            const colWidth = (colWidthPercent / 100) * element.width;
                            console.log(`[PDF Gen]    Col '${col.field}' (Width: ${colWidth})`);

                            let cellValue = rowData[col.field] !== undefined ? String(rowData[col.field]) : "";
                            console.log(`[PDF Gen]    Value: "${cellValue}"`);

                            if (col.script) cellValue = evaluateScript(col.script, rowData);

                            const padding = 10;
                            const maxTextWidth = colWidth - padding;

                            let truncatedVal = cellValue;
                            let currentW = 0;
                            let fitText = "";
                            for (const char of cellValue) {
                                const code = char.charCodeAt(0);
                                const font = code > 0x2000 ? symbolsFont : sarabunFont;
                                const charW = font.widthOfTextAtSize(char, fontSize);
                                if (currentW + charW > maxTextWidth) break;
                                fitText += char;
                                currentW += charW;
                            }
                            truncatedVal = fitText;

                            const textActualWidth = currentW;
                            let uX = currentColX + 5;
                            if (element.alignment === 'center') {
                                uX = currentColX + (colWidth - textActualWidth) / 2;
                            } else if (element.alignment === 'right') {
                                uX = currentColX + colWidth - textActualWidth - 5;
                            }

                            const uY = (pageHeight - rowVisualTop) - (rowHeight / 2) - (fontSize * 0.15);

                            // Debug Coord
                            console.log(`[PDF Gen]    Drawing at (x:${uX}, y:${uY}) with Text "${truncatedVal}"`);

                            const pos = rotatePoint(uX, uY);

                            drawRichText(page, truncatedVal, pos.x, pos.y, fontSize, pdfRotDeg);

                            // DEBUG: Draw Border
                            // try {
                            //     page.drawRectangle({
                            //         x: pos.x,
                            //         y: pos.y - 2,
                            //         width: colWidth,
                            //         height: rowHeight,
                            //         borderColor: rgb(1, 0, 0),
                            //         borderWidth: 1,
                            //     });
                            //     console.log(`[PDF Gen]    Border Drawn`);
                            // } catch (e) {
                            //     console.error(`[PDF Gen]    Border Draw Failed`, e);
                            // }

                            currentColX += colWidth;
                        }
                    }
                } else {
                    console.log(`[PDF Gen] !!! NO COLUMNS DEFINED !!! Skipping Table Render.`);
                }
            }
        } catch (err) {
            console.error("Error processing element:", element.id, err);
        }
    }

    return await pdfDoc.save();
}
