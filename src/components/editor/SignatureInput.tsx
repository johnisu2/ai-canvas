"use client";

import { useRef, useEffect, useState } from "react";
import SignaturePad from "signature_pad";
import { Eraser, Save, X } from "lucide-react";

interface SignatureInputProps {
    initialValue?: string;
    onSave: (base64: string) => void;
    onCancel: () => void;
    strokeColor?: string;
    penColor?: string;
}

export function SignatureInput({ initialValue, onSave, onCancel, penColor = "black" }: SignatureInputProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            // Handle high DPI screens
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d")?.scale(ratio, ratio);

            padRef.current = new SignaturePad(canvas, {
                penColor: penColor,
                backgroundColor: "rgba(255, 255, 255, 0)", // Transparent
            });

            const handleEnd = () => {
                onSave(padRef.current?.toDataURL() || "");
            };

            padRef.current.addEventListener("endStroke", handleEnd);

            if (initialValue) {
                padRef.current.fromDataURL(initialValue);
            }

            // Resize handler could be added here
        }

        return () => {
            padRef.current?.off();
        };
    }, [initialValue, penColor]);

    return (
        <div className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative h-64 w-full">
                <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
                <div className="absolute bottom-2 right-2 flex gap-2">
                    <button
                        onClick={() => {
                            padRef.current?.clear();
                            onSave(""); // Notify parent that it's cleared
                        }}
                        className="p-2 bg-white rounded-full shadow border hover:bg-red-50 text-red-500"
                        title="Clear"
                    >
                        <Eraser className="w-4 h-4" />
                    </button>
                    {/* Add an internal change listener to onSave if needed, but padRef doesn't have onChange. 
                        Usually we save on confirm (modal button). 
                        We should probably expose the padRef or call onSave when penUp? 
                        The user said remove buttons because they use the ones below.
                    */}
                    <button
                        onClick={() => {
                            if (padRef.current && !padRef.current.isEmpty()) {
                                onSave(padRef.current.toDataURL());
                            }
                        }}
                        className="p-2 bg-white rounded-full shadow border hover:bg-indigo-50 text-indigo-500 hidden"
                        title="Sync"
                    >
                        <Save className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
