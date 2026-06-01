const fs = require('fs');
const path = 'src/app/result/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// --- 1. Add Undo2, Redo2 to imports ---
content = content.replace(
  `  Trash2\n} from "lucide-react";`,
  `  Trash2,\n  Undo2,\n  Redo2\n} from "lucide-react";`
);

// --- 2. Replace updateResume + auto-save with history-aware version ---
const oldBlock = `  const updateResume = (updates: Partial<TemplateV1>) => {
    setResume((prev) => prev ? { ...prev, ...updates } : null);
  };

  // Auto-save: persist resume to localStorage whenever it changes
  useEffect(() => {
    if (resume) {
      localStorage.setItem("generated_resume", JSON.stringify(resume));
    }
  }, [resume]);`;

const newBlock = `  // ── Undo / Redo history ──────────────────────────────────────────────────
  const MAX_HISTORY = 50;
  const historyRef = useRef<TemplateV1[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateResume = (updates: Partial<TemplateV1>) => {
    setResume((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
      truncated.push(next);
      if (truncated.length > MAX_HISTORY) truncated.shift();
      historyRef.current = truncated;
      historyIndexRef.current = truncated.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const prev = historyRef.current[historyIndexRef.current];
    setResume(prev);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const next = historyRef.current[historyIndexRef.current];
    setResume(next);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  // Seed history once resume first loads
  useEffect(() => {
    if (resume && historyRef.current.length === 0) {
      historyRef.current = [resume];
      historyIndexRef.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume === null]);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editMode) return;
      const isInput = (e.target as HTMLElement)?.tagName === 'INPUT' ||
                      (e.target as HTMLElement)?.tagName === 'TEXTAREA';
      if (!isInput && (e.ctrlKey || e.metaKey)) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, canUndo, canRedo]);

  // Auto-save: persist resume to localStorage whenever it changes
  useEffect(() => {
    if (resume) {
      localStorage.setItem("generated_resume", JSON.stringify(resume));
    }
  }, [resume]);`;

if (!content.includes(oldBlock)) {
  console.error('ERROR: updateResume block not found!');
  process.exit(1);
}
content = content.replace(oldBlock, newBlock);

// --- 3. Add Undo/Redo buttons inside the pill nav bar ---
// Target: the closing </div> and )} of the pill nav
const oldPillClose = `                + Custom
                </button>
              </div>
            </div>
          )}`;

const newPillClose = `                + Custom
                </button>
              </div>

              {/* ── Undo / Redo buttons — right-aligned in pill bar ── */}
              <div className="flex items-center gap-1 ml-auto pt-1 sm:pt-0 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  className={\`flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all duration-200 \${
                    canUndo
                      ? 'bg-white/6 text-white/70 border-white/10 hover:bg-white/15 hover:text-white active:scale-95'
                      : 'bg-transparent text-white/20 border-white/5 cursor-not-allowed'
                  }\`}
                >
                  <Undo2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                  className={\`flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all duration-200 \${
                    canRedo
                      ? 'bg-white/6 text-white/70 border-white/10 hover:bg-white/15 hover:text-white active:scale-95'
                      : 'bg-transparent text-white/20 border-white/5 cursor-not-allowed'
                  }\`}
                >
                  <Redo2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Redo</span>
                </button>
              </div>
            </div>
          )}`;

if (!content.includes(oldPillClose)) {
  console.error('ERROR: pill nav close block not found!');
  process.exit(1);
}
content = content.replace(oldPillClose, newPillClose);

// --- 4. Fix pill nav container: change grid div to flex so Undo/Redo can right-align ---
const oldPillContainer = `              <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">`;
const newPillContainer = `              <div className="flex flex-wrap gap-1 sm:gap-1.5 items-start">`;

if (!content.includes(oldPillContainer)) {
  console.error('WARN: pill container not found — skipping grid fix');
} else {
  content = content.replace(oldPillContainer, newPillContainer);
  console.log('Pill container grid -> flex done');
}

fs.writeFileSync(path, content, 'utf-8');
console.log('Done! Undo/Redo added to result/page.tsx');
