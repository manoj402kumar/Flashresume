import { getBlogPost, getBlogPosts } from "@/lib/blog";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Metadata } from "next";
import Link from "next/link";

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

// Dynamically generate the SEO tags for each blog post
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const post = getBlogPost(resolvedParams.slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: `${post.title} | Flashresume Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

// Generate static pages at build time for lightning-fast speeds
export async function generateStaticParams() {
  const posts = getBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: Props) {
  const resolvedParams = await params;
  const post = getBlogPost(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="min-h-screen bg-surface pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-6 sm:px-8">
        <div className="mb-8">
          <Link 
            href="/blog" 
            className="text-primary hover:underline text-sm font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Blog
          </Link>
        </div>

        <header className="mb-10">
          <div className="text-on-surface-variant text-sm mb-4 font-medium">
            {new Date(post.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold font-headline text-on-background leading-tight mb-6">
            {post.title}
          </h1>
          <p className="text-xl text-on-surface-variant leading-relaxed">
            {post.description}
          </p>
        </header>

        <div className="prose prose-lg prose-slate prose-a:text-primary hover:prose-a:text-primary-container max-w-none">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </div>
    </article>
  );
}
