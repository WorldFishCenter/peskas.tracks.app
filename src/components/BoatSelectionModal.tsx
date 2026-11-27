import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  SearchIcon,
  SearchXIcon,
  XIcon,
} from 'lucide-react';
import { getAllUsers, MongoUser } from '../api/authService';
import {
  fetchFleetTripActivity,
  FleetTripActivity,
  TRIP_ACTIVITY_DAYS,
} from '../api/pelagicDataService';
import { formatTripDate } from '../utils/formatters';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BoatSelectionModalProps {
  onSelect: (imei: string) => void;
  onClose: () => void;
}

type SortField = 'Boat' | 'IMEI' | 'captain' | 'vessel_type' | 'Community' | 'Region' | 'Country' | 'trips';
type SortDir = 'asc' | 'desc';

const BoatSelectionModal: React.FC<BoatSelectionModalProps> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();
  const [boats, setBoats] = useState<MongoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('Boat');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [tripActivity, setTripActivity] = useState<FleetTripActivity | null>(null);
  const [tripActivityFailed, setTripActivityFailed] = useState(false);

  // Trip counts take a few seconds for the whole fleet, so load alongside the vessel list.
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
          [b.Boat, b.IMEI, b.captain, b.vessel_type, b.Community, b.Region, b.Country].some((v) =>
            (v ?? '').toLowerCase().includes(q)
          )
        )
      : boats;

    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortField === 'trips') {
        const at = tripActivity?.[a.IMEI];
        const bt = tripActivity?.[b.IMEI];
        // Equal counts fall back to whichever vessel was at sea more recently.
        cmp =
          (at?.trips ?? 0) - (bt?.trips ?? 0) ||
          (Date.parse(at?.lastTripEnd ?? '') || 0) - (Date.parse(bt?.lastTripEnd ?? '') || 0);
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

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />;
    return sortDir === 'asc' ? (
      <ChevronUpIcon className="size-3.5" />
    ) : (
      <ChevronDownIcon className="size-3.5" />
    );
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('navigation.selectBoat')}</DialogTitle>
          <DialogDescription>
            Showing {filteredAndSorted.length} of {boats.length} vessels
            {tripActivity && ` · ${activeVesselCount} with trips in the last ${TRIP_ACTIVITY_DAYS} days`}
            {!tripActivity && !tripActivityFailed && ' · loading trip counts…'}
            {tripActivityFailed && ' · trip counts unavailable'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <InputGroup className="h-9">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Search vessels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={t('common.close')}
                    onClick={() => setSearch('')}
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow>
                    {columns.map(({ label, field }) => (
                      <TableHead
                        key={field}
                        className="min-w-28 cursor-pointer select-none"
                        onClick={() => handleSort(field)}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>{label}</span>
                          {renderSortIcon(field)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((boat) => (
                    <TableRow
                      key={boat.IMEI}
                      className="cursor-pointer"
                      onClick={() => onSelect(boat.IMEI)}
                    >
                      <TableCell className="font-medium">{boat.Boat || 'Unknown'}</TableCell>
                      <TableCell>
                        {tripActivity?.[boat.IMEI] ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {tripActivity[boat.IMEI].trips}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTripDate(tripActivity[boat.IMEI].lastTripEnd, t)}
                            </span>
                          </div>
                        ) : tripActivity ? (
                          <span className="text-muted-foreground">0</span>
                        ) : tripActivityFailed ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <Skeleton className="h-4 w-16" />
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{boat.IMEI}</code>
                      </TableCell>
                      <TableCell>{boat.captain || '-'}</TableCell>
                      <TableCell>{boat.vessel_type || '-'}</TableCell>
                      <TableCell>{boat.Community || '-'}</TableCell>
                      <TableCell>{boat.Region || '-'}</TableCell>
                      <TableCell>
                        {boat.Country ? (
                          <Badge variant="outline">{boat.Country}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredAndSorted.length === 0 && (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchXIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('common.noResults')}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BoatSelectionModal;
