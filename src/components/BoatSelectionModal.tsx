import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllUsers, MongoUser } from '../api/authService';
import {
  fetchFleetTripActivity,
  FleetTripActivity,
  TRIP_ACTIVITY_DAYS
} from '../api/pelagicDataService';
import { formatTripDate } from '../utils/formatters';

interface BoatSelectionModalProps {
  onSelect: (imei: string) => void;
  onClose: () => void;
}

type SortField = 'Boat' | 'IMEI' | 'captain' | 'vessel_type' | 'Community' | 'Region' | 'Country' | 'trips';
type SortDir = 'asc' | 'desc';

const getCountryColor = (country: string | undefined): string => {
  const countryColors: Record<string, string> = {
    'Kenya': 'bg-success-subtle text-success',
    'Tanzania': 'bg-info-subtle text-info',
    'Mozambique': 'bg-warning-subtle text-warning',
    'Zanzibar': 'bg-primary-subtle text-primary',
    'Egypt': 'bg-danger-subtle text-danger',
    'Malawi': 'bg-secondary-subtle text-secondary',
  };
  return countryColors[country || ''] || 'bg-light-subtle text-muted';
};

const BoatSelectionModal: React.FC<BoatSelectionModalProps> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();
  const [boats, setBoats] = useState<MongoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('Boat');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [tripActivity, setTripActivity] = useState<FleetTripActivity | null>(null);
  const [tripActivityFailed, setTripActivityFailed] = useState(false);

  // Trip counts take a few seconds to come back for the whole fleet, so they
  // load alongside the vessel list and fill in when ready rather than holding
  // the table back.
  useEffect(() => {
    const loadTripActivity = async () => {
      try {
        setTripActivity(await fetchFleetTripActivity());
      } catch (err) {
        console.error('Error loading vessel trip counts:', err);
        setTripActivityFailed(true);
      }
    };
    loadTripActivity();
  }, []);

  useEffect(() => {
    const loadBoats = async () => {
      try {
        setLoading(true);
        const data = await getAllUsers();
        setBoats(data);
      } catch (err) {
        console.error('Error loading vessels:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBoats();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? boats.filter((b) =>
          [b.Boat, b.IMEI, b.captain, b.vessel_type, b.Community, b.Region, b.Country]
            .some((v) => (v ?? '').toLowerCase().includes(q))
        )
      : boats;

    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortField === 'trips') {
        const at = tripActivity?.[a.IMEI];
        const bt = tripActivity?.[b.IMEI];
        // Equal counts fall back to whichever vessel was at sea more recently.
        cmp = ((at?.trips ?? 0) - (bt?.trips ?? 0))
          || (Date.parse(at?.lastTripEnd ?? '') || 0) - (Date.parse(bt?.lastTripEnd ?? '') || 0);
      } else {
        const av = (a[sortField] ?? '').toLowerCase();
        const bv = (b[sortField] ?? '').toLowerCase();
        cmp = av < bv ? -1 : av > bv ? 1 : 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [boats, search, sortField, sortDir, tripActivity]);

  const activeVesselCount = useMemo(
    () => (tripActivity ? boats.filter((b) => tripActivity[b.IMEI]).length : 0),
    [boats, tripActivity]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Counts read most-first, text reads A to Z.
      setSortDir(field === 'trips' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <i className="ti ti-selector text-muted ms-1" />;
    return sortDir === 'asc'
      ? <i className="ti ti-chevron-up ms-1" />
      : <i className="ti ti-chevron-down ms-1" />;
  };

  const columns: { label: string; field: SortField }[] = [
    { label: 'Vessel Name', field: 'Boat' },
    { label: `Trips (${TRIP_ACTIVITY_DAYS} days)`, field: 'trips' },
    { label: 'IMEI', field: 'IMEI' },
    { label: 'Captain', field: 'captain' },
    { label: 'Vessel Type', field: 'vessel_type' },
    { label: 'Community', field: 'Community' },
    { label: 'Region', field: 'Region' },
    { label: 'Country', field: 'Country' },
  ];

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">{t('navigation.selectBoat')}</h3>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">{t('common.loading')}</span>
                </div>
              </div>
            ) : (
              <div>
                {/* Search Input */}
                <div className="mb-3">
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="ti ti-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search vessels..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                    />
                    {search && (
                      <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                        <i className="ti ti-x"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Results count */}
                <div className="mb-3">
                  <small className="text-muted">
                    Showing {filteredAndSorted.length} of {boats.length} vessels
                    {tripActivity && ` · ${activeVesselCount} with trips in the last ${TRIP_ACTIVITY_DAYS} days`}
                    {!tripActivity && !tripActivityFailed && ' · loading trip counts…'}
                    {tripActivityFailed && ' · trip counts unavailable'}
                  </small>
                </div>

                {/* Table */}
                <div className="table-responsive" style={{ maxHeight: '60vh' }}>
                  <table className="table table-hover table-striped">
                    <thead className="table-dark sticky-top">
                      <tr>
                        {columns.map(({ label, field }) => (
                          <th
                            key={field}
                            style={{ minWidth: '120px', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => handleSort(field)}
                          >
                            <div className="d-flex align-items-center justify-content-between">
                              <span>{label}</span>
                              <SortIcon field={field} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSorted.map((boat) => (
                        <tr
                          key={boat.IMEI}
                          style={{ cursor: 'pointer' }}
                          onClick={() => onSelect(boat.IMEI)}
                        >
                          <td>{boat.Boat || 'Unknown'}</td>
                          <td className="text-nowrap">
                            {tripActivity?.[boat.IMEI] ? (
                              <>
                                <span className="badge rounded-pill bg-success-subtle text-success">
                                  {tripActivity[boat.IMEI].trips}
                                </span>
                                <span className="small text-muted ms-2">
                                  {formatTripDate(tripActivity[boat.IMEI].lastTripEnd, t)}
                                </span>
                              </>
                            ) : tripActivity ? (
                              <span className="text-muted">0</span>
                            ) : tripActivityFailed ? (
                              <span className="text-muted">-</span>
                            ) : (
                              <span className="placeholder col-4" />
                            )}
                          </td>
                          <td><code className="text-muted small">{boat.IMEI}</code></td>
                          <td>{boat.captain || '-'}</td>
                          <td>{boat.vessel_type || '-'}</td>
                          <td>{boat.Community || '-'}</td>
                          <td>{boat.Region || '-'}</td>
                          <td>
                            {boat.Country ? (
                              <span className={`badge rounded-pill ${getCountryColor(boat.Country)}`}>
                                {boat.Country}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredAndSorted.length === 0 && (
                    <div className="text-center py-5">
                      <div className="text-muted">
                        <i className="ti ti-search-off fs-1"></i>
                        <p className="mt-2">{t('common.noResults')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoatSelectionModal;
