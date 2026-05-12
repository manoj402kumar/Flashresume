"use client";

import React, { useState, useEffect, useRef } from 'react';
import { pdf } from "@react-pdf/renderer";
import { Document as ReactPDFDocument, Page as ReactPDFPage, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function MobilePDFPreview({ children }: { children: React.ReactElement }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [numPages, setNumPages] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width reactively so each PDF page fills the box exactly
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(containerRef.current);
    setContainerWidth(Math.floor(containerRef.current.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  // Re-render PDF blob whenever the template (children) changes
  useEffect(() => {
    let url: string;
    setBlobUrl(null);
    setNumPages(1);
    pdf(children as any).toBlob().then((blob) => {
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    }).catch(console.error);
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-hidden bg-white rounded-sm">
      {!blobUrl || containerWidth === 0 ? (
        <div className="w-full flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <ReactPDFDocument
          file={blobUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>}
          error={<div className="p-4 text-center text-error">Failed to load PDF preview.</div>}
        >
          {/* Render every page stacked — no content is clipped */}
          {Array.from({ length: numPages }, (_, i) => (
            <ReactPDFPage
              key={i + 1}
              pageNumber={i + 1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              width={containerWidth}
            />
          ))}
        </ReactPDFDocument>
      )}
    </div>
  );
}
