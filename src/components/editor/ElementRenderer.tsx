"use client";

import { Rnd } from "react-rnd";
import { CanvasElement, ElementType } from "@/types/canvas";
import { cn } from "@/lib/utils";
import { useState, useRef, memo } from "react";
import {
    Edit2,
    Trash2,
    RotateCw,
    QrCode,
    Image as ImageIcon,
    PenTool,
    Grid
} from "lucide-react";

interface ElementRendererProps {
    element: CanvasElement;
    scale: number;
    isSelected: boolean;
    onUpdate: (id: string | number, updates: Partial<CanvasElement>) => void;
    onSelect: (id: string | number) => void;
    onEdit: (id: string | number) => void;
    onDelete: (id: string | number) => void;
}

const colorMap: Record<ElementType, string> = {
    text: "border-blue-500 bg-blue-500/10 text-blue-600",
    qr: "border-purple-500 bg-purple-500/10 text-purple-600",
    image: "border-green-500 bg-green-500/10 text-green-600",
    table: "border-orange-500 bg-orange-500/10 text-orange-600",
    signature: "border-pink-500 bg-pink-500/10 text-pink-600",
};

export const ElementRenderer = memo(function ElementRenderer({ element, scale, isSelected, onUpdate, onSelect, onEdit, onDelete }: ElementRendererProps) {
    const elementRef = useRef<HTMLDivElement>(null);
    const [isRotating, setIsRotating] = useState(false);

    const onRotateStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const rect = elementRef.current?.getBoundingClientRect();
        if (!rect) return;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const startMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        const startElementRotation = element.rotation || 0;

        setIsRotating(true);

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentMouseAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
            let newRotation = startElementRotation + (currentMouseAngle - startMouseAngle);
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
            className={cn("group z-[50]", isSelected ? "z-[60]" : "")}
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
            <div
                className="w-full h-full relative"
                style={{
                    transform: `rotate(${element.rotation || 0}deg)`,
                    transition: isRotating ? 'none' : 'transform 0.15s ease-out'
                }}
            >
                {isSelected && (
                    <>
                        {/* Control Handles */}
                        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] shadow-sm" />
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] shadow-sm" />
                        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] shadow-sm" />
                        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border border-indigo-500 z-[100] shadow-sm" />

                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full flex flex-col-reverse items-center z-[110]">
                            <div className="w-0.5 h-10 bg-indigo-500" />
                            <div
                                className="w-9 h-9 bg-white border-2 border-indigo-500 rounded-full flex items-center justify-center cursor-alias shadow-lg hover:scale-110 transition-transform pointer-events-auto active:scale-125"
                                onMouseDown={onRotateStart}
                            >
                                <RotateCw className="w-4 h-4 text-indigo-600" />
                            </div>
                        </div>

                        <div
                            className="absolute -bottom-16 left-1/2 flex items-center bg-white/95 backdrop-blur-sm shadow-2xl border border-slate-200 rounded-2xl px-1 py-1 gap-1 transition-all z-[120]"
                            style={{ transform: `translateX(-50%) rotate(${-(element.rotation || 0)}deg)` }}
                        >
                            <button onClick={(e) => { e.stopPropagation(); onEdit(element.id); }} className="px-3 py-1.5 hover:bg-indigo-50 rounded-xl text-indigo-600 text-[11px] font-bold flex items-center gap-1.5"><Edit2 className="w-3" /> แก้ไข</button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(element.id); }} className="px-3 py-1.5 hover:bg-red-50 rounded-xl text-red-500 text-[11px] font-bold flex items-center gap-1.5"><Trash2 className="w-3" /> ลบ</button>
                        </div>
                    </>
                )}

                <div
                    ref={elementRef}
                    className={cn(
                        "w-full h-full relative flex flex-col transition-all overflow-hidden border-2",
                        isSelected ? "border-indigo-500 shadow-2xl bg-white/50" : cn(colorMap[element.type] || "border-slate-300")
                    )}
                >
                    <div className="flex-1 w-full h-full relative drag-handle cursor-move">
                        <div className={cn("select-none h-full w-full flex flex-col pointer-events-none")}>
                            {element.type === 'image' && element.fieldValue && (
                                <img src={element.fieldValue} className="w-full h-full object-contain" alt="" />
                            )}
                            {element.type === 'signature' && element.fieldValue && (
                                <img src={element.fieldValue} className="w-full h-full object-contain" alt="" />
                            )}
                            {element.type === 'qr' && (
                                <div className="w-full h-full flex items-center justify-center p-1">
                                    {(element.fieldValue?.startsWith('data:image') || element.fieldValue?.startsWith('/'))
                                        ? <img src={element.fieldValue} className="w-full h-full object-contain" alt="" />
                                        : <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(element.fieldValue || '')}`} className="w-full h-full object-contain" alt="" />
                                    }
                                </div>
                            )}

                            {element.type === 'table' && (
                                <div className="w-full h-full flex flex-col bg-white/50 relative bg-opacity-50">
                                    {(() => {
                                        const metadata = element.metadata || {};
                                        const columns = Array.isArray(metadata) ? metadata : (metadata.columns || []);
                                        const rowHeight = Array.isArray(metadata) ? 22 : (metadata.rowHeight || 22);

                                        if (columns.length === 0) return <div className="flex-1 flex items-center justify-center opacity-30"><Grid /> Empty Table</div>;

                                        let cur = 0;
                                        const positions = columns.map((c: any) => cur += (parseFloat(c.width) || (100 / columns.length))).slice(0, -1);

                                        return (
                                            <>
                                                {/* Grid Lines */}
                                                {positions.map((pos: any, i: number) => (
                                                    <div key={`g-${i}`} className="absolute inset-y-0 w-px bg-slate-300 opacity-80 pointer-events-none" style={{ left: `${pos}%`, transform: 'translateX(-0.5px)' }} />
                                                ))}

                                                {/* Resizers */}
                                                {isSelected && positions.map((pos: any, i: number) => (
                                                    <div
                                                        key={`r-${i}`}
                                                        className="absolute inset-y-0 w-8 -ml-4 cursor-col-resize hover:bg-indigo-500/5 pointer-events-auto z-[80] group/r"
                                                        style={{ left: `${pos}%` }}
                                                        onMouseDown={(e: React.MouseEvent) => {
                                                            e.stopPropagation();
                                                            const startX = e.clientX;
                                                            const container = e.currentTarget.closest('.drag-handle');
                                                            if (!container) return;
                                                            const rect = container.getBoundingClientRect();
                                                            const widths = columns.map((c: any) => parseFloat(c.width) || (100 / columns.length));

                                                            const move = (ev: MouseEvent) => {
                                                                const delta = ((ev.clientX - startX) / rect.width) * 100;
                                                                const nI = Math.max(5, widths[i] + delta);
                                                                const nNX = Math.max(5, widths[i + 1] - delta);
                                                                if (nI >= 5 && nNX >= 5) {
                                                                    const newC = [...columns];
                                                                    newC[i] = { ...newC[i], width: `${nI}%` };
                                                                    newC[i + 1] = { ...newC[i + 1], width: `${nNX}%` };

                                                                    const nextMetadata = Array.isArray(metadata) ? newC : { ...metadata, columns: newC };
                                                                    onUpdate(element.id, { metadata: nextMetadata });
                                                                }
                                                            };
                                                            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
                                                            document.addEventListener('mousemove', move);
                                                            document.addEventListener('mouseup', up);
                                                        }}
                                                    >
                                                        <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-transparent group-hover/r:bg-indigo-500 transition-colors" />
                                                    </div>
                                                ))}

                                                {/* Data Row */}
                                                <div className="absolute inset-0 flex flex-col overflow-hidden pointer-events-none">
                                                    {(() => {
                                                        const numRows = Math.floor(element.height / rowHeight) || 1;
                                                        const rowArr = Array.from({ length: numRows }, (_, i) => i + 1);
                                                        return rowArr.map((row: number, idx: number) => (
                                                            <div key={row} style={{ height: `${rowHeight}px` }} className="relative flex shrink-0">
                                                                {/* horizontal line */}
                                                                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-slate-400/80 z-[60]" />

                                                                {columns.map((col: any, j: number) => (
                                                                    <div
                                                                        key={j}
                                                                        style={{ width: col.width || `${100 / columns.length}%` }}
                                                                        className="flex items-center px-2 truncate leading-none"
                                                                    >
                                                                        {row === 1
                                                                            ? <span className="text-[9px] font-bold text-indigo-500 uppercase">{col.field || "FIELD"}</span>
                                                                            : <span className="text-[8px] text-slate-300 italic">data...</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            {element.type === 'text' && (
                                <div className={cn("flex-1 flex items-center px-2 pointer-events-none", element.alignment === 'center' && "justify-center text-center", element.alignment === 'right' && "justify-end text-right")}>
                                    <span className="truncate w-full font-semibold text-slate-800" style={{ fontSize: element.fontSize ? `${element.fontSize}px` : '14px' }}>
                                        {element.script
                                            ? <span className="text-purple-600 flex items-center gap-1">{"{}"} Script</span>
                                            : element.formula
                                                ? <span className="text-indigo-600 flex items-center gap-1">{"="} Formula</span>
                                                : (element.label || element.fieldName || "เพิ่มข้อความ...")
                                        }
                                    </span>
                                </div>
                            )}

                            {((element.type === 'image' || element.type === 'signature') && !element.fieldValue) && (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50"><ImageIcon className="w-8 h-8" /></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Rnd >
    );
});
