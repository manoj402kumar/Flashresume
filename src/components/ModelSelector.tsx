"use client";

export type ModelChoice = "gemini" | "mistral";

interface ModelSelectorProps {
  value: ModelChoice;
  onChange: (model: ModelChoice) => void;
  label?: string;
}

const MODELS = [
  {
    id: "gemini" as ModelChoice,
    name: "Gemini",
    badge: "Google",
    description: "Fast & reliable",
    activeBg: "bg-blue-500/10 border-blue-500/50",
    activeText: "text-blue-400",
    dot: "bg-blue-400",
  },
  {
    id: "mistral" as ModelChoice,
    name: "Mistral",
    badge: "La Plateforme",
    description: "High quality JSON",
    activeBg: "bg-orange-400/10 border-orange-400/50",
    activeText: "text-orange-400",
    dot: "bg-orange-400",
  },
];

export default function ModelSelector({ value, onChange, label }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1">
          {label}
        </p>
      )}
      <div className="flex gap-3">
        {MODELS.map((model) => {
          const isActive = value === model.id;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id)}
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left active:scale-95
                ${isActive ? model.activeBg : "bg-surface-container-low border-transparent hover:border-surface-container-high"}`}
            >
              <div className="flex-1">
                <div className={`font-bold text-sm ${isActive ? model.activeText : "text-on-surface-variant"}`}>
                  {model.name}
                  <span className={`ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded-full
                    ${isActive ? "bg-on-background/10 text-on-background" : "bg-surface-container-high text-on-surface-variant"}`}>
                    {model.badge}
                  </span>
                </div>
                <div className="text-[11px] text-on-surface-variant">{model.description}</div>
              </div>
              {isActive && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${model.dot}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
