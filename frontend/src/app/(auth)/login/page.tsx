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
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#fefefe] p-4 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        {/* Logo section */}
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 rounded-lg bg-[#143258] items-center justify-center font-bold text-white tracking-wider text-base mb-3">
            RF
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-black">RoomFlow</h1>
          <p className="text-gray-500 mt-2 text-sm font-normal">Enterprise Room Booking Engine</p>
        </div>

        {/* Sign In Card */}
        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-black">Sign In</CardTitle>
            <CardDescription className="text-gray-500">Enter your credentials to access your booking dashboard</CardDescription>
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

              <Button type="submit" variant="primary" className="w-full mt-4" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-gray-100 pt-4 mt-3">
            <p className="text-gray-500 text-xs">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-[#143258] hover:text-[#0f2744] font-medium transition-colors hover:underline">
                Create one now
              </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Seed Credentials Info */}
        <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 flex flex-col gap-2">
          <p className="font-semibold text-gray-700">💡 Quick-start Seed Credentials:</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-gray-700">IT Admin:</span>
              <p className="text-gray-500">admin@roomflow.local</p>
              <p className="text-gray-500">password123</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Room Manager:</span>
              <p className="text-gray-500">manager@roomflow.local</p>
              <p className="text-gray-500">password123</p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-2 mt-1">
            <span className="font-medium text-gray-700">Regular Employee:</span>
            <p className="text-gray-500">user@roomflow.local / password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
