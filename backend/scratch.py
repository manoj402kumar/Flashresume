import re

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    content = content.replace(
        'const [openEditSection, setOpenEditSection] = useState<string>("contact");',
        'const [openEditSections, setOpenEditSections] = useState<Record<string, boolean>>({ contact: true });\n  const toggleSection = (sec: string) => setOpenEditSections(p => ({ ...p, [sec]: not p.get(sec) }));'.replace('not', '!')
    )

    content = re.sub(
        r'onClick=\{\(\) => editMode && setOpenEditSection\(openEditSection === (.*?) \? "" \: .*?\)\}',
        r'onClick={() => editMode && toggleSection(\1)}',
        content
    )

    content = re.sub(
        r'openEditSection === (.*?) \? 180 \: 0',
        r'openEditSections[\1] ? 180 : 0',
        content
    )

    content = re.sub(
        r'\(\!editMode \|\| openEditSection === (.*?)\)',
        r'(!editMode || openEditSections[\1])',
        content
    )
    
    content = content.replace(
        'className="flex-1 rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm mr-4"',
        'className="flex-1 min-w-0 rounded-xl px-4 py-2 border border-on-surface-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 hover:border-on-surface-variant/40 transition-all duration-300 shadow-sm mr-2"'
    )
    content = content.replace(
        'className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"',
        'className="flex-shrink-0 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold"'
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Processed {filepath}")

process_file(r"d:\FlashresumeFolder\Flashresumev2\src\app\result\page.tsx")
process_file(r"d:\FlashresumeFolder\Flashresumev2\src\app\scratch\page.tsx")
