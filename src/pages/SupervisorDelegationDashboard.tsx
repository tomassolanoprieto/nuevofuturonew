import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { 
  LogOut, 
  BarChart, 
  Shield,
  User,
  Users,
  Clock,
  Search,
  X,
  Plus,
  Edit,
  Calendar,
  FileText,
  Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import SupervisorDelegationEmployees from './SupervisorDelegationEmployees';
import SupervisorDelegationRequests from './SupervisorDelegationRequests';
import SupervisorDelegationCalendar from './SupervisorDelegationCalendar';
import SupervisorDelegationReports from './SupervisorDelegationReports';

function Overview() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [newEntry, setNewEntry] = useState({
    timestamp: '',
    entry_type: 'clock_in'
  });
  const [delegation] = useState<string | null>('MADRID');

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchTimeEntries();
    }
  }, [employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc(
        'get_employees_by_delegation',
        { p_delegation: 'MADRID' }
      );

      if (error) {
        console.error('Error en RPC:', error);
        throw error;
      }

      if (data) {
        console.log('Empleados obtenidos:', data);
        setEmployees(data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeEntries = async () => {
    try {
      const employeeIds = employees.map(emp => emp.id);
      
      const { data: timeEntriesData, error } = await supabase
        .from('time_entries')
        .select('*')
        .in('employee_id', employeeIds)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setTimeEntries(timeEntriesData || []);
    } catch (err) {
      console.error('Error fetching time entries:', err);
    }
  };

  const handleAddEntry = async () => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .insert([{
          employee_id: selectedEmployee.employee.id,
          entry_type: newEntry.entry_type,
          timestamp: new Date(newEntry.timestamp).toISOString()
        }]);

      if (error) throw error;

      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Error adding entry:', err);
      alert('Error al añadir el fichaje');
    }
  };

  const handleUpdateEntry = async () => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          entry_type: editingEntry.entry_type,
          timestamp: new Date(editingEntry.timestamp).toISOString()
        })
        .eq('id', editingEntry.id);

      if (error) throw error;

      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Error updating entry:', err);
      alert('Error al actualizar el fichaje');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este fichaje?')) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Error deleting entry:', err);
      alert('Error al eliminar el fichaje');
    }
  };

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getEntryTypeText = (type) => {
    switch (type) {
      case 'clock_in': return 'Entrada';
      case 'break_start': return 'Inicio Pausa';
      case 'break_end': return 'Fin Pausa';
      case 'clock_out': return 'Salida';
      default: return type;
    }
  };

  // Calculate total work time for each employee
  const employeeWorkTimes = employees.map(employee => {
    const employeeEntries = timeEntries.filter(entry => entry.employee_id === employee.id);
    
    // Group entries by date
    const entriesByDate = employeeEntries.reduce((acc, entry) => {
      const date = new Date(entry.timestamp).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(entry);
      return acc;
    }, {});

    let totalTime = 0;

    // Calculate time for each day
    Object.values(entriesByDate).forEach(dayEntries => {
      const sortedEntries = dayEntries.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let clockInTime = null;
      let breakStartTime = null;

      sortedEntries.forEach(entry => {
        const time = new Date(entry.timestamp).getTime();

        switch (entry.entry_type) {
          case 'clock_in':
            clockInTime = time;
            break;
          case 'break_start':
            if (clockInTime) {
              totalTime += time - clockInTime;
              clockInTime = null;
            }
            breakStartTime = time;
            break;
          case 'break_end':
            breakStartTime = null;
            clockInTime = time;
            break;
          case 'clock_out':
            if (clockInTime) {
              totalTime += time - clockInTime;
              clockInTime = null;
            }
            break;
        }
      });

      // If there's an open clock in without a clock out (still working)
      if (clockInTime && !breakStartTime) {
        const now = new Date().getTime();
        totalTime += now - clockInTime;
      }
    });

    return {
      employee,
      totalTime,
      entries: employeeEntries
    };
  });

  const totalWorkTime = employeeWorkTimes.reduce((acc, curr) => acc + curr.totalTime, 0);

  // Filter employees based on search term
  const filteredEmployees = employeeWorkTimes.filter(({ employee }) =>
    employee.fiscal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Vista General</h1>
          <p className="text-gray-600">Delegación: {delegation}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Empleados</p>
                <p className="text-2xl font-bold">{employees.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <Clock className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Tiempo Total Trabajado</p>
                <p className="text-2xl font-bold">{formatDuration(totalWorkTime)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <Shield className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Delegación</p>
                <p className="text-2xl font-bold">{delegation}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Buscar empleados..."
            />
          </div>
        </div>

        {/* Employee List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Centros de Trabajo
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiempo Trabajado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center">
                    Cargando...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center">
                    No hay empleados para mostrar
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(({ employee, totalTime, entries }) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedEmployee({ employee, totalTime, entries });
                      setShowDetailsModal(true);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {employee.fiscal_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {employee.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {employee.work_centers.join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatDuration(totalTime)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    Detalles de Fichajes - {selectedEmployee.employee.fiscal_name}
                  </h2>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{selectedEmployee.employee.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Centros de Trabajo</p>
                      <p className="font-medium">
                        {selectedEmployee.employee.work_centers.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Registro de Fichajes</h3>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Añadir Fichaje
                      </button>
                    </div>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Fecha
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Hora
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedEmployee.entries
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map((entry) => (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {new Date(entry.timestamp).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {new Date(entry.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {getEntryTypeText(entry.entry_type)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingEntry({
                                          id: entry.id,
                                          timestamp: new Date(entry.timestamp).toISOString().slice(0, 16),
                                          entry_type: entry.entry_type
                                        });
                                        setShowEditModal(true);
                                      }}
                                      className="p-1 text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEntry(entry.id);
                                      }}
                                      className="p-1 text-red-600 hover:text-red-800"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit/Add Modal */}
        {showEditModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    {editingEntry ? 'Editar Fichaje' : 'Añadir Fichaje'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingEntry(null);
                      setNewEntry({
                        timestamp: '',
                        entry_type: 'clock_in'
                      });
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (editingEntry) {
                    handleUpdateEntry();
                  } else {
                    handleAddEntry();
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha y Hora
                    </label>
                    <input
                      type="datetime-local"
                      value={editingEntry ? editingEntry.timestamp : newEntry.timestamp}
                      onChange={(e) => {
                        if (editingEntry) {
                          setEditingEntry({...editingEntry, timestamp: e.target.value});
                        } else {
                          setNewEntry({...newEntry, timestamp: e.target.value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Fichaje
                    </label>
                    <select
                      value={editingEntry ? editingEntry.entry_type : newEntry.entry_type}
                      onChange={(e) => {
                        if (editingEntry) {
                          setEditingEntry({...editingEntry, entry_type: e.target.value});
                        } else {
                          setNewEntry({...newEntry, entry_type: e.target.value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="clock_in">Entrada</option>
                      <option value="break_start">Inicio Pausa</option>
                      <option value="break_end">Fin Pausa</option>
                      <option value="clock_out">Salida</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingEntry(null);
                        setNewEntry({
                          timestamp: '',
                          entry_type: 'clock_in'
                        });
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingEntry ? 'Guardar Cambios' : 'Añadir Fichaje'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupervisorDelegationDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('pin');
    navigate('/login/supervisor/delegacion');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-purple-600 mr-2" />
                <span className="text-xl font-bold text-gray-900">Portal Supervisor Delegación</span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('overview');
                  navigate('/supervisor/delegacion');
                }}
                className={`text-gray-900 hover:text-gray-700 px-3 py-2 font-medium ${
                  activeTab === 'overview' ? 'text-purple-600' : ''
                }`}
              >
                Vista General
              </button>
              <button
                onClick={() => {
                  setActiveTab('employees');
                  navigate('/supervisor/delegacion/empleados');
                }}
                className={`text-gray-900 hover:text-gray-700 px-3 py-2 font-medium ${
                  activeTab === 'employees' ? 'text-purple-600' : ''
                }`}
              >
                Empleados
              </button>
              <button
                onClick={() => {
                  setActiveTab('requests');
                  navigate('/supervisor/delegacion/solicitudes');
                }}
                className={`text-gray-900 hover:text-gray-700 px-3 py-2 font-medium ${
                  activeTab === 'calendar' ? 'text-purple-600' : ''
                }`}
              >
                Solicitudes
              </button>
              <button
                onClick={() => {
                  setActiveTab('calendar');
                  navigate('/supervisor/delegacion/calendario');
                }}
                className={`text-gray-900 hover:text-gray-700 px-3 py-2 font-medium ${
                  activeTab === 'requests' ? 'text-purple-600' : ''
                }`}                              
              >
                Calendario
              </button>
              <button
                onClick={() => {
                  setActiveTab('reports');
                  navigate('/supervisor/delegacion/informes');
                }}
                className={`text-gray-900 hover:text-gray-700 px-3 py-2 font-medium ${
                  activeTab === 'reports' ? 'text-purple-600' : ''
                }`}  
              >
                Informes
              </button>
              <button
                onClick={() => {
                  setActiveTab('settings');
                  navigate('/supervisor/delegacion/ajustes');
                }}
                className={`text-gray-900 hover:text-gray-700 px-3 py-2 font-medium ${
                  activeTab === 'settings' ? 'text-purple-600' : ''
                }`}
              >
                Configuración
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleLogout}
                className="flex items-center text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors duration-200"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/empleados" element={<SupervisorDelegationEmployees />} />
        <Route path="/solicitudes" element={<SupervisorDelegationRequests />} />        
        <Route path="/calendario" element={<SupervisorDelegationCalendar />} />
        <Route path="/informes" element={<SupervisorDelegationReports />} />
      </Routes>
    </div>
  );
}
