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

// Register fonts (using default serif for ATS compatibility)
Font.register({
  family: "Times-Roman",
  src: "https://fonts.gstatic.com/s/timesnewroman/v1/LJ8a3LwzZTmNaZvR4V4kY_XDTjb_lvqh4yU.ttf",
});

// FlashResume Template v1 Styles
const styles = StyleSheet.create({
  page: {
    padding: "0.75in",
    fontSize: 10.5,
    fontFamily: "Times-Roman",
    lineHeight: 1.15,
    color: "#000000",
  },
  // Heading Section
  heading: {
    marginBottom: 10,
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
    marginBottom: 4,
  },
  link: {
    color: "#000",
    textDecoration: "none",
  },
  // Section Headers
  sectionTitle: {
    fontSize: 11.5,
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
    fontSize: 10,
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
    fontWeight: "bold",
  },
  institution: {
    fontSize: 10,
  },
  duration: {
    fontSize: 10,
    fontStyle: "italic",
  },
  location: {
    fontSize: 10,
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
    fontSize: 10.5,
    fontWeight: "bold",
  },
  company: {
    fontSize: 10,
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
    fontSize: 10,
    fontWeight: "bold",
    width: 130,
    flexShrink: 0,
  },
  skillList: {
    fontSize: 10,
    flex: 1,
    textAlign: "justify",
  },
  // Achievements
  achievementItem: {
    fontSize: 10,
    marginBottom: 2,
    paddingLeft: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});

const JUNK_PATTERNS = /^(linkedin profile|github link|linkedin|github|link|url|n\/a|none|your.*(url|link|profile|username))$/i;
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
}

export default function ResumePDF({ resume }: ResumePDFProps) {
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
            <Link src={getValidUrl(resume.heading.linkedin_url, "linkedin.com/in/username")} style={styles.link}>
              {cleanDisplayUrl(resume.heading.linkedin_url, "linkedin.com/in/username")}
            </Link>
            {" • "}
            <Link src={getValidUrl(resume.heading.github_url, "github.com/username")} style={styles.link}>
              {cleanDisplayUrl(resume.heading.github_url, "github.com/username")}
            </Link>
          </Text>
        </View>

        {/* SUMMARY */}
        {resume.summary && resume.summary.trim() !== "" && (
          <View>
            <Text style={styles.sectionTitle}>SUMMARY</Text>
            <View style={styles.sectionDivider} />
            <Text style={styles.summaryText}>{resume.summary}</Text>
          </View>
        )}

        {/* EDUCATION */}
        {resume.education.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>EDUCATION</Text>
            <View style={styles.sectionDivider} />
            {resume.education.map((edu, idx) => (
              <View key={idx} style={styles.educationItem}>
                <View style={styles.institutionRow}>
                  <Text style={styles.institution}>{edu.institution}</Text>
                  <Text style={styles.duration}>{edu.duration}</Text>
                </View>
                <View style={styles.titleRow}>
                  <Text style={styles.degree}>{edu.degree}{edu.cgpa ? ` | CGPA: ${edu.cgpa}` : ""}</Text>
                  <Text style={styles.location}>{edu.location}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* EXPERIENCE */}
        {resume.experience.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>EXPERIENCE</Text>
            <View style={styles.sectionDivider} />
            {resume.experience.map((exp, idx) => (
              <View key={idx} style={styles.experienceItem}>
                <View style={styles.titleRow}>
                  <Text style={styles.jobTitle}>{exp.job_title}</Text>
                  <Text style={styles.duration}>{exp.duration}</Text>
                </View>
                <View style={styles.titleRow}>
                  <Text style={styles.company}>{exp.company}</Text>
                  <Text style={styles.location}>{exp.location}</Text>
                </View>
                <View style={styles.bullets}>
                  {exp.bullets.map((bullet, bidx) => (
                    <View key={bidx} style={styles.bullet}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* PROJECTS */}
        {resume.projects.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>PROJECTS</Text>
            <View style={styles.sectionDivider} />
            {resume.projects.map((proj, idx) => (
              <View key={idx} style={styles.experienceItem}>
                <View style={styles.titleRow}>
                  <View style={{ flexDirection: "row" }}>
                    <Text style={styles.jobTitle}>{proj.title}</Text>
                    {proj.tech_stack ? (
                      <Text style={{ fontSize: 10.5, fontStyle: "italic" }}>
                        <Text style={{ fontWeight: "normal", fontStyle: "normal" }}> | </Text>
                        {proj.tech_stack}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row" }}>
                    <Text style={styles.duration}>{proj.duration}</Text>
                    {(proj.link || proj.link_href) ? (
                      <>
                        <Text style={{ fontSize: 10.5, marginHorizontal: 4 }}> | </Text>
                        <Link src={getValidUrl(proj.link_href || proj.link, "github.com/reponame")} style={{ ...styles.link, textDecoration: "underline", fontSize: 10.5 }}>
                          {proj.link || "Link"}
                        </Link>
                      </>
                    ) : null}
                  </View>
                </View>
                <View style={styles.bullets}>
                  {proj.bullets.map((bullet, bidx) => (
                    <View key={bidx} style={styles.bullet}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TECHNICAL SKILLS */}
        <View>
          <Text style={styles.sectionTitle}>TECHNICAL SKILLS</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.skillsContainer}>
            {resume.technical_skills.languages.length > 0 && (
              <View style={styles.skillCategory} wrap={false}>
                <Text style={styles.skillLabel}>Languages:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.languages.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.frameworks.length > 0 && (
              <View style={styles.skillCategory} wrap={false}>
                <Text style={styles.skillLabel}>Frameworks & Libraries:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.frameworks.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.databases.length > 0 && (
              <View style={styles.skillCategory} wrap={false}>
                <Text style={styles.skillLabel}>Databases:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.databases.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.cloud_services.length > 0 && (
              <View style={styles.skillCategory} wrap={false}>
                <Text style={styles.skillLabel}>Cloud Services:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.cloud_services.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.developer_tools.length > 0 && (
              <View style={styles.skillCategory} wrap={false}>
                <Text style={styles.skillLabel}>Developer Tools:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.developer_tools.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.miscellaneous && resume.technical_skills.miscellaneous.length > 0 && (
              <View style={styles.skillCategory} wrap={false}>
                <Text style={styles.skillLabel}>Miscellaneous:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.miscellaneous.join(", ")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* CERTIFICATIONS / ACHIEVEMENTS */}
        {(() => {
          const items = [
            ...(resume.certifications_and_achievements ?? []),
            ...(resume.certifications ?? []),
            ...(resume.achievements ?? []),
          ];
          // Deduplicate in case backend populates both merged and individual arrays
          const unique = [...new Set(items)];
          return unique.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>CERTIFICATIONS / ACHIEVEMENTS</Text>
              <View style={styles.sectionDivider} />
              {unique.map((item, idx) => (
                <View key={idx} style={styles.achievementItem}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null;
        })()}
      </Page>
    </Document>
  );
}
