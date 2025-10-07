import ParticleSea from "@/components/ParticleSea";

export default function HomePage() {
  return (
    <main className="relative min-h-screen">
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
        </div>
      </div>
    </main>
  );
}
