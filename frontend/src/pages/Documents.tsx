import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Plus,
  FileText,
  Download,
  Pencil,
  Trash2,
  X,
  Search,
  CloudUpload,
  Loader2
} from 'lucide-react';
import { getDocuments, createDocument, updateDocument, deleteDocument, type Document } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { format, isBefore, addDays } from 'date-fns';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api`;

const categories = [
  { value: 'all', label: 'All', icon: '📋' },
  { value: 'formation', label: 'Formation', icon: '📜' },
  { value: 'contracts', label: 'Contracts', icon: '📝' },
  { value: 'tax', label: 'Tax', icon: '📊' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'licenses', label: 'Licenses', icon: '📄' },
  { value: 'agreements', label: 'Agreements', icon: '🤝' },
  { value: 'financial', label: 'Financial', icon: '💰' },
  { value: 'other', label: 'Other', icon: '📎' },
];

export default function Documents() {
  const { canEdit } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    external_url: '',
    description: '',
    expiration_date: '',
    tags: ''
  });
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const [modalFile, setModalFile] = useState<File | null>(null);

  const loadDocuments = async () => {
    const data = await getDocuments(selectedCategory === 'all' ? undefined : selectedCategory);
    setDocuments(data);
    setLoading(false);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (res.ok) {
        loadDocuments();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      files.forEach(file => uploadFile(file));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      files.forEach(file => uploadFile(file));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedCategory]);

  const filteredDocuments = documents.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.tags?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      if (modalFile && !editingDocument) {
        // Upload file first, then update with additional metadata
        const uploadFormData = new FormData();
        uploadFormData.append('file', modalFile);
        const uploadRes = await fetch(`${API_BASE}/documents/upload`, {
          method: 'POST',
          credentials: 'include',
          body: uploadFormData
        });

        if (uploadRes.ok) {
          const uploadedDoc = await uploadRes.json();
          // Update with additional metadata
          await updateDocument(uploadedDoc.id, {
            name: formData.name || modalFile.name,
            category: formData.category,
            description: formData.description || null,
            expiration_date: formData.expiration_date ? new Date(formData.expiration_date).toISOString() : null,
            tags: formData.tags || null
          });
        }
      } else {
        const payload = {
          ...formData,
          expiration_date: formData.expiration_date ? new Date(formData.expiration_date).toISOString() : null
        };

        if (editingDocument) {
          await updateDocument(editingDocument.id, payload);
        } else {
          await createDocument(payload);
        }
      }
    } finally {
      setUploading(false);
    }

    setShowModal(false);
    setEditingDocument(null);
    setModalFile(null);
    setFormData({ name: '', category: 'other', external_url: '', description: '', expiration_date: '', tags: '' });
    loadDocuments();
  };

  const handleEdit = (doc: Document) => {
    setEditingDocument(doc);
    setFormData({
      name: doc.name,
      category: doc.category,
      external_url: doc.external_url || '',
      description: doc.description || '',
      expiration_date: doc.expiration_date ? doc.expiration_date.split('T')[0] : '',
      tags: doc.tags || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this document?')) {
      await deleteDocument(id);
      loadDocuments();
    }
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    return isBefore(new Date(date), addDays(new Date(), 30));
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return isBefore(new Date(date), new Date());
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Documents</h1>
          <p className="text-gray-400 mt-1">Store and organize your business documents</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditingDocument(null); setModalFile(null); setFormData({ name: '', category: 'other', external_url: '', description: '', expiration_date: '', tags: '' }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Add Document
          </button>
        )}
      </div>

      {/* Upload Zone - only show for users who can edit */}
      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-cyan-500 bg-cyan-500/10'
              : 'border-white/20 hover:border-white/40 hover:bg-white/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              <p className="text-gray-400">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <CloudUpload className={`w-10 h-10 ${isDragging ? 'text-cyan-400' : 'text-gray-500'}`} />
              <div>
                <p className="text-white font-medium">
                  {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  PDF, DOC, XLS, images, and more
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                selectedCategory === cat.value
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No documents found</p>
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-cyan-400 hover:text-cyan-300"
            >
              Add your first document
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="w-8 h-8 text-violet-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white truncate" title={doc.name}>{doc.name}</h3>
                    {canEdit ? (
                      <select
                        value={doc.category}
                        onChange={async (e) => {
                          await updateDocument(doc.id, { category: e.target.value });
                          loadDocuments();
                        }}
                        className="text-xs text-gray-400 bg-transparent border-none p-0 cursor-pointer hover:text-white focus:outline-none capitalize"
                      >
                        {categories.slice(1).map((cat) => (
                          <option key={cat.value} value={cat.value} className="bg-[#1a1d24]">{cat.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-500 capitalize">{doc.category}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {isExpired(doc.expiration_date) && (
                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">Expired</span>
                  )}
                  {!isExpired(doc.expiration_date) && isExpiringSoon(doc.expiration_date) && (
                    <span className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400">Expiring</span>
                  )}
                </div>
              </div>

              {doc.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2 overflow-hidden">{doc.description}</p>
              )}

              {doc.expiration_date && (
                <p className={`text-xs mb-3 ${isExpired(doc.expiration_date) ? 'text-red-400' : isExpiringSoon(doc.expiration_date) ? 'text-amber-400' : 'text-gray-500'}`}>
                  Expires: {format(new Date(doc.expiration_date), 'MMM d, yyyy')}
                </p>
              )}

              {doc.tags && (
                <div className="flex flex-wrap gap-1 mb-3 overflow-hidden">
                  {doc.tags.split(',').slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400 truncate max-w-[100px]">
                      {tag.trim()}
                    </span>
                  ))}
                  {doc.tags.split(',').length > 3 && (
                    <span className="text-xs text-gray-500">+{doc.tags.split(',').length - 3}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(doc)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/10 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {!canEdit && <div />}
                {doc.file_path && (
                  <button
                    onClick={async () => {
                      try {
                        // Secure download with auth credentials
                        const response = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
                          credentials: 'include'
                        });
                        if (!response.ok) throw new Error('Download failed');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = doc.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('Download failed:', error);
                        alert('Download failed. Please try again.');
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingDocument ? 'Edit Document' : 'Add Document'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {categories.slice(1).map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* File Upload Section - only show when adding new document */}
              {!editingDocument && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Upload File</label>
                  <div
                    onClick={() => modalFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                      modalFile
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                    }`}
                  >
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setModalFile(file);
                          if (!formData.name) {
                            setFormData(prev => ({ ...prev, name: file.name }));
                          }
                        }
                      }}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                    />
                    {modalFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <span className="text-white text-sm">{modalFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalFile(null);
                          }}
                          className="ml-2 text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <CloudUpload className="w-6 h-6 text-gray-500" />
                        <span className="text-sm text-gray-400">Click to choose a file</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* External URL - show as alternative when no file uploaded */}
              {!modalFile && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {editingDocument ? 'External URL' : 'Or paste an external URL'}
                  </label>
                  <input
                    type="url"
                    value={formData.external_url}
                    onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., important, 2024, renewal"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {modalFile ? 'Uploading...' : 'Saving...'}
                    </>
                  ) : (
                    editingDocument ? 'Save' : (modalFile ? 'Upload & Add' : 'Add Document')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
