"use client";

import { useState } from "react";
import { X, FileDown, Loader2 } from "lucide-react";

interface GenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentId: string;
}

export function GenerateModal({ isOpen, onClose, documentId }: GenerateModalProps) {
    const [jsonInput, setJsonInput] = useState("{\n  \"field_name\": \"value\"\n}");
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

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
                onClose();
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50">
                    <h2 className="font-semibold text-indigo-900 flex items-center gap-2">
                        <FileDown className="w-5 h-5" /> Generate PDF
                    </h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-indigo-400" /></button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                        Enter the JSON data to map into the document variables (e.g. <code>{"{{variable}}"}</code>).
                    </p>
                    <textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        className="w-full h-48 font-mono text-sm p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                    />
                </div>

                <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200">Cancel</button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium shadow flex items-center gap-2 disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        {isGenerating ? "Generating..." : "Download PDF"}
                    </button>
                </div>
            </div>
        </div>
    );
}
