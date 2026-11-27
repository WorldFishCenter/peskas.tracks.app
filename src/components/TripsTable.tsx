import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  getPaginationRowModel,
  PaginationState,
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  MapIcon,
  Maximize2Icon,
  Minimize2Icon,
  RouteIcon,
} from 'lucide-react';
import { cn } from 'cn';
import { Trip } from '../types';
import {
  formatDateTimeWithTimezone,
  formatDurationFromSeconds,
  formatDistance,
} from '../utils/formatters';
import { anonymizeBoatName, anonymizeText } from '../utils/demoData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

interface TripsTableProps {
  trips: Trip[];
  onSelectTrip: (tripId: string) => void;
  loading?: boolean;
  selectedTripId?: string;
}

const TripsTable: React.FC<TripsTableProps> = ({
  trips,
  onSelectTrip,
  loading = false,
  selectedTripId,
}) => {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  const columnHelper = createColumnHelper<Trip>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: t('trips.tripId'),
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('boatName', {
        header: t('trips.vesselName'),
        cell: (info) => anonymizeBoatName(info.getValue() || 'Unknown'),
      }),
      columnHelper.accessor('community', {
        header: t('vessel.community'),
        cell: (info) => anonymizeText(info.getValue() || 'Unknown', 'Demo Community'),
      }),
      columnHelper.accessor('startTime', {
        header: t('trips.startTime'),
        cell: (info) =>
          formatDateTimeWithTimezone(new Date(info.getValue()), info.row.original.timezone),
        sortingFn: (rowA, rowB) =>
          new Date(rowA.original.startTime).getTime() -
          new Date(rowB.original.startTime).getTime(),
      }),
      columnHelper.accessor('endTime', {
        header: t('trips.endTime'),
        cell: (info) =>
          formatDateTimeWithTimezone(new Date(info.getValue()), info.row.original.timezone),
        sortingFn: (rowA, rowB) =>
          new Date(rowA.original.endTime).getTime() - new Date(rowB.original.endTime).getTime(),
      }),
      columnHelper.accessor('durationSeconds', {
        header: t('trips.duration'),
        cell: (info) => formatDurationFromSeconds(info.getValue()),
      }),
      columnHelper.accessor('distanceMeters', {
        header: t('trips.distance'),
        cell: (info) => formatDistance(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: t('trips.actions'),
        cell: (info) => {
          const isSelected = selectedTripId === info.row.original.id;
          return (
            <Button
              size="sm"
              variant={isSelected ? 'secondary' : 'default'}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTrip(info.row.original.id);
              }}
            >
              <MapIcon data-icon="inline-start" />
              {isSelected ? t('trips.viewing') : t('trips.view')}
            </Button>
          );
        },
      }),
    ],
    [columnHelper, onSelectTrip, selectedTripId, t]
  );

  const table = useReactTable({
    data: trips,
    columns,
    state: {
      sorting,
      ...(expanded ? {} : { pagination }),
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    ...(expanded ? {} : { getPaginationRowModel: getPaginationRowModel() }),
  });

  const getSortIcon = (isSorted: boolean | string) => {
    if (!isSorted) return <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />;
    if (isSorted === 'desc') return <ChevronDownIcon className="size-3.5" />;
    return <ChevronUpIcon className="size-3.5" />;
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
    if (!expanded) {
      setPagination({ pageIndex: 0, pageSize: trips.length });
    } else {
      setPagination({ pageIndex: 0, pageSize: 5 });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('common.fishingTrips')}</CardTitle>
          <CardAction>
            <Spinner className="text-primary" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyMedia>
                <Spinner className="size-6 text-primary" />
              </EmptyMedia>
              <EmptyTitle>{t('common.loadingFishingTripsData')}</EmptyTitle>
              <EmptyDescription>{t('common.pleaseWaitWhileWeRetrieveTrips')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  if (trips.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RouteIcon />
              </EmptyMedia>
              <EmptyTitle>{t('common.noTripsFound')}</EmptyTitle>
              <EmptyDescription>{t('common.noTripsMessage')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const pageIndex = table.getState().pagination?.pageIndex ?? 0;
  const pageSize = table.getState().pagination?.pageSize ?? 5;
  const pageCount = table.getPageCount();

  return (
    <Card size="sm">
      {/* Mobile: Collapsible */}
      <Collapsible open={mobileOpen} onOpenChange={setMobileOpen} className="md:hidden">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between px-3 py-1 text-left font-medium transition-colors',
                mobileOpen && 'text-primary'
              )}
            />
          }
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <RouteIcon className="size-4 text-primary" />
            {t('common.fishingTrips')}
            <Badge variant="secondary">{trips.length}</Badge>
          </span>
          {mobileOpen ? (
            <ChevronUpIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="flex flex-col gap-3 px-3 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {expanded
                  ? `${trips.length} ${t('trips.title').toLowerCase()} ${t('common.found')}`
                  : `${t('common.showing')} ${Math.min(5, trips.length)} ${t('common.of')} ${trips.length}`}
              </span>
              <Button variant="outline" size="sm" onClick={toggleExpanded}>
                {expanded ? (
                  <>
                    <Minimize2Icon data-icon="inline-start" />
                    {t('common.showLess')}
                  </>
                ) : (
                  <>
                    <Maximize2Icon data-icon="inline-start" />
                    {t('common.showAll')} ({trips.length})
                  </>
                )}
              </Button>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              {(expanded ? trips : trips.slice(0, 5)).map((trip) => {
                const isSelected = selectedTripId === trip.id;
                return (
                  <Card
                    key={trip.id}
                    size="sm"
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => onSelectTrip(trip.id)}
                  >
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate font-semibold">
                          {anonymizeBoatName(trip.boatName || 'Unknown')}
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? 'secondary' : 'default'}
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTrip(trip.id);
                          }}
                        >
                          <MapIcon data-icon="inline-start" />
                          {isSelected ? t('trips.viewing') : t('trips.view')}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <div className="font-medium text-foreground">
                            {t('vessel.community')}
                          </div>
                          <div>{anonymizeText(trip.community || 'Unknown', 'Demo Community')}</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{t('trips.duration')}</div>
                          <div>{formatDurationFromSeconds(trip.durationSeconds)}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {t('trips.startTime')} – {t('trips.endTime')}:{' '}
                        </span>
                        {formatDateTimeWithTimezone(new Date(trip.startTime), trip.timezone)} →{' '}
                        {formatDateTimeWithTimezone(new Date(trip.endTime), trip.timezone)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Desktop: Header */}
      <CardHeader className="hidden items-center md:grid">
        <CardTitle className="flex items-center gap-2 text-sm">
          <RouteIcon className="size-4 text-primary" />
          {t('common.fishingTrips')}
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleExpanded}
            title={expanded ? t('common.showLess') : t('common.showAll')}
          >
            {expanded ? (
              <>
                <Minimize2Icon data-icon="inline-start" />
                {t('common.showLess')}
              </>
            ) : (
              <>
                <Maximize2Icon data-icon="inline-start" />
                {t('common.showAll')} ({trips.length})
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {trips.length} {t('trips.title').toLowerCase()} {t('common.found')}
          </span>
        </CardAction>
      </CardHeader>

      {/* Desktop: Full Table */}
      <CardContent className="hidden px-0 lg:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(header.column.getCanSort() && 'cursor-pointer select-none')}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && getSortIcon(header.column.getIsSorted())}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={selectedTripId === row.original.id ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={() => onSelectTrip(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Tablet: Condensed Table */}
      <CardContent className="hidden px-0 md:block lg:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('trips.vesselName')}</TableHead>
              <TableHead>{t('vessel.community')}</TableHead>
              <TableHead className="text-center">{t('trips.duration')}</TableHead>
              <TableHead className="text-center">{t('trips.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const trip = row.original;
              const isSelected = selectedTripId === trip.id;
              return (
                <TableRow
                  key={trip.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => onSelectTrip(trip.id)}
                >
                  <TableCell>
                    <div className="font-medium">
                      {anonymizeBoatName(trip.boatName || 'Unknown')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTimeWithTimezone(new Date(trip.startTime), trip.timezone)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {anonymizeText(trip.community || 'Unknown', 'Demo Community')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {formatDurationFromSeconds(trip.durationSeconds)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant={isSelected ? 'secondary' : 'default'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrip(trip.id);
                      }}
                    >
                      <MapIcon data-icon="inline-start" />
                      {isSelected ? t('trips.viewing') : t('trips.view')}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {/* Desktop: Pagination */}
      {!expanded && trips.length > pageSize && (
        <CardFooter className="hidden flex-col items-center justify-between gap-2 sm:flex-row md:flex">
          <p className="text-xs text-muted-foreground">
            {t('common.showing')} {pageIndex * pageSize + 1} {t('common.to')}{' '}
            {Math.min((pageIndex + 1) * pageSize, trips.length)} {t('common.of')} {trips.length}{' '}
            {t('common.entries')}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              {t('common.previous')}
            </Button>

            {Array.from({ length: Math.min(3, pageCount) }, (_, i) => i).map((idx) => (
              <Button
                key={idx}
                variant={idx === pageIndex ? 'default' : 'outline'}
                size="sm"
                onClick={() => table.setPageIndex(idx)}
              >
                {idx + 1}
              </Button>
            ))}

            {pageCount > 3 && pageIndex < pageCount - 3 && (
              <span className="px-1.5 text-xs text-muted-foreground">…</span>
            )}

            {pageCount > 3 && (
              <Button
                variant={pageIndex === pageCount - 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => table.setPageIndex(pageCount - 1)}
              >
                {pageCount}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t('common.next')}
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default TripsTable;
