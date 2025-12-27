'use client';

import { useState, useEffect, use } from 'react';
import dynamic from 'next/dynamic';
import { Save, FileDown, ArrowLeft, MousePointer2, Minus, Plus, Grid as GridIcon, PenTool } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EditModal from '@/components/EditModal';

// Dynamic import to avoid SSR issues with Fabric.js
const CanvasEditor = dynamic(() => import('@/components/CanvasEditor'), {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center">Loading Editor...</div>
});

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [document, setDocument] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [numPages, setNumPages] = useState(0); // Initialize to 0
    const [showGrid, setShowGrid] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const router = useRouter();
    const [selectedElement, setSelectedElement] = useState<any>(null);
    const [editingElement, setEditingElement] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    // NEW: Store loaded PDF document
    const [pdfDocument, setPdfDocument] = useState<any>(null);

    useEffect(() => {
        fetchDocument();
    }, [id]);

    // NEW: Load PDF Document object once
    useEffect(() => {
        if (!document?.fileUrl || document.fileType !== 'pdf') return;

        const loadPdf = async () => {
            try {
                // Dynamic import pdfjs to ensure worker is set (though handled in CanvasEditor, 
                // we might need to set it here purely for valid import if we used it directly, 
                // but we can rely on CanvasEditor's import side-effects or duplicate the worker setup here if needed.
                // For simplicity, let's assume CanvasEditor setup is sufficient or we do it here.)
                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

                const loadingTask = pdfjsLib.getDocument(document.fileUrl);
                const pdf = await loadingTask.promise;
                setPdfDocument(pdf);
                setNumPages(pdf.numPages);
            } catch (error) {
                console.error("Failed to load PDF", error);
            }
        };
        loadPdf();
    }, [document]);

    const fetchDocument = async () => {
        try {
            const res = await fetch(`/api/documents/${id}`);
            if (res.ok) {
                const data = await res.json();
                setDocument(data);
                // For images, set 1 page default
                if (data.fileType !== 'pdf') setNumPages(1);
            }
        } catch (error) {
            console.error('Error fetching document', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCanvas = async (pageElements: any[], pageNum: number) => {
        setDocument((prev: any) => {
            // MERGE: Keep elements from other pages, replace elements from current page
            const otherElements = prev.elements.filter((el: any) => (el.pageNumber || 1) !== pageNum);
            // Ensure new elements have correct page property
            const newElementsWithPage = pageElements.map(el => ({ ...el, pageNumber: pageNum }));

            return {
                ...prev,
                elements: [...otherElements, ...newElementsWithPage]
            };
        });
    };

    const saveToServer = async () => {
        setSaving(true);
        try {
            console.log('[Client] Saving elements:', document.elements);
            const res = await fetch(`/api/documents/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elements: document.elements }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.details || errData.error || 'Unknown error');
            }
            alert('Saved successfully');
        } catch (error: any) {
            console.error('Save error', error);
            alert(`Failed to save: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePDF = () => {
        // Hardcode HN001 for testing as per user request
        window.open(`/api/documents/${id}/generate?patientHn=HN001`, '_blank');
    };

    const handleDragStart = (e: React.DragEvent, type: string, name: string) => {
        e.dataTransfer.setData('fieldType', type);
        e.dataTransfer.setData('fieldName', name);
    };

    const handleSelectElement = (el: any) => {
        setSelectedElement(el);
    };

    const handleEdit = (el: any) => {
        setEditingElement(el);
    };

    const handleUpdateElement = (data: { fieldName: string; fieldValue: string; metadata?: any }) => {
        if (!editingElement) return;

        const newElements = document.elements.map((el: any) => {
            if (el.id === editingElement.id) {
                return { ...el, ...data, label: data.fieldName, metadata: { ...el.metadata, ...data.metadata } };
            }
            return el;
        });

        setDocument({ ...document, elements: newElements });
        setEditingElement(null);
    };

    const handleDeleteElement = (id: string) => {
        if (!confirm('Are you sure you want to delete this element?')) return;

        const newElements = document.elements.filter((el: any) => el.id !== id);
        setDocument({ ...document, elements: newElements });
        setEditingElement(null);
        setSelectedElement(null);
    };

    if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
    if (!document) return <div className="flex h-screen items-center justify-center">Document not found</div>;

    return (
        <div className="flex h-screen flex-col bg-gray-50 overflow-hidden">
            {/* Header */}
            <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10">
                {/* Left: Back & Title */}
                <div className="flex items-center space-x-4">
                    <Link href="/" className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-sm font-semibold text-gray-900">{document.title}</h1>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 uppercase">{document.fileType}</span>
                    </div>
                </div>

                {/* Center: Controls */}
                <div className="flex items-center space-x-3 bg-white p-1 rounded-xl shadow-sm border border-gray-100">

                    {/* Zoom */}
                    <div className="flex items-center bg-gray-50 rounded-lg p-1">
                        <button onClick={() => setZoomLevel(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600"><Minus size={16} /></button>
                        <span className="text-xs font-semibold px-2 text-gray-600 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                        <button onClick={() => setZoomLevel(z => Math.min(3, parseFloat((z + 0.1).toFixed(1))))} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-600"><Plus size={16} /></button>
                    </div>
                    <div className="w-px h-6 bg-gray-200 my-auto"></div>

                    {/* Grid */}
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 ${showGrid ? 'bg-blue-100 text-blue-600 shadow-inner' : 'hover:bg-gray-100 text-gray-500'}`}
                        title="Toggle Grid"
                    >
                        <GridIcon size={18} />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-3">
                    <button
                        onClick={saveToServer}
                        disabled={saving}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-medium shadow-sm"
                    >
                        <Save size={14} />
                        <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                        onClick={handleGeneratePDF}
                        className="flex items-center space-x-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium shadow-sm"
                    >
                        <FileDown size={14} />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                {/* Sidebar */}
                <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-10">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Toolbox</h2>
                        <p className="text-xs text-gray-400 mt-1">Drag fields onto the canvas</p>
                    </div>

                    <div className="p-4 space-y-3 overflow-y-auto flex-1">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xs font-medium text-gray-900 mb-2">Data Mapping</h3>
                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'text', 'Text Field')}
                                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 cursor-move transition-colors flex items-center space-x-3"
                                >
                                    <MousePointer2 size={16} className="text-blue-500" />
                                    <span className="text-sm font-medium text-gray-700">Text / DB Field</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-medium text-gray-900 mb-2">Media & Content</h3>
                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'qr', 'QR Code')}
                                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 cursor-move transition-colors flex items-center space-x-3"
                                >
                                    <MousePointer2 size={16} className="text-purple-500" />
                                    <span className="text-sm font-medium text-gray-700">QR Code</span>
                                </div>

                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'image', 'Image')}
                                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 cursor-move transition-colors flex items-center space-x-3"
                                >
                                    <MousePointer2 size={16} className="text-green-500" />
                                    <span className="text-sm font-medium text-gray-700">Image</span>
                                </div>

                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'signature', 'Signature')}
                                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 cursor-move transition-colors flex items-center space-x-3"
                                >
                                    <PenTool size={16} className="text-pink-500" />
                                    <span className="text-sm font-medium text-gray-700">Signature</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-medium text-gray-900 mb-2">Layout</h3>
                                <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'table', 'Table')}
                                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 cursor-move transition-colors flex items-center space-x-3"
                                >
                                    <MousePointer2 size={16} className="text-orange-500" />
                                    <span className="text-sm font-medium text-gray-700">Table</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Canvas Area - Scrollable */}
                <div className="flex-1 bg-gray-100 overflow-y-auto">
                    <div className="flex flex-col items-center py-8 space-y-8">
                        {Array.from({ length: Math.max(1, numPages) }).map((_, i) => (
                            <div key={i} className="shadow-lg relative">
                                {/* Page Number Indicator (Outside) */}
                                <div className="absolute -left-10 top-0 text-xs font-bold text-gray-400">
                                    Page {i + 1}
                                </div>
                                <CanvasEditor
                                    fileUrl={document.fileUrl}
                                    fileType={document.fileType}
                                    initialElements={document.elements}
                                    onSave={(elements) => handleSaveCanvas(elements, i + 1)} // Correct Page Index
                                    onSelect={handleSelectElement}
                                    onEdit={handleEdit}
                                    onDelete={(el) => handleDeleteElement(el.id)}
                                    pageNum={i + 1}
                                    onLoad={(data) => {
                                        if (i === 0 && !pdfDocument) setNumPages(data.numPages); // Fallback if pdfDocument not loaded
                                    }}
                                    zoom={zoomLevel}
                                    showGrid={showGrid}
                                    pdfDocument={pdfDocument}
                                />
                            </div>
                        ))}
                        {numPages === 0 && loading && (
                            <div className="text-gray-400">Initializing PDF...</div>
                        )}
                    </div>
                </div>
            </div>

            <EditModal
                key={editingElement?.id}
                isOpen={!!editingElement}
                onClose={() => setEditingElement(null)}
                data={editingElement || {}}
                onSave={handleUpdateElement}
                onDelete={() => handleDeleteElement(editingElement?.id)}
            />
        </div>
    );
}
