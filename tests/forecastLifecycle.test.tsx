import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ForecastChangePreview } from '../src/admin/ForecastLifecycle';

it('shows data status separately from numeric zero in the publication comparison', () => {
  render(<ForecastChangePreview comparison={{ revision: 1, stale: false, newOrigin: false, changedCells: 2,
    validation: { valid: false, issues: [] }, changes: [
      { subdistrictCode: '300101', targetMonth: '2026-11', status: 'predicted', riskCode: 0,
        before: { status: 'out_of_scope', riskCode: null } },
      { subdistrictCode: '300102', targetMonth: '2026-11', status: 'insufficient_data', riskCode: null,
        before: { status: 'predicted', riskCode: 1 } },
    ] }} />);
  expect(screen.getByText('นอกขอบเขตการศึกษา')).toBeInTheDocument();
  expect(screen.getByText('ข้อมูลไม่เพียงพอ')).toBeInTheDocument();
  expect(screen.getByText('ไม่พบความเสี่ยง')).toBeInTheDocument();
  expect(screen.queryByText('ไม่มีค่า')).toBeNull();
});
