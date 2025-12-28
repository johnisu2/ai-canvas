"use client";

import { CanvasElement, ElementType } from "@/types/canvas";
import { X, Save, Trash2, Code, Calculator, Type, Grid, ImageIcon, PenTool } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SignatureInput } from "./SignatureInput";

interface DBField {
    id: number;
    fieldName: string;
    label: string | null;
}

interface DBTable {
    id: number;
    tableName: string;
    fields: DBField[];
}

interface EditModalProps {
    element: CanvasElement;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: Partial<CanvasElement>) => void;
    onChange?: (id: string, updates: Partial<CanvasElement>) => void; // Added for Live Preview
    onDelete: (id: string) => void;
}

export function EditModal({ element, isOpen, onClose, onSave, onChange, onDelete }: EditModalProps) {
    const [formData, setFormData] = useState<Partial<CanvasElement>>({});
    const [tables, setTables] = useState<DBTable[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<number | "">("");
    const [selectedFieldId, setSelectedFieldId] = useState<number | "">("");

    useEffect(() => {
        if (isOpen) {
            setFormData(element);
            fetchTables();

            // Parse existing fieldName to set initial dropdown state
            if (element.fieldName && element.fieldName.includes('.')) {
                // Optimization: We need tables loaded to match ID. 
                // We'll handle this in the fetchTables effect or a separate one after tables load?
                // Or we rely on string matching if we don't have IDs in string. 
                // If we save as "Table.Field", we can match strings.
            }
        }
    }, [isOpen, element]);

    const fetchTables = async () => {
        try {
            const res = await fetch("/api/config/tables");
            if (res.ok) {
                const data = await res.json();
                setTables(data);

                // Set initial selection based on element.fieldName
                if (element.fieldName) {
                    const parts = element.fieldName.split('.');
                    if (parts.length >= 2) {
                        const tableName = parts[0];
                        const fieldNamePart = parts[1];

                        const table = data.find((t: DBTable) => t.tableName === tableName);
                        if (table) {
                            setSelectedTableId(table.id);
                            // Find field ID
                            const field = table.fields.find((f: DBField) => f.fieldName === fieldNamePart);
                            if (field) {
                                setSelectedFieldId(field.id);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch tables", error);
        }
    };

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(element.id, formData);
        onClose();
    };

    const handleChange = (field: keyof CanvasElement, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Live Preview: Notify parent immediately
        if (onChange) {
            onChange(element.id, { [field]: value });
        }
    };

    const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const tableId = parseInt(e.target.value);
        if (isNaN(tableId)) {
            setSelectedTableId("");
            setSelectedFieldId("");
            handleChange("fieldName", ""); // Clear mapping
            return;
        }
        setSelectedTableId(tableId);
        setSelectedFieldId(""); // Reset field when table changes
        handleChange("fieldName", "");
    };

    const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const fieldId = parseInt(e.target.value);
        if (isNaN(fieldId)) {
            setSelectedFieldId("");
            return;
        }
        setSelectedFieldId(fieldId);

        const table = tables.find(t => t.id === selectedTableId);
        const field = table?.fields.find(f => f.id === fieldId);

        if (table && field) {
            // Save as 'TableName.FieldName'
            const mapping = `${table.tableName}.${field.fieldName}`;
            handleChange("fieldName", mapping);
        }
    };

    // Simple file upload handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                handleChange("fieldValue", base64);
            };
            reader.readAsDataURL(file);
        }
    };

    // Get active fields for selected table
    const activeFields = selectedTableId
        ? tables.find(t => t.id === selectedTableId)?.fields || []
        : [];

    // Render content based on type
    const renderContent = () => {
        if (element.type === "signature") {
            return (
                <SignatureInput
                    initialValue={formData.fieldValue}
                    onSave={(base64) => {
                        handleChange("fieldValue", base64);
                    }}
                    onCancel={onClose}
                />
            );
        }

        // Common fields for Text, QR, Image
        return (
            <div className="space-y-4">
                {/* Label / Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อเรียกข้อมูล / ป้ายกำกับ</label>
                    <input
                        type="text"
                        value={formData.label || ""}
                        onChange={e => handleChange("label", e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="เช่น ชื่อผู้ป่วย"
                    />
                </div>

                {/* DB Field Map - Dropdowns */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">เชื่อมต่อฐานข้อมูล (Database Mapping)</label>
                    <div className="grid grid-cols-2 gap-2">
                        {/* Table Selector */}
                        <select
                            value={selectedTableId}
                            onChange={handleTableChange}
                            className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">-- เลือกตาราง --</option>
                            {tables.map(table => (
                                <option key={table.id} value={table.id}>{table.tableName}</option>
                            ))}
                        </select>

                        {/* Field Selector */}
                        <select
                            value={selectedFieldId}
                            onChange={handleFieldChange}
                            disabled={!selectedTableId}
                            className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            <option value="">-- เลือกฟิลด์ --</option>
                            {activeFields.map(field => (
                                <option key={field.id} value={field.id}>{field.label || field.fieldName}</option>
                            ))}
                        </select>
                    </div>
                    {/* Read-only view of current mapping */}
                    {formData.fieldName && (
                        <div className="mt-2 text-xs text-slate-500 font-mono bg-slate-50 p-1.5 rounded border text-right">
                            แผนผังปัจจุบัน: <span className="text-indigo-600 font-bold">{formData.fieldName}</span>
                        </div>
                    )}
                </div>

                {/* Type Specifics */}
                {element.type === "text" && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">ขนาดตัวอักษร</label>
                                <input
                                    type="number"
                                    value={formData.fontSize || 14}
                                    onChange={e => handleChange("fontSize", parseInt(e.target.value))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">การจัดวาง</label>
                                <select
                                    value={formData.alignment || "left"}
                                    onChange={e => handleChange("alignment", e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg bg-white"
                                >
                                    <option value="left">ชิดซ้าย</option>
                                    <option value="center">กึ่งกลาง</option>
                                    <option value="right">ชิดขวา</option>
                                </select>
                            </div>
                        </div>

                        {/* Formula */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <Calculator className="w-3 h-3" /> สูตรคำนวณ (เช่น ราคาสินค้า * จำนวน)
                            </label>
                            <input
                                type="text"
                                value={formData.formula || ""}
                                onChange={e => handleChange("formula", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg font-mono text-sm bg-indigo-50/50 border-indigo-200 focus:bg-white"
                                placeholder="เช่น price * qty"
                            />
                        </div>

                        {/* Script */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <Code className="w-3 h-3" /> สคริปต์ / เงื่อนไข (JavaScript)
                            </label>
                            <textarea
                                value={formData.script || ""}
                                onChange={e => handleChange("script", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-20"
                                placeholder="return data.value > 10;"
                            />
                        </div>
                    </>
                )}

                {(element.type === "qr" || element.type === "image") && (
                    <div className="space-y-4 border-t pt-4">
                        <label className="block text-sm font-medium text-slate-700">ตั้งค่าแหล่งที่มา</label>
                        <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-600 mb-2">
                            <p>เลือกข้อมูลจากฐานข้อมูล หรืออัปโหลดรูปภาพใหม่</p>
                        </div>
                        {/* Upload */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">อัปโหลดรูปภาพ (คงที่/เริ่มต้น)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    className="flex-1 px-3 py-2 border rounded-lg text-xs"
                                    placeholder="URL รูปภาพ หรือ Base64"
                                    value={formData.fieldValue || ""}
                                    onChange={e => handleChange("fieldValue", e.target.value)}
                                />
                                <label className="cursor-pointer p-2 bg-slate-200 rounded hover:bg-slate-300">
                                    <ImageIcon className="w-4 h-4" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </label>
                            </div>
                            {/* Preview */}
                            {formData.fieldValue && (formData.fieldValue.startsWith("data:image") || formData.fieldValue.startsWith("http") || formData.fieldValue.startsWith("/")) && (
                                <div className="mt-2 w-20 h-20 border rounded overflow-hidden bg-slate-100 flex items-center justify-center">
                                    <img src={formData.fieldValue} alt="Preview" className="w-full h-full object-contain" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {element.type === "table" && (
                    <div className="space-y-4 border-t pt-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เลือกตารางข้อมูลหลัก</label>
                            <select
                                value={selectedTableId}
                                onChange={handleTableChange}
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">-- เลือกตาราง --</option>
                                {tables.map(table => (
                                    <option key={table.id} value={table.id}>{table.tableName}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-slate-700">ลำดับคอลัมน์ (Columns)</label>
                            <button
                                type="button"
                                onClick={() => {
                                    const currentCols = Array.isArray(formData.metadata) ? formData.metadata : [];
                                    const newCols = [...currentCols, { header: 'คอลัมน์ใหม่', field: '', width: '' }];
                                    handleChange("metadata", newCols);
                                }}
                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                            >
                                + เพิ่มคอลัมน์
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {(Array.isArray(formData.metadata) ? formData.metadata : []).map((col: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="col-span-1 border-r border-slate-200 text-center font-mono text-[10px] text-slate-400">
                                        {idx + 1}
                                    </div>
                                    <div className="col-span-8">
                                        <select
                                            value={col.field}
                                            onChange={e => {
                                                const newCols = [...(formData.metadata as any)];
                                                newCols[idx] = { ...col, field: e.target.value };
                                                handleChange("metadata", newCols);
                                            }}
                                            disabled={!selectedTableId}
                                            className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="">-- เลือกฟิลด์ --</option>
                                            {activeFields.map(f => (
                                                <option key={f.id} value={f.fieldName}>{f.label || f.fieldName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            placeholder="กว้าง"
                                            value={col.width}
                                            onChange={e => {
                                                const newCols = [...(formData.metadata as any)];
                                                newCols[idx] = { ...col, width: e.target.value };
                                                handleChange("metadata", newCols);
                                            }}
                                            className="w-full text-xs px-1 py-1.5 border border-slate-300 rounded text-center outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newCols = (formData.metadata as any[]).filter((_: any, i: number) => i !== idx);
                                                handleChange("metadata", newCols);
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {(!Array.isArray(formData.metadata) || formData.metadata.length === 0) && (
                            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                                <p className="text-xs text-slate-500">ยังไม่มีการกำหนดคอลัมน์</p>
                                <p className="text-[10px] text-slate-400 mt-1">คลิก "+ เพิ่มคอลัมน์" เพื่อเริ่มต้น</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className={cn("px-6 py-4 flex items-center justify-between border-b",
                    element.type === "text" && "bg-blue-50 border-blue-100",
                    element.type === "qr" && "bg-purple-50 border-purple-100",
                    element.type === "image" && "bg-green-50 border-green-100",
                    element.type === "table" && "bg-orange-50 border-orange-100",
                    element.type === "signature" && "bg-pink-50 border-pink-100",
                )}>
                    <div className="flex items-center gap-2 font-semibold capitalize text-slate-800">
                        <span className={cn("p-1.5 rounded-lg text-white",
                            element.type === "text" && "bg-blue-500",
                            element.type === "qr" && "bg-purple-500",
                            element.type === "image" && "bg-green-500",
                            element.type === "table" && "bg-orange-500",
                            element.type === "signature" && "bg-pink-500",
                        )} />
                        {element.type === "text" && <Type className="w-4 h-4" />}
                        {element.type === "qr" && <Grid className="w-4 h-4" />}
                        {element.type === "image" && <ImageIcon className="w-4 h-4" />}
                        {element.type === "table" && <Grid className="w-4 h-4" />}
                        {element.type === "signature" && <PenTool className="w-4 h-4" />}
                        แก้ไของค์ประกอบ: {element.type.toUpperCase()}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {renderContent()}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center">
                    <button
                        onClick={() => onDelete(element.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1 px-3 py-2 rounded hover:bg-red-50 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" /> ลบออก
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors font-medium"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium shadow-lg shadow-indigo-200"
                        >
                            บันทึกการแก้ไข
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
