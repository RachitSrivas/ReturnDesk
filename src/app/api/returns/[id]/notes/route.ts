import { NextResponse } from 'next/server';
import { ReturnService } from '@/services/return-service';
import { addNoteSchema } from '@/lib/validations';
import { errorResponse } from '@/lib/errors';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const json = await request.json();
    const parsed = addNoteSchema.parse(json);
    const note = await ReturnService.addNote(params.id, parsed.content, parsed.author);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
