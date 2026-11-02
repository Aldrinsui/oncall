import { useApp } from '../../context/AppContext';
import PulseHome from './PulseHome';
import PulseChannel from './PulseChannel';

export default function Pulse() {
  const {
    pulseView,
    setPulseView,
    activeChannelId,
    setActiveChannelId,
  } = useApp();

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setPulseView('channel');
  };

  const handleBackToHome = () => {
    setPulseView('home');
  };

  return (
    <div className="animate-fade-in pb-4">
      {pulseView === 'home' ? (
        <PulseHome onSelectChannel={handleSelectChannel} />
      ) : (
        <PulseChannel
          channelId={activeChannelId || 'callcentre-team'}
          onBack={handleBackToHome}
        />
      )}
    </div>
  );
}
