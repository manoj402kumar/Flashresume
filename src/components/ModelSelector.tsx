"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModelSelectorProps {
  storageKey: string;
  label: string;
}

export const MODELS = {
  r1_preferred_model: [
    { id: "", name: "Auto (Fastest Available)" },
    { id: "mistral-medium-latest", name: "Mistral Medium (Mistral)" },
    { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron (NVIDIA)" },
    { id: "mistral-large-latest", name: "Mistral Large (Mistral)" },
    { id: "mistralai/mistral-medium-3.5-128b", name: "Mistral Medium 3.5 (NVIDIA)" },
    { id: "ministral-8b-latest", name: "Ministral 8B (Mistral)" },
    { id: "mistralai/ministral-14b-instruct-2512", name: "Ministral 14B (NVIDIA)" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)" },
    { id: "mistralai/mixtral-8x22b-instruct-v0.1", name: "Mixtral 8x22B (NVIDIA)" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Groq)" },
    { id: "mistral-small-latest", name: "Mistral Small (Mistral)" },
    { id: "mistralai/mistral-small-4-119b-2603", name: "Mistral Small 4 (NVIDIA)" },
    { id: "mistral-tiny-latest", name: "Mistral Tiny (Mistral)" },
    { id: "open-mistral-nemo", name: "Mistral Nemo (Mistral)" }
  ],
  preferred_model: [
    { id: "", name: "Auto (Best Quality Available)" },
    { id: "mistral-medium-latest", name: "Mistral Medium (Mistral)" },
    { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron (NVIDIA)" },
    { id: "mistral-large-latest", name: "Mistral Large (Mistral)" },
    { id: "mistralai/mistral-medium-3.5-128b", name: "Mistral Medium 3.5 (NVIDIA)" },
    { id: "ministral-8b-latest", name: "Ministral 8B (Mistral)" },
    { id: "mistralai/ministral-14b-instruct-2512", name: "Ministral 14B (NVIDIA)" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)" },
    { id: "mistralai/mixtral-8x22b-instruct-v0.1", name: "Mixtral 8x22B (NVIDIA)" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Groq)" },
    { id: "mistral-small-latest", name: "Mistral Small (Mistral)" },
    { id: "mistralai/mistral-small-4-119b-2603", name: "Mistral Small 4 (NVIDIA)" },
    { id: "mistral-tiny-latest", name: "Mistral Tiny (Mistral)" },
    { id: "open-mistral-nemo", name: "Mistral Nemo (Mistral)" }
  ]
};

export default function ModelSelector({ storageKey, label }: ModelSelectorProps) {
  const [selected, setSelected] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options = storageKey === "r1_preferred_model" 
    ? MODELS.r1_preferred_model 
    : MODELS.preferred_model;

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
            className="absolute bottom-full left-0 right-0 mb-2 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xl overflow-hidden z-50 py-1"
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
