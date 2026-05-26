'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Database, HardDrive, Cloud, Key, Lock, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

type StorageType = 'LOCAL' | 'S2_STORAGE' | 'GOOGLE_DRIVE';

export default function StorageSettingsPage() {
  const [storageType, setStorageType] = useState<StorageType>('LOCAL');
  const [s3Key, setS3Key] = useState('AKIAIOSFODNN7EXAMPLE');
  const [s3Secret, setS3Secret] = useState('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
  const [s3Bucket, setS3Bucket] = useState('roomflow-assets-production');
  const [driveClientSecret, setDriveClientSecret] = useState('GOCSPX-u1_Z-xV3EXAMPLECLIENTSECRET');
  const [driveFolderId, setDriveFolderId] = useState('1B_uxxxxxxxxxxxxxxxxx_xxxxxxxxxxx');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success(`Storage provider successfully switched to ${storageType}!`);
    }, 1200);
  };

  return (
    <DashboardLayout title="Storage Provider Controls" description="Configure file upload abstractions, cloud settings, and OAuth systems." allowedRoles={['ADMIN_IT']}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Toggle Storage Strategy */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border border-slate-900 glass">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <span>Strategy Selection</span>
              </CardTitle>
              <CardDescription>Select the underlying storage provider model</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col gap-4">
              {/* Local Storage Option */}
              <div
                onClick={() => setStorageType('LOCAL')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  storageType === 'LOCAL'
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-200'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700/50 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <HardDrive className={`w-5 h-5 ${storageType === 'LOCAL' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <p className="font-bold text-sm text-slate-200">Local Directory</p>
                    <p className="text-xs text-slate-500">Saves uploads to server storage</p>
                  </div>
                </div>
                <Badge variant={storageType === 'LOCAL' ? 'success' : 'neutral'}>
                  {storageType === 'LOCAL' ? 'ACTIVE' : 'READY'}
                </Badge>
              </div>

              {/* S2/S3 Cloud Storage Option */}
              <div
                onClick={() => setStorageType('S2_STORAGE')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  storageType === 'S2_STORAGE'
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-200'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700/50 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Cloud className={`w-5 h-5 ${storageType === 'S2_STORAGE' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <p className="font-bold text-sm text-slate-200">S2 / S3 Cloud Bucket</p>
                    <p className="text-xs text-slate-500">Scaleable cloud object storage</p>
                  </div>
                </div>
                <Badge variant={storageType === 'S2_STORAGE' ? 'success' : 'neutral'}>
                  {storageType === 'S2_STORAGE' ? 'ACTIVE' : 'READY'}
                </Badge>
              </div>

              {/* Google Drive Option */}
              <div
                onClick={() => setStorageType('GOOGLE_DRIVE')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  storageType === 'GOOGLE_DRIVE'
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-200'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700/50 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Cloud className={`w-5 h-5 ${storageType === 'GOOGLE_DRIVE' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <p className="font-bold text-sm text-slate-200">Google Drive API</p>
                    <p className="text-xs text-slate-500">Corporate Google Drive folders</p>
                  </div>
                </div>
                <Badge variant={storageType === 'GOOGLE_DRIVE' ? 'success' : 'neutral'}>
                  {storageType === 'GOOGLE_DRIVE' ? 'ACTIVE' : 'READY'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Credentials Form Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-slate-900 glass">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <span>Provider Settings</span>
              </CardTitle>
              <CardDescription>Configure access tokens and secrets for the selected provider</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {storageType === 'LOCAL' && (
                <div className="p-6 rounded-xl border border-slate-800/50 bg-slate-900/20 text-sm text-slate-400 space-y-4">
                  <div className="flex items-start gap-3 text-indigo-300">
                    <Settings className="w-5 h-5 shrink-0 text-indigo-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-200">Local Disk Configuration:</p>
                      <p className="text-xs text-slate-500 mt-1">Saves all meeting room photos and assets directly inside the project uploads subdirectory.</p>
                    </div>
                  </div>
                  <div className="space-y-2 mt-4 text-xs font-semibold uppercase">
                    <p className="text-slate-500">Active Settings:</p>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>Upload Path: <span className="font-mono text-slate-400">./uploads/</span></div>
                      <div>Max Size Limit: <span className="font-mono text-slate-400">5 MB</span></div>
                    </div>
                  </div>
                </div>
              )}

              {storageType === 'S2_STORAGE' && (
                <div className="space-y-4">
                  <Input
                    label="Access Key ID"
                    type="text"
                    value={s3Key}
                    onChange={(e) => setS3Key(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                  />
                  <Input
                    label="Secret Access Key"
                    type="password"
                    value={s3Secret}
                    onChange={(e) => setS3Secret(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                  />
                  <Input
                    label="S3 Bucket Name"
                    type="text"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    leftIcon={<Database className="w-4 h-4" />}
                  />
                </div>
              )}

              {storageType === 'GOOGLE_DRIVE' && (
                <div className="space-y-4">
                  <Input
                    label="OAuth Client ID"
                    type="text"
                    value="1092830918-exampleclientid.apps.googleusercontent.com"
                    disabled
                    leftIcon={<Lock className="w-4 h-4" />}
                  />
                  <Input
                    label="OAuth Client Secret"
                    type="password"
                    value={driveClientSecret}
                    onChange={(e) => setDriveClientSecret(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                  />
                  <Input
                    label="Destination Google Folder ID"
                    type="text"
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    leftIcon={<Database className="w-4 h-4" />}
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-4 border-t border-slate-900/40 p-0 flex justify-end">
              <Button onClick={handleSave} variant="primary" isLoading={isSaving}>
                Save System Config
              </Button>
            </CardFooter>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
