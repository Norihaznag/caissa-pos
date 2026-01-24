import { useEffect, useState } from 'react';
import { supabase, License } from '../lib/supabase';
import { 
  Plus, 
  Copy, 
  MoreVertical, 
  Search,
  Key,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Licenses() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

  // Form state for creating licenses
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    quantity: 1,
  });

  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = async () => {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error('Failed to load licenses:', error);
      toast.error('Failed to load licenses');
    } finally {
      setLoading(false);
    }
  };

  const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let part = 0; part < 4; part++) {
      if (part > 0) key += '-';
      for (let i = 0; i < 4; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return key;
  };

  const createLicenses = async () => {
    setCreating(true);
    try {
      const newLicenses = [];
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

      for (let i = 0; i < formData.quantity; i++) {
        let key = generateLicenseKey();
        // Ensure unique key
        while (licenses.some(l => l.license_key === key)) {
          key = generateLicenseKey();
        }

        newLicenses.push({
          license_key: key,
          customer_name: formData.customerName || null,
          customer_email: formData.customerEmail || null,
          customer_phone: formData.customerPhone || null,
          status: 'available',
          plan: 'standard',
          expires_at: expiresAt.toISOString(),
        });
      }

      const { error } = await supabase
        .from('licenses')
        .insert(newLicenses);

      if (error) throw error;

      toast.success(`Created ${formData.quantity} license(s)`);
      setShowCreateModal(false);
      setFormData({ customerName: '', customerEmail: '', customerPhone: '', quantity: 1 });
      loadLicenses();
    } catch (error) {
      console.error('Failed to create licenses:', error);
      toast.error('Failed to create licenses');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const updateLicenseStatus = async (license: License, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', license.id);

      if (error) throw error;

      toast.success(`License ${newStatus}`);
      setSelectedLicense(null);
      loadLicenses();
    } catch (error) {
      console.error('Failed to update license:', error);
      toast.error('Failed to update license');
    }
  };

  const resetDeviceBinding = async (license: License) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ 
          device_id: null, 
          status: 'available',
          activated_at: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', license.id);

      if (error) throw error;

      toast.success('Device binding reset');
      setSelectedLicense(null);
      loadLicenses();
    } catch (error) {
      console.error('Failed to reset device binding:', error);
      toast.error('Failed to reset device binding');
    }
  };

  const filteredLicenses = licenses.filter(l => 
    l.license_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.device_id?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-3xl font-bold text-white">Licenses</h1>
          <p className="text-gray-400 mt-1">Manage subscription licenses</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Generate Licenses
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by key, customer, email, or device ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-4 text-gray-400 font-medium">License Key</th>
              <th className="text-left p-4 text-gray-400 font-medium">Customer</th>
              <th className="text-left p-4 text-gray-400 font-medium">Status</th>
              <th className="text-left p-4 text-gray-400 font-medium">Device</th>
              <th className="text-left p-4 text-gray-400 font-medium">Expires</th>
              <th className="text-left p-4 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLicenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No licenses found
                </td>
              </tr>
            ) : (
              filteredLicenses.map((license) => (
                <tr key={license.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-orange-500" />
                      <code className="text-white font-mono">{license.license_key}</code>
                      <button
                        onClick={() => copyToClipboard(license.license_key)}
                        className="p-1 hover:bg-gray-700 rounded"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white">{license.customer_name || '-'}</p>
                      <p className="text-gray-500 text-sm">{license.customer_email || ''}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={license.status} />
                  </td>
                  <td className="p-4">
                    <code className="text-gray-400 text-sm">
                      {license.device_id || '-'}
                    </code>
                  </td>
                  <td className="p-4 text-gray-400">
                    {license.expires_at 
                      ? format(new Date(license.expires_at), 'MMM d, yyyy')
                      : 'Never'}
                  </td>
                  <td className="p-4">
                    <div className="relative">
                      <button
                        onClick={() => setSelectedLicense(selectedLicense?.id === license.id ? null : license)}
                        className="p-2 hover:bg-gray-700 rounded"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      
                      {selectedLicense?.id === license.id && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[160px]">
                          <button
                            onClick={() => copyToClipboard(license.license_key)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 text-left"
                          >
                            <Copy className="w-4 h-4" />
                            Copy Key
                          </button>
                          {license.status === 'active' && (
                            <>
                              <button
                                onClick={() => updateLicenseStatus(license, 'suspended')}
                                className="w-full flex items-center gap-2 px-4 py-2 text-yellow-400 hover:bg-gray-700 text-left"
                              >
                                <Clock className="w-4 h-4" />
                                Suspend
                              </button>
                              <button
                                onClick={() => resetDeviceBinding(license)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-blue-400 hover:bg-gray-700 text-left"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Reset Device
                              </button>
                            </>
                          )}
                          {license.status === 'suspended' && (
                            <button
                              onClick={() => updateLicenseStatus(license, 'active')}
                              className="w-full flex items-center gap-2 px-4 py-2 text-green-400 hover:bg-gray-700 text-left"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Reactivate
                            </button>
                          )}
                          {license.status !== 'revoked' && (
                            <button
                              onClick={() => updateLicenseStatus(license, 'revoked')}
                              className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-gray-700 text-left"
                            >
                              <XCircle className="w-4 h-4" />
                              Revoke
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Generate Licenses</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Customer Name (optional)</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Customer Email (optional)</label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Customer Phone (optional)</label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Number of Licenses</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400">
                  Each license is valid for <span className="text-orange-500 font-medium">1 year</span> and costs <span className="text-orange-500 font-medium">600 DH</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createLicenses}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {creating ? 'Creating...' : `Generate ${formData.quantity} License(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    available: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Clock className="w-3 h-3" /> },
    active: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
    suspended: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <Clock className="w-3 h-3" /> },
    revoked: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <XCircle className="w-3 h-3" /> },
  };

  const { bg, text, icon } = config[status] || config.available;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${bg} ${text}`}>
      {icon}
      {status}
    </span>
  );
}
