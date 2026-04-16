"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type ModelChoice = "gemini" | "mistral" | "groq";

export interface ModelSelection {
  provider: ModelChoice;
  model: string;
}

export const DEFAULT_MODEL_SELECTION: ModelSelection = {
  provider: "mistral",
  model: "mistral-medium-latest",
};

interface ModelSelectorProps {
  value: ModelSelection;
  onChange: (selection: ModelSelection) => void;
  label?: string;
}

const PROVIDER_MODELS = {
  gemini: {
    label: "Gemini",
    badge: "Google",
    description: "Fast & reliable",
    activeBg: "bg-blue-500/10 border-blue-500/50",
    activeText: "text-blue-400",
    dot: "bg-blue-400",
    models: [
      { id: "gemini-2.5-flash",                    label: "Gemini 2.5 Flash",      note: "Best quality" },
      { id: "gemini-2.5-flash-lite-preview-06-17", label: "Gemini 2.5 Flash Lite", note: "Faster"       },
      { id: "gemma-3-27b-it",                      label: "Gemma 3 27B",           note: "Fallback"     },
    ],
    default: "gemini-2.5-flash",
  },
  mistral: {
    label: "Mistral",
    badge: "Recommended ⚡",
    description: "High quality JSON",
    activeBg: "bg-orange-400/10 border-orange-400/50",
    activeText: "text-orange-400",
    dot: "bg-orange-400",
    models: [
      { id: "mistral-large-latest",  label: "Mistral Large",  note: "Best quality" },
      { id: "mistral-medium-latest", label: "Mistral Medium", note: "Balanced"     },
      { id: "open-mistral-nemo",     label: "Mistral Nemo",   note: "Fastest"      },
    ],
    default: "mistral-medium-latest",
  },
  groq: {
    label: "Groq",
    badge: "Ultra Fast ⚡⚡",
    description: "LPU inference",
    activeBg: "bg-red-500/10 border-red-500/50",
    activeText: "text-red-400",
    dot: "bg-red-400",
    models: [
      { id: "llama-3.3-70b-versatile",        label: "Llama 3.3 70B", note: "Best quality" },
      { id: "llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", note: "Latest model" },
      { id: "qwen-qwq-32b",                   label: "Qwen QwQ 32B",  note: "Strong JSON"  },
      { id: "llama3-8b-8192",                 label: "Llama 3 8B",    note: "Fastest"      },
    ],
    default: "llama-3.3-70b-versatile",
  },
} as const;

export default function ModelSelector({ value, onChange, label }: ModelSelectorProps) {
  const [openDropdown, setOpenDropdown] = useState<ModelChoice | null>(null);

  const handleProviderClick = (providerId: ModelChoice) => {
    if (value.provider !== providerId) {
      onChange({ provider: providerId, model: PROVIDER_MODELS[providerId].default });
      setOpenDropdown(providerId);
    } else {
      setOpenDropdown(prev => prev === providerId ? null : providerId);
    }
  };

  const handleModelSelect = (providerId: ModelChoice, modelId: string) => {
    onChange({ provider: providerId, model: modelId });
    setOpenDropdown(null);
  };

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1">
          {label}
        </p>
      )}
      <div className="flex gap-3">
        {(Object.keys(PROVIDER_MODELS) as ModelChoice[]).map((providerId) => {
          const provider = PROVIDER_MODELS[providerId];
          const isActive = value.provider === providerId;
          const isOpen = openDropdown === providerId;
          const selectedModel = isActive ? provider.models.find(m => m.id === value.model) : null;

          return (
            <div key={providerId} className="flex-1 relative">
              <button
                type="button"
                onClick={() => handleProviderClick(providerId)}
                className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-left active:scale-95
                  ${isActive ? provider.activeBg : "bg-surface-container-low border-transparent hover:border-surface-container-high"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm truncate ${isActive ? provider.activeText : "text-on-surface-variant"}`}>
                    {provider.label}
                    <span className={`ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded-full
                      ${isActive ? "bg-on-background/10 text-on-background" : "bg-surface-container-high text-on-surface-variant"}`}>
                      {provider.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant truncate">
                    {isActive && selectedModel ? selectedModel.label : provider.description}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isActive && <div className={`w-2 h-2 rounded-full ${provider.dot}`} />}
                  {isActive && (isOpen
                    ? <ChevronUp className={`w-3.5 h-3.5 ${provider.activeText}`} />
                    : <ChevronDown className={`w-3.5 h-3.5 ${provider.activeText}`} />
                  )}
                </div>
              </button>

              {isActive && isOpen && (
                <div className={`absolute top-full left-0 right-0 mt-1.5 rounded-xl border-2 overflow-hidden z-20 shadow-xl ${provider.activeBg}`}>
                  {provider.models.map((model, idx) => {
                    const isSelected = value.model === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleModelSelect(providerId, model.id)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors
                          ${isSelected ? "bg-on-background/10" : "hover:bg-on-background/5"}
                          ${idx !== provider.models.length - 1 ? "border-b border-on-background/5" : ""}`}
                      >
                        <div>
                          <div className={`text-sm font-semibold ${isSelected ? provider.activeText : "text-on-surface-variant"}`}>
                            {model.label}
                          </div>
                          <div className="text-[11px] text-on-surface-variant/70">{model.note}</div>
                        </div>
                        {isSelected && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${provider.dot}`} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
