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
    MousePointer2,
    Maximize,
    ArrowUp,
    Monitor,
    MonitorOff
} from "lucide-react";

interface ToolboxProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    zoomLevel: number;
    showGrid: boolean;
    onToggleGrid: () => void;
    onDragStart: (type: ElementType) => void;
    onFitToScreen: () => void;
    onScrollToTop: () => void;
    onToggleFullScreen: () => void;
    isFullScreen: boolean;
    isFitted: boolean;
}

export function Toolbox({
    onZoomIn,
    onZoomOut,
    zoomLevel,
    showGrid,
    onToggleGrid,
    onDragStart,
    onFitToScreen,
    onScrollToTop,
    onToggleFullScreen,
    isFullScreen,
    isFitted
}: ToolboxProps) {

    const tools = [
        { type: "text" as const, icon: Type, label: "ข้อความ", color: "bg-blue-500", text: "text-blue-500" },
        { type: "qr" as const, icon: QrCode, label: "คิวอาร์โค้ด", color: "bg-purple-500", text: "text-purple-500" },
        { type: "image" as const, icon: ImageIcon, label: "รูปภาพ", color: "bg-green-500", text: "text-green-500" },
        { type: "table" as const, icon: TableIcon, label: "ตาราง", color: "bg-orange-500", text: "text-orange-500" },
        { type: "signature" as const, icon: PenTool, label: "ลายเซ็น", color: "bg-pink-500", text: "text-pink-500" },
    ];

    return (
        <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[70] flex flex-col gap-4">

            {/* Combined Toolbox */}
            <div className="bg-white/70 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-[28px] p-2 flex flex-col gap-2 ring-1 ring-black/5">
                {/* Insert Group */}
                <div className="flex flex-col gap-2">
                    <div className="p-2 text-[10px] font-black uppercase tracking-tighter text-slate-400 text-center">
                        Insert
                    </div>
                    {tools.map((tool) => (
                        <div
                            key={tool.type}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData("elementType", tool.type);
                                onDragStart(tool.type);
                            }}
                            className="group relative flex items-center justify-center p-3 rounded-2xl hover:bg-slate-100 transition-all cursor-grab active:cursor-grabbing"
                        >
                            <div className={cn(
                                "absolute inset-0 opacity-10 rounded-2xl transition-colors",
                                tool.color
                            )} />
                            <tool.icon className={cn("w-5 h-5", tool.text)} />

                            {/* Tooltip (Point Left) */}
                            <span className="absolute left-full mr-4 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none z-10 font-bold whitespace-nowrap translate-x-4 group-hover:translate-x-0">
                                {tool.label}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="h-px bg-slate-100 mx-2 my-1" />

                {/* Controls Group */}
                <div className="flex flex-col gap-2 items-center">
                    <div className="p-2 text-[10px] font-black uppercase tracking-tighter text-slate-400 text-center">
                        Tools
                    </div>

                    <button
                        onClick={onToggleGrid}
                        className={cn(
                            "p-3 rounded-2xl transition-all group relative active:scale-95",
                            showGrid ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:bg-slate-100"
                        )}
                    >
                        <Grid className="w-5 h-5" />
                        <span className="absolute left-full mr-4 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none z-10 font-bold whitespace-nowrap translate-x-4 group-hover:translate-x-0">
                            {showGrid ? "ปิดเส้นตาราง (G)" : "เปิดเส้นตาราง (G)"}
                        </span>
                    </button>

                    <div className="flex flex-col items-center gap-1 py-1">
                        <button onClick={onZoomIn} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all active:scale-95 group relative">
                            <ZoomIn className="w-5 h-5" />
                            <span className="absolute left-full mr-4 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none z-10 font-bold whitespace-nowrap translate-x-4 group-hover:translate-x-0">
                                ขยาย (+)
                            </span>
                        </button>

                        <div className="px-2 py-1 bg-slate-50 rounded-lg">
                            <div className="text-[10px] font-black text-indigo-600">
                                {Math.round(zoomLevel * 100)}%
                            </div>
                        </div>

                        <button onClick={onZoomOut} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all active:scale-95 group relative">
                            <ZoomOut className="w-5 h-5" />
                            <span className="absolute left-full mr-4 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none z-10 font-bold whitespace-nowrap translate-x-4 group-hover:translate-x-0">
                                ย่อ (-)
                            </span>
                        </button>
                    </div>

                    <button
                        onClick={onFitToScreen}
                        className={cn(
                            "p-3 rounded-2xl transition-all group relative active:scale-95",
                            isFitted ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-indigo-50 text-indigo-500"
                        )}
                    >
                        <Maximize
                            className={cn(
                                "w-5 h-5 transition-colors",
                                isFitted ? "text-white" : "text-slate-500"
                            )}
                        />
                        <span className="absolute left-full mr-4 px-3 py-2 bg-indigo-600 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none z-[70] font-bold whitespace-nowrap translate-x-4 group-hover:translate-x-0">
                            พอดีหน้าจอ (F)
                        </span>
                    </button>

                    <button
                        onClick={onToggleFullScreen}
                        className={cn(
                            "p-3 rounded-2xl transition-all active:scale-95 group relative",
                            isFullScreen ? "bg-slate-800 text-white" : "hover:bg-slate-100 text-slate-500"
                        )}
                    >
                        {isFullScreen ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                        <span className="absolute left-full mr-4 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none z-10 font-bold whitespace-nowrap translate-x-4 group-hover:translate-x-0">
                            {isFullScreen ? "ออกจากโหมดเต็มหน้าจอ" : "โหมดเต็มหน้าจอ (M)"}
                        </span>
                    </button>

                    <button onClick={onScrollToTop} className="p-3 rounded-2xl hover:bg-slate-100 text-slate-500 transition-all active:scale-95 group relative">
                        <ArrowUp className="w-5 h-5" />
                        <span className="absolute left-full mr-4 px-3 py-2 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl pointer-events-none z-10 font-bold whitespace-nowrap translate-x-4 group-hover:translate-x-0">
                            กลับขึ้นบนสุด
                        </span>
                    </button>
                </div>
            </div>

        </div>
    );
}
