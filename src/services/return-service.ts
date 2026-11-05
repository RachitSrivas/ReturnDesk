import { PrismaClient, ReturnStatus, ResolutionType } from '@prisma/client';
import { ApiError } from '../lib/errors';
import { prisma } from '../lib/db';

export class ReturnService {
  // Create a new return request
  static async create(data: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string | null;
    orderNumber: string;
    itemSku: string;
    itemName: string;
    quantity: number;
    reason: string;
  }) {
    // Enforce positive quantity
    if (data.quantity <= 0) {
      throw new ApiError('Quantity must be greater than zero.', 422);
    }
    // Generate reference (simple deterministic for demo)
    const reference = `RET-${Date.now()}`;
    try {
      const request = await prisma.returnRequest.create({
        data: {
          reference,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone ?? undefined,
          orderNumber: data.orderNumber,
          itemSku: data.itemSku,
          itemName: data.itemName,
          quantity: data.quantity,
          reason: data.reason as any,
        },
      });
      return request;
    } catch (e: any) {
      // Handle partial unique index violation (duplicate live request)
      if (e.code === 'P2002' && e.meta?.target?.includes('unique_live_order_item')) {
        throw new ApiError('A live return request already exists for this order/item.', 409);
      }
      throw e;
    }
  }

  // List with server‑side search / filter / sort / pagination
  static async list(params: {
    search?: string;
    status?: string[];
    reason?: string[];
    sortBy?: keyof any;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const { search, status, reason, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 } = params;
    const where: any = { removedAt: null };
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status.length) where.status = { in: status };
    if (reason && reason.length) where.reason = { in: reason };

    const skip = (page - 1) * limit;
    const [total, data, counts] = await Promise.all([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          reference: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          orderNumber: true,
          itemSku: true,
          itemName: true,
          quantity: true,
          status: true,
          reason: true,
          resolution: true,
          refundAmount: true,
          createdAt: true,
        },
      }),
      prisma.returnRequest.groupBy({
        by: ['status'],
        where: { removedAt: null },
        _count: { status: true },
      }),
    ]);

    const stats = {
      totalActive: 0,
      OPEN: 0,
      IN_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      COMPLETED: 0,
    };
    for (const c of counts) {
      if (c.status in stats) {
        (stats as any)[c.status] = c._count.status;
      }
      if (c.status !== ReturnStatus.REJECTED && c.status !== ReturnStatus.COMPLETED) {
        stats.totalActive += c._count.status;
      }
    }

    return { total, data: data as any, page, limit, totalPages: Math.ceil(total / limit), stats };
  }

  static async get(id: string) {
    const request = await prisma.returnRequest.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: 'asc' } } },
    });
    if (!request || request.removedAt) {
      throw new ApiError('Return request not found.', 404);
    }
    return request;
  }

  // Edit only when status is OPEN or IN_REVIEW
  static async edit(id: string, data: Partial<{ customerName: string; customerEmail: string; customerPhone: string | null; orderNumber: string; itemSku: string; itemName: string; quantity: number; reason: string }>) {
    const request = await this.get(id);
    if (request.status !== ReturnStatus.OPEN && request.status !== ReturnStatus.IN_REVIEW) {
      throw new ApiError('Only OPEN or IN_REVIEW requests can be edited.', 409);
    }
    // prevent editing locked fields after approval/rejection – already checked
    const updated = await prisma.returnRequest.update({
      where: { id },
      data: data as any,
    });
    return updated;
  }

  // Change status with validation of transitions and resolution
  static async changeStatus(id: string, newStatus: ReturnStatus, payload?: { resolution?: ResolutionType; refundAmount?: number }) {
    const request = await this.get(id);
    // Validate transition matrix
    const allowed = this.allowedTransitions(request.status);
    if (!allowed.includes(newStatus)) {
      throw new ApiError(`Invalid status transition from ${request.status} to ${newStatus}.`, 409, { allowed });
    }
    // If moving to APPROVED, enforce resolution rules
    if (newStatus === ReturnStatus.APPROVED) {
      if (!payload?.resolution) {
        throw new ApiError('Resolution type is required when approving.', 422);
      }
      if (payload.resolution === ResolutionType.REFUND) {
        if (!payload.refundAmount || payload.refundAmount <= 0) {
          throw new ApiError('Refund amount must be greater than zero for REFUND resolution.', 422);
        }
      } else {
        if (payload.refundAmount && payload.refundAmount > 0) {
          throw new ApiError('Refund amount must be zero for non‑REFUND resolutions.', 422);
        }
      }
    }
    // Build update object
    const updateData: any = { status: newStatus };
    if (newStatus === ReturnStatus.APPROVED && payload) {
      updateData.resolution = payload.resolution;
      updateData.refundAmount = payload.resolution === ResolutionType.REFUND ? payload.refundAmount : null;
    }
    // Use transaction to avoid race conditions on the unique index when moving to a live status
    const result = await prisma.$transaction(async (tx) => {
      // Re‑fetch within transaction for freshest data
      const fresh = await tx.returnRequest.findUnique({ where: { id } });
      if (!fresh) throw new ApiError('Return request not found.', 404);
      // Apply same transition check again inside transaction
      const allowedInner = this.allowedTransitions(fresh.status);
      if (!allowedInner.includes(newStatus)) {
        throw new ApiError(`Invalid status transition from ${fresh.status} to ${newStatus}.`, 409);
      }
      return tx.returnRequest.update({ where: { id }, data: updateData });
    });
    return result;
  }

  static allowedTransitions(current: ReturnStatus): ReturnStatus[] {
    switch (current) {
      case ReturnStatus.OPEN:
        return [ReturnStatus.IN_REVIEW];
      case ReturnStatus.IN_REVIEW:
        return [ReturnStatus.APPROVED, ReturnStatus.REJECTED];
      case ReturnStatus.APPROVED:
        return [ReturnStatus.COMPLETED];
      default:
        return [];
    }
  }

  // Add a note – always allowed (even after final states)
  static async addNote(id: string, content: string, author: string) {
    const request = await this.get(id);
    const note = await prisma.returnNote.create({
      data: {
        returnRequestId: request.id,
        content,
        author,
      },
    });
    return note;
  }

  // Soft delete – only OPEN or REJECTED and not already removed
  static async softDelete(id: string) {
    const request = await this.get(id);
    if (request.status !== ReturnStatus.OPEN && request.status !== ReturnStatus.REJECTED) {
      throw new ApiError('Only OPEN or REJECTED requests can be removed.', 409);
    }
    const updated = await prisma.returnRequest.update({
      where: { id },
      data: { removedAt: new Date() },
    });
    return updated;
  }
}
