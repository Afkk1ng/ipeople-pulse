import { logoutResponse } from '@/lib/auth';

export const runtime = 'edge';

export async function POST() {
  return logoutResponse();
}
