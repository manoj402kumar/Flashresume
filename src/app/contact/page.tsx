import React from "react";
import BackButton from "@/components/BackButton";

export const metadata = {
  title: "Contact Us | Flashresume",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen pt-24 pb-12 bg-surface">
      <div className="max-w-3xl mx-auto px-6">
        <BackButton />
        <h1 className="text-4xl font-headline font-bold mb-8">Contact Us</h1>
        <div className="bg-surface-container-low p-8 rounded-3xl border border-surface-container-high space-y-6">
          <p className="text-on-surface-variant leading-relaxed">
            We're here to help! If you have any complaints, questions, feedback, or need assistance, please reach out to us using the contact details below.
          </p>

          <div>
            <h3 className="text-lg font-bold mb-2">Email</h3>
            <a href="mailto:veerababup114@gmail.com" className="text-primary hover:underline">veerababup114@gmail.com</a>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2">Phone</h3>
            <p className="text-on-surface-variant">+91 9701910239</p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2">Operating Hours</h3>
            <p className="text-on-surface-variant">Monday to Friday - 9:00 AM to 6:00 PM (IST)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
