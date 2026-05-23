import { Metadata } from "next";
import { notFound } from "next/navigation";
import { seoPages } from "@/lib/seo-data";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

type Props = {
  params: { slug: string };
};

export function generateStaticParams() {
  return seoPages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const pageData = seoPages.find((p) => p.slug === resolvedParams.slug);
  
  if (!pageData) {
    return { title: "Not Found" };
  }

  return {
    title: pageData.title,
    description: pageData.description,
    alternates: {
      canonical: `https://flashresume.in/resume-templates/${pageData.slug}`,
    },
  };
}

export default async function SEOProgrammaticPage({ params }: Props) {
  const resolvedParams = await params;
  const pageData = seoPages.find((p) => p.slug === resolvedParams.slug);

  if (!pageData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background font-sans pt-32 pb-24">
      {/* TopNavBar is handled globally by layout or we can just assume user navigates via global nav */}
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-sm font-bold text-amber-700 mb-6 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>Flashresume - The Smart Choice</span>
          </div>
          
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-on-background leading-tight mb-6">
            {pageData.h1}
          </h1>
          
          <p className="text-lg md:text-xl text-on-surface-variant leading-relaxed font-medium">
            {pageData.heroText}
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/"
              className="flash-gradient text-white font-bold text-lg px-8 py-4 rounded-full shadow-xl hover:opacity-90 transition-all active:scale-95 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        <div className="mt-20 max-w-4xl mx-auto bg-surface-container rounded-3xl p-8 sm:p-12 border border-surface-container-high shadow-sm">
          <h2 className="font-headline text-2xl sm:text-3xl font-bold text-on-background mb-8 text-center">
            Why use Flashresume for this?
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {pageData.features.map((feature, idx) => (
              <div key={idx} className="bg-surface rounded-2xl p-6 border border-surface-container-low shadow-sm hover:shadow-md transition-shadow">
                <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-bold text-on-background">{feature}</h3>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
