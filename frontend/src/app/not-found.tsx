import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-white text-slate-900 gap-6">
      <div className="text-center space-y-4">
        <h1 className="text-8xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">
          404
        </h1>
        <p className="text-2xl font-bold text-slate-800">Page Not Found</p>
        <p className="text-slate-500 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
