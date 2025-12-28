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
            console.log(`[PDF Gen] Fetching image from: ${urlOrBase64.substring(0, 50)}...`);

            if (urlOrBase64.startsWith("data:image")) {
                const parts = urlOrBase64.split(",");
                if (parts.length < 2) throw new Error("Invalid Base64 data");
                const base64Data = parts[1];
                const bytes = Uint8Array.from(Buffer.from(base64Data, "base64"));
                console.log(`[PDF Gen] Decoded Base64, size: ${bytes.length} bytes`);
                return bytes;
            }
            if (urlOrBase64.startsWith("http")) {
                const response = await fetch(urlOrBase64);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                console.log(`[PDF Gen] Fetched from URL, size: ${bytes.length} bytes`);
                return bytes;
            }
            if (urlOrBase64.startsWith("/")) {
                // Remove leading slash for join to work correctly with public
                const cleanPath = urlOrBase64.replace(/^\/+/, "");
                const localPath = join(process.cwd(), "public", cleanPath);
                console.log(`[PDF Gen] Loading local image from: ${localPath}`);
                const buffer = await readFile(localPath);
                console.log(`[PDF Gen] Loaded local file, size: ${buffer.length} bytes`);
                return new Uint8Array(buffer);
            }
            console.warn(`[PDF Gen] Unknown image source type: ${urlOrBase64.substring(0, 20)}`);
            return null;
        } catch (error) {
            console.error(`[PDF Gen] Image fetch failed for "${urlOrBase64.substring(0, 30)}...":`, error);
            return null;
        }
    };

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

            console.log(`[PDF Gen] Element: ${element.id}, Type: ${element.type}, fieldName: "${fieldName}"`);

            // Robust Mapping Logic
            let resolvedValue = value;

            // 1. Try direct fieldName match or partial match (if Table.Field)
            if (dataContext && fieldName) {
                const shortFieldName = fieldName.includes('.') ? fieldName.split('.').pop()! : fieldName;

                if (dataContext[fieldName] !== undefined) {
                    resolvedValue = String(dataContext[fieldName]);
                    console.log(`[PDF Gen] Found match (Full): ${fieldName} -> ${resolvedValue}`);
                } else if (dataContext[shortFieldName] !== undefined) {
                    resolvedValue = String(dataContext[shortFieldName]);
                    console.log(`[PDF Gen] Found match (Short): ${shortFieldName} -> ${resolvedValue}`);
                }
            }

            // 2. Mustache replacement in the value string
            if (resolvedValue && typeof resolvedValue === 'string' && resolvedValue.includes("{{") && dataContext) {
                resolvedValue = resolvedValue.replace(/\{\{(.*?)\}\}/g, (_, key) => {
                    const k = key.trim();
                    const result = dataContext[k] !== undefined ? String(dataContext[k]) : `{{${k}}}`;
                    console.log(`[PDF Gen] Mustache match: ${k} -> ${result}`);
                    return result;
                });
            }

            // Cleanup: If value is still a default placeholder but we have a fieldName that failed to map
            // we should probably keep the placeholder or show a blank, but let's log it.
            if (resolvedValue === "เพิ่มข้อความ..." && fieldName) {
                console.log(`[PDF Gen] Warning: Element with field "${fieldName}" still has default placeholder.`);
            }

            console.log(`[PDF Gen] Final value for ${element.id}: "${resolvedValue}"`);

            // Common properties
            const x = element.x;
            const y = pageHeight - element.y; // Top-down to bottom-up (rough)
            const rotationDegrees = element.rotation || 0;
            const rad = (rotationDegrees * Math.PI) / 180;

            if (element.type === "text") {
                const fontSize = element.fontSize || 14;
                // Note: drawRichText doesn't support rotation yet, but let's fix the basic drawing first
                drawRichText(
                    page,
                    resolvedValue,
                    x,
                    y - fontSize,
                    fontSize
                );
            } else if (element.type === "qr") {
                const qrValue = resolvedValue || "";
                let image;

                // If it looks like an image source (Base64, URL, or Local Path), try to render as image first
                if (qrValue.startsWith("data:image") || qrValue.startsWith("http") || qrValue.startsWith("/")) {
                    const bytes = await fetchImageBytes(qrValue);
                    if (bytes) {
                        try {
                            const isPng = qrValue.includes("image/png") || qrValue.startsWith("data:image/png") || qrValue.endsWith(".png");
                            image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
                            console.log(`[PDF Gen] QR element rendered as image from source`);
                        } catch (e) {
                            // Fallback try other format
                            try {
                                image = qrValue.toLowerCase().includes("png") ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
                            } catch {
                                console.warn(`[PDF Gen] QR element failed image embedding, will try generating QR code`);
                            }
                        }
                    }
                }

                if (image) {
                    page.drawImage(image, {
                        x,
                        y: y - element.height,
                        width: element.width,
                        height: element.height,
                        rotate: radians(rad)
                    });
                } else {
                    // Default QR generation
                    const qrDataUrl = await QRCode.toDataURL(qrValue);
                    const qrImage = await pdfDoc.embedPng(qrDataUrl);
                    page.drawImage(qrImage, {
                        x,
                        y: y - element.height,
                        width: element.width,
                        height: element.height,
                        rotate: radians(rad)
                    });
                }
            } else if (element.type === "image" || element.type === "signature") {
                if (resolvedValue && (resolvedValue.startsWith("data:image") || resolvedValue.startsWith("http") || resolvedValue.startsWith("/"))) {
                    const bytes = await fetchImageBytes(resolvedValue);
                    if (bytes) {
                        console.log(`[PDF Gen] Embedding image for ${element.id}, size: ${bytes.length} bytes`);
                        let image;
                        try {
                            // Detect type or try PNG then JPG
                            if (resolvedValue.includes("image/png") || resolvedValue.endsWith(".png")) {
                                image = await pdfDoc.embedPng(bytes);
                            } else if (resolvedValue.includes("image/jpeg") || resolvedValue.includes("image/jpg") || resolvedValue.endsWith(".jpg") || resolvedValue.endsWith(".jpeg")) {
                                image = await pdfDoc.embedJpg(bytes);
                            } else {
                                // Fallback: try PNG first
                                try {
                                    image = await pdfDoc.embedPng(bytes);
                                } catch {
                                    image = await pdfDoc.embedJpg(bytes);
                                }
                            }
                        } catch (embedError) {
                            console.error(`[PDF Gen] Image embedding failed for ${element.id}:`, embedError);
                        }

                        if (image) {
                            page.drawImage(image, {
                                x,
                                y: y - element.height,
                                width: element.width,
                                height: element.height,
                                rotate: radians(rad)
                            });
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
