import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PageLoadBoundary, usePageLoading } from '../src/components/PageLoadBoundary';
import { AppStartup } from '../src/components/AppStartup';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Read({ pending, name }: { pending: boolean; name: string }) {
  usePageLoading(pending);
  return <p>{name}</p>;
}

it('waits for all readers, including a newly mounted waterfall, without resetting children', () => {
  function Editor() {
    const [value, setValue] = useState('');
    return <input aria-label="draft" value={value} onChange={event => setValue(event.target.value)} />;
  }
  function Content({ stage }: { stage: number }) {
    return <StrictMode><PageLoadBoundary path="/admin">
      <Read pending={stage === 0} name="list" />
      {stage > 0 && <Read pending={stage === 1} name="catalog" />}
      <Editor />
    </PageLoadBoundary></StrictMode>;
  }
  const { container, rerender } = render(<Content stage={0} />);
  expect(screen.getByRole('status')).toHaveTextContent('กำลังเตรียมข้อมูลสำหรับผู้ดูแล...');
  expect(container.querySelector('.page-load-content')).toHaveAttribute('inert');
  expect(screen.queryByRole('textbox')).toBeNull();
  rerender(<Content stage={1} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  rerender(<Content stage={2} />);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'unsaved draft' } });
  rerender(<Content stage={1} />);
  rerender(<Content stage={2} />);
  expect(screen.getByRole('textbox')).toHaveValue('unsaved draft');
  expect(container.querySelector('.page-load-content')).not.toHaveAttribute('inert');
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('releases an abandoned route and restores scrolling when the boundary unmounts', () => {
  const { rerender, unmount } = render(<PageLoadBoundary path="/"><Read pending name="departed" /></PageLoadBoundary>);
  expect(document.body.style.overflow).toBe('hidden');
  rerender(<PageLoadBoundary path="/admin"><p>ready route</p></PageLoadBoundary>);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<PageLoadBoundary path="/admin"><Read pending name="next" /></PageLoadBoundary>);
  unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('offers recovery for an unusually slow startup without pretending loading has finished', () => {
  vi.useFakeTimers();
  render(<AppStartup path="/admin" />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Korat Tan Phai')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('กำลังเตรียมข้อมูลสำหรับผู้ดูแล...');
  act(() => vi.advanceTimersByTime(20_000));
  expect(screen.getByRole('button', { name: 'โหลดหน้าใหม่' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '2 จาก 3 ขั้นตอน');
});

it('reports completed owner phases without advancing with elapsed time', () => {
  vi.useFakeTimers();
  const { rerender } = render(<AppStartup path="/" phase="auth" />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  rerender(<AppStartup path="/" phase="module" />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  rerender(<AppStartup path="/" phase="page" />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
});

it('finishes only after all reads settle, releases content immediately and cancels an interrupted exit', () => {
  vi.useFakeTimers();
  const content = (pending: boolean) => <PageLoadBoundary path="/admin"><Read pending={pending} name="result" /><button>ready action</button></PageLoadBoundary>;
  const { container, rerender } = render(content(true));
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
  rerender(content(false));
  expect(container.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '100');
  expect(container.querySelector('.app-startup')).toHaveAttribute('inert');
  expect(container.querySelector('.app-startup')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('button', { name: 'ready action' })).toBeInTheDocument();
  expect(container.querySelector('.page-load-content')).not.toHaveAttribute('inert');
  expect(document.body.style.overflow).not.toBe('hidden');
  act(() => vi.advanceTimersByTime(100));
  rerender(content(true));
  act(() => vi.advanceTimersByTime(220));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
  rerender(content(false));
  act(() => vi.advanceTimersByTime(220));
  expect(container.querySelector('.app-startup')).toBeNull();
});
