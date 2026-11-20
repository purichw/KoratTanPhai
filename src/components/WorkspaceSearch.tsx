import { createContext, lazy, Suspense } from 'react';
import { Search } from 'lucide-react';
import { AppErrorBoundary } from './AppErrorBoundary';
import { WorkspaceDialog } from './WorkspaceDialog';
import '../workspace-search.css';

const SearchContent = lazy(() => import('./WorkspaceSearchContent').then(module => ({ default: module.WorkspaceSearchContent })));

type WorkspaceSearchActions = {
  userId: string; includeExport: boolean; onNavigate: (path: string) => void; onExport: () => void;
};
export type WorkspaceSearchProps = WorkspaceSearchActions & {
  onClose: () => void;
  mapScope?: { name: string; areaCodes: ReadonlySet<string>; onSelect: (code: string) => string | undefined };
};
export const WorkspaceSearchContext = createContext<WorkspaceSearchActions | null>(null);

export function WorkspaceSearchTrigger({ onOpen, compact = false }: { onOpen: () => void; compact?: boolean }) {
  return <button type="button" className={compact ? 'icon-button primary-button workspace-search-trigger is-compact' : 'primary-button workspace-search-trigger'}
    aria-label="ค้นหาข้อมูล" title="ค้นหาข้อมูล" aria-haspopup="dialog" onClick={onOpen}>
    <Search size={19} aria-hidden="true" />{!compact && <span>ค้นหาข้อมูล</span>}
  </button>;
}

export function WorkspaceSearch(props: WorkspaceSearchProps) {
  return <WorkspaceDialog title="ค้นหาข้อมูล" onClose={props.onClose} wide closeLabel="ปิดการค้นหา">
    <AppErrorBoundary><Suspense fallback={<p role="status">กำลังเตรียมการค้นหาข้อมูล...</p>}>
      <SearchContent {...props} />
    </Suspense></AppErrorBoundary>
  </WorkspaceDialog>;
}
