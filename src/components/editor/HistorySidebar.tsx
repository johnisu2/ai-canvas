import { useEffect, useState } from "react";
import { Clock, RotateCcw, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Swal from "sweetalert2";

interface Version {
    id: number;
    versionNumber: number;
    createdAt: string;
    changeLog: string | null;
}

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    documentId: number | string;
    onPreviewVersion: (elements: any[], versionNumber: number) => void;
}

export function HistorySidebar({ isOpen, onClose, documentId, onPreviewVersion }: HistorySidebarProps) {
    const [versions, setVersions] = useState<Version[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeVersionId, setActiveVersionId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && documentId) {
            fetchVersions();
        }
    }, [isOpen, documentId]);

    const fetchVersions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/documents/${documentId}/versions`);
            if (res.ok) {
                const data = await res.json();
                setVersions(data);
            }
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePreview = async (version: Version) => {
        try {
            const res = await fetch(`/api/documents/${documentId}/versions/${version.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.elements) {
                    onPreviewVersion(data.elements, version.versionNumber);
                    setActiveVersionId(version.id);
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'โหลดข้อมูลไม่สำเร็จ',
                    text: 'ไฟล์เวอร์ชันนี้อาจเสียหายหรือถูกลบ'
                });
            }
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl border-l border-slate-200 z-[40] flex flex-col font-sans">
            {/* Header */}
            <div className="p-5 border-b flex items-center justify-between bg-white">
                <div className="flex items-center gap-3 font-bold text-slate-800 text-lg">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Clock className="w-5 h-5 text-indigo-600" />
                    </div>
                    ประวัติการแก้ไข
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="text-sm font-medium">กำลังโหลดข้อมูล...</span>
                    </div>
                ) : versions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 bg-slate-50 rounded-2xl border-2 border-slate-100 border-dashed m-2">
                        <div className="p-3 bg-white rounded-full shadow-sm">
                            <Clock className="w-6 h-6 text-slate-300" />
                        </div>
                        <span className="text-sm">ยังไม่มีประวัติการบันทึก</span>
                    </div>
                ) : (
                    <div className="px-1">
                        {versions.map((ver, index) => {
                            const isActive = activeVersionId === ver.id;
                            const isLast = index === versions.length - 1;

                            return (
                                <div
                                    key={ver.id}
                                    className="relative pl-8 pb-2 group"
                                >
                                    {/* Timeline Line */}
                                    {versions.length > 1 && (
                                        <div className={cn(
                                            "absolute left-[-0.5px] w-[2.5px] bg-slate-100 transition-colors duration-300 group-hover:bg-indigo-50",
                                            index === 0 ? "top-6 bottom-0" :
                                                isLast ? "top-0 h-6" :
                                                    "top-0 bottom-0"
                                        )} />
                                    )}

                                    {/* Timeline Dot */}
                                    <div className={cn(
                                        "absolute -left-[5px] top-6 w-[11px] h-[11px] rounded-full border-2 transition-all duration-300 z-10 box-border bg-white",
                                        isActive
                                            ? "bg-indigo-600 border-indigo-600 shadow-[0_0_0_4px_rgba(99,102,241,0.2)] scale-125"
                                            : "border-slate-300 group-hover:border-indigo-400 group-hover:scale-110"
                                    )} />

                                    {/* Card */}
                                    <div
                                        onClick={() => handlePreview(ver)}
                                        className={cn(
                                            "relative rounded-2xl p-4 cursor-pointer transition-all duration-300 border",
                                            isActive
                                                ? "bg-indigo-50/80 border-indigo-200 shadow-lg ring-1 ring-indigo-200"
                                                : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1"
                                        )}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm",
                                                    isActive
                                                        ? "bg-indigo-600 text-white"
                                                        : "bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors"
                                                )}>
                                                    V.{ver.versionNumber}
                                                </span>
                                                {index === 0 && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold border border-emerald-200">
                                                        Latest
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-full border border-slate-100/50">
                                                {new Date(ver.createdAt).toLocaleString('th-TH', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>

                                        <div className="text-sm text-slate-700 font-medium leading-relaxed mb-4">
                                            {ver.changeLog || "ไม่มีรายละเอียดการแก้ไข"}
                                        </div>

                                        {/* Meta Ref */}
                                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                isActive ? "bg-indigo-400" : "bg-slate-300"
                                            )} />
                                            <span className="text-[11px] text-slate-500 font-medium">
                                                บันทึกเมื่อ {new Date(ver.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </span>
                                        </div>

                                        {isActive && (
                                            <div className="mt-4 flex items-center justify-center relative bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-md overflow-hidden group/btn">
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                                                <div className="relative flex items-center gap-2">
                                                    <div className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-tight">กำลังแสดงตัวอย่าง</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 bg-amber-50 border-t border-amber-100 text-sm text-amber-800 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="p-1 bg-amber-100 rounded-full h-fit shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="leading-relaxed">
                    คลิกเลือกเวอร์ชันเพื่อดูตัวอย่าง (Preview) <br />
                    หากพอใจ ให้กดปุ่ม <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200">บันทึก</span>
                </div>
            </div>
        </div>
    );
}
