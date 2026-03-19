declare module 'lunar-calendar' {
  interface LunarResult {
    lunarYear: number
    lunarMonth: number
    lunarDay: number
    lunarMonthName: string
    lunarDayName: string
    solarTerm?: string
    isLeapMonth: boolean
    isLeapYear: boolean
  }

  export function solarToLunar(year: number, month: number, day: number): LunarResult
  export function lunarToSolar(year: number, month: number, day: number, isLeapMonth?: boolean): { year: number; month: number; day: number }
}