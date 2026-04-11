"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { pdf } from "@react-pdf/renderer";
import { 
  Download, 
  Copy, 
  RefreshCw, 
  Edit3, 
  Eye, 
  Sparkles, 
  Save,
  TrendingUp,
  CheckCircle2,
  Home,
  FileText,
  Zap
} from "lucide-react";
import type { TemplateV1 } from "@/lib/api";
import {
  isSkillAdded,
  isBulletEnhanced,
  getHighlightClass,
} from "@/lib/highlighting";
import ResumePDF from "@/components/ResumePDF";

// Helper component for editable skill tags
function EditableSkillTags({
  skills,
  onChange,
  editMode,
  colorClass,
  highlightedSkills = [],
  showHighlights = false,
}: {
  skills: string[];
  onChange: (newSkills: string[]) => void;
  editMode: boolean;
  colorClass: string;
  highlightedSkills?: string[];
  showHighlights?: boolean;
}) {
  const [newSkill, setNewSkill] = useState("");

  const addSkill = () => {
    if (newSkill.trim()) {
      onChange([...skills, newSkill.trim()]);
      setNewSkill(""); // Clear input after adding
    }
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, idx) => idx !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill, idx) => {
        const isHighlighted = highlightedSkills.includes(skill.toLowerCase());
        const highlightClass = showHighlights && isHighlighted ? "ring-2 ring-yellow-400" : "";
        
        return (
          <span
            key={idx}
            className={`px-3 py-1 ${colorClass} rounded-full text-sm flex items-center gap-2 ${highlightClass} transition-all`}
          >
            {skill}
            {showHighlights && isHighlighted && (
              <span className="text-xs" title="AI added">✨</span>
            )}
            {editMode && (
              <button
                onClick={() => removeSkill(idx)}
                className="hover:text-red-600 font-bold"
                type="button"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
      {editMode && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="+ Add skill"
            className="px-3 py-1 border-2 border-dashed border-gray-300 rounded-full text-sm focus:outline-none focus:border-indigo-500"
            style={{ minWidth: "100px" }}
          />
          {newSkill.trim() && (
            <button
              onClick={addSkill}
              className="px-3 py-1 bg-indigo-600 text-white rounded-full text-sm hover:bg-indigo-700"
              type="button"
            >
              ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const [resume, setResume] = useState<TemplateV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChanges, setShowChanges] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  useEffect(() => {
    // Load generated resume from localStorage
    const resumeData = localStorage.getItem("generated_resume");

    if (!resumeData) {
      router.push("/upload");
      return;
    }

    setResume(JSON.parse(resumeData));
    setLoading(false);
  }, [router]);

  const handleCopyJSON = () => {
    if (resume) {
      navigator.clipboard.writeText(JSON.stringify(resume, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartOver = () => {
    // Clear all localStorage
    localStorage.clear();
    router.push("/upload");
  };

  const handleSaveChanges = () => {
    if (resume) {
      localStorage.setItem("generated_resume", JSON.stringify(resume));
      setHasUnsavedChanges(false);
      alert("✅ Changes saved successfully!");
    }
  };

  const updateResume = (updates: Partial<TemplateV1>) => {
    setResume((prev) => prev ? { ...prev, ...updates } : null);
    setHasUnsavedChanges(true);
  };

  const handleDownloadPDF = async () => {
    if (!resume) return;

    try {
      setDownloadingPDF(true);
      
      // Generate PDF blob
      const blob = await pdf(<ResumePDF resume={resume} />).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resume.heading.name.replace(/\s+/g, "_")}_Resume.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading || !resume) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary-container animate-pulse" />
            </div>
          </div>
          <p className="text-on-surface-variant font-medium">Loading your resume...</p>
        </div>
      </div>
    );
  }

  const scoreImprovement = resume.ats_score_after - resume.ats_score_before;

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Glassmorphic Toolbar - Fixed Top */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 glass-header border-b border-surface-container-low"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-headline text-lg font-bold text-on-background">Your Resume</h1>
                <p className="text-xs text-on-surface-variant">AI-Optimized</p>
              </div>
            </div>

            {/* Center: Score Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.3 }}
              className="hidden md:flex items-center gap-3 bg-primary-container/10 px-6 py-3 rounded-full border border-primary-container/30"
            >
              <div className="text-center">
                <p className="text-xs text-on-surface-variant">Before</p>
                <p className="text-lg font-bold text-on-surface-variant">{resume.ats_score_before}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary" />
              <div className="text-center">
                <p className="text-xs text-primary">After</p>
                <p className="text-lg font-bold text-primary">{resume.ats_score_after}</p>
              </div>
              <div className="bg-primary text-white px-3 py-1 rounded-full text-sm font-bold">
                +{scoreImprovement}
              </div>
            </motion.div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHighlights(!showHighlights)}
                className={`p-2 rounded-xl transition-all ${
                  showHighlights
                    ? "bg-primary-container/20 text-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest"
                }`}
                title="Toggle highlights"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`p-2 rounded-xl transition-all ${
                  editMode
                    ? "bg-secondary-container/20 text-secondary-container"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest"
                }`}
                title="Toggle edit mode"
              >
                {editMode ? <Eye className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
              </button>
              {hasUnsavedChanges && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={handleSaveChanges}
                  className="p-2 rounded-xl bg-primary text-white hover:opacity-90 transition-all"
                  title="Save changes"
                >
                  <Save className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Resume Content (Left - 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Heading */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              {editMode ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={resume.heading.name}
                    onChange={(e) =>
                      updateResume({
                        heading: { ...resume.heading, name: e.target.value },
                      })
                    }
                    className="w-full text-2xl font-bold text-gray-900 border-2 border-indigo-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Full Name"
                  />
                  <input
                    type="tel"
                    value={resume.heading.phone}
                    onChange={(e) =>
                      updateResume({
                        heading: { ...resume.heading, phone: e.target.value },
                      })
                    }
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="📞 Phone"
                  />
                  <input
                    type="email"
                    value={resume.heading.email}
                    onChange={(e) =>
                      updateResume({
                        heading: { ...resume.heading, email: e.target.value },
                      })
                    }
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="📧 Email"
                  />
                  <input
                    type="url"
                    value={resume.heading.linkedin_url}
                    onChange={(e) =>
                      updateResume({
                        heading: { ...resume.heading, linkedin_url: e.target.value },
                      })
                    }
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="🔗 LinkedIn URL"
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {resume.heading.name}
                  </h2>
                  <div className="space-y-1 text-gray-700">
                    <p>📞 {resume.heading.phone}</p>
                    <p>📧 {resume.heading.email}</p>
                    {resume.heading.linkedin_url && (
                      <p>🔗 {resume.heading.linkedin_url}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Education */}
            {resume.education.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Education</h3>
                {resume.education.map((edu, idx) => (
                  <div key={idx} className="mb-4 last:mb-0">
                    {editMode ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            const newEducation = [...resume.education];
                            newEducation[idx].degree = e.target.value;
                            updateResume({ education: newEducation });
                          }}
                          className="w-full font-bold border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Degree"
                        />
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => {
                            const newEducation = [...resume.education];
                            newEducation[idx].institution = e.target.value;
                            updateResume({ education: newEducation });
                          }}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Institution"
                        />
                        <input
                          type="text"
                          value={edu.location}
                          onChange={(e) => {
                            const newEducation = [...resume.education];
                            newEducation[idx].location = e.target.value;
                            updateResume({ education: newEducation });
                          }}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Location"
                        />
                        <input
                          type="text"
                          value={edu.duration}
                          onChange={(e) => {
                            const newEducation = [...resume.education];
                            newEducation[idx].duration = e.target.value;
                            updateResume({ education: newEducation });
                          }}
                          className="w-full text-sm border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Duration"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-gray-900">{edu.degree}</p>
                        <p className="text-gray-700">{edu.institution}, {edu.location}</p>
                        <p className="text-sm text-gray-600">{edu.duration}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Experience */}
            {resume.experience.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Experience</h3>
                {resume.experience.map((exp, idx) => (
                  <div key={idx} className="mb-6 last:mb-0">
                    {editMode ? (
                      <div className="space-y-2 mb-3">
                        <input
                          type="text"
                          value={exp.job_title}
                          onChange={(e) => {
                            const newExperience = [...resume.experience];
                            newExperience[idx].job_title = e.target.value;
                            updateResume({ experience: newExperience });
                          }}
                          className="w-full font-bold border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Job Title"
                        />
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => {
                            const newExperience = [...resume.experience];
                            newExperience[idx].company = e.target.value;
                            updateResume({ experience: newExperience });
                          }}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Company"
                        />
                        <input
                          type="text"
                          value={exp.location}
                          onChange={(e) => {
                            const newExperience = [...resume.experience];
                            newExperience[idx].location = e.target.value;
                            updateResume({ experience: newExperience });
                          }}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Location"
                        />
                        <input
                          type="text"
                          value={exp.duration}
                          onChange={(e) => {
                            const newExperience = [...resume.experience];
                            newExperience[idx].duration = e.target.value;
                            updateResume({ experience: newExperience });
                          }}
                          className="w-full text-sm border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Duration"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-gray-900">{exp.job_title}</p>
                        <p className="text-gray-700">{exp.company}, {exp.location}</p>
                        <p className="text-sm text-gray-600 mb-2">{exp.duration}</p>
                      </>
                    )}
                    <ul className="list-disc list-inside space-y-2">
                      {exp.bullets.map((bullet, bidx) => {
                        const isHighlighted = isBulletEnhanced(bullet, "Experience", resume.changes);
                        const highlightClass = getHighlightClass(isHighlighted, showHighlights);
                        
                        return (
                          <li key={bidx} className={`text-gray-700 text-sm ${highlightClass} rounded`}>
                            {editMode ? (
                              <textarea
                                value={bullet}
                                onChange={(e) => {
                                  const newExperience = [...resume.experience];
                                  newExperience[idx].bullets[bidx] = e.target.value;
                                  updateResume({ experience: newExperience });
                                }}
                                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 resize-none"
                                rows={2}
                              />
                            ) : (
                              <span className="flex items-start gap-2">
                                <span className="flex-1">{bullet}</span>
                                {showHighlights && isHighlighted && (
                                  <span className="text-yellow-600 text-xs flex-shrink-0" title="AI enhanced">✨</span>
                                )}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Projects */}
            {resume.projects.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Projects</h3>
                {resume.projects.map((proj, idx) => (
                  <div key={idx} className="mb-6 last:mb-0">
                    {editMode ? (
                      <div className="space-y-2 mb-3">
                        <input
                          type="text"
                          value={proj.title}
                          onChange={(e) => {
                            const newProjects = [...resume.projects];
                            newProjects[idx].title = e.target.value;
                            updateResume({ projects: newProjects });
                          }}
                          className="w-full font-bold border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Project Title"
                        />
                        <input
                          type="text"
                          value={proj.tech_stack}
                          onChange={(e) => {
                            const newProjects = [...resume.projects];
                            newProjects[idx].tech_stack = e.target.value;
                            updateResume({ projects: newProjects });
                          }}
                          className="w-full text-sm border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Tech Stack"
                        />
                        <input
                          type="text"
                          value={proj.duration}
                          onChange={(e) => {
                            const newProjects = [...resume.projects];
                            newProjects[idx].duration = e.target.value;
                            updateResume({ projects: newProjects });
                          }}
                          className="w-full text-sm border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Duration"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-gray-900">{proj.title}</p>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>Tech Stack:</strong> {proj.tech_stack}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">{proj.duration}</p>
                      </>
                    )}
                    <ul className="list-disc list-inside space-y-2">
                      {proj.bullets.map((bullet, bidx) => {
                        const isHighlighted = isBulletEnhanced(bullet, proj.title, resume.changes);
                        const highlightClass = getHighlightClass(isHighlighted, showHighlights);
                        
                        return (
                          <li key={bidx} className={`text-gray-700 text-sm ${highlightClass} rounded`}>
                            {editMode ? (
                              <textarea
                                value={bullet}
                                onChange={(e) => {
                                  const newProjects = [...resume.projects];
                                  newProjects[idx].bullets[bidx] = e.target.value;
                                  updateResume({ projects: newProjects });
                                }}
                                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 resize-none"
                                rows={2}
                              />
                            ) : (
                              <span className="flex items-start gap-2">
                                <span className="flex-1">{bullet}</span>
                                {showHighlights && isHighlighted && (
                                  <span className="text-yellow-600 text-xs flex-shrink-0" title="AI enhanced">✨</span>
                                )}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Technical Skills */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Technical Skills</h3>
              <div className="space-y-3">
                {resume.technical_skills.languages.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">Languages:</p>
                    <EditableSkillTags
                      skills={resume.technical_skills.languages}
                      onChange={(newSkills) =>
                        updateResume({
                          technical_skills: {
                            ...resume.technical_skills,
                            languages: newSkills,
                          },
                        })
                      }
                      editMode={editMode}
                      colorClass="bg-blue-100 text-blue-700"
                      highlightedSkills={resume.changes
                        .filter((c) => c.toLowerCase().includes("languages"))
                        .map((c) => {
                          const match = c.match(/Added (.+?) to/i);
                          return match ? match[1].toLowerCase() : "";
                        })
                        .filter(Boolean)}
                      showHighlights={showHighlights}
                    />
                  </div>
                )}
                {resume.technical_skills.frameworks.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">Frameworks:</p>
                    <EditableSkillTags
                      skills={resume.technical_skills.frameworks}
                      onChange={(newSkills) =>
                        updateResume({
                          technical_skills: {
                            ...resume.technical_skills,
                            frameworks: newSkills,
                          },
                        })
                      }
                      editMode={editMode}
                      colorClass="bg-purple-100 text-purple-700"
                      highlightedSkills={resume.changes
                        .filter((c) => c.toLowerCase().includes("frameworks"))
                        .map((c) => {
                          const match = c.match(/Added (.+?) to/i);
                          return match ? match[1].toLowerCase() : "";
                        })
                        .filter(Boolean)}
                      showHighlights={showHighlights}
                    />
                  </div>
                )}
                {resume.technical_skills.databases.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">Databases:</p>
                    <EditableSkillTags
                      skills={resume.technical_skills.databases}
                      onChange={(newSkills) =>
                        updateResume({
                          technical_skills: {
                            ...resume.technical_skills,
                            databases: newSkills,
                          },
                        })
                      }
                      editMode={editMode}
                      colorClass="bg-green-100 text-green-700"
                      highlightedSkills={resume.changes
                        .filter((c) => c.toLowerCase().includes("databases"))
                        .map((c) => {
                          const match = c.match(/Added (.+?) to/i);
                          return match ? match[1].toLowerCase() : "";
                        })
                        .filter(Boolean)}
                      showHighlights={showHighlights}
                    />
                  </div>
                )}
                {resume.technical_skills.cloud_services.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">Cloud Services:</p>
                    <EditableSkillTags
                      skills={resume.technical_skills.cloud_services}
                      onChange={(newSkills) =>
                        updateResume({
                          technical_skills: {
                            ...resume.technical_skills,
                            cloud_services: newSkills,
                          },
                        })
                      }
                      editMode={editMode}
                      colorClass="bg-orange-100 text-orange-700"
                      highlightedSkills={resume.changes
                        .filter((c) => c.toLowerCase().includes("cloud"))
                        .map((c) => {
                          const match = c.match(/Added (.+?) to/i);
                          return match ? match[1].toLowerCase() : "";
                        })
                        .filter(Boolean)}
                      showHighlights={showHighlights}
                    />
                  </div>
                )}
                {resume.technical_skills.developer_tools.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">Developer Tools:</p>
                    <EditableSkillTags
                      skills={resume.technical_skills.developer_tools}
                      onChange={(newSkills) =>
                        updateResume({
                          technical_skills: {
                            ...resume.technical_skills,
                            developer_tools: newSkills,
                          },
                        })
                      }
                      editMode={editMode}
                      colorClass="bg-gray-100 text-gray-700"
                      highlightedSkills={resume.changes
                        .filter((c) => c.toLowerCase().includes("developer_tools") || c.toLowerCase().includes("tools"))
                        .map((c) => {
                          const match = c.match(/Added (.+?) to/i);
                          return match ? match[1].toLowerCase() : "";
                        })
                        .filter(Boolean)}
                      showHighlights={showHighlights}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Achievements */}
            {resume.achievements.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Achievements</h3>
                <ul className="list-disc list-inside space-y-2">
                  {resume.achievements.map((achievement, idx) => (
                    <li key={idx} className="text-gray-700">
                      {editMode ? (
                        <textarea
                          value={achievement}
                          onChange={(e) => {
                            const newAchievements = [...resume.achievements];
                            newAchievements[idx] = e.target.value;
                            updateResume({ achievements: newAchievements });
                          }}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 resize-none"
                          rows={2}
                        />
                      ) : (
                        achievement
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Changes Panel (Right - 1 column) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">What AI Changed</h3>
                <button
                  onClick={() => setShowChanges(!showChanges)}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  {showChanges ? "Hide" : "Show"}
                </button>
              </div>

              {showChanges && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {resume.changes.length} modification(s) made
                  </p>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {resume.changes.map((change, idx) => (
                      <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-gray-800">
                          <span className="font-bold text-yellow-700">{idx + 1}.</span> {change}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all ${
              downloadingPDF
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl"
            }`}
          >
            {downloadingPDF ? "📄 Generating PDF..." : "📥 Download PDF"}
          </button>
          <button
            onClick={handleCopyJSON}
            className="flex-1 py-4 px-6 rounded-xl font-semibold text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 transition-all"
          >
            {copied ? "✓ Copied!" : "📋 Copy JSON"}
          </button>
          <button
            onClick={handleStartOver}
            className="flex-1 py-4 px-6 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
          >
            🔄 Start Over
          </button>
        </div>

        {/* Edit Mode Toggle */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              editMode
                ? "bg-gray-200 text-gray-700"
                : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
            }`}
          >
            {editMode ? "👁️ View Mode" : "✏️ Edit Mode"}
          </button>
          <button
            onClick={() => setShowHighlights(!showHighlights)}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              showHighlights
                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {showHighlights ? "✨ Hide Highlights" : "🔆 Show Highlights"}
          </button>
          {hasUnsavedChanges && (
            <button
              onClick={handleSaveChanges}
              className="px-6 py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 transition-all animate-pulse"
            >
              💾 Save Changes
            </button>
          )}
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            {editMode
              ? "✏️ Edit mode active - Click any field to modify"
              : showHighlights
              ? "✨ Yellow highlights show AI-enhanced content"
              : "💡 Toggle highlights to see AI improvements"}
          </p>
        </div>
      </div>
    </div>
  );
}
