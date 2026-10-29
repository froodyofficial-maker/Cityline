import { useUI } from '../../store/ui';
import { DMSidebar } from './DMSidebar';
import { ServerSidebar } from './ServerSidebar';
import { UserPanel } from './UserPanel';
import { VoicePanel } from './VoicePanel';

export function Sidebar() {
  const route = useUI((s) => s.route);
  return (
    <aside className="sidebar">
      {route.kind === 'server' ? <ServerSidebar key={route.serverId} serverId={route.serverId} /> : <DMSidebar />}
      <div className="sidebar-foot">
        <VoicePanel />
        <UserPanel />
      </div>
    </aside>
  );
}
