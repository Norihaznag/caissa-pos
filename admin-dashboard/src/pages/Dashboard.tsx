import { useEffect, useState } from 'react';
import { supabase, License, Device } from '../lib/supabase';
import { 
  Key, 
  Smartphone, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

interface Stats {
  totalLicenses: number;
  activeLicenses: number;
  availableLicenses: number;
  totalDevices: number;
  activeTrials: number;
  expiredTrials: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalLicenses: 0,
    activeLicenses: 0,
    availableLicenses: 0,
    totalDevices: 0,
    activeTrials: 0,
    expiredTrials: 0,
  });
  const [recentLicenses, setRecentLicenses] = useState<License[]>([]);
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load licenses
      const { data: licenses } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      // Load devices
      const { data: devices } = await supabase
        .from('devices')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (licenses) {
        const now = new Date();
        setStats({
          totalLicenses: licenses.length,
          activeLicenses: licenses.filter(l => l.status === 'active').length,
          availableLicenses: licenses.filter(l => l.status === 'available').length,
          totalDevices: devices?.length || 0,
          activeTrials: devices?.filter(d => 
            d.trial_expires_at && new Date(d.trial_expires_at) > now && !d.license_id
          ).length || 0,
          expiredTrials: devices?.filter(d => 
            d.trial_expires_at && new Date(d.trial_expires_at) <= now && !d.license_id
          ).length || 0,
        });
        setRecentLicenses(licenses.slice(0, 5));
      }

      if (devices) {
        setRecentDevices(devices.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your license system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          icon={<Key className="w-6 h-6" />}
          label="Total Licenses"
          value={stats.totalLicenses}
          color="orange"
        />
        <StatCard 
          icon={<CheckCircle className="w-6 h-6" />}
          label="Active Licenses"
          value={stats.activeLicenses}
          color="green"
        />
        <StatCard 
          icon={<TrendingUp className="w-6 h-6" />}
          label="Available Licenses"
          value={stats.availableLicenses}
          color="blue"
        />
        <StatCard 
          icon={<Smartphone className="w-6 h-6" />}
          label="Total Devices"
          value={stats.totalDevices}
          color="purple"
        />
        <StatCard 
          icon={<Clock className="w-6 h-6" />}
          label="Active Trials"
          value={stats.activeTrials}
          color="yellow"
        />
        <StatCard 
          icon={<AlertCircle className="w-6 h-6" />}
          label="Expired Trials"
          value={stats.expiredTrials}
          color="red"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Licenses */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Licenses</h2>
          {recentLicenses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No licenses yet</p>
          ) : (
            <div className="space-y-3">
              {recentLicenses.map((license) => (
                <div key={license.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-mono text-sm text-white">{license.license_key}</p>
                    <p className="text-xs text-gray-500">{license.customer_name || 'No customer'}</p>
                  </div>
                  <StatusBadge status={license.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Devices */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Devices</h2>
          {recentDevices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No devices yet</p>
          ) : (
            <div className="space-y-3">
              {recentDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-mono text-sm text-white">{device.device_id}</p>
                    <p className="text-xs text-gray-500">
                      Last seen: {format(new Date(device.last_seen_at), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  {device.license_id ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Licensed
                    </span>
                  ) : device.trial_expires_at && new Date(device.trial_expires_at) > new Date() ? (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                      Trial
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                      Expired
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  color: 'orange' | 'green' | 'blue' | 'purple' | 'yellow' | 'red';
}) {
  const colorClasses = {
    orange: 'bg-orange-500/10 text-orange-500',
    green: 'bg-green-500/10 text-green-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    red: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusClasses: Record<string, string> = {
    available: 'bg-blue-500/20 text-blue-400',
    active: 'bg-green-500/20 text-green-400',
    suspended: 'bg-yellow-500/20 text-yellow-400',
    revoked: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${statusClasses[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  );
}
