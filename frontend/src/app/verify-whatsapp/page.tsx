'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Phone, MessageSquare, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return localStorage;
  } catch {
    try {
      sessionStorage.setItem('__test__', '1');
      sessionStorage.removeItem('__test__');
      return sessionStorage;
    } catch {
      return null;
    }
  }
}

export default function VerifyWhatsAppPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'enter-email' | 'enter-otp'>('enter-email');
  const [isLoading, setIsLoading] = useState(false);

  // On mount: check if email stored from registration, auto-skip to OTP step
  React.useEffect(() => {
    const storage = getStorage();
    const storedEmail = storage?.getItem('verify_email');
    if (storedEmail) {
      setEmail(storedEmail);
      setStep('enter-otp');
      storage?.removeItem('verify_email'); // consume after read

      // If coming from login (mode=resend), auto-trigger OTP resend
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'resend') {
        api.post('/auth/resend-otp', { email: storedEmail }).catch(() => {});
      }
    }
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/auth/resend-otp', { email });
      setStep('enter-otp');
      toast.success('OTP sent to your WhatsApp number');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP code');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      const { access_token, user } = res.data;

      const storage = getStorage();
      if (storage) {
        storage.setItem('roomflow_token', access_token);
        storage.setItem('roomflow_user', JSON.stringify(user));
      }

      toast.success('WhatsApp verified successfully!');

      // Use hard redirect so AuthProvider rehydrates from storage.
      // router.push() keeps stale AuthContext state → Sidebar sees user=null.
      if (user.role === 'ADMIN_IT') window.location.href = '/system/users';
      else if (user.role === 'ROOM_ADMIN') window.location.href = '/dashboard';
      else if (user.role === 'RENTER') window.location.href = '/renter/dashboard';
      else window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post('/auth/resend-otp', { email });
      toast.success('New OTP sent to your WhatsApp');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 items-center justify-center font-bold text-white tracking-wider text-xl shadow-lg shadow-indigo-500/30 mb-3">
            RF
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Verify WhatsApp</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">
            {step === 'enter-email'
              ? 'Enter your registered email to receive an OTP'
              : 'Enter the 6-digit code sent to your WhatsApp'}
          </p>
        </div>

        <Card className="border border-slate-200 shadow-2xl bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-indigo-400" />
              WhatsApp Verification
            </CardTitle>
            <CardDescription>
              {step === 'enter-email'
                ? 'We\'ll send you a verification code via WhatsApp'
                : `Check your WhatsApp for the code sent to your number`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'enter-email' ? (
              <form onSubmit={handleSendOtp} className="space-y-4 mt-2">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  required
                />
                <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                  Send OTP via WhatsApp
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 mt-2">
                <div className="text-center mb-2">
                  <p className="text-slate-500 text-xs">
                    OTP sent to <span className="text-indigo-400 font-semibold">{email}</span>
                  </p>
                </div>
                <Input
                  label="6-Digit OTP Code"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  required
                />
                <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                  Verify OTP
                </Button>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleResend}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend OTP
                  </button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-200 pt-4 mt-2">
            <p className="text-slate-500 text-xs">
              Already verified?{' '}
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
