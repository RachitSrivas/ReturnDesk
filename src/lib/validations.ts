import { z } from 'zod';

export const createReturnSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  orderNumber: z.string().min(1),
  itemSku: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.enum(['DAMAGED','WRONG_ITEM','SIZE_ISSUE','NOT_AS_DESCRIBED','CHANGED_MIND']),
});

export const editReturnSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional().nullable(),
  orderNumber: z.string().min(1).optional(),
  itemSku: z.string().min(1).optional(),
  itemName: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  reason: z.enum(['DAMAGED','WRONG_ITEM','SIZE_ISSUE','NOT_AS_DESCRIBED','CHANGED_MIND']).optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(['OPEN','IN_REVIEW','APPROVED','REJECTED','COMPLETED']),
  resolution: z.enum(['REFUND','REPLACEMENT','STORE_CREDIT']).optional(),
  refundAmount: z.number().positive().optional(),
});

export const addNoteSchema = z.object({
  content: z.string().min(1),
  author: z.string().min(1),
});
