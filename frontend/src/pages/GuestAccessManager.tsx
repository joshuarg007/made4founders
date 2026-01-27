/**
 * GuestAccessManager - Admin panel for managing guest users
 *
 * Allows inviting investors, advisors, lawyers etc. with limited
 * access to data room and investor updates via magic links.
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  UserPlus,
  Users,
  Clock,
  Shield,
  Trash2,
  RefreshCw,
  Send,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import {
  getGuestUsers,
  inviteGuestUser,
  updateGuestUser,
  deleteGuestUser,
  resendGuestInvite,
  type GuestUser,
} from '../lib/api';

const GUEST_TYPES = [
  { value: 'investor', label: 'Investor', icon: '💰', description: 'View data room, investor updates' },
  { value: 'advisor', label: 'Advisor', icon: '💡', description: 'View data room, investor updates' },
  { value: 'lawyer', label: 'Lawyer', icon: '⚖️', description: 'View data room, legal documents' },
  { value: 'board_member', label: 'Board Member', icon: '👔', description: 'Full guest access' },
];

const PERMISSION_OPTIONS = [
  { key: 'data_room', label: 'Data Room', description: 'View documents in data room' },
  { key: 'investor_updates', label: 'Investor Updates', description: 'View investor update reports' },
];

export default function GuestAccessManager() {
  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestUser | null>(null);
  const [sendingInvite, setSendingInvite] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    guest_type: 'investor',
    permissions: {
      data_room: true,
      investor_updates: true,
    },
  });

  useEffect(() => {
    loadGuests();
  }, []);

  const loadGuests = async () => {
    try {
      setLoading(true);
      const data = await getGuestUsers();
      setGuests(data);
    } catch {
      // Error handled by global handler
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convert permissions object to the format expected by API
      const permissionsPayload: Record<string, string[]> = {};
      if (formData.permissions.data_room) {
        permissionsPayload.data_room = ['view'];
      }
      if (formData.permissions.investor_updates) {
        permissionsPayload.investor_updates = ['view'];
      }

      await inviteGuestUser({
        email: formData.email,
        name: formData.name,
        guest_type: formData.guest_type,
        permissions: permissionsPayload,
      });
      setShowInviteModal(false);
      resetForm();
      loadGuests();
    } catch {
      // Error handled by global handler
    }
  };

  const handleUpdateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest) return;

    try {
      // Convert permissions object to the format expected by API
      const permissionsPayload: Record<string, string[]> = {};
      if (formData.permissions.data_room) {
        permissionsPayload.data_room = ['view'];
      }
      if (formData.permissions.investor_updates) {
        permissionsPayload.investor_updates = ['view'];
      }

      await updateGuestUser(editingGuest.id, {
        name: formData.name,
        guest_type: formData.guest_type,
        permissions: permissionsPayload,
        is_active: editingGuest.is_active,
      });
      setEditingGuest(null);
      resetForm();
      loadGuests();
    } catch {
      // Error handled by global handler
    }
  };

  const handleResendInvite = async (guestId: number) => {
    try {
      setSendingInvite(guestId);
      await resendGuestInvite(guestId);
      // Show success - the API will return a message
    } catch {
      // Error handled by global handler
    } finally {
      setSendingInvite(null);
    }
  };

  const handleToggleActive = async (guest: GuestUser) => {
    try {
      await updateGuestUser(guest.id, { is_active: !guest.is_active });
      loadGuests();
    } catch {
      // Error handled by global handler
    }
  };

  const handleDelete = async (guestId: number) => {
    if (!window.confirm('Are you sure you want to revoke access for this guest? They will no longer be able to access your data.')) {
      return;
    }
    try {
      await deleteGuestUser(guestId);
      loadGuests();
    } catch {
      // Error handled by global handler
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      guest_type: 'investor',
      permissions: {
        data_room: true,
        investor_updates: true,
      },
    });
  };

  const openEditModal = (guest: GuestUser) => {
    setEditingGuest(guest);
    setFormData({
      email: guest.email,
      name: guest.name || '',
      guest_type: guest.guest_type,
      permissions: {
        data_room: guest.permissions?.data_room !== undefined,
        investor_updates: guest.permissions?.investor_updates !== undefined,
      },
    });
  };

  const getGuestTypeInfo = (type: string) => {
    return GUEST_TYPES.find((t) => t.value === type) || GUEST_TYPES[0];
  };

  const getStatusBadge = (guest: GuestUser) => {
    if (!guest.is_active) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
          <XCircle className="w-3 h-3" />
          Revoked
        </span>
      );
    }
    if (guest.token_expires_at && new Date(guest.token_expires_at) < new Date()) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
          <AlertTriangle className="w-3 h-3" />
          Expired
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    );
  };

  const activeGuests = guests.filter((g) => g.is_active);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Guest Access</h1>
          <p className="text-gray-400">
            Invite investors, advisors, and other stakeholders to securely access your data room
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowInviteModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:opacity-90 transition"
        >
          <UserPlus className="w-4 h-4" />
          Invite Guest
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1a1d24] rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{guests.length}</p>
              <p className="text-xs text-gray-500">Total Guests</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1d24] rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeGuests.length}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1d24] rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {guests.filter((g) => g.last_accessed_at).length}
              </p>
              <p className="text-xs text-gray-500">Have Accessed</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1d24] rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {guests.filter((g) => g.guest_type === 'investor').length}
              </p>
              <p className="text-xs text-gray-500">Investors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Guest List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-[#1a1d24]/5 rounded-xl p-4 h-24" />
          ))}
        </div>
      ) : guests.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1d24] rounded-xl border border-white/10">
          <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No guests yet</h3>
          <p className="text-gray-400 mb-4">
            Invite investors, advisors, or other stakeholders to securely access your data room.
          </p>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-[#1a1d24]/10 text-white rounded-lg hover:bg-[#1a1d24]/20 transition"
          >
            Invite your first guest
          </button>
        </div>
      ) : (
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#1a1d24]/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Last Access
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {guests.map((guest) => {
                const typeInfo = getGuestTypeInfo(guest.guest_type);
                return (
                  <tr key={guest.id} className="hover:bg-[#1a1d24]/5">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white font-medium">
                          {(guest.name || guest.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {guest.name || 'No name'}
                          </p>
                          <p className="text-xs text-gray-500">{guest.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
                        <span>{typeInfo.icon}</span>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {guest.permissions?.data_room && (
                          <span className="px-2 py-0.5 rounded text-xs bg-[#1a1d24]/10 text-gray-400">
                            Data Room
                          </span>
                        )}
                        {guest.permissions?.investor_updates && (
                          <span className="px-2 py-0.5 rounded text-xs bg-[#1a1d24]/10 text-gray-400">
                            Updates
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(guest)}</td>
                    <td className="px-4 py-4 text-sm text-gray-400">
                      {guest.last_accessed_at
                        ? formatDistanceToNow(new Date(guest.last_accessed_at), { addSuffix: true })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(guest)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1d24]/10 rounded-lg transition"
                          title="Edit permissions"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleResendInvite(guest.id)}
                          disabled={sendingInvite === guest.id}
                          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-[#1a1d24]/10 rounded-lg transition disabled:opacity-50"
                          title="Resend invite"
                        >
                          {sendingInvite === guest.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleActive(guest)}
                          className={`p-2 hover:bg-[#1a1d24]/10 rounded-lg transition ${
                            guest.is_active
                              ? 'text-gray-400 hover:text-yellow-400'
                              : 'text-yellow-400 hover:text-green-400'
                          }`}
                          title={guest.is_active ? 'Suspend access' : 'Restore access'}
                        >
                          {guest.is_active ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(guest.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#1a1d24]/10 rounded-lg transition"
                          title="Delete guest"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Invite Guest</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="investor@example.com"
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Guest Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GUEST_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, guest_type: type.value })}
                      className={`p-3 rounded-lg border text-left transition ${
                        formData.guest_type === type.value
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{type.icon}</span>
                        <span className="text-sm font-medium text-white">{type.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1d24]/5 cursor-pointer hover:bg-[#1a1d24]/10 transition"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 rounded border-white/20 bg-[#1a1d24]/5 text-cyan-500 focus:ring-cyan-500/20"
                      />
                      <div>
                        <p className="text-sm text-white">{perm.label}</p>
                        <p className="text-xs text-gray-500">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 bg-[#1a1d24]/5 text-gray-300 rounded-lg hover:bg-[#1a1d24]/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:opacity-90 transition"
                >
                  <Send className="w-4 h-4" />
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Edit Guest Access</h2>
              <button
                onClick={() => setEditingGuest(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGuest} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Guest Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GUEST_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, guest_type: type.value })}
                      className={`p-3 rounded-lg border text-left transition ${
                        formData.guest_type === type.value
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{type.icon}</span>
                        <span className="text-sm font-medium text-white">{type.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1d24]/5 cursor-pointer hover:bg-[#1a1d24]/10 transition"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions[perm.key as keyof typeof formData.permissions]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 rounded border-white/20 bg-[#1a1d24]/5 text-cyan-500 focus:ring-cyan-500/20"
                      />
                      <div>
                        <p className="text-sm text-white">{perm.label}</p>
                        <p className="text-xs text-gray-500">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Access Info */}
              <div className="p-3 bg-[#1a1d24]/5 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Invited</span>
                  <span className="text-white">
                    {format(new Date(editingGuest.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                {editingGuest.last_accessed_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Last accessed</span>
                    <span className="text-white">
                      {formatDistanceToNow(new Date(editingGuest.last_accessed_at), { addSuffix: true })}
                    </span>
                  </div>
                )}
                {editingGuest.token_expires_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Link expires</span>
                    <span className="text-white">
                      {format(new Date(editingGuest.token_expires_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGuest(null)}
                  className="flex-1 px-4 py-2 bg-[#1a1d24]/5 text-gray-300 rounded-lg hover:bg-[#1a1d24]/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:opacity-90 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
