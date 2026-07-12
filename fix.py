import re
import os

files = ['src/app/result/page.tsx', 'src/app/scratch/page.tsx']

for filepath in files:
    if not os.path.exists(filepath):
        print(f"Not found: {filepath}")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace <motion.div layout with <motion.div layout="position"
    content = re.sub(r'<motion\.div\s*\n\s*layout\b', '<motion.div\n                            layout="position"', content)

    # 2. Remove whileHover={{ y: -4 }}
    content = re.sub(r'\s*whileHover=\{\{\s*y:\s*-4\s*\}\}', '', content)

    # 3. Replace key={idx} in specific arrays
    # Education
    content = re.sub(r'(resume\.education\.map\([^)]+\)\s*=>\s*\(\s*<div\s+)key=\{idx\}', r'\1key={`edu-${idx}-${edu.institution?.slice(0, 15) || ""}`}', content)
    # Experience
    content = re.sub(r'(resume\.experience\.map\([^)]+\)\s*=>\s*\(\s*<div\s+)key=\{idx\}', r'\1key={`exp-${idx}-${exp.company?.slice(0, 15) || ""}`}', content)
    # Projects
    content = re.sub(r'(resume\.projects\.map\([^)]+\)\s*=>\s*\(\s*<div\s+)key=\{idx\}', r'\1key={`proj-${idx}-${proj.title?.slice(0, 15) || ""}`}', content)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Processed {filepath}")
