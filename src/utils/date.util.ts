export class DateUtil {
  public static toIso(date: Date = new Date()): string {
    return date.toISOString();
  }

  public static toDateString(date: Date = new Date()): string {
    return date.toISOString().split('T')[0]!;
  }

  public static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  public static isExpired(date: Date | string | null): boolean {
    if (!date) return false;
    const target = typeof date === 'string' ? new Date(date) : date;
    return target.getTime() < Date.now();
  }

  public static sanitizeForFilename(name: string): string {
    return name
      .trim()
      .replace(/[\s/\\?%*:|"<>]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}

