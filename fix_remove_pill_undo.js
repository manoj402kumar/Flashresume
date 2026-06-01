const fs = require('fs');
const path = 'src/app/result/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Remove the entire Undo/Redo block from the pill nav bar
const undoBlock = `\r\n                {/* \u2500\u2500 Undo / Redo buttons \u2014 right-aligned in pill bar \u2500\u2500 */}\r\n                <div className="flex items-center gap-1 ml-auto flex-shrink-0">\r\n                  <button\r\n                    type="button"\r\n                    onClick={handleUndo}\r\n                    disabled={!canUndo}\r\n                    title="Undo (Ctrl+Z)"\r\n                    className={\`flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all duration-200 \${\r\n                      canUndo\r\n                        ? 'bg-white/6 text-white/70 border-white/10 hover:bg-white/15 hover:text-white active:scale-95'\r\n                        : 'bg-transparent text-white/20 border-white/5 cursor-not-allowed'\r\n                    }\`}\r\n                  >\r\n                    <Undo2 className="w-3 h-3" />\r\n                    <span className="hidden sm:inline">Undo</span>\r\n                  </button>\r\n                  <button\r\n                    type="button"\r\n                    onClick={handleRedo}\r\n                    disabled={!canRedo}\r\n                    title="Redo (Ctrl+Y)"\r\n                    className={\`flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all duration-200 \${\r\n                      canRedo\r\n                        ? 'bg-white/6 text-white/70 border-white/10 hover:bg-white/15 hover:text-white active:scale-95'\r\n                        : 'bg-transparent text-white/20 border-white/5 cursor-not-allowed'\r\n                    }\`}\r\n                  >\r\n                    <Redo2 className="w-3 h-3" />\r\n                    <span className="hidden sm:inline">Redo</span>\r\n                  </button>\r\n                </div>`;

if (!content.includes(undoBlock)) {
  console.error('Block not found!');
  process.exit(1);
}

content = content.replace(undoBlock, '');
fs.writeFileSync(path, content, 'utf-8');
console.log('Removed Undo/Redo from pill nav bar. Done!');
