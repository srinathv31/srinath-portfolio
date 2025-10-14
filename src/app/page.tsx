import ParticleSea from "@/components/ParticleSea";

export default function HomePage() {
  return (
    <main className="relative h-full w-full overflow-y-auto overflow-x-hidden">
      <ParticleSea />

      {/* Hero Section */}
      <div className="relative z-10 flex min-h-screen py-12 px-6 md:px-12 lg:px-24 xl:px-32 pointer-events-none">
        <div className="max-w-7xl w-full">
          {/* Name */}
          <div className="mb-12 overflow-hidden">
            <h1 className="text-7xl md:text-8xl lg:text-9xl tracking-tight animate-slide-in">
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Srinath
              </span>
              <span className="block text-white mt-2">Venkatesh</span>
            </h1>
          </div>

          {/* Bio */}
          <div className="max-w-3xl space-y-6 animate-slide-in-delay">
            <div className="flex items-start gap-4">
              <div className="w-1 h-20 bg-gradient-to-b from-blue-400 to-purple-400 rounded-full animate-slide-in-delay-2"></div>
              <div>
                <p className="text-2xl md:text-3xl lg:text-4xl text-slate-200 font-light leading-relaxed">
                  Building cool things
                </p>
                <p className="text-lg md:text-xl text-slate-400 mt-4 leading-relaxed">
                  Recently into AI.
                </p>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="max-w-3xl mt-12 animate-slide-in-delay-3 pointer-events-auto">
            <div className="flex items-center gap-6">
              {/* GitHub */}
              <a
                href="https://github.com/srinathv31"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:border-slate-300/50 transition-all duration-300 hover:bg-white/10"
              >
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-slate-200 transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-slate-300 group-hover:text-white transition-colors">
                  GitHub
                </span>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com/in/srinath-venkatesh/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#0A66C2]/50 transition-all duration-300 hover:bg-white/10"
              >
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-[#0A66C2] transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <span className="text-slate-300 group-hover:text-white transition-colors">
                  LinkedIn
                </span>
              </a>

              {/* Email */}
              <a
                href="mailto:srinath@srinathvenkatesh.com"
                className="group flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:border-amber-400/50 transition-all duration-300 hover:bg-white/10"
              >
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-slate-300 group-hover:text-white transition-colors">
                  Email
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
