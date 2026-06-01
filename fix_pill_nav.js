const fs = require('fs');
const path = 'src/app/result/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Remove the extra outer flex wrapper div and its orphaned closing tag
// Before: outer flex div + inner grid div
// After: just the original grid div

const oldOpen = `              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">\r\n                <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">`;
const newOpen = `              <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">`;

if (!content.includes(oldOpen)) {
  console.error('Opening wrapper not found!');
  process.exit(1);
}
content = content.replace(oldOpen, newOpen);

// Remove the orphaned closing </div> (the inner grid close that was added)
// The pattern is: after + Custom button close, there's an extra </div> before the outer </div>
const oldClose = `                </button>\r\n                </div>\r\n\r\n              </div>`;
const newClose = `                </button>\r\n              </div>`;

if (!content.includes(oldClose)) {
  console.error('Closing wrapper not found!');
  // Show context
  const idx = content.indexOf('+ Custom');
  console.log(JSON.stringify(content.substring(idx, idx+200)));
  process.exit(1);
}
content = content.replace(oldClose, newClose);

fs.writeFileSync(path, content, 'utf-8');
console.log('Pill nav cleaned up. Extra wrapper div removed.');
