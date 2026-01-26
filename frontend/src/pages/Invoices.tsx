import { useState, useEffect } from 'react'
import {
  Plus,
  Send,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Download,
  Trash2,
  X,
  CreditCard
} from 'lucide-react'
import {
  getInvoices,
  createInvoice,
  sendInvoice,
  markInvoicePaid,
  deleteInvoice,
  getInvoiceSummary,
  getContacts,
} from '../lib/api'
import type {
  Invoice,
  InvoiceSummary,
} from '../lib/api'

interface LocalContact {
  id: number;
  name: string;
  email: string | null;
  company?: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<InvoiceSummary | null>(null)
  const [contacts, setContacts] = useState<LocalContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all')

  // Modals
  const [showNewInvoice, setShowNewInvoice] = useState(false)
  const [_selectedInvoice, _setSelectedInvoice] = useState<Invoice | null>(null)

  // Form state
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 }
  ])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [invoicesData, summaryData, contactsData] = await Promise.all([
        getInvoices(),
        getInvoiceSummary(),
        getContacts()
      ])
      setInvoices(invoicesData)
      setSummary(summaryData)
      setContacts(contactsData as LocalContact[])
    } catch (err) {
      setError('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    if (activeTab === 'all') return true
    if (activeTab === 'draft') return inv.status === 'draft'
    if (activeTab === 'sent') return inv.status === 'sent' || inv.status === 'viewed'
    if (activeTab === 'paid') return inv.status === 'paid'
    if (activeTab === 'overdue') {
      return inv.status !== 'paid' && inv.status !== 'cancelled' && new Date(inv.due_date) < new Date()
    }
    return true
  })

  const calculateTotal = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const tax = subtotal * (parseFloat(taxRate) / 100)
    return { subtotal, tax, total: subtotal + tax }
  }

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }])
  }

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index))
    }
  }

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems]
    if (field === 'description') {
      updated[index].description = value as string
    } else {
      updated[index][field] = parseFloat(value as string) || 0
    }
    setLineItems(updated)
  }

  const handleCreateInvoice = async () => {
    if (!selectedContactId || !dueDate || lineItems.some(item => !item.description || item.unit_price <= 0)) {
      setError('Please fill in all required fields')
      return
    }

    try {
      await createInvoice({
        contact_id: selectedContactId,
        due_date: dueDate,
        tax_rate: parseFloat(taxRate) || 0,
        notes: notes || undefined,
        line_items: lineItems.filter(item => item.description && item.unit_price > 0)
      })
      setShowNewInvoice(false)
      resetForm()
      loadData()
    } catch (err) {
      setError('Failed to create invoice')
    }
  }

  const resetForm = () => {
    setSelectedContactId(null)
    setDueDate('')
    setTaxRate('0')
    setNotes('')
    setLineItems([{ description: '', quantity: 1, unit_price: 0 }])
  }

  const handleSendInvoice = async (invoiceId: number) => {
    try {
      await sendInvoice(invoiceId)
      loadData()
    } catch (err) {
      setError('Failed to send invoice')
    }
  }

  const handleMarkPaid = async (invoiceId: number) => {
    try {
      await markInvoicePaid(invoiceId)
      loadData()
    } catch (err) {
      setError('Failed to mark invoice as paid')
    }
  }

  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!confirm('Delete this invoice?')) return
    try {
      await deleteInvoice(invoiceId)
      loadData()
    } catch (err) {
      setError('Failed to delete invoice')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-gray-400 bg-gray-500/20'
      case 'sent':
      case 'viewed':
        return 'text-blue-400 bg-blue-500/20'
      case 'paid':
        return 'text-emerald-400 bg-emerald-500/20'
      case 'overdue':
        return 'text-red-400 bg-red-500/20'
      case 'cancelled':
        return 'text-gray-400 bg-gray-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="w-3 h-3" />
      case 'sent':
      case 'viewed':
        return <Send className="w-3 h-3" />
      case 'paid':
        return <CheckCircle className="w-3 h-3" />
      case 'cancelled':
        return <X className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
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
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-gray-400 mt-1">Create and manage invoices</p>
        </div>
        <button
          onClick={() => setShowNewInvoice(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_outstanding)}</p>
                <p className="text-xs text-gray-400">Outstanding</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(summary.total_overdue)}</p>
                <p className="text-xs text-gray-400">Overdue ({summary.overdue_count})</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(summary.total_paid_this_month)}</p>
                <p className="text-xs text-gray-400">Paid This Month</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.invoice_count}</p>
                <p className="text-xs text-gray-400">Total Invoices</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-cyan-400 border-cyan-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="bg-[#1a1d24] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Invoice</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Due</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Amount</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map(invoice => {
                const isOverdue = invoice.status !== 'paid' && invoice.status !== 'cancelled' &&
                  new Date(invoice.due_date) < new Date()

                return (
                  <tr key={invoice.id} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">{invoice.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white">{invoice.contact_name}</p>
                        <p className="text-xs text-gray-500">{invoice.contact_company}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(invoice.issue_date).toLocaleDateString()}
                    </td>
                    <td className={`px-6 py-4 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-white font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          isOverdue ? 'text-red-400 bg-red-500/20' : getStatusColor(invoice.status)
                        }`}>
                          {isOverdue ? <AlertTriangle className="w-3 h-3" /> : getStatusIcon(invoice.status)}
                          {isOverdue ? 'Overdue' : invoice.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {invoice.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleSendInvoice(invoice.id)}
                              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition"
                              title="Send Invoice"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(invoice.status === 'sent' || invoice.status === 'viewed') && (
                          <button
                            onClick={() => handleMarkPaid(invoice.id)}
                            className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition"
                            title="Mark as Paid"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* New Invoice Modal */}
      {showNewInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Create Invoice</h2>

            <div className="space-y-4">
              {/* Client Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Client</label>
                  <select
                    value={selectedContactId || ''}
                    onChange={(e) => setSelectedContactId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select client...</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} {contact.company ? `(${contact.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Line Items</label>
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                        placeholder="Qty"
                        min="1"
                        className="w-20 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="number"
                        value={item.unit_price || ''}
                        onChange={(e) => handleLineItemChange(index, 'unit_price', e.target.value)}
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        className="w-28 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => handleRemoveLineItem(index)}
                        disabled={lineItems.length === 1}
                        className="p-2 text-gray-400 hover:text-red-400 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddLineItem}
                  className="mt-2 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  + Add Line Item
                </button>
              </div>

              {/* Tax and Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Payment terms, etc."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(calculateTotal().subtotal)}</span>
                </div>
                {parseFloat(taxRate) > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatCurrency(calculateTotal().tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal().total)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewInvoice(false)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!selectedContactId || !dueDate || lineItems.every(item => !item.description || item.unit_price <= 0)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
