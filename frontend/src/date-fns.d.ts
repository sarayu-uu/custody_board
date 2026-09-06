declare module "date-fns" {
  export function format(date: Date | number | string, format: string): string;
  export function addDays(date: Date | number | string, amount: number): Date;
}
