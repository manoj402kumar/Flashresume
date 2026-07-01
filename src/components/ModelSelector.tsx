"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModelSelectorProps {
  storageKey: string;
  label: string;
}

export const MODELS = {
  r1_preferred_model: "auto",
  options: [
    { id: "auto", name: "Auto (Production Routing)" },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (Premium)" },
    
    // -- Pool 1 (Primary Fallbacks) --
    { id: "mistral-medium-3.5|key1", name: "Mistral Medium 3.5 (Mistral) - Key 1" },
    { id: "mistral-medium-3.5|key2", name: "Mistral Medium 3.5 (Mistral) - Key 2" },
    { id: "mistral-medium-3.5|key3", name: "Mistral Medium 3.5 (Mistral) - Key 3" },
    { id: "mistral-medium-2604|key1", name: "Mistral Medium 2604 (Mistral) - Key 1" },
    { id: "mistral-medium-2604|key2", name: "Mistral Medium 2604 (Mistral) - Key 2" },
    { id: "mistral-medium-2604|key3", name: "Mistral Medium 2604 (Mistral) - Key 3" },
    { id: "mistral-medium-latest|key1", name: "Mistral Medium (Mistral) - Key 1" },
    { id: "mistral-medium-latest|key2", name: "Mistral Medium (Mistral) - Key 2" },
    { id: "mistral-medium-latest|key3", name: "Mistral Medium (Mistral) - Key 3" },
    { id: "mistral-large-2512|key1", name: "Mistral Large 2512 (Mistral) - Key 1" },
    { id: "mistral-large-2512|key2", name: "Mistral Large 2512 (Mistral) - Key 2" },
    { id: "mistral-large-2512|key3", name: "Mistral Large 2512 (Mistral) - Key 3" },
    { id: "mistral-medium-2508|key1", name: "Mistral Medium 2508 (Mistral) - Key 1" },
    { id: "mistral-medium-2508|key2", name: "Mistral Medium 2508 (Mistral) - Key 2" },
    { id: "mistral-medium-2508|key3", name: "Mistral Medium 2508 (Mistral) - Key 3" },
    { id: "mistral-large-latest|key1", name: "Mistral Large (Mistral) - Key 1" },
    { id: "mistral-large-latest|key2", name: "Mistral Large (Mistral) - Key 2" },
    { id: "mistral-large-latest|key3", name: "Mistral Large (Mistral) - Key 3" },

    // -- Pool 2 (Secondary Fallbacks) --
    { id: "ministral-14b-latest|key1", name: "Ministral 14B (Mistral) - Key 1" },
    { id: "ministral-14b-latest|key2", name: "Ministral 14B (Mistral) - Key 2" },
    { id: "ministral-14b-latest|key3", name: "Ministral 14B (Mistral) - Key 3" },
    { id: "mistral-small-latest|key1", name: "Mistral Small (Mistral) - Key 1" },
    { id: "mistral-small-latest|key2", name: "Mistral Small (Mistral) - Key 2" },
    { id: "mistral-small-latest|key3", name: "Mistral Small (Mistral) - Key 3" },
    { id: "mistral-small-2506|key1", name: "Mistral Small 2506 (Mistral) - Key 1" },
    { id: "mistral-small-2506|key2", name: "Mistral Small 2506 (Mistral) - Key 2" },
    { id: "mistral-small-2506|key3", name: "Mistral Small 2506 (Mistral) - Key 3" },
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast|key1", name: "Llama 3.3 70B Fast (Cloudflare) - Key 1" },
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast|key2", name: "Llama 3.3 70B Fast (Cloudflare) - Key 2" },
    { id: "mistralai/ministral-14b-instruct-2512|key1", name: "Ministral 14B 2512 (NVIDIA) - Key 1" },
    { id: "mistralai/ministral-14b-instruct-2512|key2", name: "Ministral 14B 2512 (NVIDIA) - Key 2" },
    { id: "@cf/mistralai/mistral-small-3.1-24b-instruct|key1", name: "Mistral Small 24B (Cloudflare) - Key 1" },
    { id: "@cf/mistralai/mistral-small-3.1-24b-instruct|key2", name: "Mistral Small 24B (Cloudflare) - Key 2" },
    { id: "mistralai/mistral-nemotron|key1", name: "Mistral Nemotron (NVIDIA) - Key 1" },
    { id: "mistralai/mistral-nemotron|key2", name: "Mistral Nemotron (NVIDIA) - Key 2" }
  ]
};


export default function ModelSelector({ storageKey, label }: ModelSelectorProps) {
  const [selected, setSelected] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options = MODELS.options;

  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setSelected(saved);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, id);
    }
    setIsOpen(false);
  };

  const selectedModel = options.find(o => o.id === selected) || options[0];

  return (
    <div className="flex flex-col gap-1.5 w-full relative pt-2" ref={dropdownRef}>
      <label className="font-sans text-[11px] font-bold uppercase tracking-wider text-on-surface-variant ml-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-xl text-sm font-medium text-on-background border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-on-surface-variant" />
          <span className="font-semibold">{selectedModel.name}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xl overflow-y-auto max-h-72 z-50 py-1"
          >
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-surface-container-low transition-colors flex items-center justify-between ${
                  selected === opt.id ? "bg-primary/5 text-primary font-bold" : "text-on-background"
                }`}
              >
                {opt.name}
                {selected === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
