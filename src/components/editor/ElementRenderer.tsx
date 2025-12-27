"use client";

import { Rnd } from "react-rnd";
import { CanvasElement, ElementType } from "@/types/canvas";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import {
    Edit2,
    Trash2,
    RotateCw,
    QrCode,
    Image as ImageIcon,
    PenTool,
    Grid // Added
} from "lucide-react";

interface ElementRendererProps {
    element: CanvasElement;
    scale: number;
    isSelected: boolean;
    onUpdate: (id: string, updates: Partial<CanvasElement>) => void;
    onSelect: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

const colorMap: Record<ElementType, string> = {
    text: "border-blue-500 bg-blue-500/10 text-blue-600",
    qr: "border-purple-500 bg-purple-500/10 text-purple-600",
    image: "border-green-500 bg-green-500/10 text-green-600",
    table: "border-orange-500 bg-orange-500/10 text-orange-600",
    signature: "border-pink-500 bg-pink-500/10 text-pink-600",
};

export function ElementRenderer({ element, scale, isSelected, onUpdate, onSelect, onEdit, onDelete }: ElementRendererProps) {
    const elementRef = useRef<HTMLDivElement>(null);
    const [isRotating, setIsRotating] = useState(false);

    // Custom Rotation Logic (Word-like: Delta-based with Snapping)
    const onRotateStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const rect = elementRef.current?.getBoundingClientRect();
        if (!rect) return;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Capture initial state
        const startMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        const startElementRotation = element.rotation || 0;

        setIsRotating(true);

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentMouseAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);

            // Delta rotation
            let newRotation = startElementRotation + (currentMouseAngle - startMouseAngle);

            // Snapping (15 degrees)
            newRotation = Math.round(newRotation / 15) * 15;

            onUpdate(element.id, { rotation: newRotation });
        };

        const onMouseUp = () => {
            setIsRotating(false);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <Rnd
            size={{ width: element.width, height: element.height }}
            position={{ x: element.x, y: element.y }}
            onDragStop={(e, d) => onUpdate(element.id, { x: d.x, y: d.y })}
            onResizeStop={(e, direction, ref, delta, position) => {
                onUpdate(element.id, {
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                    x: position.x,
                    y: position.y,
                });
            }}
            scale={scale}
            bounds="parent"
            enableResizing={isSelected}
            disableDragging={!isSelected}
            dragHandleClassName="drag-handle"
            className={cn(
                "group z-[50]",
                isSelected ? "z-[60]" : ""
            )}
            style={{
                cursor: isSelected ? 'default' : 'pointer',
                display: 'flex',
                zIndex: isSelected ? 60 : 50
            }}
            onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onSelect(element.id);
            }}
        >
            {/* Inner Wrapper for Rotation - Avoids conflict with Rnd's transforms */}
            <div
                className="w-full h-full relative"
                style={{
                    transform: `rotate(${element.rotation || 0}deg)`,
                    transition: isRotating ? 'none' : 'transform 0.15s ease-out'
                }}
            >
                {/* Visual Handles & Controls */}
                {isSelected && (
                    <>
                        {/* Corners (White squares with blue borders - Word Style) */}
                        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />
                        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />
                        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />

                        {/* Mid-points */}
                        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />
                        <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] pointer-events-none shadow-sm" />

                        {/* Rotation Handle Line & Dot */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full flex flex-col-reverse items-center pointer-events-none z-[110]">
                            <div className="w-0.5 h-10 bg-indigo-500" />
                            <div
                                className="w-9 h-9 bg-white border-2 border-indigo-500 rounded-full flex items-center justify-center cursor-alias shadow-lg hover:scale-110 transition-transform pointer-events-auto active:scale-125 bg-gradient-to-b from-white to-slate-50"
                                onMouseDown={onRotateStart}
                            >
                                <RotateCw className="w-4 h-4 text-indigo-600" />
                            </div>
                        </div>

                        {/* Sub Toolbar - Counter-rotated to stay upright */}
                        <div
                            className={cn(
                                "absolute -bottom-16 left-1/2 flex items-center bg-white/95 backdrop-blur-sm shadow-2xl border border-slate-200 rounded-2xl px-1 py-1 gap-1 transition-all z-[120]",
                                isSelected ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                            )}
                            style={{
                                transform: `translateX(-50%) rotate(${-(element.rotation || 0)}deg)`,
                                transition: isRotating ? 'none' : 'transform 0.15s, opacity 0.2s'
                            }}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(element.id);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-50 rounded-xl text-indigo-600 transition-all text-[11px] font-bold group"
                            >
                                <Edit2 className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                                <span>แก้ไข</span>
                            </button>
                            <div className="w-px h-4 bg-slate-100" />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(element.id);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 rounded-xl text-red-500 transition-all text-[11px] font-bold group"
                            >
                                <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                <span>ลบ</span>
                            </button>
                        </div>
                    </>
                )}

                <div
                    ref={elementRef}
                    className={cn(
                        "w-full h-full relative flex flex-col transition-all overflow-hidden",
                        isSelected ? "ring-2 ring-indigo-500/50 shadow-2xl bg-white/50" : cn("border-2", colorMap[element.type] || "border-slate-300")
                    )}
                >
                    {/* Main Content Area */}
                    <div className="flex-1 w-full h-full relative drag-handle cursor-move">
                        <div className="pointer-events-none select-none h-full w-full flex flex-col p-1">
                            {/* Image Preview */}
                            {element.type === 'image' && element.fieldValue && (
                                <img src={element.fieldValue} className="w-full h-full object-contain pointer-events-none" alt="" />
                            )}

                            {/* Signature Preview */}
                            {element.type === 'signature' && element.fieldValue && (
                                <img src={element.fieldValue} className="w-full h-full object-contain pointer-events-none" alt="" />
                            )}

                            {/* QR Preview */}
                            {element.type === 'qr' && (
                                <div className="w-full h-full flex items-center justify-center rounded p-1">
                                    {element.fieldValue && element.fieldValue.startsWith('http')
                                        ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(element.fieldValue || '')}`} className="w-full h-full object-contain" alt="" />
                                        : <QrCode className="w-10 h-10 text-purple-400/50" />
                                    }
                                </div>
                            )}

                            {/* Table Grid Preview */}
                            {element.type === 'table' && (
                                <div className="w-full h-full flex flex-col border border-slate-200 bg-white relative">
                                    {(() => {
                                        const columns = Array.isArray(element.metadata) ? element.metadata : [];
                                        if (columns.length === 0) return (
                                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-1 opacity-50">
                                                <Grid className="w-8 h-8" />
                                                <span className="text-[10px] uppercase font-bold tracking-widest">ตารางว่าง</span>
                                            </div>
                                        );

                                        return (
                                            <div className="w-full h-full overflow-hidden relative">
                                                {/* Column Dividers (Resizers) */}
                                                {isSelected && columns.map((_: any, i: number) => {
                                                    if (i === columns.length - 1) return null;
                                                    let leftPos = 0;
                                                    for (let j = 0; j <= i; j++) {
                                                        const w = columns[j].width;
                                                        const val = parseFloat(w) || (100 / columns.length);
                                                        leftPos += val;
                                                    }

                                                    return (
                                                        <div
                                                            key={i}
                                                            className="absolute top-0 bottom-0 w-2 hover:bg-indigo-400/50 cursor-col-resize z-[70] pointer-events-auto -ml-1 transition-colors"
                                                            style={{ left: `${leftPos}%` }}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                const startX = e.clientX;
                                                                const initialWidths = columns.map((c: any) => parseFloat(c.width) || (100 / columns.length));

                                                                const onMouseMove = (moveEvent: MouseEvent) => {
                                                                    const deltaX = moveEvent.clientX - startX;
                                                                    const percentDelta = (deltaX / (element.width * scale)) * 100;
                                                                    const newCols = [...columns];
                                                                    newCols[i] = { ...columns[i], width: `${Math.max(5, initialWidths[i] + percentDelta)}%` };
                                                                    newCols[i + 1] = { ...columns[i + 1], width: `${Math.max(5, initialWidths[i + 1] - percentDelta)}%` };
                                                                    onUpdate(element.id, { metadata: newCols });
                                                                };

                                                                const onMouseUp = () => {
                                                                    document.removeEventListener("mousemove", onMouseMove);
                                                                    document.removeEventListener("mouseup", onMouseUp);
                                                                };

                                                                document.addEventListener("mousemove", onMouseMove);
                                                                document.addEventListener("mouseup", onMouseUp);
                                                            }}
                                                        >
                                                            <div className="mx-auto w-px h-full bg-slate-200 group-hover:bg-indigo-400" />
                                                        </div>
                                                    );
                                                })}

                                                <div className="flex-1 grid grid-cols-1 divide-y divide-slate-100 h-full">
                                                    {[1, 2, 3, 4, 5, 6, 7].map(row => (
                                                        <div key={row} className="flex h-full min-h-[1.5rem]">
                                                            {columns.map((col: any, j: number) => (
                                                                <div
                                                                    key={j}
                                                                    style={{ width: col.width || `${100 / columns.length}%` }}
                                                                    className="border-r border-slate-100 last:border-0 flex items-center px-1.5 truncate text-[9px] text-slate-500 font-medium"
                                                                >
                                                                    {row === 1 ? col.field : ""}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Text / Default Preview */}
                            {element.type === 'text' && (
                                <div className={cn(
                                    "flex-1 w-full flex items-center px-2 overflow-hidden",
                                    element.alignment === 'center' && "justify-center text-center",
                                    element.alignment === 'right' && "justify-end text-right",
                                )}>
                                    <span className="truncate w-full font-semibold text-slate-800" style={{ fontSize: element.fontSize ? `${element.fontSize}px` : '14px' }}>
                                        {element.label || element.fieldName || "เพิ่มข้อความ..."}
                                    </span>
                                </div>
                            )}

                            {/* Fallback for empty image/sign */}
                            {((element.type === 'image' || element.type === 'signature') && !element.fieldValue) && (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-1 opacity-50 p-2">
                                    {element.type === 'image' ? <ImageIcon className="w-8 h-8" /> : <PenTool className="w-8 h-8" />}
                                    <span className="text-[11px] uppercase font-bold tracking-[0.2em]">{element.type === 'image' ? 'เลือกรูปภาพ' : 'เซ็นชื่อ'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Rnd>
    );
}
