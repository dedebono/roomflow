'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import api from '@/lib/api';
import { User, Role } from '@/types';
import toast from 'react-hot-toast';
import { Users, Plus, Edit2, Trash2, Shield, Mail, Key, Phone } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // User Form Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userWhatsappNumber, setUserWhatsappNumber] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<Role>('USER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err: any) {
      toast.error('Failed to load user records');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Open Edit User Modal
  const handleOpenEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserWhatsappNumber(user.whatsappNumber || '');
    setUserPassword(''); // Clear for editing
    setUserRole(user.role);
    setIsModalOpen(true);
  };

  // Open New User Modal
  const handleOpenNewUser = () => {
    setEditingUserId(null);
    setUserName('');
    setUserEmail('');
    setUserWhatsappNumber('');
    setUserPassword('');
    setUserRole('USER');
    setIsModalOpen(true);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail) {
      toast.error('Please enter name and email');
      return;
    }

    if (!editingUserId && !userPassword) {
      toast.error('Password is required for new users');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: userName,
        email: userEmail,
        whatsappNumber: userWhatsappNumber || undefined,
        role: userRole,
      };

      if (userPassword) {
        payload.password = userPassword;
      }

      if (editingUserId) {
        await api.patch(`/users/${editingUserId}`, payload);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', payload);
        toast.success('User created successfully');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This will also wipe all their active reservations.')) return;

    try {
      await api.delete(`/users/${id}`);
      toast.success('User successfully deleted');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Deletion failed');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'ADMIN_IT') return 'danger';
    if (role === 'ROOM_ADMIN') return 'info';
    return 'success';
  };

  const columns = [
    {
      header: 'Employee Name',
      accessor: 'name' as const,
      cell: (u: User) => (
        <span className="font-bold text-slate-900 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-indigo-400">
            {u.name.charAt(0)}
          </div>
          {u.name}
        </span>
      ),
    },
    {
      header: 'Email Address',
      accessor: 'email' as const,
      cell: (u: User) => <span className="font-medium text-slate-600">{u.email}</span>,
    },
    {
      header: 'WhatsApp',
      accessor: 'whatsappNumber' as const,
      mobileHidden: true,
      cell: (u: User) => <span className="font-medium text-slate-600">{u.whatsappNumber || '—'}</span>,
    },
    {
      header: 'Access Role',
      accessor: 'role' as const,
      cell: (u: User) => <Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge>,
    },
    {
      header: 'Registered On',
      mobileHidden: true,
      cell: (u: User) => (
        <span className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (u: User) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEditUser(u)}
            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteUser(u.id)}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout title="User Management Console" description="Create user accounts, promotion assignments, password resets, and role rules." allowedRoles={['ADMIN_IT']}>
      {/* Active Users Table */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4 flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Registered Accounts</span>
            </CardTitle>
            <CardDescription>Organization employees and administrators registered in RoomFlow</CardDescription>
          </div>
          <Button size="sm" variant="primary" onClick={handleOpenNewUser}>
            <Plus className="w-3.5 h-3.5" />
            <span>Create User</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={users}
            emptyMessage="No users registered."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* User Administration Dialog Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUserId ? 'Modify User Profile' : 'Register New User'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            leftIcon={<Shield className="w-4 h-4" />}
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="john@company.com"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="WhatsApp Number (Optional)"
            type="tel"
            placeholder="+628****6789"
            value={userWhatsappNumber}
            onChange={(e) => setUserWhatsappNumber(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
          />

          <Input
            label={editingUserId ? 'Reset Password (Leave blank to keep current)' : 'Password'}
            type="password"
            placeholder="••••••••"
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            leftIcon={<Key className="w-4 h-4" />}
            required={!editingUserId}
          />

          <Select
            label="Access Clearance / Role"
            options={[
              { value: 'USER', label: 'USER (Standard Employee)' },
              { value: 'RENTER', label: 'RENTER (Room Renter)' },
              { value: 'ROOM_ADMIN', label: 'ROOM_ADMIN (Operations Manager)' },
              { value: 'ADMIN_IT', label: 'ADMIN_IT (System Controller)' },
            ]}
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as Role)}
            required
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/40">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingUserId ? 'Save Profile' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
