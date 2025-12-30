"use client";

import { useEffect, useRef, useState } from "react";
import { PDFDocumentProxy } from "pdfjs-dist";
import { CanvasElement } from "@/types/canvas";
import { ElementRenderer } from "./ElementRenderer";
import { ElementType } from "@/types/canvas";

interface PDFPageProps {
    pageNumber: number;
    pdfDocument: PDFDocumentProxy;
    scale: number;
    showGrid: boolean;
    elements: CanvasElement[];
    selectedElementId: string | number | null;
    onAddElement: (type: ElementType, x: number, y: number) => void;
    onUpdateElement: (id: string | number, updates: Partial<CanvasElement>) => void;
    onSelectElement: (id: string | number) => void;
    onEditElement: (id: string | number) => void;
    onDeleteElement: (id: string | number) => void;
}

export function PDFPage({
    pageNumber,
    pdfDocument,
    scale,
    showGrid,
    elements,
    selectedElementId,
    onAddElement,
    onUpdateElement,
    onSelectElement,
    onEditElement,
    onDeleteElement,
}: PDFPageProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        let isCancelled = false;

        const renderPage = async () => {
            if (!canvasRef.current || !pdfDocument) return;

            try {
                const page = await pdfDocument.getPage(pageNumber);

                // 1. Baseline viewport at scale 1.0 for CSS layout calculations
                const baselineViewport = page.getViewport({ scale: 1.0 });
                const baseWidth = baselineViewport.width;
                const baseHeight = baselineViewport.height;

                // 2. High-resolution scale for rendering (Fixed at 2.0 base for crispness)
                const renderBaseScale = 2.0;
                const dpr = window.devicePixelRatio || 1;
                const totalScale = renderBaseScale * dpr;
                const highResViewport = page.getViewport({ scale: totalScale });

                // Update container dimensions (relative to zoom scale)
                setDimensions(prev =>
                    (prev.width === baseWidth * scale && prev.height === baseHeight * scale)
                        ? prev
                        : { width: baseWidth * scale, height: baseHeight * scale }
                );

                const canvas = canvasRef.current;
                const context = canvas.getContext("2d", { willReadFrequently: true });

                if (context) {
                    // Cancel any existing task
                    if (renderTaskRef.current) {
                        try {
                            await renderTaskRef.current.cancel();
                        } catch (e) { /* ignore */ }
                    }

                    if (isCancelled) return;

                    // Set canvas resolution to high-res viewport
                    canvas.width = highResViewport.width;
                    canvas.height = highResViewport.height;

                    const renderContext = {
                        canvasContext: context,
                        viewport: highResViewport,
                        intent: 'print' // Use print intent for higher quality font rendering
                    };

                    const task = page.render(renderContext);
                    renderTaskRef.current = task;

                    await task.promise;
                }
            } catch (error: any) {
                if (error.name !== "RenderingCancelledException") {
                    console.error(`Error rendering page ${pageNumber}:`, error);
                }
            }
        };

        renderPage();

        return () => {
            isCancelled = true;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdfDocument, pageNumber, scale]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData("elementType") as ElementType;
        if (type) {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            // Calculate x, y relative to unscaled PDF coordinates
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            onAddElement(type, x, y);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <div
            className="relative shadow-lg bg-white transition-all duration-200 ease-in-out mb-8"
            style={{
                width: (dimensions.width / scale) || '800px',
                height: (dimensions.height / scale) || '1100px',
                minHeight: '800px'
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />

            {/* Grid Layer */}
            {showGrid && (
                <div
                    className="absolute inset-0 pointer-events-none opacity-40 z-10"
                    style={{
                        backgroundImage: `
                                                    linear-gradient(to right, rgba(0,0,0,0.6) 1px, transparent 1px),
                                                    linear-gradient(to bottom, rgba(0,0,0,0.6) 1px, transparent 1px)
                                                `,
                        backgroundSize: `20px 20px`,
                    }}
                />
            )}
            {/* {showGrid && (
                <div className="absolute inset-0 pointer-events-none opacity-20 z-10"
                    style={{ backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`, backgroundSize: `${20}px ${20}px` }}>
                </div>
            )} */}

            {/* Elements Rendering Layer */}
            <div className="absolute inset-0 w-full h-full"
                style={{
                    width: (dimensions.width / scale) || '800px',
                    height: (dimensions.height / scale) || '1100px',
                    minHeight: '800px'
                }}>
                {elements.map((el) => (
                    <ElementRenderer
                        key={el.id}
                        element={el}
                        scale={scale}
                        isSelected={selectedElementId === el.id}
                        onUpdate={onUpdateElement}
                        onSelect={onSelectElement}
                        onEdit={onEditElement}
                        onDelete={onDeleteElement}
                    />
                ))}
            </div>
        </div>
    );
}
