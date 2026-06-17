import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Link,
} from "@react-pdf/renderer";
import type { TemplateV1 } from "@/lib/api";

// Register Times New Roman TTF files so they are embedded in the PDF blob.
// Using "Times-Roman" (PDF built-in) causes pdfjs to substitute a browser font
// on mobile, breaking the visual appearance. Embedding the TTF fixes this.
Font.register({
  family: "Times New Roman",
  fonts: [
    { src: "/fonts/times.ttf" },
    { src: "/fonts/timesbd.ttf", fontWeight: "bold" },
    { src: "/fonts/timesi.ttf", fontStyle: "italic" },
    { src: "/fonts/timesbd.ttf", fontWeight: "bold", fontStyle: "italic" },
  ],
});

// FlashResume Template v1 Styles
const styles = StyleSheet.create({
  page: {
    paddingTop: "0.5in",
    paddingBottom: "0.5in",
    paddingHorizontal: "0.65in",
    fontSize: 11,
    fontFamily: "Times New Roman",
    lineHeight: 1.15,
    color: "#000000",
  },
  // Heading Section
  heading: {
    marginBottom: 0,
    textAlign: "center",
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  contactInfo: {
    fontSize: 9.5,
    color: "#000",
    marginBottom: 0,
  },
  link: {
    color: "#000",
    textDecoration: "none",
  },
  // Section Headers
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionDivider: {
    borderBottom: "0.75pt solid #000",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 10.5,
    textAlign: "justify",
    marginBottom: 6,
  },
  // Education
  educationItem: {
    marginBottom: 6,
  },
  institutionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  degree: {
    fontSize: 10.5,
    fontStyle: "italic",
  },
  institution: {
    fontSize: 11,
    fontWeight: "bold",
  },
  duration: {
    fontSize: 10.5,
    fontStyle: "italic",
  },
  location: {
    fontSize: 10.5,
    color: "#333",
  },
  // Experience & Projects
  experienceItem: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  jobTitle: {
    fontSize: 11,
    fontWeight: "bold",
  },
  company: {
    fontSize: 10.5,
    marginBottom: 2,
  },
  bullets: {
    marginTop: 2,
    paddingLeft: 12,
  },
  bullet: {
    fontSize: 10,
    marginBottom: 1.5,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bulletPoint: {
    width: 8,
    marginRight: 4,
  },
  bulletText: {
    flex: 1,
    textAlign: "justify",
    fontSize: 10.5,
  },
  // Technical Skills
  skillsContainer: {
    marginTop: 4,
  },
  skillCategory: {
    marginBottom: 3,
    flexDirection: "row",
  },
  skillLabel: {
    fontSize: 10.5,
    fontWeight: "bold",
    width: 130,
    flexShrink: 0,
  },
  skillList: {
    fontSize: 10.5,
    flex: 1,
    textAlign: "justify",
  },
  // Achievements
  achievementItem: {
    fontSize: 10.5,
    marginBottom: 2,
    paddingLeft: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});

const JUNK_PATTERNS = /^(linkedin profile|github link|linkedin\.com\/in\/username|github\.com\/username|linkedin|github|link|url|n\/a|none|your.*(url|link|profile|username))$/i;
function cleanDisplayUrl(val: string | undefined | null, fallback: string): string {
  if (!val || JUNK_PATTERNS.test(val.trim())) return fallback;
  return val.replace(/^https?:\/\//i, "");
}

function getValidUrl(val: string | undefined | null, fallback: string): string {
  if (!val || JUNK_PATTERNS.test(val.trim())) return `https://${fallback}`;
  const trimmed = val.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

interface ResumePDFProps {
  resume: TemplateV1;
  showHighlights?: boolean;
  matchedKeywords?: string[];
  missingKeywords?: string[];
}

function HighlightedText({ text, matched, missing, showHighlights, style }: { text: string; matched: string[]; missing: string[]; showHighlights: boolean; style?: any; }) {
  if (!showHighlights || (!matched?.length && !missing?.length) || !text) {
    return <Text style={style}>{text}</Text>;
  }

  const escapeRegex = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

  const wordTypes = new Map<string, "matched" | "missing">();
  const allWords: string[] = [];

  // Stop words to skip when generating single-word sub-phrases (avoids false positives)
  const STOP_WORDS = new Set(["knowledge", "experience", "understanding", "proficiency", "skills", "ability", "strong", "good", "basic", "advanced", "demonstrated", "via", "using", "with", "and", "the", "for", "any", "one", "of", "in", "a", "an", "to", "on", "or", "is", "at", "by"]);

  const normalizeKeywords = (keywords: string[]) => {
    const result: string[] = [];
    for (const k of keywords) {
      // Step 1: Split OR groups (e.g., "java/python" → ["java", "python"])
      const orParts = k.split(/\s*\/\s*|\s+[Oo][Rr]\s+|\|/).map(w => w.trim()).filter(Boolean);
      for (const part of orParts) {
        const words = part.split(/\s+/);
        if (words.length <= 2) {
          // Short keyword — add as-is (e.g., "REST APIs", "Docker", "CI/CD")
          result.push(part);
        } else {
          // Multi-word phrase — generate sub-phrases (longest first, min 2 words)
          // e.g., "NoSQL database knowledge" → ["NoSQL database knowledge", "NoSQL database", "database knowledge"]
          for (let len = words.length; len >= 2; len--) {
            for (let start = 0; start <= words.length - len; start++) {
              result.push(words.slice(start, start + len).join(" "));
            }
          }
          // Also add meaningful single words (skip stop words)
          for (const w of words) {
            if (!STOP_WORDS.has(w.toLowerCase()) && w.length > 2) {
              result.push(w);
            }
          }
        }
      }
    }
    return result;
  };

  normalizeKeywords(matched || []).forEach(word => {
    wordTypes.set(word.toLowerCase(), "matched");
    const startB = /^[a-z0-9]/i.test(word) ? "\\b" : "";
    const endB = /[a-z0-9]$/i.test(word) ? "\\b" : "";
    allWords.push(`${startB}${escapeRegex(word)}${endB}`);
  });

  normalizeKeywords(missing || []).forEach(word => {
    wordTypes.set(word.toLowerCase(), "missing");
    const startB = /^[a-z0-9]/i.test(word) ? "\\b" : "";
    const endB = /[a-z0-9]$/i.test(word) ? "\\b" : "";
    allWords.push(`${startB}${escapeRegex(word)}${endB}`);
  });

  if (allWords.length === 0) return <Text style={style}>{text}</Text>;

  allWords.sort((a, b) => b.length - a.length);

  const regex = new RegExp(`(${allWords.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const type = wordTypes.get(part.toLowerCase());
        if (type) {
          const bgColor = type === "matched" ? "#fef08a" : "#bbf7d0";
          const textColor = type === "matched" ? "#854d0e" : "#166534"; // Dark Amber and Dark Green for visibility if bg drops
          return <Text key={i} style={{ backgroundColor: bgColor, color: textColor, fontWeight: "bold" }}>{part}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export default function ResumePDFTemplateA4({ resume, showHighlights = false, matchedKeywords = [], missingKeywords = [] }: ResumePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADING */}
        <View style={styles.heading}>
          <Text style={styles.name}>{resume.heading.name.toUpperCase()}</Text>
          <Text style={styles.contactInfo}>
            {resume.heading.phone}
            {" • "}
            <Link src={`mailto:${resume.heading.email}`} style={styles.link}>
              {resume.heading.email}
            </Link>
            {" • "}
            <Link src={resume.heading.linkedin_url_href || getValidUrl(resume.heading.linkedin_url, "linkedin.com/in/username")} style={styles.link}>
              {cleanDisplayUrl(resume.heading.linkedin_url, "linkedin")}
            </Link>
            {" • "}
            <Link src={getValidUrl(resume.heading.github_url, "github.com/username")} style={styles.link}>
              {cleanDisplayUrl(resume.heading.github_url, "github.com/username")}
            </Link>
          </Text>
        </View>

        {/* DYNAMIC SECTIONS */}
        {(resume.section_order || ["summary", "education", "experience", "projects", "skills", "certifications"]).map((sectionId) => {
          switch (sectionId) {
            case "summary":
              if (!resume.summary || resume.summary.trim() === "") return null;
              return (
                <View key="summary" wrap={false}>
                  <Text style={styles.sectionTitle}>SUMMARY</Text>
                  <View style={styles.sectionDivider} />
                  <HighlightedText
                    text={resume.summary}
                    matched={matchedKeywords}
                    missing={missingKeywords}
                    showHighlights={showHighlights}
                    style={styles.summaryText}
                  />
                </View>
              );
            case "education":
              if (!resume.education || resume.education.length === 0) return null;
              return (
                <View key="education">
                  <Text style={styles.sectionTitle}>EDUCATION</Text>
                  <View style={styles.sectionDivider} />
                  {resume.education.map((edu, idx) => (
                    <View key={idx} style={styles.educationItem} wrap={false}>
                      <View style={styles.institutionRow}>
                        <Text style={styles.institution}>{edu.institution}</Text>
                        <Text style={styles.location}>{edu.location}</Text>
                      </View>
                      <View style={styles.titleRow}>
                        <Text style={styles.degree}>{edu.degree}{edu.cgpa ? ` | CGPA: ${edu.cgpa}` : ""}</Text>
                        <Text style={styles.duration}>{edu.duration}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            case "experience":
              if (!resume.experience || resume.experience.length === 0) return null;
              return (
                <View key="experience">
                  <Text style={styles.sectionTitle}>EXPERIENCE</Text>
                  <View style={styles.sectionDivider} />
                  {resume.experience.map((exp, idx) => (
                    <View key={idx} style={styles.experienceItem} wrap={false}>
                      <View style={styles.titleRow}>
                        <Text style={styles.jobTitle}>{exp.job_title}</Text>
                        <Text style={{ fontSize: 10.5 }}>{exp.duration}</Text>
                      </View>
                      <View style={styles.titleRow}>
                        <Text style={{ ...styles.company, fontStyle: "italic" }}>{exp.company}</Text>
                        <Text style={{ ...styles.location, fontStyle: "italic" }}>{exp.location}</Text>
                      </View>
                      <View style={styles.bullets}>
                        {exp.bullets.map((bullet, bidx) => {
                          if (!bullet.trim()) return null;
                          return (
                            <View key={bidx} style={styles.bullet}>
                              <Text style={styles.bulletPoint}>•</Text>
                              <HighlightedText
                                text={bullet}
                                matched={matchedKeywords}
                                missing={missingKeywords}
                                showHighlights={showHighlights}
                                style={styles.bulletText}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              );
            case "projects":
              if (!resume.projects || resume.projects.length === 0) return null;
              return (
                <View key="projects">
                  <Text style={styles.sectionTitle}>PROJECTS</Text>
                  <View style={styles.sectionDivider} />
                  {resume.projects.map((proj, idx) => (
                    <View key={idx} style={styles.experienceItem} wrap={false}>
                      <View style={styles.titleRow}>
                        <View style={{ flexDirection: "row" }}>
                          <Text style={styles.jobTitle}>
                            {proj.title}
                            {proj.tech_stack ? (
                              <Text style={{ fontSize: 10.5, fontStyle: "italic", fontWeight: "normal" }}>
                                {" | "}
                                <HighlightedText
                                  text={proj.tech_stack}
                                  matched={matchedKeywords}
                                  missing={missingKeywords}
                                  showHighlights={showHighlights}
                                />
                              </Text>
                            ) : null}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                          {(proj.link || proj.link_href) ? (
                            <Text style={{ fontSize: 10.5 }}>
                              <Link src={getValidUrl(proj.link_href || proj.link, "")} style={{ ...styles.link, textDecoration: "underline", fontSize: 10.5 }}>
                                {proj.link || "Link"}
                              </Link>
                              {proj.duration ? <Text>  •  </Text> : null}
                            </Text>
                          ) : null}
                          {proj.duration ? <Text style={{ fontSize: 10.5 }}>{proj.duration}</Text> : null}
                        </View>
                      </View>
                      <View style={styles.bullets}>
                        {proj.bullets.map((bullet, bidx) => {
                          if (!bullet.trim()) return null;
                          return (
                            <View key={bidx} style={styles.bullet}>
                              <Text style={styles.bulletPoint}>•</Text>
                              <HighlightedText
                                text={bullet}
                                matched={matchedKeywords}
                                missing={missingKeywords}
                                showHighlights={showHighlights}
                                style={styles.bulletText}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              );
            case "skills":
              return (
                <View key="skills" wrap={false}>
                  <Text style={styles.sectionTitle}>TECHNICAL SKILLS</Text>
                  <View style={styles.sectionDivider} />
                  <View style={styles.skillsContainer}>
                    {resume.technical_skills.languages.length > 0 && (
                      <View style={styles.skillCategory}>
                        <Text style={styles.skillLabel}>Languages:</Text>
                        <HighlightedText
                          text={resume.technical_skills.languages.join(", ")}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.skillList}
                        />
                      </View>
                    )}
                    {resume.technical_skills.frameworks_and_libraries.length > 0 && (
                      <View style={styles.skillCategory}>
                        <Text style={styles.skillLabel}>Frameworks & Libraries:</Text>
                        <HighlightedText
                          text={resume.technical_skills.frameworks_and_libraries.join(", ")}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.skillList}
                        />
                      </View>
                    )}
                    {resume.technical_skills.databases.length > 0 && (
                      <View style={styles.skillCategory}>
                        <Text style={styles.skillLabel}>Databases:</Text>
                        <HighlightedText
                          text={resume.technical_skills.databases.join(", ")}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.skillList}
                        />
                      </View>
                    )}
                    {resume.technical_skills.cloud_services.length > 0 && (
                      <View style={styles.skillCategory}>
                        <Text style={styles.skillLabel}>Cloud Services:</Text>
                        <HighlightedText
                          text={resume.technical_skills.cloud_services.join(", ")}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.skillList}
                        />
                      </View>
                    )}
                    {resume.technical_skills.developer_tools.length > 0 && (
                      <View style={styles.skillCategory}>
                        <Text style={styles.skillLabel}>Developer Tools:</Text>
                        <HighlightedText
                          text={resume.technical_skills.developer_tools.join(", ")}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.skillList}
                        />
                      </View>
                    )}
                    {resume.technical_skills.miscellaneous && resume.technical_skills.miscellaneous.length > 0 && (
                      <View style={styles.skillCategory}>
                        <Text style={styles.skillLabel}>Miscellaneous:</Text>
                        <HighlightedText
                          text={resume.technical_skills.miscellaneous.join(", ")}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.skillList}
                        />
                      </View>
                    )}
                    {(resume.technical_skills?.custom_categories || [])
                      .filter(cat => cat.label.trim() !== "" || cat.skills.length > 0)
                      .map((cat, idx) => (
                      <View key={`custom-${idx}`} style={styles.skillCategory}>
                        <Text style={styles.skillLabel}>{(cat.label || "Custom") + (cat.skills.length > 0 ? ":" : "")}</Text>
                        <HighlightedText
                          text={cat.skills.join(", ")}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.skillList}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            case "certifications":
              const items = [
                ...(resume.certifications_and_achievements ?? []),
                ...(resume.certifications ?? []),
                ...(resume.achievements ?? []),
              ];
              const unique = [...new Set(items)];
              if (unique.length === 0) return null;
              return (
                <View key="certifications" wrap={false}>
                  <Text style={styles.sectionTitle}>CERTIFICATIONS & ACHIEVEMENTS</Text>
                  <View style={styles.sectionDivider} />
                  <View style={styles.skillsContainer}>
                    {unique.map((item, idx) => (
                      <View key={idx} style={styles.achievementItem}>
                        <Text style={styles.bulletPoint}>•</Text>
                        <HighlightedText
                          text={item}
                          matched={matchedKeywords}
                          missing={missingKeywords}
                          showHighlights={showHighlights}
                          style={styles.bulletText}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            default:
              if (sectionId.startsWith("custom_")) {
                const customSection = resume.custom_sections?.find(s => s.id === sectionId);
                const hasValidBullets = customSection?.bullets?.some(b => {
                  const text = typeof b === 'string' ? b : b.text;
                  return !!text?.trim();
                });
                if (!customSection || (!customSection.heading?.trim() && !hasValidBullets)) return null;
                return (
                  <View key={sectionId} wrap={false}>
                    <Text style={styles.sectionTitle}>{customSection.heading.toUpperCase()}</Text>
                    <View style={styles.sectionDivider} />
                    <View style={styles.bullets}>
                      {(customSection.bullets || []).map((bulletObj, bidx) => {
                        const text = typeof bulletObj === 'string' ? bulletObj : bulletObj.text;
                        const url = typeof bulletObj === 'string' ? undefined : bulletObj.url;
                        if (!text?.trim()) return null;
                        return (
                          <View key={bidx} style={styles.bullet}>
                            <Text style={styles.bulletPoint}>•</Text>
                            {url ? (
                              <Text style={{ ...styles.bulletText, textDecoration: 'underline', color: '#000' }}>
                                <Link src={url.startsWith('http') ? url : `https://${url}`} style={styles.link}>
                                  {text}
                                </Link>
                              </Text>
                            ) : (
                              <Text style={styles.bulletText}>{text}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              }
              return null;
          }
        })}
      </Page>
    </Document>
  );
}

