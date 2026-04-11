import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
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
    borderBottom: "1.5pt solid #000",
    paddingBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  contactInfo: {
    fontSize: 9.5,
    color: "#000",
    marginBottom: 4,
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
    width: 110,
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
            {resume.heading.phone} • {resume.heading.email}
            {resume.heading.linkedin_url && ` • ${resume.heading.linkedin_url}`}
          </Text>
        </View>

        {/* EDUCATION */}
        {resume.education.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>EDUCATION</Text>
            <View style={styles.sectionDivider} />
            {resume.education.map((edu, idx) => (
              <View key={idx} style={styles.educationItem}>
                <View style={styles.institutionRow}>
                  <Text style={styles.institution}>{edu.institution}</Text>
                  <Text style={styles.location}>{edu.location}</Text>
                </View>
                <View style={styles.titleRow}>
                  <Text style={styles.degree}>{edu.degree}</Text>
                  <Text style={styles.duration}>{edu.duration}</Text>
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
                <Text style={styles.company}>
                  {exp.company} • {exp.location}
                </Text>
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
                  <Text style={styles.jobTitle}>{proj.title}</Text>
                  <Text style={styles.duration}>{proj.duration}</Text>
                </View>
                <Text style={styles.company}>{proj.tech_stack}</Text>
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
              <View style={styles.skillCategory}>
                <Text style={styles.skillLabel}>Languages:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.languages.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.frameworks.length > 0 && (
              <View style={styles.skillCategory}>
                <Text style={styles.skillLabel}>Frameworks:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.frameworks.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.databases.length > 0 && (
              <View style={styles.skillCategory}>
                <Text style={styles.skillLabel}>Databases:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.databases.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.cloud_services.length > 0 && (
              <View style={styles.skillCategory}>
                <Text style={styles.skillLabel}>Cloud Services:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.cloud_services.join(", ")}
                </Text>
              </View>
            )}
            {resume.technical_skills.developer_tools.length > 0 && (
              <View style={styles.skillCategory}>
                <Text style={styles.skillLabel}>Developer Tools:</Text>
                <Text style={styles.skillList}>
                  {resume.technical_skills.developer_tools.join(", ")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ACHIEVEMENTS */}
        {resume.achievements.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
            <View style={styles.sectionDivider} />
            {resume.achievements.map((achievement, idx) => (
              <View key={idx} style={styles.achievementItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{achievement}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
