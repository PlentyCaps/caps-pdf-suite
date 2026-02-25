"use client";

import { useState } from "react";
import Link from "next/link";
import { Moon, Sun, FileText, Scissors, RefreshCw, Archive, Edit3, PenTool, ArrowRight, Github, ScanText } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Merge PDFs",
    description: "Combine multiple PDF files into one seamless document in seconds.",
    color: "from-blue-500 to-blue-600",
    href: "/merge",
  },
  {
    icon: Scissors,
    title: "Split PDFs",
    description: "Extract pages or split large PDFs into smaller, manageable files.",
    color: "from-purple-500 to-purple-600",
    href: "/split",
  },
  {
    icon: RefreshCw,
    title: "Convert PDFs",
    description: "Convert PDFs to Word, Excel, images, and more — or the other way around.",
    color: "from-green-500 to-green-600",
    href: "/convert",
  },
  {
    icon: Archive,
    title: "Compress PDFs",
    description: "Reduce file size without sacrificing quality. Share faster, store smarter.",
    color: "from-orange-500 to-orange-600",
    href: "/compress",
  },
  {
    icon: Edit3,
    title: "Edit PDFs",
    description: "Add text, annotations, and highlights directly to your PDF files.",
    color: "from-red-500 to-red-600",
    href: "/edit",
  },
  {
    icon: PenTool,
    title: "Sign PDFs",
    description: "Sign documents digitally and collect signatures with ease.",
    color: "from-teal-500 to-teal-600",
    href: "/sign",
  },
  {
    icon: ScanText,
    title: "OCR — Text Recognition",
    description: "Extract text from scanned PDFs and images. Runs fully in your browser.",
    color: "from-violet-500 to-violet-600",
    href: "/ocr",
  },
];

export default function Home() {
  const [dark, setDark] = useState(true);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">

        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">Caps PDF Suite</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#features" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:block">
                Features
              </a>
              <button
                onClick={() => setDark(!dark)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-full blur-3xl" />
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
              ✦ All your PDF tools in one place
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
              PDFs, handled{" "}
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                effortlessly
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Merge, split, convert, compress, edit and sign PDF files — all in one powerful web suite.
              No installs. No limits. Just results.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-red-500/25">
                Start for free <ArrowRight className="w-5 h-5" />
              </button>
              <button className="flex items-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <Github className="w-5 h-5" /> View on GitHub
              </button>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
              {[
                { value: "6+", label: "PDF tools" },
                { value: "100%", label: "Web based" },
                { value: "Free", label: "To start" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 bg-gray-50 dark:bg-gray-900/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need for PDFs</h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
                A full suite of professional PDF tools, built for speed and simplicity.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                const cardContent = (
                  <>
                    <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium transition-colors text-blue-500 group-hover:text-blue-400">
                      {feature.href ? <>Try it <ArrowRight className="w-3 h-3" /></> : <>Coming soon <ArrowRight className="w-3 h-3" /></>}
                    </div>
                  </>
                );
                const cardClass = "group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-200 cursor-pointer text-left";
                return feature.href ? (
                  <Link key={feature.title} href={feature.href} className={cardClass}>
                    {cardContent}
                  </Link>
                ) : (
                  <div key={feature.title} className={cardClass}>
                    {cardContent}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl p-12 shadow-2xl shadow-red-500/20">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to tame your PDFs?
              </h2>
              <p className="text-red-100 text-lg mb-8">
                Join thousands of users who use Caps PDF Suite to get things done.
              </p>
              <button className="bg-white text-red-600 font-semibold px-8 py-4 rounded-xl text-lg hover:bg-red-50 transition-colors">
                Get started for free
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-md flex items-center justify-center">
                <FileText className="w-3 h-3 text-white" />
              </div>
              <span className="font-semibold text-sm">Caps PDF Suite</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} Caps PDF Suite. All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}
