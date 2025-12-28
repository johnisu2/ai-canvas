"use client";

import { useState } from "react";
import { FileDown, Loader2, ChevronRight, ChevronLeft, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenerationPanelProps {
    documentId: string;
}

export function GenerationPanel({ documentId }: GenerationPanelProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [jsonInput, setJsonInput] = useState(JSON.stringify({
        "first_name": "สมชาย",
        "image": "/uploads/mock_patient.png",
        "Table": [
            { "item": "ยาพาราเซลตามอล", "qty": 2, "price": 100 },
            { "item": "ยาแก้ไอ", "qty": 1, "price": 50 }
        ]
    }, null, 2));
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        try {
            setIsGenerating(true);
            const json = JSON.parse(jsonInput);

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId, json })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `generated_doc_${documentId}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                console.error("Failed");
                alert("Failed to generate PDF");
            }
        } catch (e) {
            console.error(e);
            alert("Invalid JSON or Error");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className={cn(
            "fixed right-0 top-0 bottom-0 bg-white shadow-xl z-40 transition-all duration-300 flex flex-col border-l",
            isOpen ? "w-80" : "w-12"
        )}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute -left-3 top-1/2 -translate-y-1/2 bg-white border border-slate-200 p-1 rounded-full shadow-md text-slate-500 hover:text-indigo-600"
            >
                {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Header */}
            <div className="p-4 border-b bg-slate-50 flex items-center gap-2 h-16">
                <Settings className="w-5 h-5 text-indigo-600" />
                {isOpen && <h2 className="font-semibold text-slate-800">Generation Config</h2>}
            </div>

            {/* Content */}
            {isOpen && (
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Template Selection Placeholder */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Template / Mapping</label>
                        <select className="w-full p-2 border rounded-lg bg-white text-sm">
                            <option>Default Mapping</option>
                            <option>Custom Template A</option>
                        </select>
                    </div>

                    {/* JSON Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Test Data (JSON)</label>
                        <textarea
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            className="w-full h-64 font-mono text-xs p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t bg-slate-50">
                {isOpen ? (
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium shadow flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        Generate PDF
                    </button>
                ) : (
                    <div className="flex justify-center">
                        <button onClick={() => setIsOpen(true)} className="p-2 text-indigo-600 hover:bg-slate-100 rounded">
                            <FileDown className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
