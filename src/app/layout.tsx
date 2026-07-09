import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import PresenceTracker from "@/components/PresenceTracker";
import MaintenanceBanner from "@/components/MaintenanceBanner";

export const metadata: Metadata = {
  metadataBase: new URL("https://flashresume.in"),
  title: {
    default: "Flashresume – AI Resume & ATS Optimizer for Job Descriptions",
    template: "%s | Flashresume",
  },
  description:
    "Tailor your resume to any job description instantly. Our advanced AI matches ATS keywords, lets you edit PDF resumes, and build from scratch. Get hired faster with Flashresume.",
  keywords: [
    "AI resume optimizer",
    "tailor resume to job description",
    "ATS keyword matcher",
    "optimize resume for ATS",
    "edit PDF resume text",
    "modify PDF resume online",
    "AI resume builder",
    "resume templates for freshers",
    "ATS resume checker",
    "job description resume match",
    "resume and job description match",
    "resume jd optimizer tool",
    "match resume with job description AI",
    "ATS resume scan",
    "JD and resume matcher",
    "JD resume ATS checker",
    "CV optimizer",
    "resume score checker",
    "resume job description optimizer",
    "resume job description checker"
  ],
  authors: [{ name: "Flashresume" }],
  creator: "Flashresume",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://flashresume.in",
    title: "Flashresume – AI Resume & ATS Optimizer for Job Descriptions",
    description:
      "Tailor your resume to any job description instantly. Our AI matches ATS keywords and helps you get hired faster.",
    siteName: "Flashresume",
    images: [
      {
        url: "/og-image.png", // We will add an OG image later
        width: 1200,
        height: 630,
        alt: "Flashresume AI Resume Optimizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flashresume – AI Resume & ATS Optimizer for Job Descriptions",
    description: "Tailor your resume to any job description instantly with our AI keyword optimizer.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://flashresume.in",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-MFXM63VQ');
          `}
        </Script>

        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-T4SV743LWL"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-T4SV743LWL');
          `}
        </Script>
      </head>
      <body suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MFXM63VQ"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        <MaintenanceBanner />
        
        {/* Global Presence Tracker */}
        <PresenceTracker />

        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

        {/* Schema Markup for Google Rich Results */}
        <Script id="schema-software" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Flashresume",
            "operatingSystem": "WebBrowser",
            "applicationCategory": "BusinessApplication",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "ratingCount": "1250"
            },
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "INR"
            },
            "description": "Tailor your resume to any job description instantly. Our advanced AI matches ATS keywords and optimizes your PDF resume in 60 seconds.",
            "url": "https://flashresume.in",
            "applicationSubCategory": "Resume Builder",
            "featureList": [
              "ATS Resume Score Checker",
              "Job Description Keyword Matching",
              "Single Column ATS Formatting",
              "PDF Text Editor",
              "TCS Ninja Fresher Templates"
            ],
            "audience": {
              "@type": "Audience",
              "audienceType": "Job Seekers, Freshers, Software Engineers in India"
            }
          })
        }} />
      </body>
    </html>
  );
}
