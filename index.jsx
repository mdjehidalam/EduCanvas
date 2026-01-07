import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileText, Globe, Plus, Trash2, ChevronLeft, ChevronRight, 
  PenTool, Highlighter, Eraser, Search, BookOpen, Layout, Settings, 
  MousePointer2, Upload, Eye, EyeOff, X, Save, Download,
  Image as ImageIcon, Type as TypeIcon, Code as CodeIcon,
  Loader2, PlusCircle, FileUp, FilePlus, AlertCircle, RefreshCw,
  ExternalLink, Layers, Zap, Type, AlignLeft, ChevronDown, Check,
  GripHorizontal
} from 'lucide-react';

// External libraries
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const App = () => {
  // --- STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [showSettings, setShowSettings] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [watermark, setWatermark] = useState('EduCanvas Pro');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [error, setError] = useState(null);
  
  // Element States
  const [editingTextId, setEditingTextId] = useState(null);
  const [draggingElement, setDraggingElement] = useState(null);
  
  const [documents, setDocuments] = useState([
    { 
      id: 'doc1', 
      title: 'New Project', 
      pages: [
        { id: 'p1', elements: [], pdfData: null, pageNum: 1, type: 'blank' }
      ]
    },
  ]);
  const [activeDocId, setActiveDocId] = useState('doc1');

  const [activeTool, setActiveTool] = useState('pen');
  const [penColor, setPenColor] = useState('#3b82f6');
  const [penSize, setPenSize] = useState(3);

  // --- UTILS ---
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  // --- ELEMENT MANIPULATION ---
  const handleSmartTextAdd = (pageId, fullText, initialX = 10, initialY = 15) => {
    const activeDoc = documents.find(d => d.id === activeDocId);
    if (!activeDoc) return;

    const pageIndex = activeDoc.pages.findIndex(p => p.id === pageId);
    if (pageIndex === -1) return;

    const CHARS_PER_PAGE = 1800; 
    const elementId = Date.now();
    
    // Add the element first
    const newElement = { 
      type: 'text', 
      content: fullText || "", 
      x: initialX, 
      y: initialY, 
      id: elementId 
    };

    if (fullText.length <= CHARS_PER_PAGE) {
      updatePageElements(pageId, newElement);
      // Immediately set as editing so user sees the textarea
      setEditingTextId(elementId);
    } else {
      const chunks = [];
      for (let i = 0; i < fullText.length; i += CHARS_PER_PAGE) {
        chunks.push(fullText.substring(i, i + CHARS_PER_PAGE));
      }

      setDocuments(prev => prev.map(doc => {
        if (doc.id === activeDocId) {
          const newPages = [...doc.pages];
          newPages[pageIndex] = {
            ...newPages[pageIndex],
            elements: [...newPages[pageIndex].elements, { ...newElement, content: chunks[0] }]
          };
          const additionalPages = chunks.slice(1).map((chunk, idx) => ({
            id: `overflow-${Date.now()}-${idx}`,
            elements: [{ type: 'text', content: chunk, x: 10, y: 10, id: Date.now() + idx + 100 }],
            type: 'blank',
            pdfDoc: null,
            pageNum: null
          }));
          newPages.splice(pageIndex + 1, 0, ...additionalPages);
          return { ...doc, pages: newPages };
        }
        return doc;
      }));
      setEditingTextId(elementId);
    }
  };

  const updatePageElements = (pageId, newElement) => {
    setDocuments(prev => prev.map(doc => ({
      ...doc,
      pages: doc.pages.map(p => p.id === pageId ? {
        ...p,
        elements: [...p.elements, newElement]
      } : p)
    })));
  };

  const updateTextContent = (pageId, elId, content) => {
    setDocuments(prev => prev.map(doc => ({
      ...doc,
      pages: doc.pages.map(p => p.id === pageId ? {
        ...p,
        elements: p.elements.map(el => el.id === elId ? { ...el, content } : el)
      } : p)
    })));
  };

  const moveElement = (pageId, elId, newX, newY) => {
    setDocuments(prev => prev.map(doc => ({
      ...doc,
      pages: doc.pages.map(p => p.id === pageId ? {
        ...p,
        elements: p.elements.map(el => el.id === elId ? { ...el, x: newX, y: newY } : el)
      } : p)
    })));
  };

  // --- DRAG HANDLERS ---
  const handleDragStart = (e, pageId, elId) => {
    // Only allow drag if Select tool is active and we aren't currently editing text
    if (activeTool !== 'select' || editingTextId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    setDraggingElement({ pageId, elId, offsetX, offsetY });
  };

  const handleDragMove = (e) => {
    if (!draggingElement) return;
    const pageContainer = e.currentTarget;
    const rect = pageContainer.getBoundingClientRect();
    
    let x = ((e.clientX - draggingElement.offsetX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - draggingElement.offsetY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(95, x));
    y = Math.max(0, Math.min(98, y));

    moveElement(draggingElement.pageId, draggingElement.elId, x, y);
  };

  const handleDragEnd = () => {
    setDraggingElement(null);
  };

  // --- PDF & EXPORT ---
  const exportToPdf = async () => {
    const activeDoc = documents.find(d => d.id === activeDocId);
    if (!activeDoc || activeDoc.pages.length === 0) return;
    setIsExporting(true);
    setEditingTextId(null); 
    try {
      if (!window.jspdf) await loadScript(JSPDF_URL);
      if (!window.html2canvas) await loadScript(HTML2CANVAS_URL);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = document.querySelectorAll('.pdf-page-container');
      for (let i = 0; i < pages.length; i++) {
        const canvas = await window.html2canvas(pages[i], {
          scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      pdf.save(`${activeDoc?.title || 'exported'}_edited.pdf`);
    } catch (err) {
      showError("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAppendPdf = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showError("Invalid file type. Please upload a PDF.");
      return;
    }
    setIsLoadingFile(true);
    try {
      await loadScript(PDFJS_URL);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;
      const newPages = [];
      for (let i = 1; i <= pageCount; i++) {
        newPages.push({
          id: `page-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          elements: [], pdfDoc: pdf, pageNum: i, type: 'pdf'
        });
      }
      setDocuments(prev => prev.map(doc => {
        if (doc.id === activeDocId) {
          return { 
            ...doc, 
            title: (doc.pages.length === 0 || doc.pages[0].type === 'blank') ? file.name : doc.title,
            pages: [...(doc.pages[0]?.type === 'blank' && doc.pages.length === 1 ? [] : doc.pages), ...newPages] 
          };
        }
        return doc;
      }));
    } catch (err) {
      showError("Failed to render PDF: " + err.message);
    } finally {
      setIsLoadingFile(false);
      e.target.value = '';
    }
  };

  const addBlankPage = () => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === activeDocId) {
        return {
          ...doc,
          pages: [...doc.pages, { id: `blank-${Date.now()}`, elements: [], pdfDoc: null, type: 'blank' }]
        };
      }
      return doc;
    }));
  };

  const deletePage = (docId, pageId) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        const filtered = doc.pages.filter(p => p.id !== pageId);
        return { ...doc, pages: filtered };
      }
      return doc;
    }));
  };

  const removeElement = (docId, pageId, elId) => {
    setDocuments(prev => prev.map(doc => doc.id === docId ? {
      ...doc,
      pages: doc.pages.map(p => p.id === pageId ? {
        ...p,
        elements: p.elements.filter(el => el.id !== elId)
      } : p)
    } : doc));
    if (editingTextId === elId) setEditingTextId(null);
  };

  const activeDoc = documents.find(d => d.id === activeDocId);

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-200 overflow-hidden font-sans select-none">
      
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top duration-300">
          <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400">
            <AlertCircle size={20} />
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* 1. SIDEBAR */}
      <aside className={`fixed lg:relative z-50 h-full transition-all duration-300 ease-in-out border-r border-slate-800 bg-[#0f172a] flex flex-col ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2 text-blue-400 truncate tracking-tight"><Layers size={18} /> EduCanvas</h2>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-slate-800 rounded text-slate-400 lg:hidden"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <button onClick={() => { const id = Math.random().toString(36).substr(2, 9); setDocuments([...documents, { id, title: `Project ${documents.length + 1}`, pages: [{ id: Date.now(), elements: [], type: 'blank' }] }]); setActiveDocId(id); }} className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl hover:bg-blue-600/20 text-blue-400 transition-all font-bold text-xs uppercase tracking-widest">
            <Plus size={16} /> New Project
          </button>

          <div className="space-y-2">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                onClick={() => { setActiveDocId(doc.id); }}
                className={`group flex flex-col gap-2 p-3 rounded-xl border transition-all cursor-pointer ${activeDocId === doc.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-500'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-10 rounded flex items-center justify-center shrink-0 ${activeDocId === doc.id ? 'bg-blue-500 text-white' : 'bg-slate-900 text-slate-500'}`}><FileText size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{doc.title}</p>
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tight">{doc.pages.length} Pages</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3">
             <button onClick={addBlankPage} className="w-full flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700 rounded-xl hover:border-slate-500 text-slate-300 transition-all text-xs font-bold">
                <FilePlus size={16} className="text-blue-400" /> New Blank Page
             </button>
             <label className={`flex items-center gap-3 w-full p-3 bg-slate-800/40 border border-slate-700 rounded-xl hover:border-slate-500 text-slate-300 cursor-pointer transition-all ${isLoadingFile ? 'opacity-50 cursor-wait' : ''}`}>
                {isLoadingFile ? <Loader2 size={16} className="animate-spin text-emerald-400" /> : <FileUp size={16} className="text-emerald-400" />}
                <span className="text-xs font-bold">{isLoadingFile ? 'Processing...' : 'Upload PDF'}</span>
                <input type="file" className="hidden" accept=".pdf" onChange={handleAppendPdf} disabled={isLoadingFile} />
             </label>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
        <header className="h-16 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between px-4 z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              {sidebarOpen ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <span className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{activeDoc?.title}</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ToolBtn active={activeTool === 'select'} onClick={() => setActiveTool('select')} icon={<MousePointer2 size={18}/>} title="Rearrange & Move" />
            
            <div className="relative flex items-center">
              <ToolBtn active={activeTool === 'pen'} onClick={() => setActiveTool('pen')} icon={<PenTool size={18}/>} color={penColor} title="Pen Tool" />
              <button onClick={() => setShowColorPicker(!showColorPicker)} className="ml-[-6px] p-1 bg-slate-800 hover:bg-slate-700 rounded-r-md border-y border-r border-slate-700 text-slate-400"><ChevronDown size={12} /></button>
              {showColorPicker && (
                <div className="absolute top-12 left-0 z-50 bg-[#1e293b] border border-slate-700 p-2 rounded-xl shadow-2xl flex gap-2 animate-in fade-in zoom-in duration-200">
                  {['#3b82f6', '#ef4444', '#10b981', '#ffffff', '#eab308', '#a855f7'].map(c => (
                    <button key={c} onClick={() => { setPenColor(c); setShowColorPicker(false); setActiveTool('pen'); }} className={`w-6 h-6 rounded-full border-2 ${penColor === c ? 'border-white' : 'border-transparent hover:border-slate-500'}`} style={{backgroundColor: c}} />
                  ))}
                </div>
              )}
            </div>

            <ToolBtn active={activeTool === 'laser'} onClick={() => setActiveTool('laser')} icon={<Zap size={18}/>} title="Laser Pointer" />
            <ToolBtn active={activeTool === 'highlighter'} onClick={() => setActiveTool('highlighter')} icon={<Highlighter size={18}/>} title="Highlighter" />
            <ToolBtn active={activeTool === 'text'} onClick={() => { setActiveTool('text'); setEditingTextId(null); }} icon={<Type size={18}/>} title="Add Text" />
            <ToolBtn active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} icon={<Eraser size={18}/>} title="Eraser" />
            
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button onClick={exportToPdf} disabled={isExporting} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20">
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="hidden md:inline">Save PDF</span>
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><Settings size={18}/></button>
          </div>
        </header>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative p-4 lg:p-12 flex flex-col items-center gap-12 bg-[#020617]">
            <div className="w-full flex flex-col items-center gap-12 max-w-[850px]">
              {activeDoc?.pages.map((page) => (
                <div 
                  key={page.id} 
                  className="pdf-page-container relative w-full aspect-[1/1.41] bg-white rounded shadow-2xl border border-slate-200 flex-shrink-0 overflow-hidden"
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                >
                  <PDFRenderer page={page} />

                  <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-[0.05] select-none">
                     <span className="text-7xl font-black -rotate-45 uppercase text-black">{watermark}</span>
                  </div>

                  {/* Annotations Layer */}
                  <div className="absolute inset-0 z-20 pointer-events-none">
                    {page.elements.map(el => (
                      <div 
                        key={el.id} 
                        style={{ left: `${el.x}%`, top: `${el.y}%`, cursor: activeTool === 'select' ? 'grab' : 'default' }} 
                        className={`absolute pointer-events-auto group/el transition-shadow ${activeTool === 'select' ? 'hover:shadow-lg hover:outline hover:outline-2 hover:outline-blue-500 rounded' : 'pointer-events-none'}`}
                        onMouseDown={(e) => handleDragStart(e, page.id, el.id)}
                      >
                        {el.type === 'text' && (
                          <div className="relative group/text min-w-[100px] min-h-[40px]">
                            {editingTextId === el.id ? (
                               <div className="flex flex-col gap-1 z-[100] relative scale-105 transition-transform" onMouseDown={e => e.stopPropagation()}>
                                  <textarea 
                                    autoFocus
                                    className="text-slate-900 text-sm leading-relaxed font-medium bg-white p-3 rounded-lg shadow-2xl border-2 border-blue-500 outline-none w-[350px] min-h-[120px] resize-y select-text"
                                    value={el.content}
                                    placeholder="Click and type here..."
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onChange={(e) => updateTextContent(page.id, el.id, e.target.value)}
                                  />
                                  <div className="flex justify-end bg-blue-500 rounded-b-lg p-1 mt-[-4px]">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setEditingTextId(null); }} 
                                      className="flex items-center gap-1 text-white px-3 py-1 text-[10px] font-bold uppercase hover:bg-white/20 rounded transition-colors"
                                    >
                                      <Check size={12} /> Done Writing
                                    </button>
                                  </div>
                               </div>
                            ) : (
                              <div 
                                onClick={(e) => {
                                  if (activeTool === 'select') {
                                    e.stopPropagation();
                                    setEditingTextId(el.id);
                                  }
                                }}
                                className={`text-slate-900 text-sm leading-relaxed font-medium bg-white/80 backdrop-blur-md p-3 rounded shadow-sm max-w-[350px] whitespace-pre-wrap transition-all border border-transparent ${activeTool === 'select' ? 'hover:bg-white hover:border-blue-200 cursor-text' : ''}`}
                              >
                                {el.content || <span className="text-slate-400 italic font-normal">New Text (Click to edit)</span>}
                                {activeTool === 'select' && (
                                  <div className="absolute -top-2 -left-2 bg-blue-500 text-white p-1 rounded-md opacity-0 group-hover/el:opacity-100 transition-opacity">
                                    <GripHorizontal size={10} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {el.type === 'image' && <img src={el.content} className="max-w-[200px] rounded shadow-2xl border-4 border-white" alt="annotation" draggable={false} />}
                        
                        {!editingTextId && activeTool === 'select' && (
                          <button onClick={(e) => { e.stopPropagation(); removeElement(activeDocId, page.id, el.id); }} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/el:opacity-100 shadow-xl transition-all hover:scale-110 z-50">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Interaction Layer */}
                  <CanvasOverlay 
                    tool={activeTool} 
                    color={penColor} 
                    size={penSize} 
                    onTextAdd={(xPerc, yPerc) => {
                      handleSmartTextAdd(page.id, "", xPerc, yPerc);
                    }}
                  />

                  {!isExporting && (
                    <div className="absolute -right-14 top-4 flex flex-col gap-2 opacity-0 hover:opacity-100 transition-opacity">
                       <div className="bg-slate-800 border border-slate-700 p-2 rounded-xl shadow-xl flex flex-col gap-2">
                          <button onClick={() => {
                            const content = prompt("Paste long paragraph here:");
                            if (content) handleSmartTextAdd(page.id, content);
                          }} title="Bulk Text Paste" className="p-2 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 rounded-lg"><AlignLeft size={16}/></button>
                          <button onClick={() => {
                            const url = prompt("Enter image URL:");
                            if (url) updatePageElements(page.id, { type: 'image', content: url, x: 20, y: 20, id: Date.now() });
                          }} title="Add Image" className="p-2 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 rounded-lg"><ImageIcon size={16}/></button>
                          <div className="h-px bg-slate-700 mx-1" />
                          <button onClick={() => deletePage(activeDocId, page.id)} title="Delete Page" className="p-2 hover:bg-red-600/20 text-slate-400 hover:text-red-400 rounded-lg"><Trash2 size={16}/></button>
                       </div>
                    </div>
                  )}
                </div>
              ))}
              
              {activeDoc?.pages.length > 0 && (
                <div className="flex items-center gap-4 mb-32 p-1 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl">
                   <button onClick={addBlankPage} className="flex items-center gap-2 px-6 py-3 hover:bg-slate-700 rounded-xl text-slate-300 transition-all font-bold text-xs uppercase tracking-widest">
                      <PlusCircle size={16} className="text-blue-400" /> New Page
                    </button>
                    <div className="w-px h-6 bg-slate-700" />
                    <label className="flex items-center gap-2 px-6 py-3 hover:bg-slate-700 rounded-xl text-slate-300 cursor-pointer transition-all font-bold text-xs uppercase tracking-widest">
                      <FileUp size={16} className="text-emerald-400" /> {isLoadingFile ? 'Importing...' : 'Append PDF'}
                      <input type="file" className="hidden" accept=".pdf" onChange={handleAppendPdf} />
                    </label>
                </div>
              )}
            </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-[#1e293b] border border-slate-700 rounded-3xl w-full max-w-md p-6 lg:p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Preferences</h3>
               <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X size={24}/></button>
            </div>
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Watermark Label</label>
                <input type="text" value={watermark} onChange={(e) => setWatermark(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 transition-all" />
              </div>
              <div>
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Pen Brush Size ({penSize}px)</label>
                 <input type="range" min="1" max="25" value={penSize} onChange={(e) => setPenSize(parseInt(e.target.value))} className="w-full accent-blue-500" />
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        textarea::placeholder { color: #64748b; font-style: italic; }
      `}} />
    </div>
  );
};

const PDFRenderer = ({ page }) => {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const renderPage = async () => {
      if (page.type === 'blank' || !page.pdfDoc) return;
      setLoading(true);
      try {
        const pdfPage = await page.pdfDoc.getPage(page.pageNum);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const viewport = pdfPage.getViewport({ scale: 2 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
      } catch (err) {
        console.error("PDF Render Error:", err);
      } finally {
        setLoading(false);
      }
    };
    renderPage();
  }, [page]);

  if (page.type === 'blank') return null;
  return (
    <div className="absolute inset-0 z-0 bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
};

const CanvasOverlay = ({ tool, color, size, onTextAdd }) => {
  const drawingCanvasRef = useRef(null);
  const laserCanvasRef = useRef(null);
  const drawCtxRef = useRef(null);
  const laserCtxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const pointsRef = useRef([]);

  useEffect(() => {
    const setup = (canvas, ctxRef) => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth * 2;
      canvas.height = parent.clientHeight * 2;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      const context = canvas.getContext('2d', { alpha: true });
      context.scale(2, 2);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      ctxRef.current = context;
    };
    setup(drawingCanvasRef.current, drawCtxRef);
    setup(laserCanvasRef.current, laserCtxRef);
    let animationId;
    const animateLaser = () => {
      const ctx = laserCtxRef.current;
      const now = Date.now();
      pointsRef.current = pointsRef.current.filter(p => now - p.t < 800);
      ctx.clearRect(0, 0, laserCanvasRef.current.width, laserCanvasRef.current.height);
      if (pointsRef.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#f87171'; ctx.lineWidth = 4; ctx.shadowBlur = 12; ctx.shadowColor = '#ef4444';
        pointsRef.current.forEach((p, i) => {
          const age = (now - p.t) / 800;
          ctx.globalAlpha = 1 - age;
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      animationId = requestAnimationFrame(animateLaser);
    };
    animateLaser();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const getPointerPos = (e) => {
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, xPerc: (x / rect.width) * 100, yPerc: (y / rect.height) * 100 };
  };

  const handleStart = (e) => {
    if (tool === 'select') return;
    const { x, y, xPerc, yPerc } = getPointerPos(e);
    if (tool === 'text') {
      onTextAdd(xPerc, yPerc);
      return;
    }
    if (tool === 'laser') {
      pointsRef.current = [{ x, y, t: Date.now() }];
    } else {
      const ctx = drawCtxRef.current;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === 'highlighter' ? size * 6 : size;
      ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1.0;
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    }
    setIsDrawing(true);
  };

  const handleMove = (e) => {
    if (!isDrawing) return;
    const { x, y } = getPointerPos(e);
    if (tool === 'laser') {
      pointsRef.current.push({ x, y, t: Date.now() });
    } else if (tool !== 'text') {
      const ctx = drawCtxRef.current;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleEnd = () => {
    if (isDrawing) {
      if (tool !== 'laser' && tool !== 'text') drawCtxRef.current.closePath();
      setIsDrawing(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30">
      <canvas 
        ref={drawingCanvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        className={`absolute inset-0 touch-none z-10 ${tool === 'select' ? 'pointer-events-none' : 'cursor-crosshair pointer-events-auto'}`}
      />
      <canvas ref={laserCanvasRef} className="absolute inset-0 pointer-events-none z-20" />
    </div>
  );
};

const ToolBtn = ({ active, onClick, icon, color, title }) => (
  <button 
    onClick={onClick} 
    title={title}
    className={`p-2 rounded-lg transition-all group relative ${active ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
  >
    {icon}
    {color && <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-[#0f172a]" style={{ backgroundColor: color }} />}
    <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-[10px] text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-[60]">
      {title}
    </span>
  </button>
);

export default App;
