'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Mail, Eye, EyeOff, Send, CheckCircle, Server } from 'lucide-react';

interface EmailConfig {
  id: string;
  enabled: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  fromAddress: string;
}

export default function EmailSettingsPage() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [fromAddress, setFromAddress] = useState('noreply@roomflow.local');
  const [showPass, setShowPass] = useState(false);

  // Test send state
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api
      .get('/email-config')
      .then((res) => {
        setConfig(res.data);
        setEnabled(res.data.enabled);
        setHost(res.data.host || '');
        setPort(String(res.data.port ?? 587));
        setSecure(res.data.secure);
        setUser(res.data.user || '');
        setFromAddress(res.data.fromAddress || 'noreply@roomflow.local');
      })
      .catch(() => {
        toast.error('Failed to load Email settings');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!host) {
      toast.error('SMTP Host is required');
      return;
    }
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      toast.error('Port must be a valid number (1-65535)');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/email-config', {
        enabled,
        host: host || null,
        port: portNum,
        secure,
        user: user || null,
        pass: pass || null,
        fromAddress: fromAddress || 'noreply@roomflow.local',
      });
      setConfig(res.data);
      toast.success('Email settings saved successfully');
    } catch {
      toast.error('Failed to save Email settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail) {
      toast.error('Enter a recipient email for the test');
      return;
    }
    if (!config?.host) {
      toast.error('Save SMTP settings first, then test');
      return;
    }
    setTesting(true);
    try {
      const res = await api.post('/email-config/test', { to: testEmail });
      if (res.data?.sent) {
        toast.success(res.data.message || 'Test email sent');
      } else {
        toast.error(res.data?.message || 'Test send failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Test send failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Email Settings"
        description="Configure SMTP email notifications"
        allowedRoles={['ADMIN_IT']}
      >
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-[#143258] border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Email Settings"
      description="SMTP configuration for notifications & OTP"
      allowedRoles={['ADMIN_IT']}
    >
      <div className="max-w-2xl">
        <Card>
          <CardContent>
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="h-10 w-10 rounded-lg bg-[#143258]/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#143258]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    SMTP Configuration
                  </h2>
                  <p className="text-sm text-slate-500">
                    Used for notifications and OTP emails
                  </p>
                </div>
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Enable Email
                  </p>
                  <p className="text-xs text-slate-500">
                    Send OTP and notification messages via email
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[#143258] focus:ring-offset-2 ${
                    enabled ? 'bg-[#143258]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enabled ? 'translate-x-4' : 'translate-x-0'
                    } mt-0.5 ml-0.5`}
                  />
                </button>
              </div>

              {/* Host */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  SMTP Host <span className="text-red-500">*</span>
                </label>
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.example.com"
                />
                <p className="text-xs text-slate-400">
                  e.g. smtp.sumopod.com, smtp.gmail.com
                </p>
              </div>

              {/* Port + SSL */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    Port
                  </label>
                  <Input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="587"
                  />
                  <p className="text-xs text-slate-400">465 (SSL) / 587 (TLS)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    SSL / Secure
                  </label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={secure}
                    onClick={() => setSecure(!secure)}
                    className={`relative inline-flex h-6 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[#143258] focus:ring-offset-2 mt-2 ${
                      secure ? 'bg-[#143258]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        secure ? 'translate-x-4' : 'translate-x-0'
                      } mt-0.5 ml-0.5`}
                    />
                  </button>
                  <p className="text-xs text-slate-400">
                    {secure ? 'SSL/TLS (secure)' : 'STARTTLS'}
                  </p>
                </div>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  Username
                </label>
                <Input
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="your_username"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Leave blank to keep the saved password
                </p>
              </div>

              {/* From Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  From Address
                </label>
                <Input
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder="noreply@roomflow.local"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#143258] hover:bg-[#1a3d6b]"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>

              {/* Status */}
              {config && (
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Current Status
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle
                      className={`w-4 h-4 ${
                        config.enabled ? 'text-green-500' : 'text-gray-300'
                      }`}
                    />
                    <span className="text-sm text-slate-700">
                      {config.enabled
                        ? 'Email integration active'
                        : 'Email integration disabled'}
                    </span>
                  </div>
                  {config.host && (
                    <p className="text-xs text-slate-500">
                      {config.host}:{config.port} ({config.secure ? 'SSL' : 'TLS'}
                      )
                    </p>
                  )}
                </div>
              )}

              {/* Test Send */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#143258]" />
                  <p className="text-sm font-medium text-slate-800">
                    Send Test Email
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      type="email"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleTestSend}
                    disabled={testing}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {testing ? 'Sending...' : 'Test Send'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
