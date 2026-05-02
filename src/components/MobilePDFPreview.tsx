"use client";

import React, { useState, useEffect } from 'react';
import { pdf } from "@react-pdf/renderer";
import { Document as ReactPDFDocument, Page as ReactPDFPage, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function MobilePDFPreview({ children }: { children: React.ReactElement }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(300);

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    let url: string;
    pdf(children as any).toBlob().then((blob) => {
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    }).catch(console.error);
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!blobUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden flex justify-center bg-white rounded-sm">
      <ReactPDFDocument 
        file={blobUrl} 
        loading={<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary my-10" />}
        error={<div className="p-4 text-center text-error">Failed to load PDF preview.</div>}
      >
        <ReactPDFPage 
          pageNumber={1} 
          renderTextLayer={false} 
          renderAnnotationLayer={false} 
          width={Math.min(windowWidth - 32, 400)} 
        />
      </ReactPDFDocument>
    </div>
  );
}
