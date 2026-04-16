// Utility functions for highlighting AI-enhanced content

export interface HighlightInfo {
  type: "added" | "enhanced";
  section: string;
  field?: string;
  index?: number;
  bulletIndex?: number;
  newText?: string;
}

/**
 * Parse a change string to extract highlighting information
 * Examples:
 * - "Added Docker to developer_tools"
 * - "Enhanced Experience bullet 1: Changed 'old text' to 'new text'"
 */
export function parseChange(change: string): HighlightInfo | null {
  // Pattern 1: "Added X to Y"
  const addedMatch = change.match(/Added (.+?) to (.+)/i);
  if (addedMatch) {
    return {
      type: "added",
      section: addedMatch[2].trim(),
      field: addedMatch[1].trim(),
    };
  }

  // Pattern 2: "Enhanced [Section] bullet [N]: Changed 'old' to 'new'"
  const enhancedMatch = change.match(
    /Enhanced (.+?) bullet (\d+): Changed ['"](.+?)['"] to ['"](.+?)['"]/i
  );
  if (enhancedMatch) {
    return {
      type: "enhanced",
      section: enhancedMatch[1].trim(),
      bulletIndex: parseInt(enhancedMatch[2]) - 1, // Convert to 0-based index
      newText: enhancedMatch[4].trim(),
    };
  }

  // Pattern 3: "Enhanced [Section] [field]: Changed 'old' to 'new'"
  const fieldMatch = change.match(
    /Enhanced (.+?) (.+?): Changed ['"](.+?)['"] to ['"](.+?)['"]/i
  );
  if (fieldMatch) {
    return {
      type: "enhanced",
      section: fieldMatch[1].trim(),
      field: fieldMatch[2].trim(),
      newText: fieldMatch[4].trim(),
    };
  }

  return null;
}

/**
 * Check if a skill was added based on changes array - improved version
 */
export function isSkillAdded(
  skill: string,
  category: string,
  changes: string[]
): boolean {
  const lowerSkill = skill.toLowerCase();
  const lowerCategory = category.toLowerCase();

  return changes.some((change) => {
    const lowerChange = change.toLowerCase();

    // Strategy 1: Direct "Added X to Y" pattern
    const info = parseChange(change);
    if (
      info?.type === "added" &&
      info.section.toLowerCase().includes(lowerCategory) &&
      info.field?.toLowerCase() === lowerSkill
    ) {
      return true;
    }

    // Strategy 2: "Added X, Y, Z to category" pattern
    if (lowerChange.includes("added") && lowerChange.includes(lowerCategory)) {
      // Extract all mentioned skills
      const skillsMatch = change.match(/Added ([^:]+?) to/i);
      if (skillsMatch) {
        const mentionedSkills = skillsMatch[1].split(/,|and/).map(s => s.trim().toLowerCase());
        if (mentionedSkills.some(s => s === lowerSkill || s.includes(lowerSkill))) {
          return true;
        }
      }
    }

    // Strategy 3: Check if skill name appears in change about this category
    if (lowerChange.includes(lowerSkill) && 
        (lowerChange.includes(lowerCategory) || 
         lowerChange.includes("technical_skills") ||
         lowerChange.includes("frameworks") ||
         lowerChange.includes("tools"))) {
      return true;
    }

    return false;
  });
}

/**
 * Check if a bullet was enhanced - improved version with multiple detection strategies
 */
export function isBulletEnhanced(
  bulletText: string,
  section: string,
  changes: string[]
): boolean {
  const lowerBullet = bulletText.toLowerCase();
  const lowerSection = section.toLowerCase();

  return changes.some((change) => {
    const lowerChange = change.toLowerCase();

    // Strategy 1: Check if change mentions this section
    if (!lowerChange.includes(lowerSection) && 
        !lowerChange.includes("experience") && 
        !lowerChange.includes("project") &&
        !lowerChange.includes("intern")) {
      return false;
    }

    // Strategy 2: Parse enhanced bullet changes
    const info = parseChange(change);
    if (info?.type === "enhanced" && info.newText) {
      // Check if bullet contains the new text
      if (lowerBullet.includes(info.newText.toLowerCase())) {
        return true;
      }
    }

    // Strategy 3: Check for "Added" changes that describe new bullets
    if (lowerChange.includes("added") && lowerChange.includes(":")) {
      const addedTextMatch = change.match(/Added ['"](.*?)['"]/i);
      if (addedTextMatch && lowerBullet.includes(addedTextMatch[1].toLowerCase())) {
        return true;
      }
    }

    // Strategy 4: Check for keyword additions (TensorFlow, PyTorch, MLflow, etc.)
    const keywords = [
      "tensorflow", "pytorch", "scikit-learn", "mlflow", "pandas", "numpy",
      "docker", "kubernetes", "llm", "generative ai", "aws", "azure", "gcp"
    ];
    
    for (const keyword of keywords) {
      if (lowerChange.includes(keyword) && lowerBullet.includes(keyword)) {
        // Check if this change is about this section
        if (lowerChange.includes(lowerSection) || 
            lowerChange.includes("experience") || 
            lowerChange.includes("project") ||
            lowerChange.includes("intern")) {
          return true;
        }
      }
    }

    // Strategy 5: Check for quantification changes
    if (lowerChange.includes("quantified") && lowerChange.includes("%")) {
      const percentMatch = change.match(/(\d+)%/);
      if (percentMatch && bulletText.includes(percentMatch[1] + "%")) {
        return true;
      }
    }

    // Strategy 6: Simple text matching - if change describes adding/enhancing something
    // and that text appears in the bullet
    if ((lowerChange.includes("added") || lowerChange.includes("enhanced") || lowerChange.includes("improved"))) {
      // Extract quoted text or key phrases
      const quotedMatches = change.match(/['"]([^'"]+)['"]/g);
      if (quotedMatches) {
        for (const quoted of quotedMatches) {
          const cleanQuoted = quoted.replace(/['"]/g, '').toLowerCase();
          if (cleanQuoted.length > 10 && lowerBullet.includes(cleanQuoted)) {
            return true;
          }
        }
      }
    }

    return false;
  });
}

/**
 * Get highlight class based on whether content was modified - Enhanced visibility
 */
export function getHighlightClass(isHighlighted: boolean, showHighlights: boolean): string {
  if (!showHighlights || !isHighlighted) return "";
  return "bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 pl-3 shadow-sm transition-all";
}
