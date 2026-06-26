import { getBlogPosts } from "@/lib/blog";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flashresume Blog | Resume & Career Tips",
  description: "Read our latest articles on how to optimize your resume for Applicant Tracking Systems and land your dream job faster.",
};

export default function BlogIndexPage() {
  const posts = getBlogPosts();

  return (
    <div className="min-h-screen bg-surface pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-6 sm:px-8">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline text-on-background mb-4">
            Flashresume Blog
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl">
            Latest insights, guides, and tips on resume optimization, ATS bypass strategies, and career growth.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-on-surface-variant">No posts found. Check back later!</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {posts.map((post) => (
              <Link 
                key={post.slug} 
                href={`/blog/${post.slug}`}
                className="group block bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-100 transition-all duration-300 p-6"
              >
                <div className="text-sm font-medium text-primary mb-3">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <h2 className="text-xl font-bold text-on-background mb-3 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  {post.description}
                </p>
                <div className="mt-6 flex items-center text-primary text-sm font-semibold">
                  Read article 
                  <svg className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
