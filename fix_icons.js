const fs = require('fs');

const filepath = 'src/app/result/page.tsx';
let newContent = fs.readFileSync(filepath, 'utf-8');

const icons = ['Code'];

for (const icon of icons) {
    const blockRegex = new RegExp(`<div className="w-12 h-12 rounded-2xl bg-[A-Za-z0-9\\-]+\\/20 flex items-center justify-center">\\s*<${icon} className="w-6 h-6 text-[A-Za-z0-9\\-]+" \\/>\\s*<\\/div>`, 'g');
    newContent = newContent.replace(blockRegex, (match) => {
        const parts = match.split('\n');
        const indent = parts[1] ? parts[1].match(/^\s*/)[0] : '';
        return `<div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">\n${indent}<${icon} className="w-6 h-6 text-black" />\n${indent.replace('  ', '')}</div>`;
    });
}

fs.writeFileSync(filepath, newContent, 'utf-8');
console.log('Replaced Code icon in result/page.tsx');
