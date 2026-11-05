'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Types
type ReturnStatus = 'OPEN' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
type ReturnReason = 'DAMAGED' | 'WRONG_ITEM' | 'SIZE_ISSUE' | 'NOT_AS_DESCRIBED' | 'CHANGED_MIND';
type ResolutionType = 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT';

interface ReturnNote {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

interface ReturnItem {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  orderNumber: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  reason: ReturnReason;
  status: ReturnStatus;
  resolution?: ResolutionType | null;
  refundAmount?: number | string | null;
  createdAt: string;
  updatedAt?: string;
  notes?: ReturnNote[];
}

interface Stats {
  totalActive: number;
  OPEN: number;
  IN_REVIEW: number;
  APPROVED: number;
  REJECTED: number;
  COMPLETED: number;
}

const REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: 'Damaged',
  WRONG_ITEM: 'Wrong Item',
  SIZE_ISSUE: 'Size Issue',
  NOT_AS_DESCRIBED: 'Not As Described',
  CHANGED_MIND: 'Changed Mind',
};

export default function AgentPortal() {
  // Data state
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalActive: 0,
    OPEN: 0,
    IN_REVIEW: 0,
    APPROVED: 0,
    REJECTED: 0,
    COMPLETED: 0,
  });

  // Query state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selected item / Drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ReturnItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals state
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);

  // Action / Feedback state
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // New Note state
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('Support Agent');

  // New Request Form state
  const [newRequest, setNewRequest] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    orderNumber: '',
    itemSku: '',
    itemName: '',
    quantity: 1,
    reason: 'DAMAGED' as ReturnReason,
  });

  // Edit Request Form state
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    orderNumber: '',
    itemSku: '',
    itemName: '',
    quantity: 1,
    reason: 'DAMAGED' as ReturnReason,
  });

  // Approval Resolution Form state
  const [approvalForm, setApprovalForm] = useState<{
    resolution: ResolutionType;
    refundAmount: string;
  }>({
    resolution: 'REFUND',
    refundAmount: '',
  });

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch list of requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (reasonFilter !== 'ALL') params.append('reason', reasonFilter);
      params.append('sortBy', sortBy);
      params.append('order', sortOrder);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/returns?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to fetch return requests');
      }
      const data = await res.json();
      setItems(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, reasonFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Fetch single item details + notes
  const fetchItemDetail = async (id: string) => {
    setLoadingDetail(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/returns/${id}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to load details');
      }
      const data: ReturnItem = await res.json();
      setActiveItem(data);
      setSelectedId(id);
      // Pre-fill edit form
      setEditForm({
        customerName: data.customerName || '',
        customerEmail: data.customerEmail || '',
        customerPhone: data.customerPhone || '',
        orderNumber: data.orderNumber || '',
        itemSku: data.itemSku || '',
        itemName: data.itemName || '',
        quantity: data.quantity || 1,
        reason: data.reason || 'DAMAGED',
      });
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Status transition handler
  const handleStatusChange = async (
    newStatus: ReturnStatus,
    resolutionData?: { resolution?: ResolutionType; refundAmount?: number }
  ) => {
    if (!activeItem) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/returns/${activeItem.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolution: resolutionData?.resolution,
          refundAmount: resolutionData?.refundAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `Failed to transition to ${newStatus}`);
      }
      setActionSuccess(`Status successfully updated to ${newStatus}!`);
      setShowApproveModal(false);
      await fetchItemDetail(activeItem.id);
      await fetchRequests();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Approval Modal
  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (approvalForm.resolution === 'REFUND') {
      const amount = parseFloat(approvalForm.refundAmount);
      if (isNaN(amount) || amount <= 0) {
        setActionError('A refund amount greater than 0 is required for REFUND resolution.');
        return;
      }
      handleStatusChange('APPROVED', { resolution: 'REFUND', refundAmount: amount });
    } else {
      handleStatusChange('APPROVED', { resolution: approvalForm.resolution });
    }
  };

  // Add Note handler
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !noteContent.trim()) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/returns/${activeItem.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: noteContent.trim(),
          author: noteAuthor.trim() || 'Support Agent',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to add note');
      }
      setNoteContent('');
      setActionSuccess('Note added successfully.');
      await fetchItemDetail(activeItem.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Edit Request Details handler (only OPEN or IN_REVIEW)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/returns/${activeItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          quantity: Number(editForm.quantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to edit return request');
      }
      setActionSuccess('Request details updated successfully.');
      setShowEditModal(false);
      await fetchItemDetail(activeItem.id);
      await fetchRequests();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Soft delete handler (only OPEN or REJECTED)
  const handleSoftDelete = async () => {
    if (!activeItem) return;
    if (!confirm(`Are you sure you want to remove request ${activeItem.reference} from the active desk?`)) {
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/returns/${activeItem.id}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to remove return request');
      }
      setActionSuccess(`Request ${activeItem.reference} removed from desk.`);
      setActiveItem(null);
      setSelectedId(null);
      await fetchRequests();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Create new return request handler
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: newRequest.customerName.trim(),
          customerEmail: newRequest.customerEmail.trim(),
          customerPhone: newRequest.customerPhone.trim() || undefined,
          orderNumber: newRequest.orderNumber.trim(),
          itemSku: newRequest.itemSku.trim(),
          itemName: newRequest.itemName.trim(),
          quantity: Number(newRequest.quantity),
          reason: newRequest.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to raise return request');
      }
      setActionSuccess(`Return request raised successfully with Reference: ${data.reference}`);
      setShowRaiseModal(false);
      setNewRequest({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        orderNumber: '',
        itemSku: '',
        itemName: '',
        quantity: 1,
        reason: 'DAMAGED',
      });
      await fetchRequests();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: ReturnStatus) => {
    const config: Record<ReturnStatus, { bg: string; text: string; dot: string }> = {
      OPEN: { bg: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500', text: 'Open / Pending' },
      IN_REVIEW: { bg: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-500', text: 'In Review' },
      APPROVED: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', text: 'Approved' },
      REJECTED: { bg: 'bg-rose-50 border-rose-200 text-rose-800', dot: 'bg-rose-500', text: 'Rejected' },
      COMPLETED: { bg: 'bg-purple-50 border-purple-200 text-purple-800', dot: 'bg-purple-500', text: 'Completed' },
    };
    const c = config[status] || config.OPEN;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {c.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">ReturnDesk</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                  Agent Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Returns, replacements & refund desk</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActionError(null);
                setShowRaiseModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Raise Request
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        {/* Alerts / Feedback Banner */}
        {actionSuccess && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {actionSuccess}
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
          </div>
        )}

        {actionError && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <svg className="w-5 h-5 text-rose-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {actionError}
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Metric Cards Row */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
          <div
            onClick={() => setStatusFilter('ALL')}
            className={`cursor-pointer bg-white rounded-xl p-4 border transition hover:shadow-md ${
              statusFilter === 'ALL' ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Active Desk</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{stats.totalActive}</div>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'OPEN' ? 'ALL' : 'OPEN')}
            className={`cursor-pointer bg-white rounded-xl p-4 border transition hover:shadow-md ${
              statusFilter === 'OPEN' ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Open / Pending</span>
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{stats.OPEN}</div>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'IN_REVIEW' ? 'ALL' : 'IN_REVIEW')}
            className={`cursor-pointer bg-white rounded-xl p-4 border transition hover:shadow-md ${
              statusFilter === 'IN_REVIEW' ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>In Review</span>
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{stats.IN_REVIEW}</div>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
            className={`cursor-pointer bg-white rounded-xl p-4 border transition hover:shadow-md ${
              statusFilter === 'APPROVED' ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Approved</span>
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{stats.APPROVED}</div>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? 'ALL' : 'REJECTED')}
            className={`cursor-pointer bg-white rounded-xl p-4 border transition hover:shadow-md col-span-2 sm:col-span-1 ${
              statusFilter === 'REJECTED' ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Rejected</span>
              <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{stats.REJECTED}</div>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, email, order ID, or reference (e.g. RET-2026)..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 placeholder-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden lg:inline">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-auto px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="ALL">Status: All</option>
              <option value="OPEN">Open / Pending</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Reason Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden lg:inline">Reason:</label>
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-auto px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="ALL">Reason: All</option>
              <option value="DAMAGED">Damaged</option>
              <option value="WRONG_ITEM">Wrong Item</option>
              <option value="SIZE_ISSUE">Size Issue</option>
              <option value="NOT_AS_DESCRIBED">Not As Described</option>
              <option value="CHANGED_MIND">Changed Mind</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so as 'asc' | 'desc');
                setPage(1);
              }}
              className="w-full md:w-auto px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="createdAt-desc">Sort: Newest First</option>
              <option value="createdAt-asc">Sort: Oldest First</option>
              <option value="reference-asc">Sort: Reference (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Requests Table & Content Area */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm font-medium">Loading return requests from server...</p>
            </div>
          ) : items.length === 0 ? (
            /* Empty State matching Image 3 */
            <div className="py-20 px-4 text-center">
              <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">No return requests found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                {search || statusFilter !== 'ALL' || reasonFilter !== 'ALL'
                  ? 'No return requests match your current search and filter criteria.'
                  : 'There are currently no return requests on the active desk.'}
              </p>
              <button
                onClick={() => setShowRaiseModal(true)}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
              >
                Raise a new request
              </button>
            </div>
          ) : (
            /* Table of Requests */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Order & Item</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => fetchItemDetail(item.id)}
                      className="hover:bg-blue-50/40 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {item.reference}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.customerName}</div>
                        <div className="text-xs text-slate-500">{item.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">
                          {item.orderNumber} • <span className="text-slate-500">{item.itemName || item.itemSku}</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          SKU: {item.itemSku} • Qty: {item.quantity || 1}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {REASON_LABELS[item.reason] || item.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(item.status)}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchItemDetail(item.id);
                          }}
                          className="text-xs font-semibold px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white transition"
                        >
                          Work Desk →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && total > 0 && (
            <div className="bg-slate-50 px-4 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <div>
                Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-semibold text-slate-900">{Math.min(page * limit, total)}</span> of{' '}
                <span className="font-semibold text-slate-900">{total}</span> requests
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <span className="text-xs font-semibold px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Drawer / Modal: Work Request Details */}
      {selectedId && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-2xl min-h-screen shadow-2xl p-6 flex flex-col justify-between border-l border-slate-200">
            {loadingDetail || !activeItem ? (
              <div className="py-20 text-center text-slate-400">
                <svg className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm">Fetching request details...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold font-mono text-slate-900">{activeItem.reference}</h2>
                      {renderStatusBadge(activeItem.status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Created on {new Date(activeItem.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setActiveItem(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Status-specific Legal Action Banners */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Available Legal Actions (State Flow)
                  </h4>
                  <div className="flex flex-wrap gap-2.5">
                    {/* OPEN actions */}
                    {activeItem.status === 'OPEN' && (
                      <>
                        <button
                          disabled={submittingAction}
                          onClick={() => handleStatusChange('IN_REVIEW')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                        >
                          → Move to In Review
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => setShowEditModal(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                        >
                          ✎ Edit Details
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={handleSoftDelete}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition"
                        >
                          🗑 Remove from Desk
                        </button>
                      </>
                    )}

                    {/* IN_REVIEW actions */}
                    {activeItem.status === 'IN_REVIEW' && (
                      <>
                        <button
                          disabled={submittingAction}
                          onClick={() => {
                            setApprovalForm({ resolution: 'REFUND', refundAmount: '' });
                            setShowApproveModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                        >
                          ✓ Approve Request...
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => handleStatusChange('REJECTED')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition"
                        >
                          ✕ Reject Request
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => setShowEditModal(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                        >
                          ✎ Edit Details
                        </button>
                      </>
                    )}

                    {/* APPROVED actions */}
                    {activeItem.status === 'APPROVED' && (
                      <button
                        disabled={submittingAction}
                        onClick={() => handleStatusChange('COMPLETED')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition"
                      >
                        ✓ Mark Completed & Close
                      </button>
                    )}

                    {/* REJECTED actions */}
                    {activeItem.status === 'REJECTED' && (
                      <button
                        disabled={submittingAction}
                        onClick={handleSoftDelete}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition"
                      >
                        🗑 Remove from Desk
                      </button>
                    )}

                    {/* COMPLETED info */}
                    {activeItem.status === 'COMPLETED' && (
                      <span className="text-xs text-purple-700 font-medium bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                        This request is in a final closed state. Details are permanently locked.
                      </span>
                    )}
                  </div>
                </div>

                {/* Item Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm bg-white p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Customer</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{activeItem.customerName}</div>
                    <div className="text-xs text-slate-500">{activeItem.customerEmail}</div>
                    {activeItem.customerPhone && (
                      <div className="text-xs text-slate-500">{activeItem.customerPhone}</div>
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Order Info</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{activeItem.orderNumber}</div>
                    <div className="text-xs text-slate-600">
                      Item: <span className="font-medium text-slate-800">{activeItem.itemName}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      SKU: {activeItem.itemSku} • Units: {activeItem.quantity}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Return Reason</span>
                    <div className="mt-0.5">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {REASON_LABELS[activeItem.reason] || activeItem.reason}
                      </span>
                    </div>
                  </div>

                  {activeItem.resolution && (
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase">Resolution</span>
                      <div className="font-semibold text-emerald-700 mt-0.5">
                        {activeItem.resolution}
                        {activeItem.refundAmount && ` ($${Number(activeItem.refundAmount).toFixed(2)})`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Audit Notes Timeline */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      Audit Notes Timeline ({activeItem.notes?.length || 0})
                    </h3>
                  </div>

                  {/* Add Note Form (Always legal in all states) */}
                  <form onSubmit={handleAddNote} className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteAuthor}
                        onChange={(e) => setNoteAuthor(e.target.value)}
                        placeholder="Author name"
                        className="w-1/3 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                      <input
                        type="text"
                        required
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Write an internal note..."
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={submittingAction || !noteContent.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                      >
                        Add Note
                      </button>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {!activeItem.notes || activeItem.notes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No notes recorded yet.</p>
                    ) : (
                      activeItem.notes.map((note) => (
                        <div key={note.id} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="font-semibold text-slate-700">{note.author}</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: + Raise Return Request */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Raise Return Request</h3>
              <button onClick={() => setShowRaiseModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3.5 mt-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newRequest.customerName}
                    onChange={(e) => setNewRequest({ ...newRequest, customerName: e.target.value })}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Email *</label>
                  <input
                    type="email"
                    required
                    value={newRequest.customerEmail}
                    onChange={(e) => setNewRequest({ ...newRequest, customerEmail: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={newRequest.customerPhone}
                  onChange={(e) => setNewRequest({ ...newRequest, customerPhone: e.target.value })}
                  placeholder="+1 555-0199"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Order Number *</label>
                  <input
                    type="text"
                    required
                    value={newRequest.orderNumber}
                    onChange={(e) => setNewRequest({ ...newRequest, orderNumber: e.target.value })}
                    placeholder="ORD-9021"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item SKU *</label>
                  <input
                    type="text"
                    required
                    value={newRequest.itemSku}
                    onChange={(e) => setNewRequest({ ...newRequest, itemSku: e.target.value })}
                    placeholder="SKU-882"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={newRequest.itemName}
                    onChange={(e) => setNewRequest({ ...newRequest, itemName: e.target.value })}
                    placeholder="Running Shoes"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newRequest.quantity}
                    onChange={(e) => setNewRequest({ ...newRequest, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Return *</label>
                <select
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value as ReturnReason })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="DAMAGED">Damaged</option>
                  <option value="WRONG_ITEM">Wrong Item</option>
                  <option value="SIZE_ISSUE">Size Issue</option>
                  <option value="NOT_AS_DESCRIBED">Not As Described</option>
                  <option value="CHANGED_MIND">Changed Mind</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {submittingAction ? 'Creating...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Request Details (Only when OPEN or IN_REVIEW) */}
      {showEditModal && activeItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Details ({activeItem.reference})</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 mt-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.customerEmail}
                    onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Order Number</label>
                  <input
                    type="text"
                    required
                    value={editForm.orderNumber}
                    onChange={(e) => setEditForm({ ...editForm, orderNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item SKU</label>
                  <input
                    type="text"
                    required
                    value={editForm.itemSku}
                    onChange={(e) => setEditForm({ ...editForm, itemSku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.itemName}
                    onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Return Reason</label>
                <select
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value as ReturnReason })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="DAMAGED">Damaged</option>
                  <option value="WRONG_ITEM">Wrong Item</option>
                  <option value="SIZE_ISSUE">Size Issue</option>
                  <option value="NOT_AS_DESCRIBED">Not As Described</option>
                  <option value="CHANGED_MIND">Changed Mind</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve Request (Rule 2: Resolution selection) */}
      {showApproveModal && activeItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Approve Request</h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4 mt-4 text-sm">
              <p className="text-xs text-slate-600">
                In order to approve request <span className="font-mono font-bold text-slate-800">{activeItem.reference}</span>, select a resolution:
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Type *</label>
                <select
                  value={approvalForm.resolution}
                  onChange={(e) => setApprovalForm({ ...approvalForm, resolution: e.target.value as ResolutionType })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="REFUND">Refund</option>
                  <option value="REPLACEMENT">Replacement</option>
                  <option value="STORE_CREDIT">Store Credit</option>
                </select>
              </div>

              {approvalForm.resolution === 'REFUND' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={approvalForm.refundAmount}
                    onChange={(e) => setApprovalForm({ ...approvalForm, refundAmount: e.target.value })}
                    placeholder="e.g. 49.99"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">A positive refund amount is required for refund resolution.</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  Non-refund resolutions ({approvalForm.resolution}) do not record a refund amount.
                </p>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  Confirm Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          ReturnDesk • Production Support Desk Management System
        </div>
      </footer>
    </div>
  );
}
