// A portable hold marker keeps unresolved source cells blocked after Excel/CSV export.
export const REVIEW_HOLD = '[KTP_REVIEW_REQUIRED] ';
export const reviewHoldMessage = 'ช่องนี้ยังไม่ได้ยืนยันค่าต้นทางจากไฟล์ที่ตรวจแล้ว กรุณาแทนที่ด้วยค่าที่ตรวจสอบแล้ว';
export const isReviewHeld = (value: unknown): value is string => typeof value === 'string' && value.startsWith(REVIEW_HOLD);

export function holdReviewValue(value: unknown) {
  return isReviewHeld(value) ? value : `${REVIEW_HOLD}${value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
}
