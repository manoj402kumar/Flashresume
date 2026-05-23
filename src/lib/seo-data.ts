export interface SEOPageData {
  slug: string;
  h1: string;
  title: string;
  description: string;
  heroText: string;
  features: string[];
}

export const seoPages: SEOPageData[] = [
  // Target 1: JD Optimizer
  {
    slug: "tailor-resume-to-job-description",
    h1: "Tailor Your Resume to Any Job Description with AI",
    title: "Tailor Resume to Job Description AI | Flashresume",
    description: "Beat the ATS robot. Instantly tailor your resume to any job description using our AI keyword optimizer and bypass ATS filters.",
    heroText: "Don't get rejected by a robot. Upload your resume and the job description, and our AI will automatically optimize your keywords to get you shortlisted.",
    features: ["ATS Match Score Calculation", "Missing Keyword Injection", "Instant PDF Download"]
  },
  {
    slug: "ats-resume-checker",
    h1: "Free ATS Resume Checker & Optimizer",
    title: "ATS Resume Checker & Keyword Optimizer | Flashresume",
    description: "Check your ATS resume score online for free. Our AI analyzer finds missing keywords and formats your PDF to pass Applicant Tracking Systems.",
    heroText: "Are you passing the ATS test? 90% of large companies use Applicant Tracking Systems. Check your score and optimize your resume instantly.",
    features: ["Deep ATS Parsing", "Formatting Fixes", "Keyword Gap Analysis"]
  },
  
  // Target 2: Visual & Formats
  {
    slug: "ats-friendly-resume-format",
    h1: "Convert Your Resume to an ATS Friendly Format",
    title: "ATS Friendly Resume Formatter & Builder | Flashresume",
    description: "Fix broken tables and unreadable PDFs. Convert your existing resume into a beautiful, 100% ATS compliant format in 60 seconds.",
    heroText: "If your resume has complex tables, columns, or graphics, the ATS can't read it. We instantly convert your content into a sleek, professional, ATS-approved layout.",
    features: ["Single Column Conversion", "Standardized Fonts", "Machine-Readable PDF Export"]
  },

  // Target 3: Students / Freshers
  {
    slug: "fresher-resume-builder",
    h1: "The Best AI Resume Builder for Freshers",
    title: "Best Resume Builder for Freshers & Students | Flashresume",
    description: "No experience? No problem. Build your first professional fresher resume from scratch using our AI-powered templates tailored for campus placements.",
    heroText: "Stand out in campus placements. Our AI helps you highlight your projects, education, and skills to create a powerful resume even with zero work experience.",
    features: ["Project Highlighting", "Skills Auto-Suggestions", "Modern Entry-Level Templates"]
  },
  {
    slug: "tcs-ninja-resume-format",
    h1: "TCS Ninja & Indian IT Fresher Resume Format",
    title: "TCS Ninja Resume Format & Fresher Template | Flashresume",
    description: "Get shortlisted for TCS Ninja, Infosys, and Wipro. Use the exact resume format preferred by Indian IT mass recruiters for freshers.",
    heroText: "Mass recruiters look for specific structures. We've built the ultimate ATS-friendly fresher template designed specifically to pass TCS, Infosys, and Wipro screenings.",
    features: ["Academic Score Prominence", "Technical Skills Focus", "1-Page Standard Format"]
  },
  {
    slug: "software-engineer-resume",
    h1: "Software Engineer ATS Resume Builder",
    title: "Software Engineer Resume Builder & Templates | Flashresume",
    description: "Build a top-tier software engineer resume. Optimize for tech stacks, GitHub projects, and pass the strict ATS filters of FAANG and top startups.",
    heroText: "Engineering resumes need to hit hard and fast. Highlight your tech stack, system design experience, and measurable impact with our developer-focused AI builder.",
    features: ["Tech Stack Organization", "GitHub & Portfolio Integration", "Action Verb Suggestions"]
  },

  // Target 4: PDF Editing
  {
    slug: "edit-pdf-resume-online",
    h1: "Edit Your PDF Resume Online Free",
    title: "Edit PDF Resume Online | Modify Text Instantly",
    description: "Lost your Word document? Upload your PDF resume and easily edit text, add dates, and modify bullet points directly in your browser.",
    heroText: "No need to recreate your resume from scratch. Upload your existing PDF, and our AI will extract the text so you can update it instantly and re-download.",
    features: ["Instant Text Extraction", "Live Editing Preview", "No Watermark PDF Download"]
  }
];
