'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Eraser, Pen } from 'lucide-react';

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        id?: string;
        type?: string;
        fieldName?: string;
        fieldValue?: string;
        label?: string;
        metadata?: any;
        script?: string;
        formula?: string;
        fontSize?: number;
        alignment?: string;
    };
    onSave: (data: any) => void;
    onDelete?: () => void;
}

export default function EditModal({ isOpen, onClose, data, onSave, onDelete }: EditModalProps) {
    const [dbMappings, setDbMappings] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    // Controlled State
    const [formData, setFormData] = useState<{
        fieldName: string;
        fieldValue: string;
        script: string;
        formula: string;
        fontSize: number;
        alignment: string;
        metadata: {
            placeholder: string;
            dbFieldName: string;
            tableConfig?: {
                dataSource: string;
                columns: { header: string; field: string; width: number }[];
                showLines?: boolean;
            };
        };
    }>({
        fieldName: '',
        fieldValue: '',
        script: '',
        formula: '',
        fontSize: 14,
        alignment: 'left',
        metadata: {
            placeholder: '',
            dbFieldName: '',
            tableConfig: { dataSource: '', columns: [] }
        }
    });

    useEffect(() => {
        if (isOpen) {
            // Initialize state from props - AGGRESSIVE RESET
            const targetType = data.type || 'text';
            setFormData({
                fieldName: data.fieldName || data.label || 'Text Field',
                fieldValue: data.fieldValue || '',
                script: data.script || '',
                formula: data.formula || '',
                fontSize: data.fontSize || 14,
                alignment: data.alignment || 'left',
                metadata: {
                    placeholder: data.metadata?.placeholder || '',
                    dbFieldName: data.metadata?.dbFieldName || '',
                    tableConfig: data.metadata?.tableConfig || { dataSource: '', columns: [], showLines: false }
                }
            });

            // Ensure we are in a clean state (verify type)
            // console.log('EditModal Open:', targetType, data);

            fetch('/api/config/mappings')
                .then(res => res.json())
                .then(mappings => {
                    if (Array.isArray(mappings)) setDbMappings(mappings);
                })
                .catch(err => console.error(err));
        }
    }, [isOpen, data]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => {
            if (field.startsWith('metadata.')) {
                const metaKey = field.split('.')[1];
                return { ...prev, metadata: { ...prev.metadata, [metaKey]: value } };
            }
            return { ...prev, [field]: value };
        });
    };

    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [penColor, setPenColor] = useState('#000000');
    const [penWidth, setPenWidth] = useState(2);

    // Initialize Signature
    useEffect(() => {
        if (isOpen && data.type === 'signature' && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = penColor;
                ctx.lineWidth = penWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                // Clear and Load existing
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (data.fieldValue) {
                    const img = new Image();
                    img.src = data.fieldValue;
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                    };
                }
            }
        }
    }, [isOpen, data, penColor, penWidth]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        const { offsetX, offsetY } = getCoordinates(e, canvas);
        ctx.moveTo(offsetX, offsetY);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { offsetX, offsetY } = getCoordinates(e, canvas);
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current) {
            // Auto update field value? Or wait for save?
            // Wait for save is better performance
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        const rect = canvas.getBoundingClientRect();
        return {
            offsetX: clientX - rect.left,
            offsetY: clientY - rect.top
        };
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
            const json = await res.json();
            if (json.url) {
                setFormData(prev => ({ ...prev, fieldValue: json.url }));
            }
        } catch (error) {
            console.error('Upload failed', error);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();

        const updates: any = {
            fieldName: formData.fieldName,
            fieldValue: formData.fieldValue,
            script: formData.script,
            formula: formData.formula,
            fontSize: formData.fontSize,
            alignment: formData.alignment,
            metadata: { ...data.metadata, ...formData.metadata }
        };

        const dbField = formData.metadata.dbFieldName;

        // Auto-update fieldName based on mapping if generic
        let computedLabel = updates.fieldName;
        if (dbField && dbMappings.length > 0) {
            const [tbl, col] = dbField.split('.');
            const mapping = dbMappings.find(m => m.tableName === tbl && m.columnName === col);
            if (mapping) {
                if (!updates.fieldName || ['Text Field', 'Image', 'QR Code', 'Field'].includes(updates.fieldName)) {
                    updates.fieldName = mapping.columnName;
                    computedLabel = mapping.displayName;
                }
            }
        }

        // Use placeholder as label fallback
        if (!updates.fieldName && formData.metadata.placeholder) {
            computedLabel = formData.metadata.placeholder;
        }

        // Capture Signature
        if (data.type === 'signature' && canvasRef.current) {
            updates.fieldValue = canvasRef.current.toDataURL('image/png');
        }

        onSave({ ...data, ...updates, label: computedLabel });
        onClose();
    };

    if (!isOpen) return null;

    const type = data.type || 'text';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800">Edit {type.toUpperCase()} Element</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4">

                    {/* Common Fields */}
                    {type !== 'signature' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Label / Name</label>
                            <input
                                value={formData.fieldName}
                                onChange={e => handleChange('fieldName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                placeholder="Field Name"
                            />
                        </div>
                    )}



                    {/* NEW: DB Field Mapping (Split Choice) */}
                    {type !== 'table' && type !== 'signature' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">DB Connection</label>
                            <div className="grid grid-cols-2 gap-2">
                                {/* 1. Table Select */}
                                <div>
                                    <label className="text-xs text-gray-500">Table / Source</label>
                                    <select
                                        value={formData.metadata.dbFieldName ? formData.metadata.dbFieldName.split('.')[0] : ''}
                                        onChange={e => {
                                            const newTable = e.target.value;
                                            // Reset field when table changes
                                            if (newTable) {
                                                handleChange('metadata.dbFieldName', `${newTable}.`);
                                            } else {
                                                handleChange('metadata.dbFieldName', '');
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                    >
                                        <option value="">-- Select Table --</option>
                                        {dbMappings.map((tbl: any) => (
                                            <option key={tbl.id} value={tbl.tableName}>
                                                {tbl.tableName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 2. Field Select */}
                                <div>
                                    <label className="text-xs text-gray-500">Field</label>
                                    <select
                                        value={formData.metadata.dbFieldName}
                                        onChange={e => handleChange('metadata.dbFieldName', e.target.value)}
                                        disabled={!formData.metadata.dbFieldName || !formData.metadata.dbFieldName.includes('.')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                    >
                                        <option value="">-- Select Field --</option>
                                        {(() => {
                                            const currentTable = formData.metadata.dbFieldName ? formData.metadata.dbFieldName.split('.')[0] : '';
                                            const tableConfig = dbMappings.find((t: any) => t.tableName === currentTable);
                                            return tableConfig?.fields?.map((f: any) => (
                                                <option key={f.id} value={`${tableConfig.tableName}.${f.fieldName}`}>
                                                    {f.label || f.fieldName}
                                                </option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Select table and field to map dynamically.</p>
                        </div>
                    )}

                    {/* Type Specific Fields */}
                    {type === 'text' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                                <input
                                    value={formData.metadata.placeholder}
                                    onChange={e => handleChange('metadata.placeholder', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    placeholder="Fallback text..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
                                <textarea
                                    value={formData.fieldValue}
                                    onChange={e => handleChange('fieldValue', e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    placeholder="Enter default value..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                                    <input
                                        type="number"
                                        value={formData.fontSize}
                                        onChange={e => handleChange('fontSize', parseInt(e.target.value))}
                                        min={8}
                                        max={72}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Alignment</label>
                                    <select
                                        value={formData.alignment}
                                        onChange={e => handleChange('alignment', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                    >
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {type === 'qr' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Static URL / Content</label>
                            <div className="flex gap-2">
                                <input
                                    value={formData.fieldValue}
                                    onChange={e => handleChange('fieldValue', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    placeholder="https://example.com"
                                />
                            </div>
                            <div className="mt-2">
                                <label className="text-xs text-gray-500 mb-1 block">Or upload an image (Logo/QR):</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {uploading && <span className="text-xs text-blue-500 ml-2">Uploading...</span>}
                            </div>
                        </div>
                    )}

                    {type === 'image' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Static Image URL</label>
                            <input
                                value={formData.fieldValue}
                                onChange={e => handleChange('fieldValue', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 mb-2"
                                placeholder="https://example.com/image.png"
                            />
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Upload Image:</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {uploading && <span className="text-xs text-blue-500 ml-2">Uploading...</span>}
                            </div>
                        </div>
                    )}

                    {type === 'signature' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Signature Pad</label>

                            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm mb-3 relative">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={200}
                                    className="w-full h-48 cursor-crosshair touch-none bg-white"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                                <div className="absolute top-2 right-2">
                                    <button type="button" onClick={clearCanvas} className="px-2 py-1 bg-white/90 rounded border border-gray-200 hover:text-red-500 hover:bg-red-50 shadow-sm text-xs flex items-center gap-1 transition-colors">
                                        <Eraser size={14} /> Clear
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-gray-500">Color:</span>
                                    {['#000000', '#0000FF', '#FF0000'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setPenColor(c)}
                                            className={`w-6 h-6 rounded-full border-2 transition-transform ${penColor === c ? 'border-gray-400 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-gray-500">Size:</span>
                                    <input
                                        type="range"
                                        min="1" max="10"
                                        value={penWidth}
                                        onChange={(e) => setPenWidth(parseInt(e.target.value))}
                                        className="w-24 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <span className="text-xs font-mono w-4 text-gray-600">{penWidth}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {type === 'table' && (
                        <div className="space-y-4 border-t pt-4 mt-4">
                            <h4 className="font-semibold text-gray-900 flex items-center justify-between">
                                <span>Table Configuration</span>
                                <label className="flex items-center space-x-2 text-xs font-normal text-gray-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.metadata?.tableConfig?.showLines === true}
                                        onChange={e => {
                                            const oldConfig = formData.metadata?.tableConfig || { dataSource: '', columns: [] };
                                            const newConfig = { ...oldConfig, showLines: e.target.checked };
                                            handleChange('metadata.tableConfig', newConfig);
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Show Grid Lines</span>
                                </label>
                            </h4>

                            {/* Data Source Selection */}
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Data Source</label>
                                <select
                                    value={formData.metadata?.tableConfig?.dataSource || ''}
                                    onChange={e => {
                                        const oldConfig = formData.metadata?.tableConfig || { dataSource: '', columns: [] };
                                        const newConfig = { ...oldConfig, dataSource: e.target.value };
                                        handleChange('metadata.tableConfig', newConfig);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                >
                                    <option value="">-- Select Data Array --</option>
                                    <option value="items">Prescription Items (Drugs)</option>
                                    <option value="labResults">Lab Results</option>
                                </select>
                            </div>

                            {/* Columns Builder */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Columns</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentConfig = formData.metadata?.tableConfig || { dataSource: '', columns: [] };
                                            const currentCols = currentConfig.columns || [];
                                            const newCols = [...currentCols, { header: 'New Col', field: '', width: 20 }];
                                            handleChange('metadata.tableConfig', { ...currentConfig, columns: newCols });
                                        }}
                                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        + Add Column
                                    </button>
                                </div>

                                {/* Columns Header */}
                                <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-xs font-medium text-gray-500 uppercase">
                                    <div className="col-span-5">Header Title</div>
                                    <div className="col-span-4">Data Value</div>
                                    <div className="col-span-2 text-center">Width %</div>
                                    <div className="col-span-1"></div>
                                </div>

                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {(formData.metadata?.tableConfig?.columns || []).map((col: any, idx: number) => {
                                        // Dynamic Field Options
                                        const ds = formData.metadata?.tableConfig?.dataSource;
                                        let fieldOptions: { label: string, value: string }[] = [];

                                        if (ds === 'items') {
                                            fieldOptions = [
                                                { label: 'Drug Name', value: 'drug.name' },
                                                { label: 'Trade Name', value: 'drug.tradeName' },
                                                { label: 'Quantity', value: 'qty' },
                                                { label: 'Unit', value: 'drug.unit' },
                                                { label: 'Usage', value: 'drug.usage' },
                                                { label: 'Price', value: 'amount' },
                                                { label: 'Seq No', value: 'index_plus_1' } // Virtual field
                                            ];
                                        } else if (ds === 'labResults') {
                                            fieldOptions = [
                                                { label: 'Test Name', value: 'testName' },
                                                { label: 'Result Value', value: 'value' },
                                                { label: 'Unit', value: 'unit' },
                                                { label: 'Date', value: 'date' }
                                            ];
                                        }

                                        return (
                                            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                <div className="col-span-5">
                                                    <input
                                                        placeholder="Title"
                                                        value={col.header}
                                                        onChange={e => {
                                                            const config = formData.metadata?.tableConfig!;
                                                            const newCols = [...config.columns];
                                                            newCols[idx] = { ...col, header: e.target.value };
                                                            handleChange('metadata.tableConfig', { ...config, columns: newCols });
                                                        }}
                                                        className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    {fieldOptions.length > 0 ? (
                                                        <select
                                                            value={col.field}
                                                            onChange={e => {
                                                                const config = formData.metadata?.tableConfig!;
                                                                const newCols = [...config.columns];
                                                                newCols[idx] = { ...col, field: e.target.value };
                                                                handleChange('metadata.tableConfig', { ...config, columns: newCols });
                                                            }}
                                                            className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                                                        >
                                                            <option value="">-- Choose --</option>
                                                            {fieldOptions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            placeholder="key"
                                                            value={col.field}
                                                            onChange={e => {
                                                                const config = formData.metadata?.tableConfig!;
                                                                const newCols = [...config.columns];
                                                                newCols[idx] = { ...col, field: e.target.value };
                                                                handleChange('metadata.tableConfig', { ...config, columns: newCols });
                                                            }}
                                                            className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded font-mono text-xs"
                                                        />
                                                    )}
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        value={col.width}
                                                        onChange={e => {
                                                            const config = formData.metadata?.tableConfig!;
                                                            const newCols = [...config.columns];
                                                            newCols[idx] = { ...col, width: parseInt(e.target.value) || 0 };
                                                            handleChange('metadata.tableConfig', { ...config, columns: newCols });
                                                        }}
                                                        className="w-full text-sm px-1 py-1.5 border border-gray-300 rounded text-center outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const config = formData.metadata?.tableConfig!;
                                                            const newCols = config.columns.filter((_: any, i: number) => i !== idx);
                                                            handleChange('metadata.tableConfig', { ...config, columns: newCols });
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {(formData.metadata?.tableConfig?.columns || []).length === 0 && (
                                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                                        <p className="text-sm text-gray-500">No columns defined yet.</p>
                                        <p className="text-xs text-gray-400 mt-1">Click "+ Add Column" to start.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* NEW: Formula Field */}
                    {type !== 'table' && type !== 'signature' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Formula (Calculations)</label>
                            <textarea
                                value={formData.formula}
                                onChange={e => handleChange('formula', e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-xs"
                                placeholder="e.g. 100 * 5"
                            />
                            <p className="text-xs text-gray-500 mt-1">Use for math (e.g. Price * Qty). Processed before Script.</p>
                        </div>
                    )}

                    {/* NEW: Script / Condition Field (All Types) - Moved to Bottom */}
                    {/* NEW: Script / Condition Field (All Types) - Moved to Bottom */}
                    {type !== 'signature' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Script / Condition (Optional)</label>
                            <textarea
                                value={formData.script}
                                onChange={e => handleChange('script', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-xs"
                                placeholder="e.g. Number(db.prescriptions[0]?.totalAmount) > 300 ? '✔' : ''"
                            />
                            <p className="text-xs text-gray-500 mt-1">Enter a script logic. Return empty string '' to hide.</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
