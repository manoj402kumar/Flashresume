import React from "react";
import BackButton from "@/components/BackButton";

export const metadata = {
  title: "Privacy Policy | Flashresume",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-24 pb-12 bg-surface">
      <div className="max-w-3xl mx-auto px-6">
        <BackButton />
        <h1 className="text-4xl font-headline font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-invert max-w-none text-on-surface-variant space-y-4">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p>Your privacy is important to us. It is Flashresume's policy to respect your privacy regarding any information we may collect from you across our website, https://flashresume.in.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">Information we collect</h2>
          <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">How we use information</h2>
          <p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we’ll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">Data sharing</h2>
          <p>We don’t share any personally identifying information publicly or with third-parties, except when required to by law.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">Your rights</h2>
          <p>You are free to refuse our request for your personal information, with the understanding that we may be unable to provide you with some of your desired services.</p>
          
          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">Contact</h2>
          <p>If you have any questions about how we handle user data and personal information, feel free to contact us at veerababup114@gmail.com.</p>
        </div>
      </div>
    </div>
  );
}
