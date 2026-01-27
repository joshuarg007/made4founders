import { useState, useEffect } from 'react'
import {
  FolderPlus,
  FilePlus,
  Link2,
  Eye,
  Download,
  Trash2,
  Copy,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Lock,
  Users,
  ExternalLink,
  X,
  Share2
} from 'lucide-react'
import {
  getDataRoomTree,
  createDataRoomFolder,
  deleteDataRoomFolder,
  addDocumentToDataRoom,
  removeDocumentFromDataRoom,
  getShareableLinks,
  createShareableLink,
  revokeShareableLink,
  getDataRoomStats,
  getDataRoomAccessLogs,
  getDocuments,
} from '../lib/api'
import type {
  DataRoomFolder,
  DataRoomDocument,
  ShareableLink,
  DataRoomStats,
  DataRoomAccess
} from '../lib/api'

interface FolderTreeNode extends DataRoomFolder {
  children: FolderTreeNode[]
  documents: DataRoomDocument[]
}

export default function DataRoom() {
  const [activeTab, setActiveTab] = useState<'folders' | 'links' | 'analytics'>('folders')
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<FolderTreeNode | null>(null)
  const [links, setLinks] = useState<ShareableLink[]>([])
  const [stats, setStats] = useState<DataRoomStats | null>(null)
  const [accessLogs, setAccessLogs] = useState<DataRoomAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showAddDocument, setShowAddDocument] = useState(false)
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [_editingFolder, _setEditingFolder] = useState<DataRoomFolder | null>(null)

  // Form state
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  const [newFolderParent, setNewFolderParent] = useState<number | null>(null)

  // Available documents for adding
  const [availableDocuments, setAvailableDocuments] = useState<{ id: number; name: string; category: string }[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set())

  // Link creation
  const [linkName, setLinkName] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [linkExpiry, setLinkExpiry] = useState('')
  const [linkAccessLimit, setLinkAccessLimit] = useState('')
  const [linkForFolder, setLinkForFolder] = useState<number | null>(null)
  const [linkForDocument, setLinkForDocument] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [treeData, linksData, statsData, logsData] = await Promise.all([
        getDataRoomTree(),
        getShareableLinks(),
        getDataRoomStats(),
        getDataRoomAccessLogs()
      ])
      setFolderTree(treeData as FolderTreeNode[])
      setLinks(linksData)
      setStats(statsData)
      setAccessLogs(logsData)
    } catch (err) {
      setError('Failed to load data room')
    } finally {
      setLoading(false)
    }
  }

  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createDataRoomFolder({
        name: newFolderName.trim(),
        description: newFolderDescription.trim() || undefined,
        parent_id: newFolderParent || undefined
      })
      setShowNewFolder(false)
      setNewFolderName('')
      setNewFolderDescription('')
      setNewFolderParent(null)
      loadData()
    } catch (err) {
      setError('Failed to create folder')
    }
  }

  const handleDeleteFolder = async (folderId: number) => {
    if (!confirm('Delete this folder and all its contents?')) return
    try {
      await deleteDataRoomFolder(folderId)
      setSelectedFolder(null)
      loadData()
    } catch (err) {
      setError('Failed to delete folder')
    }
  }

  const handleAddDocuments = async () => {
    if (!selectedFolder || selectedDocIds.size === 0) return
    try {
      for (const docId of selectedDocIds) {
        await addDocumentToDataRoom({
          document_id: docId,
          folder_id: selectedFolder.id
        })
      }
      setShowAddDocument(false)
      setSelectedDocIds(new Set())
      loadData()
    } catch (err) {
      setError('Failed to add documents')
    }
  }

  const handleRemoveDocument = async (docId: number) => {
    if (!confirm('Remove this document from the data room?')) return
    try {
      await removeDocumentFromDataRoom(docId)
      loadData()
    } catch (err) {
      setError('Failed to remove document')
    }
  }

  const handleCreateLink = async () => {
    try {
      const linkData: Parameters<typeof createShareableLink>[0] = {
        name: linkName.trim() || undefined,
        folder_id: linkForFolder || undefined,
        document_id: linkForDocument || undefined,
        password: linkPassword.trim() || undefined,
        expires_at: linkExpiry ? new Date(linkExpiry).toISOString() : undefined,
        access_limit: linkAccessLimit ? parseInt(linkAccessLimit) : undefined
      }
      await createShareableLink(linkData)
      setShowCreateLink(false)
      setLinkName('')
      setLinkPassword('')
      setLinkExpiry('')
      setLinkAccessLimit('')
      setLinkForFolder(null)
      setLinkForDocument(null)
      loadData()
    } catch (err) {
      setError('Failed to create link')
    }
  }

  const handleRevokeLink = async (linkId: number) => {
    if (!confirm('Revoke this shareable link?')) return
    try {
      await revokeShareableLink(linkId)
      loadData()
    } catch (err) {
      setError('Failed to revoke link')
    }
  }

  const copyLinkToClipboard = (token: string) => {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
  }

  const openAddDocumentModal = async () => {
    try {
      const docs = await getDocuments()
      // Filter out documents already in data room
      const existingDocIds = new Set<number>()
      const collectDocIds = (nodes: FolderTreeNode[]) => {
        nodes.forEach(node => {
          node.documents.forEach(doc => existingDocIds.add(doc.document_id))
          collectDocIds(node.children)
        })
      }
      collectDocIds(folderTree)

      setAvailableDocuments(
        docs.filter((d: { id: number }) => !existingDocIds.has(d.id))
          .map((d: { id: number; name: string; category?: string }) => ({ id: d.id, name: d.name, category: d.category || 'Other' }))
      )
      setShowAddDocument(true)
    } catch (err) {
      setError('Failed to load documents')
    }
  }

  const renderFolderTree = (nodes: FolderTreeNode[], level: number = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedFolders.has(node.id)
      const isSelected = selectedFolder?.id === node.id
      const hasChildren = node.children.length > 0 || node.documents.length > 0

      return (
        <div key={node.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
              isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-[#1a1d24]/5 text-gray-300'
            }`}
            style={{ paddingLeft: `${12 + level * 20}px` }}
            onClick={() => {
              setSelectedFolder(node)
              if (hasChildren) toggleFolder(node.id)
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-5 h-5 text-cyan-400" />
            ) : (
              <Folder className="w-5 h-5 text-cyan-400" />
            )}
            <span className="flex-1 truncate">{node.name}</span>
            <span className="text-xs text-gray-500">
              {node.documents.length} docs
            </span>
          </div>

          {isExpanded && (
            <>
              {renderFolderTree(node.children, level + 1)}
              {node.documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:bg-[#1a1d24]/5 rounded-lg"
                  style={{ paddingLeft: `${32 + level * 20}px` }}
                >
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="flex-1 truncate text-sm">
                    {doc.display_name || doc.document_name}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {doc.view_count}
                    <Download className="w-3 h-3 ml-2" /> {doc.download_count}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Room</h1>
          <p className="text-gray-400 mt-1">Secure document sharing for fundraising</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white hover:bg-[#1a1d24]/10 transition"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
          <button
            onClick={() => {
              if (selectedFolder) {
                setLinkForFolder(selectedFolder.id)
              }
              setShowCreateLink(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
          >
            <Link2 className="w-4 h-4" />
            Share Link
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Folder className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_folders}</p>
                <p className="text-xs text-gray-400">Folders</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_documents}</p>
                <p className="text-xs text-gray-400">Documents</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_views}</p>
                <p className="text-xs text-gray-400">Views</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Download className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_downloads}</p>
                <p className="text-xs text-gray-400">Downloads</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.active_links}</p>
                <p className="text-xs text-gray-400">Active Links</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(['folders', 'links', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-cyan-400 border-cyan-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab === 'folders' && 'Folders & Documents'}
            {tab === 'links' && 'Shareable Links'}
            {tab === 'analytics' && 'Access Analytics'}
          </button>
        ))}
      </div>

      {/* Folders Tab */}
      {activeTab === 'folders' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Folder Tree */}
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Folder Structure</h3>
            {folderTree.length === 0 ? (
              <div className="text-center py-8">
                <Folder className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-400">No folders yet</p>
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="text-cyan-400 text-sm mt-2 hover:underline"
                >
                  Create your first folder
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {renderFolderTree(folderTree)}
              </div>
            )}
          </div>

          {/* Selected Folder Details */}
          <div className="col-span-2 bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            {selectedFolder ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-white">{selectedFolder.name}</h3>
                    {selectedFolder.description && (
                      <p className="text-sm text-gray-400 mt-1">{selectedFolder.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={openAddDocumentModal}
                      className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition"
                    >
                      <FilePlus className="w-4 h-4" />
                      Add Documents
                    </button>
                    <button
                      onClick={() => {
                        setLinkForFolder(selectedFolder.id)
                        setShowCreateLink(true)
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1d24]/5 border border-white/10 text-white text-sm rounded-lg hover:bg-[#1a1d24]/10 transition"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(selectedFolder.id)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Documents in folder */}
                <div className="space-y-2">
                  {selectedFolder.documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No documents in this folder</p>
                    </div>
                  ) : (
                    selectedFolder.documents.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 p-4 bg-[#1a1d24]/5 rounded-lg"
                      >
                        <FileText className="w-8 h-8 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {doc.display_name || doc.document_name}
                          </p>
                          <p className="text-xs text-gray-500">{doc.document_category || 'Document'}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {doc.view_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" /> {doc.download_count}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setLinkForDocument(doc.id)
                              setShowCreateLink(true)
                            }}
                            className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-[#1a1d24]/5 rounded-lg transition"
                            title="Create share link"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#1a1d24]/5 rounded-lg transition"
                            title="Remove from data room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a folder to view its contents</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Links Tab */}
      {activeTab === 'links' && (
        <div className="bg-[#1a1d24] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Accesses</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Security</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Expires</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Created</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {links.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No shareable links yet
                  </td>
                </tr>
              ) : (
                links.map(link => (
                  <tr key={link.id} className="hover:bg-[#1a1d24]/5">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-medium">{link.name || 'Unnamed Link'}</p>
                        <p className="text-xs text-gray-500">
                          {link.folder_name || link.document_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        link.folder_id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {link.folder_id ? <Folder className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {link.folder_id ? 'Folder' : 'Document'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {link.current_accesses}
                      {link.access_limit && ` / ${link.access_limit}`}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {link.has_password && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                            <Lock className="w-3 h-3" /> Password
                          </span>
                        )}
                        {link.shareholder_name && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                            <Users className="w-3 h-3" /> {link.shareholder_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {link.expires_at ? formatDate(link.expires_at) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(link.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copyLinkToClipboard(link.token)}
                          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-[#1a1d24]/5 rounded-lg transition"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/share/${link.token}`, '_blank')}
                          className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1d24]/5 rounded-lg transition"
                          title="Open link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRevokeLink(link.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#1a1d24]/5 rounded-lg transition"
                          title="Revoke link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Recent Access Activity</h3>
            <div className="space-y-2">
              {accessLogs.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No access activity yet</p>
              ) : (
                accessLogs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-center gap-4 p-3 bg-[#1a1d24]/5 rounded-lg"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      log.access_type === 'download' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                    }`}>
                      {log.access_type === 'download' ? (
                        <Download className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white">
                        {log.user_email || log.shareholder_name || 'External User'}
                        <span className="text-gray-400">
                          {' '}{log.access_type === 'download' ? 'downloaded' : 'viewed'}{' '}
                        </span>
                        <span className="text-cyan-400">
                          {log.document_name || log.folder_name}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(log.created_at)} {log.ip_address && `from ${log.ip_address}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Create New Folder</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Series A Documents"
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
                <textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Brief description of folder contents"
                  rows={2}
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Parent Folder (Optional)</label>
                <select
                  value={newFolderParent || ''}
                  onChange={(e) => setNewFolderParent(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Root Level</option>
                  {folderTree.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewFolder(false)
                  setNewFolderName('')
                  setNewFolderDescription('')
                  setNewFolderParent(null)
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {showAddDocument && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-white mb-4">Add Documents to Data Room</h2>
            <div className="space-y-4">
              {availableDocuments.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  All documents are already in the data room
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {availableDocuments.map(doc => (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                        selectedDocIds.has(doc.id) ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-[#1a1d24]/5 hover:bg-[#1a1d24]/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocIds.has(doc.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedDocIds)
                          if (e.target.checked) {
                            newSet.add(doc.id)
                          } else {
                            newSet.delete(doc.id)
                          }
                          setSelectedDocIds(newSet)
                        }}
                        className="w-4 h-4 rounded border-white/20 bg-[#1a1d24]/5 text-cyan-500 focus:ring-cyan-500"
                      />
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-white">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.category}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddDocument(false)
                  setSelectedDocIds(new Set())
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDocuments}
                disabled={selectedDocIds.size === 0}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Add {selectedDocIds.size} Document{selectedDocIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Link Modal */}
      {showCreateLink && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Create Shareable Link</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Link Name (Optional)</label>
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="e.g., For Sequoia"
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {!linkForFolder && !linkForDocument && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Share</label>
                  <select
                    value={linkForFolder ? `folder-${linkForFolder}` : linkForDocument ? `doc-${linkForDocument}` : ''}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val.startsWith('folder-')) {
                        setLinkForFolder(parseInt(val.replace('folder-', '')))
                        setLinkForDocument(null)
                      } else if (val.startsWith('doc-')) {
                        setLinkForDocument(parseInt(val.replace('doc-', '')))
                        setLinkForFolder(null)
                      }
                    }}
                    className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select folder or document...</option>
                    <optgroup label="Folders">
                      {folderTree.map(folder => (
                        <option key={`folder-${folder.id}`} value={`folder-${folder.id}`}>
                          {folder.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {(linkForFolder || linkForDocument) && (
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <p className="text-sm text-cyan-400">
                    Sharing: {linkForFolder ?
                      folderTree.find(f => f.id === linkForFolder)?.name :
                      'Selected Document'
                    }
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Password Protection (Optional)</label>
                <input
                  type="password"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  placeholder="Leave empty for no password"
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Expires (Optional)</label>
                  <input
                    type="datetime-local"
                    value={linkExpiry}
                    onChange={(e) => setLinkExpiry(e.target.value)}
                    className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Access Limit (Optional)</label>
                  <input
                    type="number"
                    value={linkAccessLimit}
                    onChange={(e) => setLinkAccessLimit(e.target.value)}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateLink(false)
                  setLinkName('')
                  setLinkPassword('')
                  setLinkExpiry('')
                  setLinkAccessLimit('')
                  setLinkForFolder(null)
                  setLinkForDocument(null)
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLink}
                disabled={!linkForFolder && !linkForDocument}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
