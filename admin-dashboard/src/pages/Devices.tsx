import { useEffect, useState } from 'react';
import { supabase, Device } from '../lib/supabase';
import { 
  Smartphone, 
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Failed to load devices:', error);
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceStatus = (device: Device) => {
    if (device.license_id) return 'licensed';
    if (device.trial_expires_at) {
      return new Date(device.trial_expires_at) > new Date() ? 'trial' : 'expired';
    }
    return 'unknown';
  };

  const filteredDevices = devices.filter(d => 
    d.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.device_model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 mt-1">Track all registered devices</p>
        </div>
        <button
          onClick={loadDevices}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by device ID, name, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No devices found
          </div>
        ) : (
          filteredDevices.map((device) => {
            const status = getDeviceStatus(device);
            return (
              <div 
                key={device.id} 
                className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      status === 'licensed' ? 'bg-green-500/20' :
                      status === 'trial' ? 'bg-yellow-500/20' :
                      'bg-red-500/20'
                    }`}>
                      <Smartphone className={`w-5 h-5 ${
                        status === 'licensed' ? 'text-green-500' :
                        status === 'trial' ? 'text-yellow-500' :
                        'text-red-500'
                      }`} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{device.device_name || 'Unknown Device'}</p>
                      <p className="text-gray-500 text-sm">{device.device_model || 'Unknown Model'}</p>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Device ID</span>
                    <code className="text-gray-300 font-mono text-xs">{device.device_id}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">App Version</span>
                    <span className="text-gray-300">{device.app_version || '-'}</span>
                  </div>
                  {device.trial_started_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Trial Started</span>
                      <span className="text-gray-300">
                        {format(new Date(device.trial_started_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  {device.trial_expires_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Trial Expires</span>
                      <span className={
                        new Date(device.trial_expires_at) > new Date() 
                          ? 'text-yellow-400' 
                          : 'text-red-400'
                      }>
                        {format(new Date(device.trial_expires_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-500">Last Seen</span>
                    <span className="text-gray-400">
                      {formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    licensed: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <CheckCircle className="w-3 h-3" />, label: 'Licensed' },
    trial: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <Clock className="w-3 h-3" />, label: 'Trial' },
    expired: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <AlertTriangle className="w-3 h-3" />, label: 'Expired' },
    unknown: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: <Clock className="w-3 h-3" />, label: 'Unknown' },
  };

  const { bg, text, icon, label } = config[status] || config.unknown;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${bg} ${text}`}>
      {icon}
      {label}
    </span>
  );
}
