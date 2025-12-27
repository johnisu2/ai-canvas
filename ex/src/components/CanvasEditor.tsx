'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { fabric } from 'fabric';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface CanvasEditorProps {
    fileUrl: string;
    fileType: string;
    initialElements: any[];
    onSave: (elements: any[]) => void;
    onSelect: (element: any | null) => void;
    onEdit: (element: any) => void;
    onDelete: (element: any) => void;
    pageNum?: number;
    onLoad?: (data: { numPages: number }) => void;
    zoom?: number;
    showGrid?: boolean;
    pdfDocument?: any; // NEW: Accepted PDF Document Proxy from parent
}

// Custom Control Helper
const renderEditIcon = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: any) => {
    const size = 24;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(-3, 3);
    ctx.lineTo(3, -3);
    ctx.stroke();
    ctx.restore();
};

const renderDeleteIcon = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: any) => {
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(4, 4);
    ctx.moveTo(4, -4);
    ctx.lineTo(-4, 4);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
};

export default function CanvasEditor(props: CanvasEditorProps) {
    const {
        fileUrl,
        fileType,
        initialElements,
        onSave,
        onSelect,
        onEdit,
        onDelete,
        pageNum = 1,
        onLoad,
        zoom = 1,
        showGrid = false,
        pdfDocument,
    } = props;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [canvasInitialized, setCanvasInitialized] = useState(0); // Trigger for sync
    const isMounted = useRef(false);
    const isInternalUpdate = useRef(false);
    const gridLinesRef = useRef<fabric.Object[]>([]);

    // Fix: Use Ref to hold latest callbacks to avoid stale closures in Fabric events
    const callbacksRef = useRef({ onSave, onDelete, onSelect, onEdit });
    useEffect(() => {
        callbacksRef.current = { onSave, onDelete, onSelect, onEdit };
    }, [onSave, onDelete, onSelect, onEdit]);

    // NEW: Scale Factor for PDF (1.5x) vs Image (1x)
    const scaleFactor = fileType === 'pdf' ? 1.5 : 1;

    // Handle Zoom
    useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        canvas.setZoom(zoom);

        // Resize canvas to match zoom for scrolling
        if (canvas.backgroundImage) {
            const bg = canvas.backgroundImage as fabric.Image;
            const baseWidth = bg.width! * bg.scaleX!;
            const baseHeight = bg.height! * bg.scaleY!;

            canvas.setWidth(baseWidth * zoom);
            canvas.setHeight(baseHeight * zoom);
        }

        canvas.requestRenderAll();
    }, [zoom]);

    // Handle Grid
    useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // Remove old grid
        gridLinesRef.current.forEach(line => canvas.remove(line));
        gridLinesRef.current = [];

        if (showGrid) {
            const gridSize = 50;
            const width = canvas.width || 800;
            const height = canvas.height || 800;

            // Vertical Lines
            for (let i = 0; i < width; i += gridSize) {
                const line = new fabric.Line([i, 0, i, height], {
                    stroke: '#ccc',
                    strokeWidth: 1,
                    selectable: false,
                    evented: false,
                    excludeFromExport: true
                });
                canvas.add(line);
                canvas.sendToBack(line);
                gridLinesRef.current.push(line);
            }

            // Horizontal Lines
            for (let i = 0; i < height; i += gridSize) {
                const line = new fabric.Line([0, i, width, i], {
                    stroke: '#ccc',
                    strokeWidth: 1,
                    selectable: false,
                    evented: false,
                    excludeFromExport: true
                });
                canvas.add(line);
                canvas.sendToBack(line);
                gridLinesRef.current.push(line);
            }
            canvas.requestRenderAll();
        }
    }, [showGrid]);

    // Initialize Canvas
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;
        isMounted.current = true;

        // Initialize custom controls
        // @ts-ignore
        fabric.Object.prototype.transparentCorners = false;
        // @ts-ignore
        fabric.Object.prototype.cornerColor = '#ffffff';
        // @ts-ignore
        fabric.Object.prototype.cornerStrokeColor = '#3b82f6';
        // @ts-ignore
        fabric.Object.prototype.borderColor = '#3b82f6';
        // @ts-ignore
        fabric.Object.prototype.cornerSize = 10;
        // @ts-ignore
        fabric.Object.prototype.padding = 10;

        // Add Edit Button Control
        // @ts-ignore
        fabric.Object.prototype.controls.editControl = new fabric.Control({
            x: 0.5,
            y: -0.5,
            offsetY: -20,
            offsetX: 20,
            cursorStyle: 'pointer',
            mouseUpHandler: (eventData, transform) => {
                const target = transform.target;
                // @ts-ignore
                if (target && target.data) {
                    // @ts-ignore
                    callbacksRef.current.onEdit({ ...target.data, id: target.data.id });
                }
                return true;
            },
            render: (ctx, left, top, styleOverride, fabricObject) => {
                const size = 24;
                ctx.save();
                ctx.translate(left, top);
                ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));

                // Circle bg
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, 2 * Math.PI);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Pen icon
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.moveTo(-3, 3);
                ctx.lineTo(3, -3);
                ctx.stroke();
                ctx.restore();
            }
        });

        // Add Delete Button Control
        // @ts-ignore
        fabric.Object.prototype.controls.deleteControl = new fabric.Control({
            x: 0.5,
            y: -0.5,
            offsetY: -20,
            offsetX: 56, // Increased to prevent overlap
            cursorStyle: 'pointer',
            mouseUpHandler: (eventData, transform) => {
                const target = transform.target;
                // @ts-ignore
                if (target && target.data) {
                    const canvas = target.canvas;
                    if (canvas) {
                        canvas.remove(target);
                        canvas.requestRenderAll();
                    }
                    callbacksRef.current.onDelete({ ...target.data, id: target.data.id });
                }
                return true;
            },
            render: (ctx, left, top, styleOverride, fabricObject) => {
                ctx.save();
                ctx.translate(left, top);
                ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));

                // Circle bg
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, 2 * Math.PI);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.strokeStyle = '#ef4444'; // Red-500
                ctx.lineWidth = 1;
                ctx.stroke();

                // X icon
                ctx.beginPath();
                ctx.moveTo(-4, -4);
                ctx.lineTo(4, 4);
                ctx.moveTo(4, -4);
                ctx.lineTo(-4, 4);
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.restore();
            }
        });

        // Initialize Canvas
        const canvas = new fabric.Canvas(canvasRef.current, {
            width: containerRef.current.clientWidth,
            height: 800, // Default height, will adjust to content
            backgroundColor: '#f3f4f6',
        });

        fabricCanvasRef.current = canvas;
        setCanvasInitialized(Date.now());

        // Load Content
        const loadContent = async () => {
            try {
                if (fileType === 'pdf') {
                    let pdf = pdfDocument;
                    if (!pdf) {
                        const loadingTask = pdfjsLib.getDocument(fileUrl);
                        pdf = await loadingTask.promise;
                    }

                    if (onLoad) onLoad({ numPages: pdf.numPages });

                    // Validate page number
                    const safePageNum = Math.min(Math.max(1, pageNum), pdf.numPages);
                    const page = await pdf.getPage(safePageNum); // Load specified page

                    if (!isMounted.current) return;

                    const viewport = page.getViewport({ scale: 1.5 }); // Scale 1.5 for better quality
                    const supportCanvas = document.createElement('canvas');
                    const context = supportCanvas.getContext('2d')!;
                    supportCanvas.height = viewport.height;
                    supportCanvas.width = viewport.width;

                    await page.render({ canvasContext: context, viewport }).promise;

                    if (!isMounted.current) return;

                    const imgUrl = supportCanvas.toDataURL();

                    fabric.Image.fromURL(imgUrl, (img) => {
                        if (!isMounted.current || !fabricCanvasRef.current) return;

                        try {
                            const currentCanvas = fabricCanvasRef.current;

                            // Remove existing background image if it was added as an object
                            // This handles cases where the background might have been added as a regular object
                            // instead of using setBackgroundImage, or if the component re-renders.
                            const objects = currentCanvas.getObjects();
                            objects.forEach(obj => {
                                // @ts-ignore
                                if (obj.name === 'pdf-background') {
                                    currentCanvas.remove(obj);
                                }
                            });

                            // Set the background image
                            img.set({
                                // @ts-ignore
                                name: 'pdf-background', // Tag it for explicit removal if needed
                                selectable: false,
                                evented: false,
                                excludeFromExport: true, // Don't export bg, we rely on original PDF
                                left: 0,
                                top: 0,
                                originX: 'left',
                                originY: 'top',
                                scaleX: viewport.width / img.width!,
                                scaleY: viewport.height / img.height!,
                            });

                            currentCanvas.setHeight(viewport.height);
                            currentCanvas.setWidth(viewport.width);
                            currentCanvas.setBackgroundImage(img, () => {
                                if (isMounted.current && fabricCanvasRef.current) {
                                    fabricCanvasRef.current.renderAll();
                                    setLoading(false);
                                }
                            });
                        } catch (e) {
                            console.warn('Error setting background', e);
                            setLoading(false);
                        }
                    });
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.warn('Canvas disposed before image load', error);
                setLoading(false);
            }
        };

        loadContent();

        // Load initial elements (ONCE on mount)
        const loadElements = (canvas: fabric.Canvas, scale: number) => {
            initialElements.forEach(el => {
                // Filter by Page
                const elPage = el.pageNumber || 1;
                if (elPage !== pageNum) return;

                let obj: fabric.Object;
                const type = el.type || 'text'; // Default to text if undefined (legacy)

                let fill = 'rgba(59, 130, 246, 0.2)';
                let stroke = '#3b82f6';

                if (type === 'qr') {
                    fill = 'rgba(168, 85, 247, 0.2)';
                    stroke = '#a855f7';
                } else if (type === 'image') {
                    fill = 'rgba(34, 197, 94, 0.2)';
                    stroke = '#22c55e';
                } else if (type === 'table') {
                    fill = 'rgba(249, 115, 22, 0.2)';
                    stroke = '#f97316';
                }

                const rect = new fabric.Rect({
                    // UPSCALE: Apply scaleFactor when loading from DB
                    left: el.x * scaleFactor,
                    top: el.y * scaleFactor,
                    width: el.width * scaleFactor,
                    height: el.height * scaleFactor,
                    fill: fill,
                    stroke: stroke,
                    strokeWidth: 2,
                    transparentCorners: false,
                });

                // Attach data
                (rect as any).data = {
                    type: type,
                    label: el.label,
                    fieldName: el.fieldName,
                    fieldValue: el.fieldValue,
                    id: el.id,
                    metadata: el.metadata || {}, // Ensure object
                    // NEW: Load format props
                    fontSize: el.fontSize || 14,
                    alignment: el.alignment || 'left',
                    script: el.script,   // FIX: Persist script
                    formula: el.formula  // FIX: Persist formula
                };

                canvas.add(rect);
                // PRIORITY: Placeholder > Label > FieldName
                const labelContent = el.metadata?.placeholder || el.label || el.fieldName || 'Field';
                addLabel(canvas, rect, labelContent, el.fontSize, el.alignment);
            });
        }


        // Events
        canvas.on('selection:created', (e) => {
            if (!isMounted.current) return;
            const obj = e.selected?.[0];
            // @ts-ignore
            if (obj) callbacksRef.current.onSelect({ ...obj.data, id: obj.data?.id });
        });
        canvas.on('selection:updated', (e) => {
            if (!isMounted.current) return;
            const obj = e.selected?.[0];
            // @ts-ignore
            if (obj) callbacksRef.current.onSelect({ ...obj.data, id: obj.data?.id });
        });
        canvas.on('selection:cleared', () => {
            if (isMounted.current) callbacksRef.current.onSelect(null);
        });
        canvas.on('object:modified', () => {
            if (isMounted.current) saveCanvas(canvas);
        });
        // Removed object:added to prevent infinite loop with syncElements
        // canvas.on('object:added', () => {
        //     if (isMounted.current) saveCanvas(canvas);
        // });

        // Clean up
        return () => {
            console.log('Cleaning up canvas...');
            const canvas = fabricCanvasRef.current;
            fabricCanvasRef.current = null;
            isMounted.current = false;

            if (canvas) {
                try {
                    canvas.dispose();
                } catch (e) {
                    console.warn('Error disposing canvas', e);
                }
            }
        };
    }, [fileUrl, fileType, pageNum, pdfDocument]); // eslint-disable-line react-hooks/exhaustive-deps

    // Effect to sync external changes (e.g. from Modal) to Canvas
    useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !isMounted.current) return;

        isInternalUpdate.current = true;

        const syncElements = async () => {
            const currentObjects = canvas.getObjects().filter(obj =>
                obj.type === 'rect' || obj.type === 'image' || obj.type === 'group'
            );

            for (const el of initialElements) {
                // Filter by page
                if ((el.pageNumber || 1) !== pageNum) continue;

                const existingObj = currentObjects.find((obj: any) => obj.data?.id === el.id) as any;
                const type = el.type || 'text';
                const hasImageUrl = ((type === 'image' || type === 'qr') && el.fieldValue && el.fieldValue.match(/^(\/|http)/)) ||
                    (type === 'signature' && el.fieldValue && el.fieldValue.startsWith('data:image'));

                // Define colors based on type
                let fill = 'rgba(59, 130, 246, 0.2)';
                let stroke = '#3b82f6';
                if (type === 'qr') { fill = 'rgba(168, 85, 247, 0.2)'; stroke = '#a855f7'; }
                else if (type === 'image') { fill = 'rgba(34, 197, 94, 0.2)'; stroke = '#22c55e'; }
                else if (type === 'table') { fill = 'rgba(249, 115, 22, 0.2)'; stroke = '#f97316'; }
                else if (type === 'signature') { fill = 'rgba(236, 72, 153, 0.1)'; stroke = '#ec4899'; }

                if (existingObj) {
                    // Update metadata
                    const needsUpdate = JSON.stringify(existingObj.data) !== JSON.stringify(el);

                    if (needsUpdate) {
                        existingObj.data = { ...el };

                        // Handle color/style
                        // Color/style logic hoisted up

                        if (existingObj.type === 'group') {
                            // Update styles for group children (Rect placeholder)
                            // @ts-ignore
                            const childRect = existingObj.getObjects().find(o => o.type === 'rect');
                            if (childRect) childRect.set({ fill, stroke });
                        } else {
                            existingObj.set({ fill, stroke });
                        }

                        existingObj.dirty = true;
                    }

                    // Handle Type Swap (Rect/Group -> Image)
                    if (hasImageUrl && (existingObj.type !== 'image' || existingObj.data?.fieldValue !== el.fieldValue)) {
                        fabric.Image.fromURL(el.fieldValue, (img) => {
                            if (!canvas || !isMounted.current) return;

                            const newImg = img.set({
                                left: existingObj.left,
                                top: existingObj.top,
                                angle: existingObj.angle,
                                scaleX: (existingObj.width * existingObj.scaleX) / (img.width || 1),
                                scaleY: (existingObj.height * existingObj.scaleY) / (img.height || 1),
                                data: { ...el },
                                transparentCorners: false,
                                cornerColor: '#ffffff',
                                cornerStrokeColor: stroke,
                                borderColor: stroke,
                                cornerSize: 10,
                                padding: 5,
                            });

                            // Add Delete Control
                            // @ts-ignore
                            newImg.controls.deleteControl = new fabric.Control({
                                x: 0.5,
                                y: -0.5,
                                offsetY: -16,
                                offsetX: 16,
                                cursorStyle: 'pointer',
                                mouseUpHandler: () => {
                                    callbacksRef.current.onDelete(el);
                                    canvas.remove(newImg);
                                    return true;
                                },
                                // @ts-ignore
                                render: renderDeleteIcon
                            });

                            // Add Edit Control for Signature/Image
                            // @ts-ignore
                            newImg.controls.editControl = new fabric.Control({
                                x: 0.5,
                                y: -0.5,
                                offsetY: -16,
                                offsetX: -16, // Left of center
                                cursorStyle: 'pointer',
                                mouseUpHandler: (eventData, transform) => {
                                    const target = transform.target;
                                    // @ts-ignore
                                    if (target && target.data) {
                                        // @ts-ignore
                                        callbacksRef.current.onEdit(target.data);
                                    }
                                    return true;
                                },
                                // @ts-ignore
                                render: renderEditIcon
                            });

                            const wasSelected = canvas.getActiveObject() === existingObj;
                            canvas.remove(existingObj);
                            canvas.add(newImg);
                            if (wasSelected) canvas.setActiveObject(newImg);

                            if (isMounted.current && fabricCanvasRef.current) {
                                fabricCanvasRef.current.requestRenderAll();
                            }
                        });
                    }
                } else {
                    // NEW element - Create and Add to Canvas
                    // properties fill/stroke are already defined above

                    const rect = new fabric.Rect({
                        left: el.x * scaleFactor,
                        top: el.y * scaleFactor,
                        width: el.width * scaleFactor,
                        height: el.height * scaleFactor,
                        fill: fill,
                        stroke: stroke,
                        strokeWidth: 2,
                        transparentCorners: false,
                    });

                    (rect as any).data = {
                        type: type,
                        label: el.label,
                        fieldName: el.fieldName,
                        fieldValue: el.fieldValue,
                        id: el.id,
                        metadata: el.metadata || {},
                        fontSize: el.fontSize || 14,
                        alignment: el.alignment || 'left',
                        script: el.script,
                        formula: el.formula
                    };

                    canvas.add(rect);
                    const labelContent = el.metadata?.placeholder || el.label || el.fieldName || 'Field';
                    addLabel(canvas, rect, labelContent, el.fontSize, el.alignment);
                }
            }

            if (isMounted.current && fabricCanvasRef.current) {
                refreshLabels(fabricCanvasRef.current);
                fabricCanvasRef.current.requestRenderAll();
            }
            isInternalUpdate.current = false;
        };

        syncElements();

    }, [initialElements, pageNum]);

    const refreshLabels = (canvas: fabric.Canvas) => {
        if (!isMounted.current || !canvas) return;
        // Remove all current labels and table lines
        canvas.getObjects().filter(obj => obj.type === 'text' || obj.type === 'line').forEach(t => {
            try { canvas.remove(t); } catch (e) { }
        });

        // Re-draw based on current objects
        canvas.getObjects().filter(obj => obj.type === 'rect' || obj.type === 'image').forEach((obj: any) => {
            if (!isMounted.current) return;
            const data = obj.data;
            if (!data) return;

            // Draw Table Lines if type is table
            if (data.type === 'table' && data.metadata?.tableConfig?.columns) {
                drawTableLines(canvas, obj, data.metadata.tableConfig.columns);
            }

            // PRIORITY: Placeholder > Label > FieldName
            const labelContent = data.metadata?.placeholder || data.label || data.fieldName || 'Field';
            addLabel(canvas, obj, labelContent, data.fontSize, data.alignment);
        });
    };

    const drawTableLines = (canvas: fabric.Canvas, rect: any, columns: any[]) => {
        if (!columns || columns.length === 0) return;

        // Check showLines config (default true)
        const showLines = rect.data?.metadata?.tableConfig?.showLines !== false;

        const totalWidth = rect.getScaledWidth();
        const height = rect.getScaledHeight();
        const top = rect.top;
        const left = rect.left;

        let currentX = 0;

        // Draw Header Line
        const headerOriginalHeight = 25; // approximated header height
        const headerHeight = headerOriginalHeight * scaleFactor;

        if (showLines) {
            const hLine = new fabric.Line([left, top + headerHeight, left + totalWidth, top + headerHeight], {
                stroke: '#f97316', // Orange match
                strokeWidth: 1,
                selectable: false,
                evented: false,
                opacity: 0.6
            });
            canvas.add(hLine);
        } else {
            // Draw subtle header separator if lines are off, for feedback?
            // actually, if lines are off, user might want "clean" text.
            // But for editor feedback, maybe keep a very faint line or just nothing.
            // Let's hide it as requested.
        }


        columns.forEach((col, idx) => {
            // Don't draw line for last column end (it's the border)
            if (idx === columns.length - 1) return;

            const colWidthPct = col.width || (100 / columns.length);
            const colWidthPx = (colWidthPct / 100) * totalWidth;

            currentX += colWidthPx;

            if (showLines) {
                const vLine = new fabric.Line([left + currentX, top, left + currentX, top + height], {
                    stroke: '#f97316',
                    strokeWidth: 1,
                    selectable: false,
                    evented: false,
                    opacity: 0.6
                });
                canvas.add(vLine);
            }

            // Add Header Text
            // Calculate center of column for text
            const prevX = currentX - colWidthPx;
            const headerText = new fabric.Text(col.header || '', {
                left: left + prevX + 2,
                top: top + 2,
                fontSize: 10 * scaleFactor,
                fill: '#ea580c',
                selectable: false,
                evented: false
            });
            canvas.add(headerText);
        });

        // Add text for last column
        // ... (Simplified: Skipping last col text for now to save code space, relying on PDF for real preview)
    };

    const addLabel = (canvas: fabric.Canvas, rect: any, textContent: string, fontSize: number = 14, alignment: string = 'left') => {
        if (!textContent || !isMounted.current || !canvas) return;

        // Hide label for Image and QR types (prevent overlap)
        if (rect.data?.type === 'image' || rect.data?.type === 'qr' || rect.data?.type === 'signature') return;

        // Scale Font Size
        const scaledFontSize = fontSize * scaleFactor;

        // Calculate Position based on Alignment
        let left = rect.left;
        let originX = 'left';
        let textAlign = 'left';

        if (alignment === 'center') {
            left = rect.left + (rect.getScaledWidth() / 2);
            originX = 'center';
            textAlign = 'center';
        } else if (alignment === 'right') {
            left = rect.left + rect.getScaledWidth();
            originX = 'right';
            textAlign = 'right';
        }

        const text = new fabric.Text(textContent, {
            left: left,
            top: rect.top + (rect.getScaledHeight() / 2) - (scaledFontSize / 2), // Center Y approx
            fontSize: scaledFontSize,
            fill: '#000000', // Black text for preview (was blue)
            selectable: false,
            evented: false,
            originX: originX,
            textAlign: textAlign,
            fontFamily: 'Tahoma' // Match PDF font approx
        });
        canvas.add(text);
        text.bringToFront();
    };

    const saveCanvas = (canvas: fabric.Canvas) => {
        if (isInternalUpdate.current || !isMounted.current) return;
        const objects = canvas.getObjects().filter(obj => obj.type === 'rect' || obj.type === 'image');
        const elements = objects.map(obj => ({
            // @ts-ignore
            ...obj.data,
            // DOWNSCALE: Normalize coordinates before saving to DB
            x: (obj.left || 0) / scaleFactor,
            y: (obj.top || 0) / scaleFactor,
            width: ((obj.width || 0) * (obj.scaleX || 1)) / scaleFactor,
            height: ((obj.height || 0) * (obj.scaleY || 1)) / scaleFactor
        }));
        callbacksRef.current.onSave(elements);
    };

    // Handlers for dropping new fields
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!fabricCanvasRef.current) return;

        const fieldType = e.dataTransfer.getData('fieldType') || 'text';
        const fieldName = e.dataTransfer.getData('fieldName');

        // Get drop position relative to canvas
        const pointer = fabricCanvasRef.current.getPointer(e.nativeEvent);

        let width = 150;
        let height = 40;
        let fill = 'rgba(59, 130, 246, 0.2)'; // blue default
        let stroke = '#3b82f6';

        if (fieldType === 'qr') {
            width = 100;
            height = 100;
            fill = 'rgba(168, 85, 247, 0.2)'; // purple
            stroke = '#a855f7';
        } else if (fieldType === 'image') {
            width = 200;
            height = 150;
            fill = 'rgba(34, 197, 94, 0.2)'; // green
            stroke = '#22c55e';
        } else if (fieldType === 'table') {
            width = 300;
            height = 150;
            fill = 'rgba(249, 115, 22, 0.2)'; // orange
            stroke = '#f97316';
        }

        const rect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: width,
            height: height,
            fill: fill,
            stroke: stroke,
            strokeWidth: 2,
        });

        (rect as any).data = {
            type: fieldType,
            fieldName: fieldName,
            fieldValue: '',
            label: fieldName,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            pageNumber: pageNum,
            metadata: {}
        };

        fabricCanvasRef.current.add(rect);
        addLabel(fabricCanvasRef.current, rect, fieldName);

        fabricCanvasRef.current.setActiveObject(rect);
        saveCanvas(fabricCanvasRef.current);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <div className="relative w-full h-full overflow-auto bg-gray-100 p-4" ref={containerRef} onDrop={handleDrop} onDragOver={handleDragOver}>
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">Loading...</div>}
            <canvas ref={canvasRef} />
        </div>
    );
}
