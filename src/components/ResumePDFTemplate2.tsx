import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  Font,
} from "@react-pdf/renderer";
import type { TemplateV1 } from "@/lib/api";

Font.register({
  family: "Computer Modern",
  fonts: [
    { src: "/fonts/cmu-serif-500-roman.ttf" },
    { src: "/fonts/cmu-serif-700-roman.ttf", fontWeight: "bold" },
    { src: "/fonts/cmu-serif-500-italic.ttf", fontStyle: "italic" },
    { src: "/fonts/cmu-serif-700-italic.ttf", fontWeight: "bold", fontStyle: "italic" }
  ]
});

// Template 3: Strict 1:1 mapping of Jake Gutierrez's raw LaTeX code.
// Base font: 11pt. Small size: 10pt.
// Margins: 0.5in all around.

const styles = StyleSheet.create({
  page: {
    paddingTop: "0.5in",
    paddingBottom: "0.5in",
    paddingHorizontal: "0.75in", // Increased left/right spacing to standard professional 0.75" width
    fontSize: 11,
    fontFamily: "Computer Modern",
    lineHeight: 1.2,
    color: "#000000",
  },
  // Heading Section
  heading: {
    marginBottom: 8,
    textAlign: "center",
  },
  name: {
    fontSize: 24, // \Huge at 11pt base
    fontWeight: "bold", // \textbf
    marginBottom: 0,
    lineHeight: 1,
  },
  contactInfo: {
    fontSize: 10, // \small
    color: "#000",
    marginTop: 4,
  },
  link: {
    color: "#000",
    textDecoration: "none",
  },
  // Section Headers
  sectionTitle: {
    fontSize: 12, // \large at 11pt base
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 3,
  },
  sectionDivider: {
    borderBottom: "1pt solid #000", // \titlerule
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 10,
    textAlign: "justify",
    marginBottom: 6,
  },
  // Common Row Layouts
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  // Item block (subheading)
  itemBlock: {
    marginBottom: 6, // \vspace{-7pt} simulation 
  },
  // Text Styles
  textBold: {
    fontWeight: "bold",
  },
  textItalic: {
    fontStyle: "italic",
  },
  textSmall: {
    fontSize: 10,
  },
  textSmallItalic: {
    fontSize: 10,
    fontStyle: "italic",
  },
  // Bullets
  bullets: {
    marginTop: 2,
    paddingLeft: 12, // leftmargin=0.15in
  },
  bullet: {
    fontSize: 10, // \small
    marginBottom: 1.5, // \vspace{-2pt}
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bulletPoint: {
    width: 8,
    marginRight: 4,
    fontSize: 8,
  },
  bulletText: {
    flex: 1,
    textAlign: "justify",
    fontSize: 10,
  },
  // Technical Skills
  skillsContainer: {
    paddingLeft: 12, // leftmargin=0.15in inside itemize
  },
  skillCategoryRow: {
    flexDirection: "row",
    marginBottom: 1.5,
  },
  skillLabel: {
    fontSize: 10, // \small
    fontWeight: "bold", // \textbf
  },
  skillList: {
    fontSize: 10, // \small
    flex: 1,
    textAlign: "justify",
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

  (matched || []).forEach(w => {
    const word = w.trim();
    if (word) {
      wordTypes.set(word.toLowerCase(), "matched");
      const startB = /^[a-z0-9]/i.test(word) ? "\\b" : "";
      const endB = /[a-z0-9]$/i.test(word) ? "\\b" : "";
      allWords.push(`${startB}${escapeRegex(word)}${endB}`);
    }
  });

  (missing || []).forEach(w => {
    const word = w.trim();
    if (word) {
      wordTypes.set(word.toLowerCase(), "missing");
      const startB = /^[a-z0-9]/i.test(word) ? "\\b" : "";
      const endB = /[a-z0-9]$/i.test(word) ? "\\b" : "";
      allWords.push(`${startB}${escapeRegex(word)}${endB}`);
    }
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
          return <Text key={i} style={{ backgroundColor: bgColor }}>{part}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export default function ResumePDFTemplate2({ resume, showHighlights = false, matchedKeywords = [], missingKeywords = [] }: ResumePDFProps) {
  return (
    <Document>
      <Page size={[612.28, 790.87]} style={styles.page}>
        {/* HEADING */}
        <View style={styles.heading}>
          <Text style={styles.name}>{resume.heading.name}</Text>
          <Text style={styles.contactInfo}>
            {resume.heading.phone}
            {" | "}
            <Link src={`mailto:${resume.heading.email}`} style={{ ...styles.link, textDecoration: "underline" }}>
              {resume.heading.email}
            </Link>
            {" | "}
            <Link src={getValidUrl(resume.heading.linkedin_url, "linkedin.com/in/username")} style={{ ...styles.link, textDecoration: "underline" }}>
              {cleanDisplayUrl(resume.heading.linkedin_url, "linkedin")}
            </Link>
            {" | "}
            <Link src={getValidUrl(resume.heading.github_url, "github.com/username")} style={{ ...styles.link, textDecoration: "underline" }}>
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
                  <Text style={styles.sectionTitle}>Summary</Text>
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
                  <Text style={styles.sectionTitle}>Education</Text>
                  <View style={styles.sectionDivider} />
                  {resume.education.map((edu, idx) => (
                    <View key={idx} style={styles.itemBlock} wrap={false}>
                      {/* LaTeX: \textbf{#1} & #2 \\ \textit{\small#3} & \textit{\small #4} */}
                      <View style={styles.row}>
                        <Text style={styles.textBold}>{edu.institution}</Text>
                        <Text>{edu.location}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.textSmallItalic}>{edu.degree}{edu.cgpa ? `, CGPA: ${edu.cgpa}` : ""}</Text>
                        <Text style={styles.textSmallItalic}>{edu.duration}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            case "experience":
              if (!resume.experience || resume.experience.length === 0) return null;
              return (
                <View key="experience">
                  <Text style={styles.sectionTitle}>Experience</Text>
                  <View style={styles.sectionDivider} />
                  {resume.experience.map((exp, idx) => (
                    <View key={idx} style={styles.itemBlock} wrap={false}>
                      {/* LaTeX: \textbf{#1} & #2 \\ \textit{\small#3} & \textit{\small #4} */}
                      <View style={styles.row}>
                        <Text style={styles.textBold}>{exp.job_title}</Text>
                        <Text>{exp.duration}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.textSmallItalic}>{exp.company}</Text>
                        <Text style={styles.textSmallItalic}>{exp.location}</Text>
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
                  <Text style={styles.sectionTitle}>Projects</Text>
                  <View style={styles.sectionDivider} />
                  {resume.projects.map((proj, idx) => (
                    <View key={idx} style={styles.itemBlock} wrap={false}>
                      {/* LaTeX: \small{\textbf{#1} | \emph{#2}} & #3 */}
                      <View style={styles.row}>
                        <Text style={styles.textSmall}>
                          <Text style={styles.textBold}>{proj.title}</Text>
                          {proj.tech_stack ? (
                            <Text>
                              {" | "}
                              <Text style={styles.textItalic}>{proj.tech_stack}</Text>
                            </Text>
                          ) : null}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                          {(proj.link || proj.link_href) ? (
                            <Text style={styles.textSmall}>
                              <Link src={getValidUrl(proj.link_href || proj.link, "")} style={{ ...styles.link, textDecoration: "underline" }}>
                                {proj.link || "Link"}
                              </Link>
                              {proj.duration ? <Text>  |  </Text> : null}
                            </Text>
                          ) : null}
                          {proj.duration ? <Text>{proj.duration}</Text> : null}
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
                  <Text style={styles.sectionTitle}>Technical Skills</Text>
                  <View style={styles.sectionDivider} />
                  <View style={styles.skillsContainer}>
                    {resume.technical_skills.languages.length > 0 && (
                      <View style={styles.skillCategoryRow}>
                        <Text style={styles.skillLabel}>Languages</Text>
                        <Text style={styles.skillList}>
                          {`: ${resume.technical_skills.languages.join(", ")}`}
                        </Text>
                      </View>
                    )}
                    {resume.technical_skills.frameworks.length > 0 && (
                      <View style={styles.skillCategoryRow}>
                        <Text style={styles.skillLabel}>Frameworks</Text>
                        <Text style={styles.skillList}>
                          {`: ${resume.technical_skills.frameworks.join(", ")}`}
                        </Text>
                      </View>
                    )}
                    {resume.technical_skills.developer_tools.length > 0 && (
                      <View style={styles.skillCategoryRow}>
                        <Text style={styles.skillLabel}>Developer Tools</Text>
                        <Text style={styles.skillList}>
                          {`: ${resume.technical_skills.developer_tools.join(", ")}`}
                        </Text>
                      </View>
                    )}
                    {resume.technical_skills.databases.length > 0 && (
                      <View style={styles.skillCategoryRow}>
                        <Text style={styles.skillLabel}>Databases</Text>
                        <Text style={styles.skillList}>
                          {`: ${resume.technical_skills.databases.join(", ")}`}
                        </Text>
                      </View>
                    )}
                    {resume.technical_skills.cloud_services.length > 0 && (
                      <View style={styles.skillCategoryRow}>
                        <Text style={styles.skillLabel}>Cloud Services</Text>
                        <Text style={styles.skillList}>
                          {`: ${resume.technical_skills.cloud_services.join(", ")}`}
                        </Text>
                      </View>
                    )}
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
                  <Text style={styles.sectionTitle}>Certifications & Achievements</Text>
                  <View style={styles.sectionDivider} />
                  <View style={styles.skillsContainer}>
                    {unique.map((item, idx) => (
                      <View key={idx} style={styles.bullet}>
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
              return null;
          }
        })}
      </Page>
    </Document>
  );
}
