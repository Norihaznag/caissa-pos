import { useEffect, useState } from 'react';
import { supabase, LicenseLog } from '../lib/supabase';
import { 
  ScrollText, 
  Search,
  Key,
  Smartphone,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function Logs() {
  const [logs, setLogs] = useState<LicenseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('license_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'trial_start':
        return <Play className="w-4 h-4 text-blue-400" />;
      case 'activate':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'validate':
        return <Key className="w-4 h-4 text-orange-400" />;
      case 'expire':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <ScrollText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'trial_start':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'activate':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'validate':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'expire':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.device_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

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
          <h1 className="text-3xl font-bold text-white">Activity Logs</h1>
          <p className="text-gray-400 mt-1">Audit trail of all license events</p>
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by device ID or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-orange-500"
        >
          <option value="all">All Actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
      </div>

      {/* Logs Timeline */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No logs found
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-800/30">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {log.device_id && (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Smartphone className="w-4 h-4" />
                          <code className="font-mono text-xs">{log.device_id}</code>
                        </div>
                      )}
                      {log.license_id && (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Key className="w-4 h-4" />
                          <code className="font-mono text-xs">{log.license_id.slice(0, 8)}...</code>
                        </div>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="mt-2 text-xs text-gray-500 bg-gray-800/50 rounded p-2 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
