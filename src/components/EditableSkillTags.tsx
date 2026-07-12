"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export default function EditableSkillTags({
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
    const trimmed = newSkill.trim();
    if (trimmed) {
      // Prevent duplicates (case-insensitive)
      const isDuplicate = skills.some(s => s.toLowerCase() === trimmed.toLowerCase());
      if (!isDuplicate) {
        onChange([...skills, trimmed]);
      }
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, idx) => idx !== index));
  };

  return (
    <div className="flex flex-wrap gap-2 content-start">
      {skills.map((skill, idx) => {
        const isHighlighted = highlightedSkills.includes(skill.toLowerCase());

        return (
          <motion.span
            key={skill}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.02 }}
            className={`px-3 py-1.5 ${colorClass} rounded-full text-sm font-medium flex items-center gap-2 ${showHighlights && isHighlighted ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-200/50 scale-105" : ""
              } transition-all`}
          >
            {skill}
            {showHighlights && isHighlighted && (
              <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse" />
            )}
            {editMode && (
              <button
                onClick={() => removeSkill(idx)}
                className="hover:opacity-60 font-bold"
                type="button"
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            )}
          </motion.span>
        );
      })}
      {editMode && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
            placeholder="+ Add"
            className="px-3 py-1.5 border border-dashed border-on-surface-variant/30 bg-surface-container-lowest/50 backdrop-blur-sm rounded-full text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/25 shadow-primary/10 focus:shadow-lg focus:shadow-primary/20 transition-all duration-300"
            style={{ minWidth: "80px" }}
          />
          {newSkill.trim() && (
            <button
              onClick={addSkill}
              className="w-7 h-7 bg-primary text-white rounded-full text-sm hover:opacity-90 flex items-center justify-center"
              type="button"
              aria-label="Add skill"
            >
              ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}
