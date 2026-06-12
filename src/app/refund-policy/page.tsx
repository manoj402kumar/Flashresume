import React from "react";
import BackButton from "@/components/BackButton";

export const metadata = {
  title: "Refund & Cancellation Policy | Flashresume",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen pt-24 pb-12 bg-surface">
      <div className="max-w-3xl mx-auto px-6">
        <BackButton />
        <h1 className="text-4xl font-headline font-bold mb-8">Refund & Cancellation Policy</h1>
        <div className="prose prose-invert max-w-none text-on-surface-variant space-y-6">
          <p>
            Thank you for choosing Flashresume. We want to ensure that you have a smooth and clear experience with our services.
          </p>

          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">No Refund Policy</h2>
          <p>
            Because Flashresume provides digital goods and services (including AI-generated resume optimizations and instant digital downloads) that are instantly accessible and consumed upon purchase, <strong>we do not offer refunds or cancellations once a purchase is made.</strong>
          </p>
          <p>
            All sales are final. We strongly encourage all users to review our free features, previews, and templates before committing to a paid plan. 
          </p>

          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">Cancellations</h2>
          <p>
            If you have subscribed to a recurring plan (e.g., our 2-month or 3-month plans), you may cancel your subscription at any time to prevent future billing. However, canceling a subscription does not grant a refund for the current billing cycle, and you will retain access to your credits until the cycle expires.
          </p>

          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">Exceptions</h2>
          <p>
            In the rare event of a technical failure on our end (e.g., you were charged but your credits were not added to your account due to a system error), please contact our support team immediately. We will investigate the issue and manually credit your account. 
          </p>

          <h2 className="text-2xl font-bold text-on-background mt-8 mb-4">Contact Us</h2>
          <p>
            If you have any questions about this policy, please contact us at: <br/>
            Email: veerababup114@gmail.com <br/>
            Phone: +91 9701910239
          </p>
        </div>
      </div>
    </div>
  );
}
