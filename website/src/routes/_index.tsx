import type { Route } from "./+types/_index";

export function loader() {
  return {};
}
export default function Index() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500">
      <div className="text-center space-y-6 px-8">
        <div className="relative">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 animate-pulse">
            Hello World
          </h1>
          <div className="absolute -top-2 -left-2 text-6xl md:text-8xl font-bold text-purple-300 opacity-30 -z-10">
            Hello World
          </div>
        </div>
        <div className="flex justify-center space-x-4">
          <div className="w-4 h-4 bg-white rounded-full animate-bounce"></div>
          <div className="w-4 h-4 bg-white rounded-full animate-bounce delay-75"></div>
          <div className="w-4 h-4 bg-white rounded-full animate-bounce delay-150"></div>
        </div>
        <p className="text-xl md:text-2xl text-white/80 max-w-md mx-auto leading-relaxed">
          Welcome to something amazing ✨
        </p>
      </div>
    </div>
  );
}
