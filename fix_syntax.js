const fs = require('fs');
let code = fs.readFileSync('src/app/generate/page.tsx', 'utf8');
code = code.replace(
  /extracted_links: extractedLinks\n\s*\}, signal\n\s*\}/,
  'extracted_links: extractedLinks\n        }, signal)'
);
// wait, let's just use regex correctly
code = code.replace(
  '        }, signal\n        });',
  '        }, signal);'
);
code = code.replace(
  '        }, signal ?? null,\n        });',
  '        }, signal);'
);
fs.writeFileSync('src/app/generate/page.tsx', code);
