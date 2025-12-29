"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Search, Plus, MoreVertical, Loader2, FileDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Document {
  id: number;
  title: string;
  fileUrl: string;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New State for Gen Dox
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [jsonInput, setJsonInput] = useState(JSON.stringify({
    "first_name": "สมชาย",
    "image": "/uploads/mock_patient.png",
    "prescription_items": [
      {
        "rx_no": "RX-2024-001",
        "drug_code": "D001",
        "qty": 20,
        "amount": 30
      },
      {
        "rx_no": "RX-2024-002",
        "drug_code": "D002",
        "qty": 10,
        "amount": 50
      }
    ]
  }, null, 2));
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        router.push(`/editor/${data.documentId}`);
      } else {
        alert("อัพโหลดล้มเหลว");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("เกิดข้อผิดพลาดในการอัพโหลด");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!selectedDocId) {
      alert("กรุณาเลือกเอกสารต้นฉบับ");
      return;
    }
    try {
      setIsGenerating(true);
      const json = JSON.parse(jsonInput);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selectedDocId, json })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `generated_doc_${selectedDocId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        console.error("Failed");
        alert("สร้างเอกสารล้มเหลว");
      }
    } catch (e) {
      console.error(e);
      alert("JSON ไม่ถูกต้อง หรือเกิดข้อผิดพลาด");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-800">
              AI Canvas
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
              คู่มือการใช้งาน
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-28 pb-20 px-6 max-w-7xl mx-auto space-y-16">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Upload Section */}
          <section>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-800 mb-2">
                อัพโหลดเอกสาร
              </h1>
              <p className="text-slate-500">
                อัพโหลด PDF หรือรูปภาพเพื่อเริ่มกำหนดจุด (Fields) ใน Canvas
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "relative group aspect-video rounded-3xl border-2 border-dashed transition-all duration-300 ease-out flex flex-col items-center justify-center cursor-pointer overflow-hidden",
                isDragging
                  ? "border-indigo-500 bg-indigo-50/50 scale-[1.02] shadow-xl shadow-indigo-100"
                  : "border-slate-300 hover:border-indigo-400 hover:bg-white"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="relative z-10 flex flex-col items-center gap-4 p-10 text-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                    isDragging ? "bg-indigo-600 shadow-lg scale-110" : "bg-white shadow-sm border border-slate-100 group-hover:scale-110"
                  )}
                >
                  <Upload
                    className={cn(
                      "w-6 h-6 transition-colors duration-300",
                      isDragging ? "text-white" : "text-indigo-600"
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800">
                    {isDragging ? "วางไฟล์ที่นี่" : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก"}
                  </h3>
                  <p className="text-sm text-slate-400">
                    รองรับ PDF, PNG, JPG (สูงสุด 20MB)
                  </p>
                </div>
                <button
                  disabled={isUploading}
                  className="px-6 py-2 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  {isUploading ? "กำลังอัพโหลด..." : "เลือกไฟล์"}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="application/pdf,image/*"
                  onChange={handleFileSelect}
                />
              </div>
            </motion.div>
          </section>

          {/* Right: Generation Section */}
          <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileDown className="w-6 h-6 text-indigo-600" />
                สร้างเอกสาร (Gen Dox)
              </h2>
              <p className="text-slate-500 text-sm">
                เลือกต้นฉบับและใส่ข้อมูล JSON เพื่อสร้างเอกสาร PDF
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">เลือกเอกสารต้นฉบับ</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                >
                  <option value="">-- เลือกเอกสาร --</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ข้อมูลนำเข้า (JSON)</label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleGeneratePDF}
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                สร้างไฟล์ PDF
              </button>
            </div>
          </section>
        </div>

        {/* Recent Files */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              เอกสารล่าสุด (Recent Documents)
            </h2>
            <div className="flex items-center gap-3">
              {/* <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหา..."
                  className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
                />
              </div> */}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {documents.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                ไม่พบเอกสาร
              </div>
            ) : (
              documents.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:shadow-slate-200/50 hover:border-indigo-200 transition-all cursor-pointer"
                  onClick={() => router.push(`/editor/${doc.id}`)}
                >
                  <div className="aspect-[4/3] rounded-xl bg-slate-50 mb-4 overflow-hidden relative border border-slate-100">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-slate-300 group-hover:text-indigo-300 transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(doc.createdAt).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
