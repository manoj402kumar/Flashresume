import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flashresume.in"),
  title: {
    default: "Flashresume - India's No.1 ATS Resume Builder",
    template: "%s | Flashresume",
  },
  description:
    "Rebuild your resume in 60 seconds. Flashresume is India's most advanced ATS resume builder. Upload your CV, job description and beat the Applicant Tracking System instantly.",
  keywords: [
    "ATS resume builder",
    "AI resume builder",
    "resume builder India",
    "free resume maker",
    "AI resume optimizer",
    "software engineer resume",
    "Overleaf resume template ai builder",
    "TCS ninja resume format",
    "best resume formats 2026",
    "edit pdf resume online free",
    "modify pdf resume text",
    "resume pdf to editable format",
    "single column ATS resume template",
    "resume maker for campus placements",
    "Taleo Greenhouse resume formatter",
    "bypass Workday ATS filters",
    "Free resume builder",
    "Resume maker online",
    "CV builder free",
    "Best resume builder for freshers India",
    "Resume format for job application",
  ],
  authors: [{ name: "Flashresume" }],
  creator: "Flashresume",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://flashresume.in",
    title: "Flashresume - India's No.1 ATS Resume Builder",
    description:
      "Rebuild your resume in 60 seconds. Beat the ATS instantly.",
    siteName: "Flashresume",
    images: [
      {
        url: "/og-image.png", // We will add an OG image later
        width: 1200,
        height: 630,
        alt: "Flashresume Open Challenge",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flashresume - India's No.1 ATS Resume Builder",
    description: "Rebuild your resume in 60 seconds.",
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

        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />

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
            "description": "India's No.1 ATS Resume Builder. Optimize and rebuild your resume for Applicant Tracking Systems in 60 seconds.",
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
