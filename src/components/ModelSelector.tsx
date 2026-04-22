"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type ModelChoice = "gemini" | "mistral" | "groq" | "cerebras" | "cloudflare";

export interface ModelSelection {
  provider: ModelChoice;
  model: string;
}

export const DEFAULT_MODEL_SELECTION: ModelSelection = {
  provider: "mistral",
  model: "mistral-large-latest",
};

interface ModelSelectorProps {
  value: ModelSelection;
  onChange: (selection: ModelSelection) => void;
  label?: string;
}

const PROVIDER_MODELS = {
  gemini: {
    label: "Gemini",
    badge: "Google AI",
    description: "Fast & reliable",
    activeBg: "bg-blue-500/10 border-blue-500/50",
    activeText: "text-blue-400",
    dot: "bg-blue-400",
    models: [
      { id: "gemini-2.5-flash",              label: "Gemini 2.5 Flash",        note: "Best quality" },
      { id: "gemini-3-flash-preview",        label: "Gemini 3 Flash Preview",  note: "Latest"       },
      { id: "gemini-2.5-flash-lite",         label: "Gemini 2.5 Flash Lite",   note: "Faster"       },
      { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite",   note: "Lightest"     },
      { id: "gemma-3-27b-it",                label: "Gemma 3 27B",             note: "Open source"  },
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
      { id: "mistral-small-latest",  label: "Mistral Small",  note: "Lighter"      },
      { id: "ministral-8b-latest",   label: "Ministral 8B",   note: "Fast"         },
      { id: "open-mistral-nemo",     label: "Mistral Nemo",   note: "Open source"  },
      { id: "mistral-tiny-latest",   label: "Mistral Tiny",   note: "Fastest"      },
    ],
    default: "mistral-large-latest",
  },
  groq: {
    label: "Groq",
    badge: "Ultra Fast ⚡⚡",
    description: "LPU inference",
    activeBg: "bg-red-500/10 border-red-500/50",
    activeText: "text-red-400",
    dot: "bg-red-400",
    models: [
      { id: "openai/gpt-oss-120b",     label: "GPT OSS 120B",      note: "Best quality" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",     note: "Reliable"     },
      { id: "qwen/qwen3-32b",          label: "Qwen 3 32B",         note: "Strong JSON"  },
      { id: "llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B", note: "Latest"       },
      { id: "openai/gpt-oss-20b",      label: "GPT OSS 20B",       note: "Balanced"     },
      { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",      note: "Fastest"      },
    ],
    default: "openai/gpt-oss-120b",
  },
  cerebras: {
    label: "Cerebras",
    badge: "Wafer Scale 🧠",
    description: "Ultra fast inference",
    activeBg: "bg-purple-500/10 border-purple-500/50",
    activeText: "text-purple-400",
    dot: "bg-purple-400",
    models: [
      { id: "qwen-3-235b-a22b", label: "Qwen 3 235B",  note: "Best quality" },
      { id: "llama3.1-8b", label: "Llama 3.1 8B", note: "Fastest"      },
    ],
    default: "qwen-3-235b",
  },
  cloudflare: {
    label: "Cloudflare",
    badge: "Edge AI ☁️",
    description: "Global edge network",
    activeBg: "bg-yellow-500/10 border-yellow-500/50",
    activeText: "text-yellow-400",
    dot: "bg-yellow-400",
    models: [
      { id: "llama-3.1-8b-instruct", label: "Llama 3.1 8B",       note: "Reliable" },
      { id: "cf-mistral-7b-instruct",   label: "Mistral 7B Instruct", note: "Balanced" },
    ],
    default: "llama-3.1-8b-instruct",
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
    <div className="space-y-3 mt-4">
      {label && (
        <label className="text-sm font-bold text-on-background px-1 block">
          {label}
        </label>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative">
        {(Object.keys(PROVIDER_MODELS) as ModelChoice[]).map((providerId) => {
          const provider = PROVIDER_MODELS[providerId];
          const isActive = value.provider === providerId;
          const isOpen = openDropdown === providerId;
          const selectedModel = isActive ? provider.models.find(m => m.id === value.model) : null;

          return (
            <div key={providerId} className="relative z-10 flex flex-col">
              <button
                type="button"
                onClick={() => handleProviderClick(providerId)}
                className={`w-full flex-1 flex flex-col justify-center items-start text-left px-4 py-3 rounded-2xl transition-all duration-300 border focus:outline-none focus:ring-2 focus:ring-primary/30
                  ${isActive
                    ? `bg-surface-container-lowest ${provider.activeText.replace('text-', 'border-')}/30 shadow-md transform scale-[1.02] ring-1 ring-inset ${provider.activeText.replace('text-', 'ring-')}/20 text-on-background`
                    : "bg-surface-container-low border-surface-container-high hover:bg-surface-container-low/80 text-on-surface-variant hover:border-on-surface-variant/20"}`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className={`font-bold tracking-tight text-[15px] ${isActive ? provider.activeText : ""}`}>
                    {provider.label}
                  </div>
                  {isActive && (
                    <div className={`w-2 h-2 rounded-full ${provider.dot} animate-pulse shadow-sm`} />
                  )}
                </div>

                <div className="text-[12px] opacity-80 truncate w-full mb-2">
                  {isActive && selectedModel ? selectedModel.label : provider.description}
                </div>

                <div className="mt-auto w-full flex items-center justify-between">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                    ${isActive ? "bg-surface-container-high text-on-background" : "bg-surface-container text-on-surface"}`}>
                    {provider.badge}
                  </span>
                  {isActive && (
                    <div className="flex items-center justify-center bg-surface-container-high rounded-full p-1">
                      {isOpen ? <ChevronUp className={`w-3.5 h-3.5 ${provider.activeText}`} /> : <ChevronDown className={`w-3.5 h-3.5 ${provider.activeText}`} />}
                    </div>
                  )}
                </div>
              </button>

              {isActive && isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-surface-container-lowest rounded-2xl border border-surface-container-highest shadow-2xl overflow-hidden transform origin-top animate-in fade-in slide-in-from-top-2">
                  <div className="p-1">
                    {provider.models.map((model) => {
                      const isSelected = value.model === model.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => handleModelSelect(providerId, model.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left rounded-xl transition-colors mb-0.5 last:mb-0
                            ${isSelected ? "bg-surface-container-high" : "hover:bg-surface-container-low"}`}
                        >
                          <div>
                            <div className={`text-[13px] font-bold ${isSelected ? provider.activeText : "text-on-background"}`}>
                              {model.label}
                            </div>
                            <div className="text-[11px] text-on-surface-variant leading-tight">{model.note}</div>
                          </div>
                          {isSelected && <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${provider.dot}`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
