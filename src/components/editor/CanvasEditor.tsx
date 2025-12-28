"use client";

import { useEffect, useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist";
import { PDFPage } from "./PDFPage";
import { CanvasElement } from "@/types/canvas";
import {
    Plus,
    Save,
    Loader2,
    Home,
    ChevronLeft
} from "lucide-react";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { Toolbox } from "./Toolbox";
import { EditModal } from "./EditModal";
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
    const [error, setError] = useState<string | null>(null);

    const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 3.0));
    const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5));
    const handleToggleGrid = () => setShowGrid(!showGrid);

    const handleAddElement = (pageNumber: number, type: ElementType, x: number, y: number) => {
        const newElement: CanvasElement = {
            id: uuidv4(),
            type,
            x,
            y,
            width: 150,
            height: 50,
            pageNumber,
        };
        setElements((prev) => [...prev, newElement]);
        setSelectedElementId(newElement.id);
        setIsDirty(true);
    };

    const handleUpdateElement = (id: string | number, updates: Partial<CanvasElement>) => {
        setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
        setIsDirty(true);
    };

    const handleDeleteElement = (id: string | number) => {
        if (!confirm("คุณต้องการลบองค์ประกอบนี้ใช่หรือไม่?")) return;
        setElements((prev) => prev.filter((el) => el.id !== id));
        if (selectedElementId === id) setSelectedElementId(null);
        if (editingElementId === id) setEditingElementId(null);
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (!isDirty) return;
        setIsSaving(true);
        try {
            await fetch(`/api/documents/${documentId}`, {
                method: "PUT",
                body: JSON.stringify({ elements }),
                headers: { "Content-Type": "application/json" }
            });
            setIsDirty(false);
        } catch (err) {
            console.error("Save failed:", err);
            alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        const loadPdf = async () => {
            if (fileType !== 'pdf') {
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
    }, [fileUrl, fileType]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error || (fileType === 'pdf' && !pdfDocument)) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                {error || "Document not found/loading failed"}
            </div>
        );
    }

    return (
        <div className="relative flex flex-col items-center gap-8 py-8 bg-slate-100 h-screen overflow-y-auto overflow-x-hidden pt-20">
            <Toolbox
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                zoomLevel={scale}
                showGrid={showGrid}
                onToggleGrid={handleToggleGrid}
                onDragStart={() => { }}
            />

            {/* Header Actions */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white/90 backdrop-blur p-2 rounded-2xl shadow-xl border border-slate-200">
                <Link
                    href="/"
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors flex items-center gap-2 group border-r border-slate-200 pr-4"
                    title="กลับหน้าแรก"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    <Home className="w-4 h-4" />
                    <span className="text-xs font-bold">กลับหน้าแรก</span>
                </Link>
                <div className="flex items-center gap-2 px-2 border-r border-slate-200">
                    <div className={cn("w-2 h-2 rounded-full", isDirty ? "bg-orange-500 animate-pulse" : "bg-green-500")} />
                    <span className="text-xs font-bold text-slate-600">
                        {isDirty ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" : "บันทึกข้อมูลแล้ว"}
                    </span>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className={cn(
                        "px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                        isDirty
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            บันทึกการแก้ไข
                        </>
                    )}
                </button>
            </div>

            {/* Content Rendering */}
            {fileType === 'pdf' && pdfDocument ? (
                Array.from({ length: pdfDocument.numPages }, (_, index) => (
                    <PDFPage
                        key={index + 1}
                        pageNumber={index + 1}
                        pdfDocument={pdfDocument}
                        scale={scale}
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
            ) : fileType !== 'pdf' ? (
                // Image / Other Rendering
                <div
                    className="relative shadow-lg bg-white transition-all duration-200 ease-in-out mb-8"
                    style={{
                        width: '800px', // Default width, maybe adjust or make responsive to image?
                        minHeight: '1100px', // Default height
                        transform: `scale(${scale})`, // Use scale here if not passing down
                        transformOrigin: 'top center'
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
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        onLoad={(e) => {
                            // Optional: adjust dimensions to match image natural size?
                            // For now, object-contain in fixed frame or just let it fill
                        }}
                    />

                    {/* Grid Layer */}
                    {showGrid && (
                        <div className="absolute inset-0 pointer-events-none opacity-20 z-10"
                            style={{ backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`, backgroundSize: `${20}px ${20}px` }}> {/* Fixed 20px grid since we scale container */}
                        </div>
                    )}

                    {/* Elements Layer */}
                    <div className="absolute inset-0">
                        {elements.map((el) => (
                            <ElementRenderer
                                key={el.id}
                                element={el}
                                scale={1} // Scale handled by parent transform
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

            {editingElementId && (
                <EditModal
                    isOpen={!!editingElementId}
                    element={elements.find(el => el.id === editingElementId)!}
                    onClose={() => setEditingElementId(null)}
                    onSave={handleUpdateElement}
                    onChange={handleUpdateElement}
                    onDelete={handleDeleteElement}
                />
            )}

        </div>
    );
}
