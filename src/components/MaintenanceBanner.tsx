"use client";

import { Wrench } from "lucide-react";

export default function MaintenanceBanner() {
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE !== "true") return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f1117] flex flex-col items-center justify-center text-center px-6">
      <div className="bg-surface-container/50 border border-surface-container-high rounded-2xl p-8 max-w-md w-full shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-8 h-8 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-3">
          Under Maintenance
        </h1>
        <p className="text-on-surface-variant mb-6 text-sm leading-relaxed">
          We are currently migrating our database to a faster region to serve you better. Flashresume will be back online shortly. Thank you for your patience!
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-on-surface-muted font-medium">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
          Migration in progress...
        </div>
      </div>
    </div>
  );
}
