"use client";

import { CanvasElement, ElementType } from "@/types/canvas";
import { X, Save, Trash2, Code, Calculator, Type, Grid, ImageIcon, PenTool, Database } from "lucide-react";
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
    displayName: string | null;
    fields: DBField[];
}

interface EditModalProps {
    element: CanvasElement;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string | number, updates: Partial<CanvasElement>) => void;
    onChange?: (id: string | number, updates: Partial<CanvasElement>) => void; // Added for Live Preview
    onDelete: (id: string | number) => void;
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

                // Priority 1: Use direct IDs if available
                if (element.dbConfigTableId) {
                    setSelectedTableId(element.dbConfigTableId);
                    if (element.dbConfigFieldId) {
                        setSelectedFieldId(element.dbConfigFieldId);
                    }
                    return;
                }

                // Priority 2: Fallback to fieldName parts (legacy/backwards compatibility)
                if (element.fieldName) {
                    const parts = element.fieldName.split('.');
                    if (parts.length >= 2) {
                        const tableName = parts[0];
                        const fieldNamePart = parts[1];

                        const table = data.find((t: DBTable) => t.tableName === tableName);
                        if (table) {
                            setSelectedTableId(table.id);
                            const field = table.fields.find((f: DBField) => f.fieldName === fieldNamePart);
                            if (field) setSelectedFieldId(field.id);
                        }
                    } else {
                        // Just table name mapping (common for Table elements)
                        const table = data.find((t: DBTable) => t.tableName === element.fieldName);
                        if (table) {
                            setSelectedTableId(table.id);
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
        if (onChange) onChange(element.id, { [field]: value });
    };

    const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const tableId = parseInt(e.target.value);
        if (isNaN(tableId)) {
            setSelectedTableId("");
            setSelectedFieldId("");
            setFormData(prev => ({
                ...prev,
                fieldName: "",
                dbConfigTableId: undefined,
                dbConfigFieldId: undefined
            }));
            if (onChange) onChange(element.id, { fieldName: "", dbConfigTableId: null as any, dbConfigFieldId: null as any });
            return;
        }

        setSelectedTableId(tableId);
        setSelectedFieldId("");

        const table = tables.find(t => t.id === tableId);
        if (table && element.type === 'table') {
            // For tables, the table itself is the target
            setFormData(prev => ({
                ...prev,
                fieldName: table.tableName,
                dbConfigTableId: tableId,
                dbConfigFieldId: undefined
            }));
            if (onChange) onChange(element.id, {
                fieldName: table.tableName,
                dbConfigTableId: tableId,
                dbConfigFieldId: null as any
            });
        } else {
            // For others, we wait for field selection
            setFormData(prev => ({
                ...prev,
                dbConfigTableId: tableId,
                dbConfigFieldId: undefined
            }));
            if (onChange) onChange(element.id, {
                dbConfigTableId: tableId,
                dbConfigFieldId: null as any
            });
        }
    };

    const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const fieldId = parseInt(e.target.value);
        if (isNaN(fieldId)) {
            setSelectedFieldId("");
            setFormData(prev => ({ ...prev, dbConfigFieldId: undefined, fieldName: "" }));
            if (onChange) onChange(element.id, { dbConfigFieldId: null as any, fieldName: "" });
            return;
        }
        setSelectedFieldId(fieldId);

        const table = tables.find(t => t.id === selectedTableId);
        const field = table?.fields.find(f => f.id === fieldId);

        if (table && field) {
            const mapping = `${table.tableName}.${field.fieldName}`;
            setFormData(prev => ({
                ...prev,
                fieldName: mapping,
                dbConfigTableId: table.id,
                dbConfigFieldId: field.id
            }));
            if (onChange) onChange(element.id, {
                fieldName: mapping,
                dbConfigTableId: table.id,
                dbConfigFieldId: field.id
            });
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
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                        <Database className="w-3 h-3 text-slate-500" /> เชื่อมต่อฐานข้อมูล (Database Mapping)
                    </label>
                    <div className={cn("grid gap-2", element.type === 'table' ? "grid-cols-1" : "grid-cols-2")}>
                        {/* Table Selector */}
                        <div className="flex flex-col gap-1.5">
                            <select
                                value={selectedTableId}
                                onChange={handleTableChange}
                                className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium w-full"
                            >
                                <option value="">-- {element.type === 'table' ? 'เลือกตารางหลัก / กำหนดเอง' : 'เลือกตาราง'} --</option>
                                {tables.map(table => (
                                    <option key={table.id} value={table.id}>
                                        {table.displayName || table.tableName}
                                    </option>
                                ))}
                            </select>

                            {selectedTableId && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 border border-indigo-100/50 rounded text-[10px] text-slate-500 font-mono">
                                    <Database className="w-3 h-3 text-indigo-400" />
                                    <span>Base: <span className="text-indigo-600 font-semibold">{tables.find(t => t.id === selectedTableId)?.tableName}</span></span>
                                </div>
                            )}
                        </div>

                        {/* Field Selector (Hidden for Tables) */}
                        {element.type !== 'table' && (
                            <div className="flex flex-col gap-1.5">
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

                                {selectedFieldId && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 border border-purple-100/50 rounded text-[10px] text-slate-500 font-mono">
                                        <Code className="w-3 h-3 text-purple-400" />
                                        <span>Key: <span className="text-purple-600 font-semibold">{activeFields.find(f => f.id === selectedFieldId)?.fieldName}</span></span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>


                {/* Formula */}
                {element.type === "text" && (
                    <>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <Calculator className="w-3 h-3 text-indigo-600" />  สูตรคำนวณ
                            </label>
                            <input
                                type="text"
                                value={formData.formula || ""}
                                onChange={e => handleChange("formula", e.target.value)}
                                className="w-full px-3 py-2 border border-indigo-100 rounded-lg font-mono text-sm bg-indigo-50/30 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="เช่น patients.amount * 5"
                            />
                        </div>

                        {/* Script */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <Code className="w-3 h-3 text-purple-600" /> สคริปต์ / เงื่อนไข
                            </label>
                            <textarea
                                value={formData.script || ""}
                                onChange={e => handleChange("script", e.target.value)}
                                className="w-full px-3 py-2 border border-purple-100 rounded-lg font-mono text-sm h-20 focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="เช่น return value > 1000 ? 'ยอดเยี่ยม' : 'ปกติ';(ข้อมูลดึงจาก DB Field Map)"
                            />
                        </div></>
                )}


                {/* Type Specifics (FontSize etc) */}
                {element.type === "text" && (
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
                )}

                {(element.type === "qr" || element.type === "image") && (
                    <div className="space-y-4 border-t pt-4">
                        {/* <label className="block text-sm font-medium text-slate-700">ตั้งค่าแหล่งที่มา</label>
                        <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-600 mb-2">
                            <p>เลือกข้อมูลจากฐานข้อมูล หรืออัปโหลดรูปภาพใหม่</p>
                        </div> */}
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

                {element.type === "table" && (() => {
                    const metadata = formData.metadata || {};
                    const columns = Array.isArray(metadata) ? metadata : (metadata.columns || []);
                    const rowHeight = Array.isArray(metadata) ? 22 : (metadata.rowHeight || 22);

                    return (
                        <div className="space-y-4 border-t pt-4 mt-4">
                            <div className="flex justify-between items-end gap-4 mb-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        ลำดับคอลัมน์ (Columns)
                                    </label>
                                    <div className="text-[10px] text-slate-400">กำหนดรายการข้อมูลที่จะแสดงในตาราง</div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-end gap-1">
                                        <label className="text-[10px] font-medium text-slate-500">สูงแถว (Row H)</label>
                                        <input
                                            type="number"
                                            value={rowHeight}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 22;
                                                handleChange("metadata", { columns, rowHeight: val });
                                            }}
                                            className="w-16 px-2 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-center font-mono"
                                            placeholder="22"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newCols = [...columns, { header: 'คอลัมน์ใหม่', field: '', width: '' }];
                                            handleChange("metadata", { columns: newCols, rowHeight });
                                        }}
                                        className="h-9 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-xs flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Grid className="w-3.5 h-3.5" /> เพิ่มคอลัมน์
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {columns.map((col: any, idx: number) => (
                                    <div
                                        key={idx}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData("colIndex", idx.toString());
                                            e.currentTarget.style.opacity = "0.5";
                                        }}
                                        onDragEnd={(e) => {
                                            e.currentTarget.style.opacity = "1";
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.borderTop = "2px solid #6366f1";
                                        }}
                                        onDragLeave={(e) => {
                                            e.currentTarget.style.borderTop = "";
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.borderTop = "";
                                            const fromIdx = parseInt(e.dataTransfer.getData("colIndex"));
                                            if (fromIdx === idx) return;

                                            const newCols = [...columns];
                                            const [movedCol] = newCols.splice(fromIdx, 1);
                                            newCols.splice(idx, 0, movedCol);
                                            handleChange("metadata", { columns: newCols, rowHeight });
                                        }}
                                        className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100 cursor-move hover:bg-slate-100 transition-all"
                                    >
                                        <div className="col-span-1 border-r border-slate-200 text-center font-mono text-[10px] text-slate-400">
                                            {idx + 1}
                                        </div>
                                        <div className="col-span-8 flex flex-col gap-1">
                                            {activeFields.length > 0 && (
                                                <select
                                                    value={col.fieldId || ""}
                                                    onChange={e => {
                                                        const fieldId = parseInt(e.target.value);
                                                        const fieldObj = activeFields.find(f => f.id === fieldId);
                                                        const newCols = [...columns];
                                                        newCols[idx] = {
                                                            ...col,
                                                            field: fieldObj?.fieldName || "",
                                                            fieldId: isNaN(fieldId) ? undefined : fieldId
                                                        };
                                                        handleChange("metadata", { columns: newCols, rowHeight });
                                                    }}
                                                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    <option value="">-- เลือกจาก DB --</option>
                                                    {activeFields.map(f => (
                                                        <option key={f.id} value={f.id}>{f.label || f.fieldName}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {/* <input
                                                placeholder="Key (เช่น item, qty)"
                                                value={col.field || ""}
                                                onChange={e => {
                                                    const newCols = [...columns];
                                                    newCols[idx] = {
                                                        ...col,
                                                        field: e.target.value,
                                                        fieldId: undefined
                                                    };
                                                    handleChange("metadata", { ...metadata, columns: newCols });
                                                }}
                                                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                            /> */}
                                        </div>
                                        {/* <div className="col-span-3">
                                            <input
                                                placeholder="Script (เงื่อนไข)"
                                                value={col.script || ""}
                                                onChange={e => {
                                                    const newCols = [...columns];
                                                    newCols[idx] = { ...col, script: e.target.value };
                                                    handleChange("metadata", { columns: newCols, rowHeight });
                                                }}
                                                className="w-full text-[10px] px-2 py-1.5 border border-slate-300 rounded bg-indigo-50/30 font-mono outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div> */}
                                        <div className="col-span-2">
                                            <input
                                                placeholder="กว้าง"
                                                value={col.width}
                                                onChange={e => {
                                                    const newCols = [...columns];
                                                    newCols[idx] = { ...col, width: e.target.value };
                                                    handleChange("metadata", { columns: newCols, rowHeight });
                                                }}
                                                className="w-full text-xs px-1 py-1.5 border border-slate-300 rounded text-center outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newCols = columns.filter((_: any, i: number) => i !== idx);
                                                    handleChange("metadata", { columns: newCols, rowHeight });
                                                }}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {columns.length === 0 && (
                                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                                    <p className="text-xs text-slate-500">ยังไม่มีการกำหนดคอลัมน์</p>
                                    <p className="text-[10px] text-slate-400 mt-1">คลิก "+ เพิ่มคอลัมน์" เพื่อเริ่มต้น</p>
                                </div>
                            )}
                        </div>
                    );
                })()}
                {element.type === "table" && (
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
