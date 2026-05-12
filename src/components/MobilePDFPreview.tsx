"use client";

import React, { useState, useEffect, useRef } from 'react';
import { pdf } from "@react-pdf/renderer";
import { Document as ReactPDFDocument, Page as ReactPDFPage, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function MobilePDFPreview({ children }: { children: React.ReactElement }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width reactively so the PDF page always fills it exactly
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(containerRef.current);
    // Set initial width immediately
    setContainerWidth(Math.floor(containerRef.current.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  // Render PDF blob whenever children (template) changes
  useEffect(() => {
    let url: string;
    pdf(children as any).toBlob().then((blob) => {
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    }).catch(console.error);
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden flex justify-center bg-white rounded-sm">
      {!blobUrl || containerWidth === 0 ? (
        <div className="w-full h-full flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <ReactPDFDocument
          file={blobUrl}
          loading={<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary my-10" />}
          error={<div className="p-4 text-center text-error">Failed to load PDF preview.</div>}
        >
          <ReactPDFPage
            pageNumber={1}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            width={containerWidth}
          />
        </ReactPDFDocument>
      )}
    </div>
  );
}
