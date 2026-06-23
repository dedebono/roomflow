'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { paymentGatewaysApi } from '@/lib/api';
import type { PaymentGateway, CreatePaymentGatewayDto, PaymentGatewayConfig } from '@/types/payment-gateway';
import toast from 'react-hot-toast';
import { Wallet, Plus, Edit2, Trash2, Link2, Key, Hash, CreditCard, Eye, EyeOff } from 'lucide-react';

// Simple Toggle Switch component
const Toggle = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
      checked ? 'bg-[#143258]' : 'bg-gray-200'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-4' : 'translate-x-0'
      } mt-0.5 ml-0.5`}
    />
  </button>
);

export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [formApiUrl, setFormApiUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formProjectSlug, setFormProjectSlug] = useState('');
  const [formVirtualAccount, setFormVirtualAccount] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const fetchGateways = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await paymentGatewaysApi.getAll();
      setGateways(data);
    } catch {
      toast.error('Failed to load payment gateways');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingId(id);
    try {
      await paymentGatewaysApi.toggle(id, !enabled);
      toast.success(`Gateway ${enabled ? 'disabled' : 'enabled'} successfully`);
      fetchGateways();
    } catch {
      toast.error('Failed to toggle gateway');
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenEdit = (gw: PaymentGateway) => {
    setEditingId(gw.id);
    setFormName(gw.name);
    setFormLogo(gw.logo || '');
    setFormApiUrl(gw.config?.apiUrl || '');
    setFormApiKey(gw.config?.apiKey || '');
    setFormProjectSlug(gw.config?.projectSlug || '');
    setFormVirtualAccount(gw.config?.virtualAccount || '');
    setFormEnabled(gw.enabled);
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormName('');
    setFormLogo('');
    setFormApiUrl('');
    setFormApiKey('');
    setFormProjectSlug('');
    setFormVirtualAccount('');
    setFormEnabled(false);
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error('Gateway name is required');
      return;
    }

    const config: PaymentGatewayConfig = {};
    if (formApiUrl.trim()) config.apiUrl = formApiUrl.trim();
    if (formApiKey.trim()) config.apiKey = formApiKey.trim();
    if (formProjectSlug.trim()) config.projectSlug = formProjectSlug.trim();
    if (formVirtualAccount.trim()) config.virtualAccount = formVirtualAccount.trim();

    const dto: CreatePaymentGatewayDto = {
      name: formName.trim(),
      logo: formLogo.trim() || undefined,
      config: Object.keys(config).length > 0 ? config : undefined,
      enabled: formEnabled,
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await paymentGatewaysApi.update(editingId, dto);
        toast.success('Payment gateway updated');
      } else {
        await paymentGatewaysApi.create(dto);
        toast.success('Payment gateway created');
      }
      handleClose();
      fetchGateways();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment gateway? This cannot be undone.')) return;
    try {
      await paymentGatewaysApi.delete(id);
      toast.success('Gateway deleted');
      fetchGateways();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Deletion failed');
    }
  };

  return (
    <DashboardLayout
      title="Payment Gateways"
      description="Configure and manage payment gateway integrations."
      allowedRoles={['ADMIN_IT']}
    >
      <Card className="border border-slate-200 glass">
        <CardHeader className="p-0 mb-4 flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-400" />
              <span>Payment Gateway Integrations</span>
            </CardTitle>
            <CardDescription>
              Enable/disable and configure payment providers like Pakasir, Ipaymu, and others.
            </CardDescription>
          </div>
          <Button size="sm" variant="primary" onClick={handleOpenNew}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Gateway</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-[#143258] border-t-transparent rounded-full" />
            </div>
          ) : gateways.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No payment gateways configured</p>
              <p className="text-xs mt-1">Add your first gateway to start accepting payments.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {gateways.map((gw) => (
                <div
                  key={gw.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-[#143258]/10 flex items-center justify-center flex-shrink-0">
                      {gw.logo ? (
                        <img src={gw.logo} alt={gw.name} className="h-6 w-6 rounded object-contain" />
                      ) : (
                        <Wallet className="w-5 h-5 text-[#143258]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{gw.name}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            gw.enabled
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}
                        >
                          {gw.enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>

                      {/* Config summary */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        {gw.config?.apiUrl && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Link2 className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{gw.config.apiUrl}</span>
                          </div>
                        )}
                        {gw.config?.projectSlug && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Hash className="w-3 h-3" />
                            <span>{gw.config.projectSlug}</span>
                          </div>
                        )}
                        {gw.config?.virtualAccount && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <CreditCard className="w-3 h-3" />
                            <span>{gw.config.virtualAccount}</span>
                          </div>
                        )}
                        {gw.config?.apiKey && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 italic">
                            <Key className="w-3 h-3" />
                            <span>••••••••</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <Toggle
                      checked={gw.enabled}
                      onChange={(checked) => handleToggle(gw.id, gw.enabled)}
                      disabled={togglingId === gw.id}
                    />
                    <button
                      onClick={() => handleOpenEdit(gw)}
                      className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(gw.id)}
                      className="text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingId ? `Edit: ${formName}` : 'Add Payment Gateway'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Gateway Name"
            placeholder="e.g. Pakasir, Ipaymu"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />

          <Input
            label="Logo URL (Optional)"
            type="url"
            placeholder="https://example.com/logo.png"
            value={formLogo}
            onChange={(e) => setFormLogo(e.target.value)}
          />

          {/* API Configuration */}
          <div className="border-t border-slate-200 pt-4 mt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">API Configuration</h4>

            <div className="space-y-3">
              <Input
                label="API URL"
                placeholder="https://app.pakasir.com/api"
                value={formApiUrl}
                onChange={(e) => setFormApiUrl(e.target.value)}
                leftIcon={<Link2 className="w-4 h-4" />}
              />

              <div className="relative">
                <Input
                  label="Project Slug / ID"
                  placeholder="e.g. depodomain"
                  value={formProjectSlug}
                  onChange={(e) => setFormProjectSlug(e.target.value)}
                  leftIcon={<Hash className="w-4 h-4" />}
                />
              </div>

              <div className="relative">
                <Input
                  label="API Key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  leftIcon={<Key className="w-4 h-4" />}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Input
                label="Virtual Account (Optional)"
                placeholder="e.g. 1179000899"
                value={formVirtualAccount}
                onChange={(e) => setFormVirtualAccount(e.target.value)}
                leftIcon={<CreditCard className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center gap-3 pt-2">
            <Toggle checked={formEnabled} onChange={setFormEnabled} />
            <span className="text-sm font-medium text-slate-700">
              {formEnabled ? 'Gateway is active' : 'Gateway is disabled'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/40">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingId ? 'Save Changes' : 'Add Gateway'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
