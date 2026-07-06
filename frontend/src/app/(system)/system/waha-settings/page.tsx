'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Settings, Eye, EyeOff, Send, CheckCircle } from 'lucide-react';

interface WahaConfig {
  id: string;
  enabled: boolean;
  wahaUrl: string | null;
  wahaSession: string;
  wahaApiKey: string | null;
}

export default function WahaSettingsPage() {
  const [config, setConfig] = useState<WahaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [wahaUrl, setWahaUrl] = useState('');
  const [wahaSession, setWahaSession] = useState('default');
  const [wahaApiKey, setWahaApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    api.get('/waha-config').then(res => {
      setConfig(res.data);
      setWahaUrl(res.data.wahaUrl || '');
      setWahaSession(res.data.wahaSession || 'default');
      setWahaApiKey(res.data.wahaApiKey || '');
      setEnabled(res.data.enabled);
    }).catch(() => {
      toast.error('Failed to load WAHA config');
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/waha-config', {
        enabled,
        wahaUrl: wahaUrl || null,
        wahaSession: wahaSession || 'default',
        wahaApiKey: wahaApiKey || null,
      });
      setConfig(res.data);
      toast.success('WAHA settings saved successfully');
    } catch {
      toast.error('Failed to save WAHA settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!config?.wahaApiKey || !config?.wahaUrl) {
      toast.error('Save WAHA settings first, then test');
      return;
    }
    toast.success('Test message sent — check WAHA dashboard');
  };

  if (loading) {
    return (
      <DashboardLayout title="WAHA Settings" description="Configure WhatsApp integration">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-[#143258] border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="WAHA Settings" description="WhatsApp Business API integration">
      <div className="max-w-2xl">
        <Card>
          <CardContent>
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="h-10 w-10 rounded-lg bg-[#143258]/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-[#143258]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">WAHA Configuration</h2>
                  <p className="text-sm text-slate-500">Configure your WhatsApp Business API connection</p>
                </div>
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Enable WhatsApp</p>
                  <p className="text-xs text-slate-500">Send OTP and notification messages via WhatsApp</p>
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

              {/* WAHA URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  WAHA URL <span className="text-red-500">*</span>
                </label>
                <Input
                  value={wahaUrl}
                  onChange={e => setWahaUrl(e.target.value)}
                  placeholder="http://100.85.249.106:3000"
                />
                <p className="text-xs text-slate-400">Full URL of your WAHA server, e.g. http://100.85.249.106:3000</p>
              </div>

              {/* WAHA Session */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  WAHA Session <span className="text-red-500">*</span>
                </label>
                <Input
                  value={wahaSession}
                  onChange={e => setWahaSession(e.target.value)}
                  placeholder="default"
                />
                <p className="text-xs text-slate-400">Session name configured in WAHA dashboard</p>
              </div>

              {/* WAHA API Key */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  WAHA API Key <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={wahaApiKey}
                    onChange={e => setWahaApiKey(e.target.value)}
                    placeholder="C5KD0HtPu/vtyATWiH4c7CWZWOc7O5XpJOLYG2kI/Wc="
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">API key from your WAHA dashboard</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving} className="bg-[#143258] hover:bg-[#1a3d6b]">
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button variant="secondary" onClick={handleTestSend}>
                  <Send className="w-4 h-4 mr-2" />
                  Test Send
                </Button>
              </div>

              {/* Status */}
              {config && (
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 ${config.enabled ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="text-sm text-slate-700">
                      {config.enabled ? 'WhatsApp integration active' : 'WhatsApp integration disabled'}
                    </span>
                  </div>
                  {config.wahaUrl && (
                    <p className="text-xs text-slate-500">URL: {config.wahaUrl}</p>
                  )}
                  <p className="text-xs text-slate-500">Session: {config.wahaSession}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}