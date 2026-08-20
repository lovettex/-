import { format } from 'date-fns';

export function getTimestampMillis(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val.toMillis === 'function') {
    try {
      return val.toMillis();
    } catch {
      // fallback
    }
  }
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().getTime();
    } catch {
      // fallback
    }
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? 0 : val.getTime();
  }
  if (typeof val.seconds === 'number') {
    const nanos = typeof val.nanoseconds === 'number' ? Math.floor(val.nanoseconds / 1000000) : 0;
    return val.seconds * 1000 + nanos;
  }
  if (typeof val._seconds === 'number') {
    const nanos = typeof val._nanoseconds === 'number' ? Math.floor(val._nanoseconds / 1000000) : 0;
    return val._seconds * 1000 + nanos;
  }
  if (typeof val === 'string') {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function getTimestampDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      // fallback
    }
  }
  if (typeof val.toMillis === 'function') {
    try {
      const d = new Date(val.toMillis());
      return isNaN(d.getTime()) ? null : d;
    } catch {
      // fallback
    }
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  if (typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatTimestamp(val: any, formatPattern: string = 'yyyy/MM/dd'): string {
  const d = getTimestampDate(val);
  if (!d) return '';
  try {
    return format(d, formatPattern);
  } catch {
    return '';
  }
}
