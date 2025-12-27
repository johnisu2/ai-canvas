'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image as ImageIcon, ExternalLink, Loader2, FileDown } from 'lucide-react';
import Link from 'next/link';

interface Document {
  id: string;
  title: string;
  fileType: string;
  createdAt: string;
}

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [jsonInput, setJsonInput] = useState<string>('{\n  "idTemp": "123",\n  "params": {}\n}');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to fetch documents', error);
    } finally {
      setLoading(false);
    }
  };



  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validation
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file format. Please upload JPG, PNG, or PDF only.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchDocuments();
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      console.error('Upload error', error);
      alert('Upload error');
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'application/pdf': [],
    },
    maxFiles: 1,
  });

  const handleTestGenerate = async () => {
    if (!selectedDoc) {
      alert('Please select a Document Template');
      return;
    }

    try {
      const res = await fetch(`/api/documents/${selectedDoc}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonInput
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error || 'Generation failed'}`);
        return;
      }

      // Download Blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated_doc_${selectedDoc}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">AI Canvas Project</h1>
          <p className="text-gray-500 mt-2">Upload images or PDFs to start extracting data</p>
        </div>

        {/* TEST GENERATION SECTION (NEW) */}
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden bg-blue-50/50">
          <div className="p-6 border-b border-blue-100 bg-blue-50">
            <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
              <FileText size={20} />
              Test Document Generation
            </h2>
            <p className="text-sm text-blue-700 mt-1">Select a template and provide JSON data to generate a real PDF.</p>
          </div>
          <div className="p-6 flex flex-col md:flex-row gap-4 items-start">
            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">1. Select Template</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  value={selectedDoc}
                  onChange={(e) => setSelectedDoc(e.target.value)}
                >
                  <option value="">-- Choose Template --</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleTestGenerate}
                disabled={!selectedDoc}
                className="w-full px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FileDown size={18} />
                Generate PDF
              </button>
            </div>

            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">2. JSON Data (Parameters)</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-lg font-mono text-xs h-32"
                placeholder='e.g. { "idTemp": 123, "params": { ... } }'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'}
          `}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : (
            <Upload className={`w-12 h-12 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          )}
          <p className="mt-4 text-center text-gray-600 font-medium">
            {uploading ? 'Uploading...' : 'Drag & drop a file here, or click to select'}
          </p>
          <p className="text-sm text-gray-400 mt-2">Supports JPG, PNG, PDF</p>
        </div>

        {/* Document List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">All Templates</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No documents yet. Upload one to get started.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                      {doc.fileType === 'pdf' ? <FileText size={20} /> : <ImageIcon size={20} />}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{doc.title}</h3>
                      <p className="text-sm text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Link
                    href={`/editor/${doc.id}`}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    <span>Edit Template</span>
                    <ExternalLink size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
