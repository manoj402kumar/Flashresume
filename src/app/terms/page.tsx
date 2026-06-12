import React from "react";
import BackButton from "@/components/BackButton";

export const metadata = {
  title: "Terms of Service | Flashresume",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-24 pb-12 bg-surface">
      <div className="max-w-3xl mx-auto px-6">
        <BackButton />
        <h1 className="text-4xl font-headline font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-invert max-w-none text-on-surface-variant space-y-4">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p>Welcome to Flashresume. By accessing or using our website, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">1. Use License</h2>
          <p>Permission is granted to temporarily download one copy of the materials (information or software) on Flashresume's website for personal, non-commercial transitory viewing only.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">2. Disclaimer</h2>
          <p>The materials on Flashresume's website are provided on an 'as is' basis. Flashresume makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">3. Limitations</h2>
          <p>In no event shall Flashresume or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Flashresume's website.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">4. Revisions and Errata</h2>
          <p>The materials appearing on Flashresume's website could include technical, typographical, or photographic errors. Flashresume does not warrant that any of the materials on its website are accurate, complete, or current.</p>
        </div>
      </div>
    </div>
  );
}
