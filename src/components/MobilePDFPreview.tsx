"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { pdf } from "@react-pdf/renderer";
import { Document as ReactPDFDocument, Page as ReactPDFPage, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  children: React.ReactElement;
  /** Pass JSON.stringify(resume) — triggers debounced PDF re-render on content change */
  refreshKey?: string;
}

export default function MobilePDFPreview({ children, refreshKey }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [numPages, setNumPages] = useState<number>(1);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef(children);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always keep childrenRef in sync so the debounced callback uses latest children
  childrenRef.current = children;

  // Measure container width reactively
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

  const generateBlob = useCallback(() => {
    let url: string;
    pdf(childrenRef.current as any).toBlob().then((blob) => {
      url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setRefreshing(false);
    }).catch(console.error);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  // Initial render on mount
  useEffect(() => {
    generateBlob();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced re-render when resume content changes (refreshKey)
  useEffect(() => {
    if (!refreshKey) return;
    setRefreshing(true);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      generateBlob();
    }, 1500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden bg-white rounded-sm relative">
      {/* Subtle updating indicator — shown while debounce is pending */}
      {refreshing && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Updating…
        </div>
      )}

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
          {Array.from({ length: numPages }, (_, i) => (
            <React.Fragment key={i + 1}>
              <ReactPDFPage
                pageNumber={i + 1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={containerWidth}
                devicePixelRatio={typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2}
              />
              {i < numPages - 1 && (
                <div style={{ height: "2px", background: "#000", width: "100%" }} />
              )}
            </React.Fragment>
          ))}
        </ReactPDFDocument>
      )}
    </div>
  );
}
