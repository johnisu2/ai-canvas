"use client";

import { cn } from "@/lib/utils";
import { ElementType } from "@/types/canvas";
import {
    Type,
    QrCode,
    Image as ImageIcon,
    Table as TableIcon,
    PenTool,
    Grid,
    ZoomIn,
    ZoomOut,
    MousePointer2
} from "lucide-react";

interface ToolboxProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    zoomLevel: number;
    showGrid: boolean;
    onToggleGrid: () => void;
    onDragStart: (type: ElementType) => void;
}

export function Toolbox({
    onZoomIn,
    onZoomOut,
    zoomLevel,
    showGrid,
    onToggleGrid,
    onDragStart
}: ToolboxProps) {

    const tools = [
        { type: "text" as const, icon: Type, label: "ข้อความ", color: "bg-blue-500", text: "text-blue-500" },
        { type: "qr" as const, icon: QrCode, label: "คิวอาร์โค้ด", color: "bg-purple-500", text: "text-purple-500" },
        { type: "image" as const, icon: ImageIcon, label: "รูปภาพ", color: "bg-green-500", text: "text-green-500" },
        { type: "table" as const, icon: TableIcon, label: "ตาราง", color: "bg-orange-500", text: "text-orange-500" },
        { type: "signature" as const, icon: PenTool, label: "ลายเซ็น", color: "bg-pink-500", text: "text-pink-500" },
    ];

    return (
        <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-6">

            {/* Draggable Tools */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-3 flex flex-col gap-3">
                {tools.map((tool) => (
                    <div
                        key={tool.type}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData("elementType", tool.type);
                            onDragStart(tool.type);
                        }}
                        className="group relative flex items-center justify-center p-3 rounded-xl hover:bg-slate-100 transition-all cursor-grab active:cursor-grabbing"
                        title={tool.label}
                    >
                        <div className={cn(
                            "absolute inset-0 opacity-20 rounded-xl transition-colors",
                            tool.color
                        )} />
                        <tool.icon className={cn("w-6 h-6", tool.text)} />

                        {/* Tooltip */}
                        <span className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {tool.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Editor Controls */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-3 flex flex-col gap-3">
                <button
                    onClick={onToggleGrid}
                    className={cn(
                        "p-3 rounded-xl transition-all hover:bg-slate-100",
                        showGrid ? "bg-indigo-50 text-indigo-600" : "text-slate-500"
                    )}
                    title="เปิด/ปิด เส้นตาราง"
                >
                    <Grid className="w-6 h-6" />
                </button>

                <div className="h-px bg-slate-200 mx-2" />

                <button onClick={onZoomIn} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 transition-all">
                    <ZoomIn className="w-6 h-6" />
                </button>
                <div className="text-center text-xs font-semibold text-slate-500">
                    {Math.round(zoomLevel * 100)}%
                </div>
                <button onClick={onZoomOut} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 transition-all">
                    <ZoomOut className="w-6 h-6" />
                </button>
            </div>

        </div>
    );
}
