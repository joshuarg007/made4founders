import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Users as UsersIcon,
  Shield,
  Edit3,
  Eye,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser, type UserResponse, type UserCreate, type UserUpdate } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const roles = [
  { value: 'admin', label: 'Admin', icon: Shield, description: 'Full access to all features and user management' },
  { value: 'editor', label: 'Editor', icon: Edit3, description: 'Can view and edit all data' },
  { value: 'viewer', label: 'Viewer', icon: Eye, description: 'Read-only access to data' },
];

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    name: string;
    role: string;
    is_active: boolean;
  }>({
    email: '',
    password: '',
    name: '',
    role: 'viewer',
    is_active: true
  });

  const loadUsers = async () => {
    try {
      setError(null);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users. You may not have admin access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const updateData: UserUpdate = {
          email: formData.email,
          name: formData.name || null,
          role: formData.role,
          is_active: formData.is_active
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await updateUser(editingUser.id, updateData);
      } else {
        const createData: UserCreate = {
          email: formData.email,
          password: formData.password,
          name: formData.name || undefined,
          role: formData.role,
          is_active: formData.is_active
        };
        await createUser(createData);
      }
      setShowModal(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', name: '', role: 'viewer', is_active: true });
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save user');
    }
  };

  const handleEdit = (user: UserResponse) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name || '',
      role: user.role,
      is_active: user.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this user? This action cannot be undone.')) {
      try {
        await deleteUser(id);
        loadUsers();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete user');
      }
    }
  };

  const handleToggleActive = async (user: UserResponse) => {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const getRoleInfo = (role: string) => {
    return roles.find(r => r.value === role) || roles[2];
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Admin Access Required</h2>
          <p className="text-gray-400">You need admin privileges to access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 mt-1">Manage users and their permissions</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ email: '', password: '', name: '', role: 'viewer', is_active: true });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-[#1a1d24] border border-white/10">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <div key={role.value} className="flex items-center gap-2">
              <div className={`p-1.5 rounded ${
                role.value === 'admin' ? 'bg-amber-500/20 text-amber-400' :
                role.value === 'editor' ? 'bg-cyan-500/20 text-cyan-400' :
                'bg-white/50/20 text-gray-400'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium text-white">{role.label}</span>
                <span className="text-xs text-gray-500 ml-2">{role.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : error ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const roleInfo = getRoleInfo(user.role);
            const RoleIcon = roleInfo.icon;
            const isCurrentUser = user.email === currentUser?.email;

            return (
              <div
                key={user.id}
                className={`p-4 rounded-xl bg-[#1a1d24] border transition ${
                  user.is_active ? 'border-white/10 hover:border-white/20' : 'border-white/5 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white font-semibold">
                      {(user.name?.[0] || user.email[0]).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {user.name || user.email}
                        </h3>
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Role Badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                      user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' :
                      user.role === 'editor' ? 'bg-cyan-500/20 text-cyan-400' :
                      'bg-white/50/20 text-gray-400'
                    }`}>
                      <RoleIcon className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium capitalize">{user.role}</span>
                    </div>

                    {/* Status Toggle */}
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={isCurrentUser}
                      className={`p-1.5 rounded ${
                        user.is_active ? 'text-green-400' : 'text-gray-400 hover:text-gray-400'
                      } ${isCurrentUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={user.is_active ? 'Active' : 'Inactive'}
                    >
                      {user.is_active ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </button>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1d24]/10 transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isCurrentUser}
                        className={`p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-[#1a1d24]/10 transition ${
                          isCurrentUser ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Created date */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <span className="text-xs text-gray-500">
                    Created {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Password {editingUser ? '(leave empty to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <div className="space-y-2">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <label
                        key={role.value}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                          formData.role === role.value
                            ? 'border-cyan-500/50 bg-cyan-500/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={formData.role === role.value}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="sr-only"
                        />
                        <div className={`p-1.5 rounded ${
                          role.value === 'admin' ? 'bg-amber-500/20 text-amber-400' :
                          role.value === 'editor' ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-white/50/20 text-gray-400'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-white">{role.label}</div>
                          <div className="text-xs text-gray-500">{role.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded bg-[#1a1d24]/5 border-white/10"
                  />
                  Active (can log in)
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
                >
                  {editingUser ? 'Save' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
