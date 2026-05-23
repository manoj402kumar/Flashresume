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
    "Rebuild your resume in 60 seconds. Flashresume is India's most advanced ATS resume builder. Upload your CV and beat the Applicant Tracking System instantly.",
  keywords: [
    "ATS resume builder",
    "resume builder India",
    "free resume maker",
    "AI resume optimizer",
    "software engineer resume",
    "Overleaf resume template ai builder",
    "TCS ninja resume format",
    "best resume formats 2026",
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
      <body suppressHydrationWarning>
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
            "url": "https://flashresume.in"
          })
        }} />
      </body>
    </html>
  );
}
