"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist";
import { PDFPage } from "./PDFPage";
import { CanvasElement } from "@/types/canvas";
import {
    Plus,
    Save,
    Loader2,
    Home,
    ChevronLeft,
    RotateCw,
    Copy,
    History as HistoryIcon
} from "lucide-react";
import Link from 'next/link';
import Swal from 'sweetalert2';
import { cn } from "@/lib/utils";
import { Toolbox } from "./Toolbox";
import { EditModal } from "./EditModal";
import { HistorySidebar } from "./HistorySidebar"; // Import Sidebar
import { v4 as uuidv4 } from "uuid";
import { ElementType } from "@/types/canvas";
import { ElementRenderer } from "./ElementRenderer";

// Configure worker
if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

interface CanvasEditorProps {
    documentId: string;
    fileUrl: string;
    fileType?: string; // NEW
    initialElements?: CanvasElement[];
}

// Normalizer to protect specific keys
const normalizeElements = (elements: any[]): CanvasElement[] => {
    return elements.map(el => ({
        ...el,
        // Ensure critical fields exist
        width: el.width || el.w || 100, // Legacy support example
        height: el.height || el.h || 50
    }));
};

export function CanvasEditor({ documentId, fileUrl, fileType = 'pdf', initialElements = [] }: CanvasEditorProps) {
    const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
    const [elements, setElements] = useState<CanvasElement[]>(initialElements);
    const [scale, setScale] = useState(1.0);
    const [showGrid, setShowGrid] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState<string | number | null>(null);
    const [editingElementId, setEditingElementId] = useState<string | number | null>(null);
    const [isGenerateOpen, setIsGenerateOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCloning, setIsCloning] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isFitted, setIsFitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 800, height: 1100 });
    const [isHistoryOpen, setIsHistoryOpen] = useState(false); // New State
    const [elementsBackup, setElementsBackup] = useState<CanvasElement[] | null>(null);

    // Hooks must be at the top level
    const clipboard = useRef<CanvasElement | null>(null);


    const handleZoomIn = useCallback(() => {
        setScale((prev) => Math.min(prev + 0.1, 3.0));
        setIsFitted(false);
    }, []);

    const handleZoomOut = useCallback(() => {
        setScale((prev) => Math.max(prev - 0.1, 0.5));
        setIsFitted(false);
    }, []);

    const handleToggleGrid = useCallback(() => setShowGrid((prev) => !prev), []);

    const handleFitToScreen = useCallback(() => {
        const container = document.querySelector('.editor-scroll-container');
        if (!container) {
            setScale(1.0);
            setIsFitted(false);
            return;
        }

        const containerWidth = container.clientWidth - 100;
        const targetWidth = 800; // Use 800 as nominal width for scaling
        const targetScale = containerWidth / targetWidth;
        const finalFitScale = Math.max(0.6, Math.min(targetScale, 1.5));

        if (Math.abs(scale - finalFitScale) < 0.05) {
            setScale(1.0);
            setIsFitted(false);
        } else {
            setScale(finalFitScale);
            setIsFitted(true);
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [scale]);

    const handleScrollToTop = useCallback(() => {
        const container = document.querySelector('.editor-scroll-container');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    const handleToggleFullScreen = useCallback(() => {
        setIsFullScreen(prev => !prev);
    }, []);


    const handleAddElement = useCallback((pageNumber: number, type: ElementType, x: number, y: number) => {
        // Default sizes based on type
        const defaults: Record<string, { w: number, h: number }> = {
            text: { w: 150, h: 40 },
            qr: { w: 100, h: 100 },
            image: { w: 150, h: 150 },
            table: { w: 350, h: 120 },
            signature: { w: 150, h: 60 }
        };
        const size = defaults[type as string] || { w: 150, h: 50 };

        const newElement: CanvasElement = {
            id: uuidv4(),
            type,
            x,
            y,
            width: size.w,
            height: size.h,
            pageNumber,
        };
        setElements((prev) => [...prev, newElement]);
        setSelectedElementId(newElement.id);
        setIsDirty(true);
    }, []);

    const handleUpdateElement = useCallback((id: string | number, updates: Partial<CanvasElement>) => {
        setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
        setIsDirty(true);
    }, []);

    const handleDeleteElement = useCallback(async (id: string | number) => {
        const result = await Swal.fire({
            title: 'ยืนยันการลบข้อมูล',
            text: "หากลบแล้วจะไม่สามารถกู้คืนข้อมูลนี้ได้",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#ef4444',
            confirmButtonText: 'ตกลง',
            cancelButtonText: 'ยกเลิก'
        });

        if (!result.isConfirmed) return;
        setElements((prev) => prev.filter((el) => el.id !== id));
        if (selectedElementId === id) setSelectedElementId(null);
        if (editingElementId === id) setEditingElementId(null);
        setIsDirty(true);
    }, [selectedElementId, editingElementId]);

    const handleSave = useCallback(async () => {
        if (!isDirty) return;
        setIsSaving(true);
        try {
            // 1. Save Current (PUT)
            const saveCurrentProm = fetch(`/api/documents/${documentId}`, {
                method: "PUT",
                body: JSON.stringify({ elements }),
                headers: { "Content-Type": "application/json" }
            });

            // 2. Create History Version (POST)
            const saveHistoryProm = fetch(`/api/documents/${documentId}/versions`, {
                method: "POST",
                body: JSON.stringify({
                    elements,
                    changeLog: `Saved on ${new Date().toLocaleString('th-TH')}`
                }),
                headers: { "Content-Type": "application/json" }
            });

            const [res] = await Promise.all([saveCurrentProm, saveHistoryProm]);
            setIsDirty(false);
            if (res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ',
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true,
                    willClose: () => {
                        window.location.reload();
                    }
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                });
            }

        } catch (err) {
            console.error("Save failed:", err);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setIsSaving(false);
        }
    }, [isDirty, documentId, elements]);

    const handleClone = useCallback(async () => {
        setIsCloning(true);
        try {
            const res = await fetch(`/api/documents/${documentId}/clone`, {
                method: "POST"
            });
            const data = await res.json();

            if (data.success && data.newId) {
                Swal.fire({
                    icon: 'success',
                    title: 'โคลนเอกสารสำเร็จ',
                    text: 'กำลังเปิดหน้าไหม่ใน Tab ใหม่...',
                    showConfirmButton: false,
                    timer: 1500
                });
                window.open(`/editor/${data.newId}`, '_blank');
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: 'ไม่สามารถโคลนข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                });
            }
        } catch (err) {
            console.error("Clone failed:", err);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถโคลนข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setIsCloning(false);
        }
    }, [documentId]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const key = e.key.toLowerCase();

            // Delete / Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedElementId) {
                    handleDeleteElement(selectedElementId);
                }
            }

            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && key === 'c') {
                if (selectedElementId) {
                    const el = elements.find(e => e.id === selectedElementId);
                    if (el) {
                        clipboard.current = el;
                        console.log('Copied:', el);
                    }
                }
            }

            // Paste (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && key === 'v') {
                if (clipboard.current) {
                    const newId = uuidv4();
                    const offset = 20;
                    const newElement: CanvasElement = {
                        ...clipboard.current,
                        id: newId,
                        x: clipboard.current.x + offset,
                        y: clipboard.current.y + offset,
                    };
                    setElements((prev) => [...prev, newElement]);
                    setSelectedElementId(newId);
                    setEditingElementId(null);
                    setIsDirty(true);
                }
            }

            // Fit to Screen (F)
            if (key === 'f') {
                handleFitToScreen();
            }

            // Toggle Full Screen (M)
            if (key === 'm') {
                handleToggleFullScreen();
            }

            // Toggle Grid (G)
            if (key === 'g') {
                handleToggleGrid();
            }

            // Zoom In (+ or =)
            if (e.key === '+' || e.key === '=') {
                handleZoomIn();
            }

            // Zoom Out (-)
            if (e.key === '-' || e.key === '_') {
                handleZoomOut();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        selectedElementId,
        elements,
        handleFitToScreen,
        handleToggleFullScreen,
        handleDeleteElement,
        handleToggleGrid,
        handleZoomIn,
        handleZoomOut
    ]);

    // Click outside to deselect
    const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
        // Only deselect if clicking directly on the background container
        if (e.target === e.currentTarget) {
            setSelectedElementId(null);
            setEditingElementId(null);
        }
    }, []);

    const isPdf = fileType?.toLowerCase().includes('pdf');

    useEffect(() => {
        const loadPdf = async () => {
            if (!isPdf) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const loadingTask = pdfjsLib.getDocument(fileUrl);
                const pdf = await loadingTask.promise;
                setPdfDocument(pdf);
            } catch (err) {
                console.error("Error loading PDF:", err);
                setError("Failed to load PDF document.");
            } finally {
                setIsLoading(false);
            }
        };

        if (fileUrl) {
            loadPdf();
        }
    }, [fileUrl, isPdf]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error || (isPdf && !pdfDocument)) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                {error || "Document not found/loading failed"}
            </div>
        );
    }



    return (
        <div className="relative flex flex-col bg-slate-100 h-screen overflow-hidden">
            <Toolbox
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                zoomLevel={scale}
                showGrid={showGrid}
                onToggleGrid={handleToggleGrid}
                onDragStart={() => { }}
                onFitToScreen={handleFitToScreen}
                onScrollToTop={handleScrollToTop}
                onToggleFullScreen={handleToggleFullScreen}
                isFullScreen={isFullScreen}
                isFitted={isFitted}
            />

            {/* Premium Header Bar */}
            <div className={cn(
                "fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center bg-white/80 backdrop-blur-md px-1.5 py-1.5 rounded-2xl shadow-2xl border border-white/20 ring-1 ring-black/5 gap-1 transition-all duration-500",
                isFullScreen ? "-translate-y-32 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
            )}>
                {/* Navigation Group */}
                <div className="flex items-center gap-1">
                    <Link
                        href="/"
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all active:scale-95 flex items-center gap-2 group"
                        title="กลับหน้าแรก"
                    >
                        <Home className="w-5 h-5" />
                    </Link>
                </div>

                <div className="w-[1px] h-6 bg-slate-200 mx-1" />

                {/* Document Status */}
                <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    <div className={cn(
                        "w-2 h-2 rounded-full shadow-sm transition-all duration-500",
                        isDirty ? "bg-orange-500 animate-pulse scale-110" : "bg-emerald-500"
                    )} />
                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-500 whitespace-nowrap">
                        {isDirty ? "มีการเปลี่ยนแปลง" : "บันทึกแล้ว"}
                    </span>
                </div>

                <div className="w-[1px] h-6 bg-slate-200 mx-1" />

                {/* Main Actions */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleClone}
                        disabled={isCloning}
                        className="group relative p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                        title="โคลนเป็นเอกสารชุดใหม่"
                    >
                        {isCloning ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Copy className="w-5 h-5" />
                        )}
                        <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none font-bold shadow-xl border border-slate-700">
                            Clone Template
                        </span>
                    </button>

                    <button
                        onClick={() => setIsHistoryOpen(prev => !prev)}
                        className={cn(
                            "p-2 rounded-xl transition-all active:scale-95 group",
                            isHistoryOpen
                                ? "bg-indigo-100 text-indigo-600 shadow-inner"
                                : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        )}
                        title="ประวัติการแก้ไข"
                    >
                        <HistoryIcon className="w-5 h-5" />
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        className={cn(
                            "px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-tight transition-all flex items-center gap-2 active:scale-95",
                            isDirty
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 ring-1 ring-indigo-500"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        <span>{isSaving ? "บันทึก..." : "บันทึก"}</span>
                    </button>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 overflow-auto bg-slate-100/50 editor-scroll-container scroll-smooth pt-20" onClick={handleBackgroundClick}>
                <div
                    className="min-h-full w-full flex flex-col items-center transition-all duration-200"
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center',
                        width: `${100 / scale}%`,
                        paddingBottom: '100px'
                    }}
                >
                    <div className="flex flex-col items-center gap-8">
                        {isPdf && pdfDocument ? (
                            Array.from({ length: pdfDocument.numPages }, (_, index) => (
                                <PDFPage
                                    key={index + 1}
                                    pageNumber={index + 1}
                                    pdfDocument={pdfDocument}
                                    scale={scale} // We'll adjust PDFPage later to handle this if needed
                                    showGrid={showGrid}
                                    elements={elements.filter((el) => el.pageNumber === index + 1)}
                                    selectedElementId={selectedElementId}
                                    onAddElement={(type: ElementType, x: number, y: number) => handleAddElement(index + 1, type, x, y)}
                                    onUpdateElement={handleUpdateElement}
                                    onSelectElement={setSelectedElementId}
                                    onEditElement={(id: string | number) => {
                                        setEditingElementId(id);
                                        setSelectedElementId(id);
                                    }}
                                    onDeleteElement={handleDeleteElement}
                                />
                            ))
                        ) : !isPdf ? (
                            // Image / Other Rendering
                            <div
                                className="relative shadow-lg bg-white transition-all duration-200 ease-in-out"
                                style={{
                                    width: '800px',
                                    height: `${(imageDimensions.height / imageDimensions.width) * 800}px`,
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const type = e.dataTransfer.getData("elementType") as ElementType;
                                    if (type) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = (e.clientX - rect.left) / scale;
                                        const y = (e.clientY - rect.top) / scale;
                                        handleAddElement(1, type, x, y);
                                    }
                                }}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                {/* Background Image */}
                                <img
                                    src={fileUrl}
                                    alt="Document"
                                    onLoad={(e) => {
                                        const img = e.currentTarget;
                                        if (img.naturalWidth && img.naturalHeight) {
                                            setImageDimensions({
                                                width: img.naturalWidth,
                                                height: img.naturalHeight
                                            });
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                                />

                                {/* Grid Layer */}
                                {/* {showGrid && (
                                    <div className="absolute inset-0 pointer-events-none opacity-20 z-10"
                                        style={{ backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`, backgroundSize: `${20}px ${20}px` }}>
                                    </div>
                                )} */}
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


                                {/* Elements Layer */}
                                <div className="absolute inset-0 w-full h-full overflow-hidden">
                                    {elements.map((el) => (
                                        <ElementRenderer
                                            key={el.id}
                                            element={el}
                                            scale={scale}
                                            isSelected={selectedElementId === el.id}
                                            onUpdate={handleUpdateElement}
                                            onSelect={setSelectedElementId}
                                            onEdit={(id: string | number) => {
                                                setEditingElementId(id);
                                                setSelectedElementId(id);
                                            }}
                                            onDelete={handleDeleteElement}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {
                editingElementId && (
                    <EditModal
                        isOpen={!!editingElementId}
                        element={elements.find(el => el.id === editingElementId)!}
                        onClose={() => setEditingElementId(null)}
                        onSave={handleUpdateElement}
                        onChange={handleUpdateElement}
                        onDelete={handleDeleteElement}
                    />
                )
            }

            <HistorySidebar
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                documentId={documentId}
                onPreviewVersion={(previewElements, versionNumber) => {
                    if (versionNumber === 0) {
                        // Restore from backup
                        if (elementsBackup) {
                            setElements(elementsBackup);
                            setElementsBackup(null);
                            setIsDirty(false);
                            Swal.fire({
                                icon: 'info',
                                title: 'ยกเลิกการแสดงตัวอย่าง',
                                text: 'กลับไปที่เวอร์ชันปัจจุบัน',
                                showConfirmButton: false,
                                timer: 1000
                            });
                        }
                        return;
                    }

                    // Store backup if not already previewing
                    if (!elementsBackup) {
                        setElementsBackup([...elements]);
                    }

                    const normalized = normalizeElements(previewElements);
                    setElements(normalized);
                    setIsDirty(true);

                    Swal.fire({
                        icon: 'info',
                        title: `กำลังแสดงตัวอย่าง V.${versionNumber}`,
                        text: 'กดปุ่ม "บันทึก" มุมขวาบนหากต้องการย้อนกลับไปใช้เวอร์ชันนี้',
                        showConfirmButton: false,
                        timer: 2500,
                        timerProgressBar: true
                    });
                }}
            />

        </div >
    );
}
