'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Successfully logged in');
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black p-4 relative overflow-hidden">
      {/* Background visual decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 items-center justify-center font-bold text-white tracking-wider text-xl shadow-lg shadow-indigo-500/30 mb-3 animate-pulse">
            RF
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">RoomFlow</h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">Enterprise Room Booking Engine</p>
        </div>

        <Card className="border border-slate-800/80 shadow-2xl glass bg-slate-900/30">
          <CardHeader className="pb-2">
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your booking dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-800/20 pt-4 mt-2">
            <p className="text-slate-400 text-xs">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors hover:underline">
                Create one now
              </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Quick Credentials Info Box for Seeding Validation */}
        <div className="mt-6 p-4 rounded-xl border border-slate-800/40 bg-slate-900/40 glass text-xs text-slate-400 flex flex-col gap-2">
          <p className="font-semibold text-slate-300">💡 Quick-start Seed Credentials:</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-slate-300">IT Admin:</span>
              <p>admin@roomflow.local</p>
              <p>password123</p>
            </div>
            <div>
              <span className="font-medium text-slate-300">Room Manager:</span>
              <p>manager@roomflow.local</p>
              <p>password123</p>
            </div>
          </div>
          <div className="border-t border-slate-800/40 pt-2 mt-1">
            <span className="font-medium text-slate-300">Regular Employee:</span>
            <p>user@roomflow.local / password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
