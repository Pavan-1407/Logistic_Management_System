import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from 'recharts';
import {
  Truck, Package, Users, MapPin, MessageCircle, Mail, Smartphone, PenTool,
  Camera, ChevronDown, ChevronUp, ArrowRight, AlertTriangle, DollarSign,
  Fuel, ClipboardList, ClipboardCheck, Bell, CheckCircle2, Container,
  TrendingUp, TrendingDown,
} from 'lucide-react';

// ---------- constants & seed data ----------

const HEADING_FONT = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

const STATUS_STYLES = {
  'Pending Assignment': { bg: 'bg-slate-100', text: 'text-slate-600' },
  'Assigned': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Dispatcher Approved': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'In Transit': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'At Warehouse': { bg: 'bg-amber-100', text: 'text-amber-800' },
  'POD Captured': { bg: 'bg-teal-100', text: 'text-teal-700' },
  'Completed': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const RESOURCE_STATUS_STYLES = {
  'Available': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'In Transit': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Overloaded': { bg: 'bg-rose-100', text: 'text-rose-700' },
  'Not Available': { bg: 'bg-slate-200', text: 'text-slate-600' },
};

// Financial rates (client-supplied, illustrative until real figures replace them)
const RATES = {
  driverPayPerHour: 30,
  standardRideHours: 8,
  fuelChargePerRide: 200,
  revenuePerRide: 2200,
};
const DRIVER_PAY_PER_RIDE = RATES.driverPayPerHour * RATES.standardRideHours; // $240

let uidCounter = 100;
function uid(prefix) {
  uidCounter += 1;
  return `${prefix}-${1000 + uidCounter}`;
}

function tripsInLast24h(workOrders, driverName) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let count = 0;
  workOrders.forEach((wo) => wo.legs.forEach((leg) => {
    if (leg.driver === driverName && leg.actualDeliveryDate && leg.actualDeliveryTime) {
      const completedAt = new Date(`${leg.actualDeliveryDate}T${leg.actualDeliveryTime}`).getTime();
      if (completedAt >= cutoff) count += 1;
    }
  }));
  return count;
}

function getWeekOfMonth(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}
function getMonthKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

function buildRideRows(workOrders) {
  const rows = [];
  workOrders.forEach((wo) => {
    wo.legs.forEach((leg) => {
      if (!leg.actualDeliveryDate) return;
      const revenue = leg.revenueAud ?? RATES.revenuePerRide;
      const fuelCharge = leg.fuelCost ?? RATES.fuelChargePerRide;
      const driverPay = leg.driverPay ?? DRIVER_PAY_PER_RIDE;
      const waitingHours = leg.waitingHours ?? 0;
      const waitingCharge = +(waitingHours * RATES.driverPayPerHour).toFixed(2);
      const netProfit = +(revenue - fuelCharge - driverPay - waitingCharge).toFixed(2);
      const netProfitPct = revenue ? +((netProfit / revenue) * 100).toFixed(1) : 0;
      rows.push({
        rideId: `${wo.id}${leg.sequence > 1 ? `-L${leg.sequence}` : ''}`,
        client: wo.client,
        truckNo: leg.primeMover, driver: leg.driver,
        rideFrom: leg.pickLocation, rideTo: leg.dropLocation,
        fuelCharge, driverPay, waitingHours, waitingCharge, revenue, netProfit, netProfitPct,
        actualDeliveryDate: leg.actualDeliveryDate,
        monthKey: getMonthKey(leg.actualDeliveryDate),
        week: getWeekOfMonth(leg.actualDeliveryDate),
      });
    });
  });
  return rows.sort((a, b) => (a.actualDeliveryDate < b.actualDeliveryDate ? 1 : -1));
}

function aggregateByTruck(rows) {
  const map = {};
  rows.forEach((r) => {
    const key = r.truckNo || 'Unknown';
    if (!map[key]) map[key] = { truckNo: key, trips: 0, revenue: 0, fuel: 0, driverPay: 0, waiting: 0, netProfit: 0 };
    map[key].trips += 1;
    map[key].revenue += r.revenue;
    map[key].fuel += r.fuelCharge;
    map[key].driverPay += r.driverPay;
    map[key].waiting += r.waitingCharge;
    map[key].netProfit += r.netProfit;
  });
  return Object.values(map).map((t) => ({ ...t, margin: t.revenue ? (t.netProfit / t.revenue) * 100 : 0 })).sort((a, b) => b.netProfit - a.netProfit);
}

function aggregateHours(entries, key) {
  const map = {};
  entries.forEach((e) => {
    const k = e[key] || 'Unknown';
    map[k] = (map[k] || 0) + e.hours;
  });
  return Object.entries(map).map(([name, hours]) => ({ name, count: +hours.toFixed(1) })).sort((a, b) => b.count - a.count);
}

const CLIENTS = ['Amazon', 'Ebay', 'Walmart'];
const CONSIGNMENT_TYPES = ['Small Parcel Delivery (SPD)', 'Full-Truckload (FTL)', 'Easy Ship Consignments'];
const LOCATIONS = ['Hyd', 'DELH', 'Bnglr', 'MUMB'];
const DRIVER_NAMES = ['Driver 18547', 'Driver 25487', 'Driver 75984', 'Driver 81364'];

const INITIAL_DRIVERS = [
  { id: 'DR1', name: 'Driver 18547', status: 'Available' },
  { id: 'DR2', name: 'Driver 25487', status: 'In Transit' },
  { id: 'DR3', name: 'Driver 75984', status: 'Overloaded' },
  { id: 'DR4', name: 'Driver 81364', status: 'Not Available' },
];
const INITIAL_PRIME_MOVERS = [
  { id: 'PM1', truckNo: 'PM21548', status: 'Available' },
  { id: 'PM2', truckNo: 'PM45958', status: 'In Transit' },
  { id: 'PM3', truckNo: 'PM26984', status: 'Available' },
  { id: 'PM4', truckNo: 'PM99648', status: 'Available' },
  { id: 'PM5', truckNo: 'PM88444', status: 'In Transit' },
];
const INITIAL_TRAILERS = [
  { id: 'TR1', regoNo: 'TR21548', status: 'Available' },
  { id: 'TR2', regoNo: 'TR45958', status: 'In Transit' },
  { id: 'TR3', regoNo: 'TR26984', status: 'Available' },
  { id: 'TR4', regoNo: 'TR99648', status: 'Available' },
  { id: 'TR5', regoNo: 'TR88444', status: 'In Transit' },
];

const SEED_WORK_ORDERS = [
  {
    id: 'WO-1001', client: 'Amazon', consignmentType: 'Small Parcel Delivery (SPD)',
    targetDeliveryDate: '2026-08-02', targetDeliveryTime: '10:00',
    reverseLogisticsPossible: false, status: 'Closed', createdAt: '2026-08-02T07:00:00',
    legs: [{
      id: 'LEG-1001', sequence: 1, loadNumber: 'T001147762',
      pickLocation: 'Hyd', dropLocation: 'DELH',
      primeMover: 'PM21548', trailer: 'TR21548', driver: 'Driver 18547',
      assignedAt: '2026-08-02T07:05:00', approvedAt: '2026-08-02T07:12:00',
      actualDeliveryDate: '2026-08-02', actualDeliveryTime: '09:40',
      legStatus: 'Completed', progress: 100,
      assignmentReasoning: 'Historical record.',
      pod: { challan: 'CH-8821', photo: true, signature: true }, fuelEfficiency: 3.1,
      revenueAud: 2200, fuelCost: 200, driverPay: 240, waitingHours: 1.0,
    }],
  },
  {
    id: 'WO-1002', client: 'Ebay', consignmentType: 'Full-Truckload (FTL)',
    targetDeliveryDate: '2026-08-09', targetDeliveryTime: '15:00',
    reverseLogisticsPossible: true, status: 'Closed', createdAt: '2026-08-09T11:00:00',
    legs: [{
      id: 'LEG-1002', sequence: 1, loadNumber: 'T001147901',
      pickLocation: 'DELH', dropLocation: 'Bnglr',
      primeMover: 'PM45958', trailer: 'TR45958', driver: 'Driver 25487',
      assignedAt: '2026-08-09T11:05:00', approvedAt: '2026-08-09T11:38:00',
      actualDeliveryDate: '2026-08-09', actualDeliveryTime: '16:10',
      legStatus: 'Completed', progress: 100,
      assignmentReasoning: 'Historical record.',
      pod: { challan: 'CH-9012', photo: true, signature: true }, fuelEfficiency: 2.9,
      revenueAud: 2200, fuelCost: 200, driverPay: 240, waitingHours: 2.5,
    }],
  },
  {
    id: 'WO-1003', client: 'Walmart', consignmentType: 'Easy Ship Consignments',
    targetDeliveryDate: '2026-08-13', targetDeliveryTime: '09:00',
    reverseLogisticsPossible: false, status: 'Closed', createdAt: '2026-08-13T06:00:00',
    legs: [{
      id: 'LEG-1003', sequence: 1, loadNumber: 'T001148055',
      pickLocation: 'Bnglr', dropLocation: 'MUMB',
      primeMover: 'PM26984', trailer: 'TR26984', driver: 'Driver 75984',
      assignedAt: '2026-08-13T06:05:00', approvedAt: '2026-08-13T06:11:00',
      actualDeliveryDate: '2026-08-13', actualDeliveryTime: '08:55',
      legStatus: 'Completed', progress: 100,
      assignmentReasoning: 'Historical record.',
      pod: { challan: 'CH-9210', photo: true, signature: true }, fuelEfficiency: 3.4,
      revenueAud: 2200, fuelCost: 200, driverPay: 240, waitingHours: 0.5,
    }],
  },
  {
    id: 'WO-1004', client: 'Amazon', consignmentType: 'Full-Truckload (FTL)',
    targetDeliveryDate: '2026-08-15', targetDeliveryTime: '13:00',
    reverseLogisticsPossible: false, status: 'Closed', createdAt: '2026-08-15T09:00:00',
    legs: [{
      id: 'LEG-1004', sequence: 1, loadNumber: 'T001148190',
      pickLocation: 'MUMB', dropLocation: 'Hyd',
      primeMover: 'PM99648', trailer: 'TR99648', driver: 'Driver 81364',
      assignedAt: '2026-08-15T09:05:00', approvedAt: '2026-08-15T09:47:00',
      actualDeliveryDate: '2026-08-15', actualDeliveryTime: '14:45',
      legStatus: 'Completed', progress: 100,
      assignmentReasoning: 'Historical record.',
      pod: { challan: 'CH-9355', photo: true, signature: true }, fuelEfficiency: 2.7,
      revenueAud: 2200, fuelCost: 200, driverPay: 240, waitingHours: 1.8,
    }],
  },
];

// ---------- shared components ----------

function SignaturePad({ onSave, label }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const start = (e) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };
  const end = () => { drawingRef.current = false; };

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  const confirm = () => {
    if (!hasSignature) return;
    onSave(canvasRef.current.toDataURL());
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">{label}</div>
      <canvas
        ref={canvasRef}
        width={320}
        height={100}
        className="border border-slate-300 rounded-lg bg-white touch-none w-full"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex gap-2">
        <button onClick={clear} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">Clear</button>
        <button onClick={confirm} disabled={!hasSignature} className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 text-white disabled:opacity-40">Confirm signature</button>
      </div>
    </div>
  );
}

function ManualAssignControl({ wo, leg, drivers, primeMovers, trailers, onManualAssign }) {
  const [driverId, setDriverId] = useState('');
  const [pmId, setPmId] = useState('');
  const [trailerId, setTrailerId] = useState('');
  const availableDrivers = drivers.filter((d) => d.status === 'Available');
  const availablePMs = primeMovers.filter((p) => p.status === 'Available');
  const availableTrailers = trailers.filter((t) => t.status === 'Available');

  return (
    <div className="w-full bg-rose-50 rounded-lg p-3 space-y-2">
      <div className="text-sm text-rose-800 flex items-center gap-1.5"><AlertTriangle size={14} /> Needs manual assignment</div>
      <div className="grid grid-cols-3 gap-2">
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-300">
          <option value="">Driver…</option>
          {availableDrivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={pmId} onChange={(e) => setPmId(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-300">
          <option value="">Prime mover…</option>
          {availablePMs.map((p) => <option key={p.id} value={p.id}>{p.truckNo}</option>)}
        </select>
        <select value={trailerId} onChange={(e) => setTrailerId(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-300">
          <option value="">Trailer…</option>
          {availableTrailers.map((t) => <option key={t.id} value={t.id}>{t.regoNo}</option>)}
        </select>
      </div>
      <button
        disabled={!driverId || !pmId || !trailerId}
        onClick={() => onManualAssign(wo.id, leg.id, { driverId, pmId, trailerId })}
        className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-40"
      >
        Confirm manual assignment
      </button>
    </div>
  );
}

function ReceiptsCapture({ wo, leg, onStartTrip }) {
  const [weightBridge, setWeightBridge] = useState(false);
  const [fuelReceipt, setFuelReceipt] = useState(false);
  return (
    <div className="w-full space-y-2 bg-slate-50 rounded-lg p-3">
      <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ClipboardList size={14} /> Pre-trip receipts</div>
      <button
        onClick={() => setWeightBridge(true)}
        className={`w-full px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1.5 ${weightBridge ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 text-rose-600'}`}
      >
        <Camera size={14} /> {weightBridge ? 'Weight bridge receipt captured' : 'Capture weight bridge receipt (mandatory)'}
      </button>
      <button
        onClick={() => setFuelReceipt(true)}
        className={`w-full px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1.5 ${fuelReceipt ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600'}`}
      >
        <Camera size={14} /> {fuelReceipt ? 'Fuel receipt captured' : 'Capture fuel receipt (optional)'}
      </button>
      <button
        disabled={!weightBridge}
        onClick={() => onStartTrip(wo.id, leg.id, { weightBridge, fuelReceipt })}
        className="w-full px-3 py-1.5 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        <Truck size={14} /> Start trip
      </button>
      {!weightBridge && <div className="text-xs text-rose-500">Weight bridge receipt is mandatory before the trip can start.</div>}
    </div>
  );
}

function BackendApprovalControl({ wo, leg, onBackendApprove }) {
  const initial = LOCATIONS.includes(leg.dropLocation) ? leg.dropLocation : '';
  const [actualDrop, setActualDrop] = useState(initial);
  return (
    <div className="w-full bg-emerald-50 rounded-lg p-3 space-y-2">
      <div className="text-sm text-emerald-800">Confirm actual drop location before closing</div>
      <select value={actualDrop} onChange={(e) => setActualDrop(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 w-full">
        <option value="" disabled>Select actual drop location</option>
        {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <button
        disabled={!actualDrop}
        onClick={() => onBackendApprove(wo.id, actualDrop)}
        className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-40 flex items-center gap-1.5"
      >
        <ClipboardCheck size={14} /> Approve & close work order
      </button>
    </div>
  );
}

function LegCard({ wo, leg, view, isLastLeg, drivers, primeMovers, trailers, onApprove, onStartTrip, onArrive, onSubmitPOD, onDecidePickup, onBackendApprove, onManualAssign }) {
  const [expanded, setExpanded] = useState(true);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [podForm, setPodForm] = useState({ challan: '', photo: false, signature: null });

  const style = STATUS_STYLES[leg.legStatus] || STATUS_STYLES['Pending Assignment'];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-400">{wo.id}{leg.sequence > 1 ? ` · leg ${leg.sequence}` : ''}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>{leg.legStatus}</span>
          </div>
          <div className="mt-1 font-medium text-slate-800">{wo.client} · {wo.consignmentType}</div>
          <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin size={14} /> {leg.pickLocation} <ArrowRight size={12} /> {leg.dropLocation}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-slate-400 shrink-0">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {expanded && (
        <div>
          <div className="border-t-2 border-dashed border-slate-200 mx-4" />

          <div className="px-4 py-3 grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-slate-400 text-xs">Driver</div><div className="font-medium">{leg.driver || '—'}</div></div>
            <div><div className="text-slate-400 text-xs">Prime mover</div><div className="font-mono">{leg.primeMover || '—'}</div></div>
            <div><div className="text-slate-400 text-xs">Trailer</div><div className="font-mono">{leg.trailer || '—'}</div></div>
          </div>

          {leg.assignmentReasoning && (
            <div className="mx-4 mb-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">{leg.assignmentReasoning}</div>
          )}

          {leg.legStatus === 'In Transit' && (
            <div className="mx-4 mb-3">
              <div className="text-xs text-slate-400 mb-1">En route</div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${leg.progress}%` }} />
              </div>
            </div>
          )}

          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {view === 'ops' && leg.legStatus === 'Pending Assignment' && (
              <ManualAssignControl wo={wo} leg={leg} drivers={drivers} primeMovers={primeMovers} trailers={trailers} onManualAssign={onManualAssign} />
            )}

            {view === 'ops' && leg.legStatus === 'Assigned' && !showSignaturePad && (
              <button onClick={() => setShowSignaturePad(true)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white flex items-center gap-1.5">
                <PenTool size={14} /> Review & approve
              </button>
            )}
            {view === 'ops' && showSignaturePad && (
              <div className="w-full">
                <SignaturePad label="Dispatcher signature" onSave={(sig) => { onApprove(wo.id, leg.id, sig); setShowSignaturePad(false); }} />
              </div>
            )}

            {view === 'ops' && leg.legStatus === 'POD Captured' && isLastLeg && wo.reverseLogisticsPossible && (
              <div className="w-full bg-indigo-50 rounded-lg p-3">
                <div className="text-sm text-indigo-800 mb-2">Business analyst: assign another pickup?</div>
                <div className="flex gap-2">
                  <button onClick={() => onDecidePickup(wo.id, true)} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white">Yes</button>
                  <button onClick={() => onDecidePickup(wo.id, false)} className="px-3 py-1.5 text-sm rounded-lg border border-indigo-300 text-indigo-700">No, complete trip</button>
                </div>
              </div>
            )}
            {view === 'ops' && leg.legStatus === 'POD Captured' && isLastLeg && !wo.reverseLogisticsPossible && (
              <button onClick={() => onDecidePickup(wo.id, false)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white">Complete trip</button>
            )}
            {view === 'ops' && isLastLeg && wo.status === 'Completed' && (
              <BackendApprovalControl wo={wo} leg={leg} onBackendApprove={onBackendApprove} />
            )}

            {view === 'driver' && leg.legStatus === 'Dispatcher Approved' && (
              <ReceiptsCapture wo={wo} leg={leg} onStartTrip={onStartTrip} />
            )}
            {view === 'driver' && leg.legStatus === 'In Transit' && (
              <button onClick={() => onArrive(wo.id, leg.id)} className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white flex items-center gap-1.5">
                <MapPin size={14} /> Mark arrived at warehouse
              </button>
            )}
            {view === 'driver' && leg.legStatus === 'At Warehouse' && (
              <div className="w-full space-y-2 bg-slate-50 rounded-lg p-3">
                <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ClipboardList size={14} /> Proof of delivery</div>
                <input
                  value={podForm.challan}
                  onChange={(e) => setPodForm({ ...podForm, challan: e.target.value })}
                  placeholder="Delivery challan number"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300"
                />
                <button
                  onClick={() => setPodForm({ ...podForm, photo: true })}
                  className={`px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1.5 ${podForm.photo ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600'}`}
                >
                  <Camera size={14} /> {podForm.photo ? 'Photo captured' : 'Capture photo (mock)'}
                </button>
                <SignaturePad label="Customer signature" onSave={(sig) => setPodForm({ ...podForm, signature: sig })} />
                <button
                  disabled={!podForm.challan || !podForm.photo || !podForm.signature}
                  onClick={() => onSubmitPOD(wo.id, leg.id, podForm)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-40"
                >
                  Submit proof of delivery
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DriverRosterPanel({ drivers, workOrders }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3">
      <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5"><Users size={14} /> Driver roster</div>
      <div className="space-y-2">
        {drivers.map((d) => {
          const s = RESOURCE_STATUS_STYLES[d.status] || RESOURCE_STATUS_STYLES['Available'];
          return (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{d.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{tripsInLast24h(workOrders, d.name)} trips / 24h</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{d.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssetRosterPanel({ title, icon, assets, labelKey }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3">
      <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">{icon} {title}</div>
      <div className="space-y-2">
        {assets.map((a) => {
          const s = RESOURCE_STATUS_STYLES[a.status] || RESOURCE_STATUS_STYLES['Available'];
          return (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 font-mono">{a[labelKey]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{a.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- tab views ----------

function CreateWorkOrderView({ onCreate, primeMovers, trailers }) {
  const [form, setForm] = useState({
    client: CLIENTS[0],
    consignmentType: CONSIGNMENT_TYPES[0],
    loadNumber: '',
    pickLocation: '',
    pickLocationCustom: '',
    dropLocation: '',
    dropLocationCustom: '',
    targetDeliveryDate: '',
    targetDeliveryTime: '',
    reverseLogisticsPossible: false,
    driverPreference: '',
    primeMoverPreference: '',
    trailerPreference: '',
  });

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const pickResolved = form.pickLocation === 'OTHER' ? form.pickLocationCustom : form.pickLocation;
  const dropResolved = form.dropLocation === 'OTHER' ? form.dropLocationCustom : form.dropLocation;
  const canSubmit = form.loadNumber && pickResolved && dropResolved && form.targetDeliveryDate && form.targetDeliveryTime;

  const selectedPM = primeMovers.find((p) => p.truckNo === form.primeMoverPreference);
  const selectedTrailer = trailers.find((t) => t.regoNo === form.trailerPreference);

  return (
    <div className="max-w-xl">
      <h2 className="text-lg mb-1" style={{ fontFamily: HEADING_FONT, fontWeight: 600 }}>Create work order</h2>
      <p className="text-sm text-slate-500 mb-4">Customer-facing intake — submitting this triggers the auto-assignment engine immediately.</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500">Client</label>
          <select value={form.client} onChange={(e) => update('client', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm">
            {CLIENTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Consignment type</label>
          <select value={form.consignmentType} onChange={(e) => update('consignmentType', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm">
            {CONSIGNMENT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Load number</label>
          <input value={form.loadNumber} onChange={(e) => update('loadNumber', e.target.value)} placeholder="e.g. T001147762" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Pick location</label>
            <select value={form.pickLocation} onChange={(e) => update('pickLocation', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm">
              <option value="" disabled>Select location</option>
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value="OTHER">Other (type manually)</option>
            </select>
            {form.pickLocation === 'OTHER' && (
              <input
                value={form.pickLocationCustom}
                onChange={(e) => update('pickLocationCustom', e.target.value)}
                placeholder="Enter pick location"
                className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            )}
          </div>
          <div>
            <label className="text-xs text-slate-500">Drop location</label>
            <select value={form.dropLocation} onChange={(e) => update('dropLocation', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm">
              <option value="" disabled>Select location</option>
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value="OTHER">Other (type manually)</option>
            </select>
            {form.dropLocation === 'OTHER' && (
              <input
                value={form.dropLocationCustom}
                onChange={(e) => update('dropLocationCustom', e.target.value)}
                placeholder="Enter drop location"
                className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Target delivery date</label>
            <input type="date" value={form.targetDeliveryDate} onChange={(e) => update('targetDeliveryDate', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Target delivery time</label>
            <input type="time" value={form.targetDeliveryTime} onChange={(e) => update('targetDeliveryTime', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Driver assignment (optional preference)</label>
          <select value={form.driverPreference} onChange={(e) => update('driverPreference', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm">
            <option value="">Auto-assign — system decides</option>
            {DRIVER_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Prime mover assignment (optional preference)</label>
          <select value={form.primeMoverPreference} onChange={(e) => update('primeMoverPreference', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm">
            <option value="">Auto-assign — system decides</option>
            {primeMovers.map((p) => <option key={p.id} value={p.truckNo}>{p.truckNo}</option>)}
          </select>
          {selectedPM && selectedPM.status === 'In Transit' && (
            <div className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {selectedPM.truckNo} is currently in transit and may not be available.</div>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-500">Trailer assignment (optional preference)</label>
          <select value={form.trailerPreference} onChange={(e) => update('trailerPreference', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm">
            <option value="">Auto-assign — system decides</option>
            {trailers.map((t) => <option key={t.id} value={t.regoNo}>{t.regoNo}</option>)}
          </select>
          {selectedTrailer && selectedTrailer.status === 'In Transit' && (
            <div className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {selectedTrailer.regoNo} is currently in transit and may not be available.</div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.reverseLogisticsPossible} onChange={(e) => update('reverseLogisticsPossible', e.target.checked)} />
          Possible to accommodate reverse logistics
        </label>
        <button
          disabled={!canSubmit}
          onClick={() => {
            onCreate({ ...form, pickLocation: pickResolved, dropLocation: dropResolved });
            setForm((prev) => ({
              ...prev, loadNumber: '', pickLocation: '', pickLocationCustom: '', dropLocation: '', dropLocationCustom: '',
              targetDeliveryDate: '', targetDeliveryTime: '', driverPreference: '', primeMoverPreference: '', trailerPreference: '',
            }));
          }}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-semibold disabled:opacity-40 disabled:hover:bg-amber-500 transition-colors"
        >
          Submit work order
        </button>
      </div>
    </div>
  );
}

function DispatchConsoleView({ workOrders, drivers, primeMovers, trailers, onApprove, onDecidePickup, onBackendApprove, onManualAssign }) {
  const active = workOrders.filter((wo) => wo.status !== 'Closed');
  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg" style={{ fontFamily: HEADING_FONT, fontWeight: 600 }}>Dispatch & approvals</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <DriverRosterPanel drivers={drivers} workOrders={workOrders} />
        <AssetRosterPanel title="Prime movers" icon={<Truck size={14} />} assets={primeMovers} labelKey="truckNo" />
        <AssetRosterPanel title="Trailers" icon={<Container size={14} />} assets={trailers} labelKey="regoNo" />
      </div>
      {active.length === 0 && (
        <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-2xl">
          <ClipboardList size={28} className="mx-auto mb-2 text-slate-300" />
          <div className="text-sm text-slate-400">No active work orders yet — create one to see the flow.</div>
        </div>
      )}
      {active.map((wo) => (
        <div key={wo.id} className="space-y-2">
          {wo.legs.map((leg, idx) => (
            <LegCard
              key={leg.id}
              wo={wo}
              leg={leg}
              view="ops"
              isLastLeg={idx === wo.legs.length - 1}
              drivers={drivers}
              primeMovers={primeMovers}
              trailers={trailers}
              onApprove={onApprove}
              onDecidePickup={onDecidePickup}
              onBackendApprove={onBackendApprove}
              onManualAssign={onManualAssign}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DriverAppView({ drivers, workOrders, onStartTrip, onArrive, onSubmitPOD }) {
  const [selectedDriver, setSelectedDriver] = useState(drivers[0]?.name);
  const myLegs = [];
  workOrders.forEach((wo) => wo.legs.forEach((leg) => {
    if (leg.driver === selectedDriver && ['Dispatcher Approved', 'In Transit', 'At Warehouse'].includes(leg.legStatus)) {
      myLegs.push({ wo, leg });
    }
  }));

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-slate-900 text-white rounded-t-2xl px-4 py-3 flex items-center gap-2">
        <Smartphone size={16} />
        <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} className="bg-slate-900 text-white text-sm outline-none">
          {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <div className="border border-t-0 border-slate-200 rounded-b-2xl p-3 space-y-3 bg-slate-50 min-h-[200px]">
        {myLegs.length === 0 && (
          <div className="text-center py-10">
            <Truck size={28} className="mx-auto mb-2 text-slate-300" />
            <div className="text-sm text-slate-400">No active jobs right now.</div>
          </div>
        )}
        {myLegs.map(({ wo, leg }) => (
          <LegCard key={leg.id} wo={wo} leg={leg} view="driver" onStartTrip={onStartTrip} onArrive={onArrive} onSubmitPOD={onSubmitPOD} />
        ))}
      </div>
    </div>
  );
}

function NotificationsView({ notifications }) {
  const iconFor = (channel) => (channel === 'WhatsApp' ? <MessageCircle size={14} /> : channel === 'SMS' ? <Smartphone size={14} /> : <Mail size={14} />);
  return (
    <div className="max-w-xl">
      <h2 className="text-lg flex items-center gap-2 mb-3" style={{ fontFamily: HEADING_FONT, fontWeight: 600 }}><Bell size={18} /> Notifications log</h2>
      <div className="space-y-2">
        {notifications.length === 0 && (
          <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-2xl">
            <Bell size={28} className="mx-auto mb-2 text-slate-300" />
            <div className="text-sm text-slate-400">No notifications sent yet.</div>
          </div>
        )}
        {notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <div className="mt-0.5 text-slate-400">{iconFor(n.channel)}</div>
            <div className="flex-1">
              <div className="text-slate-700">{n.message}</div>
              <div className="text-xs text-slate-400 mt-0.5">{n.channel} → {n.recipient} · {new Date(n.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STAT_ACCENTS = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', bar: 'bg-indigo-500' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', bar: 'bg-teal-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
};

function StatCard({ icon, label, value, accent = 'indigo' }) {
  const a = STAT_ACCENTS[accent] || STAT_ACCENTS.indigo;
  return (
    <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 right-0 h-1 ${a.bar}`} />
      <div className={`w-8 h-8 rounded-lg ${a.bg} ${a.text} flex items-center justify-center mb-2`}>{icon}</div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-slate-800 mt-0.5" style={{ fontFamily: HEADING_FONT }}>{value}</div>
    </div>
  );
}

function countBy(arr, keyFn) {
  const map = {};
  arr.forEach((item) => {
    const key = keyFn(item) || 'Unknown';
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function MiniBarList({ title, data, suffix = '' }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <div className="text-sm font-medium text-slate-700 mb-2">{title}</div>
      {data.length === 0 && <div className="text-xs text-slate-400">No data yet.</div>}
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.name}>
            <div className="flex justify-between text-xs text-slate-600 mb-0.5">
              <span>{d.name}</span><span>{d.count}{suffix}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiView({ workOrders, drivers, primeMovers }) {
  const rideRows = buildRideRows(workOrders);

  const driverUtil = Math.round((drivers.filter((d) => d.status === 'In Transit' || d.status === 'Overloaded').length / drivers.length) * 100);
  const truckUtil = Math.round((primeMovers.filter((p) => p.status === 'In Transit').length / primeMovers.length) * 100);

  const delayMinutes = (wo, leg) => {
    const target = new Date(`${wo.targetDeliveryDate}T${wo.targetDeliveryTime}`);
    const actual = new Date(`${leg.actualDeliveryDate}T${leg.actualDeliveryTime}`);
    return Math.round((actual - target) / 60000);
  };

  const delayData = workOrders.flatMap((wo) => wo.legs.filter((l) => l.actualDeliveryDate).map((l) => ({
    name: wo.id.replace('WO-', ''),
    delayMin: delayMinutes(wo, l),
  })));

  const completedLegs = workOrders.flatMap((wo) => wo.legs.filter((l) => l.actualDeliveryDate).map((l) => ({ ...l, client: wo.client })));
  const delayedPct = delayData.length ? Math.round((delayData.filter((d) => d.delayMin > 0).length / delayData.length) * 100) : 0;
  const avgFuel = completedLegs.length ? (completedLegs.reduce((s, l) => s + (l.fuelEfficiency || 0), 0) / completedLegs.length).toFixed(1) : '—';
  const totalRevenue = rideRows.reduce((s, r) => s + r.revenue, 0);

  const byTruck = countBy(completedLegs, (l) => l.primeMover);
  const byTrailer = countBy(completedLegs, (l) => l.trailer);
  const byDriver = countBy(completedLegs, (l) => l.driver);
  const byClient = countBy(completedLegs, (l) => l.client);

  const statusCounts = ['Created', 'In Progress', 'Completed', 'Closed'].map((s) => ({
    name: s, value: workOrders.filter((wo) => wo.status === s).length,
  })).filter((d) => d.value > 0);

  const PIE_COLORS = ['#94a3b8', '#f59e0b', '#6366f1', '#10b981'];

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-lg" style={{ fontFamily: HEADING_FONT, fontWeight: 600 }}>KPI dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<CheckCircle2 size={16} />} label="Trips completed" value={completedLegs.length} accent="indigo" />
        <StatCard icon={<Users size={16} />} label="Driver utilization" value={`${driverUtil}%`} accent="teal" />
        <StatCard icon={<Truck size={16} />} label="Truck utilization" value={`${truckUtil}%`} accent="blue" />
        <StatCard icon={<AlertTriangle size={16} />} label="Delayed deliveries" value={`${delayedPct}%`} accent="rose" />
        <StatCard icon={<DollarSign size={16} />} label="Revenue (completed rides)" value={`$${totalRevenue.toLocaleString()}`} accent="emerald" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <div className="text-sm font-medium text-slate-700 mb-2">Delivery time vs target (minutes)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={delayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="delayMin">
                {delayData.map((d, i) => <Cell key={i} fill={d.delayMin > 0 ? '#e11d48' : '#10b981'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-slate-400 mt-1">Negative = early/on-time, positive = minutes late</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <div className="text-sm font-medium text-slate-700 mb-2">Work order pipeline</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusCounts} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75}>
                {statusCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">Trips completed — breakdown</div>
        <div className="grid md:grid-cols-2 gap-4">
          <MiniBarList title="By truck (prime mover)" data={byTruck} />
          <MiniBarList title="By trailer" data={byTrailer} />
          <MiniBarList title="By driver" data={byDriver} />
          <MiniBarList title="By company" data={byClient} />
        </div>
      </div>
      <div className="text-xs text-slate-400 flex items-center gap-1.5">
        <Fuel size={13} /> Avg fuel efficiency (seeded/demo data): {avgFuel} km/L — accuracy will depend on whether the truck has telematics hardware once live.
      </div>
    </div>
  );
}

function money(n) {
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function FinanceView({ workOrders }) {
  const rideRows = buildRideRows(workOrders);
  const months = Array.from(new Set(rideRows.map((r) => r.monthKey))).sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState(months[0] || '');
  const activeMonth = months.includes(selectedMonth) ? selectedMonth : months[0];
  const monthRows = rideRows.filter((r) => r.monthKey === activeMonth);

  const weeklyTotals = [1, 2, 3, 4].map((w) => {
    const rows = monthRows.filter((r) => r.week === w);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const fuel = rows.reduce((s, r) => s + r.fuelCharge, 0);
    const driverPay = rows.reduce((s, r) => s + r.driverPay, 0);
    const waiting = rows.reduce((s, r) => s + r.waitingCharge, 0);
    const netProfit = revenue - fuel - driverPay - waiting;
    return { label: `Week ${w}`, trips: rows.length, revenue, fuel, driverPay, waiting, totalCost: fuel + driverPay + waiting, netProfit, margin: revenue ? (netProfit / revenue) * 100 : 0 };
  });
  const monthTotal = weeklyTotals.reduce((acc, w) => ({
    trips: acc.trips + w.trips, revenue: acc.revenue + w.revenue, fuel: acc.fuel + w.fuel,
    driverPay: acc.driverPay + w.driverPay, waiting: acc.waiting + w.waiting, netProfit: acc.netProfit + w.netProfit,
  }), { trips: 0, revenue: 0, fuel: 0, driverPay: 0, waiting: 0, netProfit: 0 });
  const monthMargin = monthTotal.revenue ? (monthTotal.netProfit / monthTotal.revenue) * 100 : 0;

  const truckRollup = aggregateByTruck(monthRows);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg" style={{ fontFamily: HEADING_FONT, fontWeight: 600 }}>Finance — PnL & ROI</h2>
        {months.length > 0 && (
          <select value={activeMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300">
            {months.map((m) => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
        )}
      </div>

      {months.length === 0 && (
        <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-2xl">
          <TrendingUp size={28} className="mx-auto mb-2 text-slate-300" />
          <div className="text-sm text-slate-400">No completed rides yet — financials appear once a POD is captured.</div>
        </div>
      )}

      {months.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<CheckCircle2 size={16} />} label={`Trips — ${formatMonthLabel(activeMonth)}`} value={monthTotal.trips} accent="indigo" />
            <StatCard icon={<DollarSign size={16} />} label="Revenue" value={money(monthTotal.revenue)} accent="emerald" />
            <StatCard icon={<TrendingDown size={16} />} label="Total costs" value={money(monthTotal.fuel + monthTotal.driverPay + monthTotal.waiting)} accent="rose" />
            <StatCard icon={<TrendingUp size={16} />} label="Net profit / margin" value={`${money(monthTotal.netProfit)} (${monthMargin.toFixed(1)}%)`} accent="teal" />
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Weekly P&amp;L — {formatMonthLabel(activeMonth)}</div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-3">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={weeklyTotals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalCost" name="Total cost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="netProfit" name="Net profit" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left font-medium px-3 py-2">Week</th>
                    <th className="text-right font-medium px-3 py-2">Trips</th>
                    <th className="text-right font-medium px-3 py-2">Revenue</th>
                    <th className="text-right font-medium px-3 py-2">Fuel</th>
                    <th className="text-right font-medium px-3 py-2">Driver pay</th>
                    <th className="text-right font-medium px-3 py-2">Waiting chg</th>
                    <th className="text-right font-medium px-3 py-2">Net profit</th>
                    <th className="text-right font-medium px-3 py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyTotals.map((w) => (
                    <tr key={w.label} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{w.label}</td>
                      <td className="px-3 py-2 text-right font-mono">{w.trips}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(w.revenue)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(w.fuel)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(w.driverPay)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(w.waiting)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${w.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(w.netProfit)}</td>
                      <td className="px-3 py-2 text-right font-mono">{w.trips ? `${w.margin.toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <td className="px-3 py-2 text-slate-800">Month total</td>
                    <td className="px-3 py-2 text-right font-mono">{monthTotal.trips}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(monthTotal.revenue)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(monthTotal.fuel)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(monthTotal.driverPay)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(monthTotal.waiting)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${monthTotal.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(monthTotal.netProfit)}</td>
                    <td className="px-3 py-2 text-right font-mono">{monthTotal.trips ? `${monthMargin.toFixed(1)}%` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Ride-level P&amp;L — {formatMonthLabel(activeMonth)}</div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthRows} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="rideId" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="netProfit" name="Net profit" radius={[4, 4, 0, 0]}>
                    {monthRows.map((r, i) => <Cell key={i} fill={r.netProfit >= 0 ? '#10b981' : '#e11d48'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="text-xs text-slate-400 mt-1">Net profit per ride — green is profitable, red would flag a loss-making ride</div>
            </div>
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left font-medium px-3 py-2">Ride</th>
                    <th className="text-left font-medium px-3 py-2">Truck</th>
                    <th className="text-left font-medium px-3 py-2">Driver</th>
                    <th className="text-left font-medium px-3 py-2">From</th>
                    <th className="text-left font-medium px-3 py-2">To</th>
                    <th className="text-right font-medium px-3 py-2">Fuel</th>
                    <th className="text-right font-medium px-3 py-2">Driver pay</th>
                    <th className="text-right font-medium px-3 py-2">Waiting chg</th>
                    <th className="text-right font-medium px-3 py-2">Revenue</th>
                    <th className="text-right font-medium px-3 py-2">Net profit</th>
                    <th className="text-right font-medium px-3 py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((r) => (
                    <tr key={r.rideId} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 font-mono text-slate-500">{r.rideId}</td>
                      <td className="px-3 py-2 font-mono">{r.truckNo || '—'}</td>
                      <td className="px-3 py-2">{r.driver || '—'}</td>
                      <td className="px-3 py-2">{r.rideFrom}</td>
                      <td className="px-3 py-2">{r.rideTo}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(r.fuelCharge)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(r.driverPay)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(r.waitingCharge)} <span className="text-slate-400">({r.waitingHours}h)</span></td>
                      <td className="px-3 py-2 text-right font-mono">{money(r.revenue)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${r.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(r.netProfit)}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.netProfitPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Truck-level rollup — {formatMonthLabel(activeMonth)}</div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-3">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={truckRollup}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="truckNo" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="netProfit" name="Net profit ($)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="margin" name="ROI margin (%)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left font-medium px-3 py-2">Truck</th>
                    <th className="text-right font-medium px-3 py-2">Trips</th>
                    <th className="text-right font-medium px-3 py-2">Revenue</th>
                    <th className="text-right font-medium px-3 py-2">Costs</th>
                    <th className="text-right font-medium px-3 py-2">Net profit</th>
                    <th className="text-right font-medium px-3 py-2">ROI (margin)</th>
                  </tr>
                </thead>
                <tbody>
                  {truckRollup.map((t) => (
                    <tr key={t.truckNo} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 font-mono">{t.truckNo}</td>
                      <td className="px-3 py-2 text-right font-mono">{t.trips}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(t.revenue)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(t.fuel + t.driverPay + t.waiting)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${t.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(t.netProfit)}</td>
                      <td className="px-3 py-2 text-right font-mono">{t.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Rates used: driver pay ${RATES.driverPayPerHour}/hr × {RATES.standardRideHours}hr standard ride = ${DRIVER_PAY_PER_RIDE}/ride · fuel ${RATES.fuelChargePerRide}/ride · revenue {money(RATES.revenuePerRide)}/ride · waiting hours charged at ${RATES.driverPayPerHour}/hr. ROI shown as profit margin (net profit ÷ revenue). These are illustrative rates — swap in real figures any time.
          </div>
        </>
      )}
    </div>
  );
}

function RiskBadge({ minutes }) {
  let cls = 'bg-emerald-100 text-emerald-700';
  let label = 'Low risk';
  if (minutes > 30) { cls = 'bg-rose-100 text-rose-700'; label = 'High risk'; }
  else if (minutes > 15) { cls = 'bg-amber-100 text-amber-700'; label = 'Moderate risk'; }
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function LeakageView({ workOrders }) {
  const delayEntries = [];
  workOrders.forEach((wo) => wo.legs.forEach((leg) => {
    if (!leg.actualDeliveryDate) return;
    const target = new Date(`${wo.targetDeliveryDate}T${wo.targetDeliveryTime}`);
    const actual = new Date(`${leg.actualDeliveryDate}T${leg.actualDeliveryTime}`);
    const minutes = Math.round((actual - target) / 60000);
    if (minutes > 0) delayEntries.push({ truckNo: leg.primeMover, driver: leg.driver, hours: minutes / 60 });
  }));
  const delayByTruck = aggregateHours(delayEntries, 'truckNo');
  const delayByDriver = aggregateHours(delayEntries, 'driver');

  const assignmentDelays = [];
  workOrders.forEach((wo) => wo.legs.forEach((leg) => {
    if (leg.assignedAt && leg.approvedAt) {
      const minutes = Math.round((new Date(leg.approvedAt) - new Date(leg.assignedAt)) / 60000);
      assignmentDelays.push({ id: `${wo.id}${leg.sequence > 1 ? `-L${leg.sequence}` : ''}`, client: wo.client, minutes });
    }
  }));
  const avgAssignDelay = assignmentDelays.length ? Math.round(assignmentDelays.reduce((s, d) => s + d.minutes, 0) / assignmentDelays.length) : 0;

  const [driverCount, setDriverCount] = useState(30);
  const [idleHoursPerWeek, setIdleHoursPerWeek] = useState(2);
  const [hourlyRate, setHourlyRate] = useState(30);
  const weeklyLossPerDriver = idleHoursPerWeek * hourlyRate;
  const monthlyLossPerDriver = weeklyLossPerDriver * 4;
  const yearlyLossPerDriver = monthlyLossPerDriver * 12;
  const totalYearlyLoss = yearlyLossPerDriver * driverCount;

  return (
    <div className="max-w-3xl space-y-8">
      <h2 className="text-lg" style={{ fontFamily: HEADING_FONT, fontWeight: 600 }}>Revenue leakage</h2>

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5"><Fuel size={14} /> Delayed hours (late deliveries only)</div>
        <div className="grid md:grid-cols-2 gap-4">
          <MiniBarList title="By truck" data={delayByTruck} suffix="h" />
          <MiniBarList title="By driver" data={delayByDriver} suffix="h" />
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">Driver assignment delay</div>
        <p className="text-xs text-slate-500 mb-3 max-w-2xl">
          Time between a job being created and the dispatcher approving the assignment. The longer this takes, the more likely a competitor accepts the load first — this is a direct contract-loss risk, not just an internal metric.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <StatCard icon={<AlertTriangle size={16} />} label="Avg. assignment delay" value={`${avgAssignDelay} min`} accent="rose" />
        </div>
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-left font-medium px-3 py-2">Ride</th>
                <th className="text-left font-medium px-3 py-2">Client</th>
                <th className="text-right font-medium px-3 py-2">Delay</th>
                <th className="text-right font-medium px-3 py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {assignmentDelays.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">No assignment-delay data yet.</td></tr>
              )}
              {assignmentDelays.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-mono text-slate-500">{d.id}</td>
                  <td className="px-3 py-2">{d.client}</td>
                  <td className="px-3 py-2 text-right font-mono">{d.minutes} min</td>
                  <td className="px-3 py-2 text-right"><RiskBadge minutes={d.minutes} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">Driver waiting-hours simulator</div>
        <p className="text-xs text-slate-500 mb-3 max-w-2xl">
          Once a driver drops a load they're idle until the next job — and still being paid. Adjust the inputs to model your actual fleet.
        </p>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-500">Number of drivers</label>
              <input type="number" min="0" value={driverCount} onChange={(e) => setDriverCount(Math.max(0, Number(e.target.value)))} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Idle hours / driver / week</label>
              <input type="number" min="0" step="0.5" value={idleHoursPerWeek} onChange={(e) => setIdleHoursPerWeek(Math.max(0, Number(e.target.value)))} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Hourly rate ($)</label>
              <input type="number" min="0" value={hourlyRate} onChange={(e) => setHourlyRate(Math.max(0, Number(e.target.value)))} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<DollarSign size={16} />} label="Loss / driver / week" value={money(weeklyLossPerDriver)} accent="rose" />
            <StatCard icon={<DollarSign size={16} />} label="Loss / driver / month" value={money(monthlyLossPerDriver)} accent="rose" />
            <StatCard icon={<DollarSign size={16} />} label="Loss / driver / year" value={money(yearlyLossPerDriver)} accent="rose" />
            <StatCard icon={<TrendingDown size={16} />} label="Total fleet loss / year" value={money(totalYearlyLoss)} accent="rose" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- root app ----------

export default function App() {
  const [workOrders, setWorkOrders] = useState(SEED_WORK_ORDERS);
  const [drivers, setDrivers] = useState(INITIAL_DRIVERS);
  const [primeMovers, setPrimeMovers] = useState(INITIAL_PRIME_MOVERS);
  const [trailers, setTrailers] = useState(INITIAL_TRAILERS);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('create');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=IBM+Plex+Mono:wght@500&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWorkOrders((prev) => prev.map((wo) => ({
        ...wo,
        legs: wo.legs.map((leg) => (leg.legStatus === 'In Transit' && leg.progress < 92
          ? { ...leg, progress: Math.min(92, leg.progress + 6) }
          : leg)),
      })));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  function pushNotification(channel, recipient, message) {
    setNotifications((prev) => [{ id: uid('N'), channel, recipient, message, timestamp: new Date().toISOString() }, ...prev]);
  }

  function markResourcesOnTrip({ driver, primeMover, trailer }) {
    if (driver) setDrivers((prev) => prev.map((d) => (d.id === driver.id ? { ...d, status: 'In Transit' } : d)));
    if (primeMover) setPrimeMovers((prev) => prev.map((p) => (p.id === primeMover.id ? { ...p, status: 'In Transit' } : p)));
    if (trailer) setTrailers((prev) => prev.map((t) => (t.id === trailer.id ? { ...t, status: 'In Transit' } : t)));
  }

  function releaseResources({ driverName, primeMoverNo, trailerNo }) {
    if (driverName) setDrivers((prev) => prev.map((d) => (d.name === driverName ? { ...d, status: 'Available' } : d)));
    if (primeMoverNo) setPrimeMovers((prev) => prev.map((p) => (p.truckNo === primeMoverNo ? { ...p, status: 'Available' } : p)));
    if (trailerNo) setTrailers((prev) => prev.map((t) => (t.regoNo === trailerNo ? { ...t, status: 'Available' } : t)));
  }

  function handleCreateWorkOrder(form) {
    let driver = null;
    if (form.driverPreference) {
      driver = drivers.find((d) => d.name === form.driverPreference && d.status === 'Available') || null;
    } else {
      driver = drivers.find((d) => d.status === 'Available') || null;
    }
    let primeMover = null;
    if (form.primeMoverPreference) {
      primeMover = primeMovers.find((p) => p.truckNo === form.primeMoverPreference && p.status === 'Available') || null;
    } else {
      primeMover = primeMovers.find((p) => p.status === 'Available') || null;
    }
    let trailer = null;
    if (form.trailerPreference) {
      trailer = trailers.find((t) => t.regoNo === form.trailerPreference && t.status === 'Available') || null;
    } else {
      trailer = trailers.find((t) => t.status === 'Available') || null;
    }

    const usedPreference = form.driverPreference || form.primeMoverPreference || form.trailerPreference;
    const parts = [];
    if (form.driverPreference) {
      parts.push(driver ? `requested driver ${driver.name} is available` : `requested driver ${form.driverPreference} is not available (status: ${drivers.find((d) => d.name === form.driverPreference)?.status || 'unknown'})`);
    }
    if (form.primeMoverPreference) {
      parts.push(primeMover ? `requested prime mover ${primeMover.truckNo} is available` : `requested prime mover ${form.primeMoverPreference} is not available (status: ${primeMovers.find((p) => p.truckNo === form.primeMoverPreference)?.status || 'unknown'})`);
    }
    if (form.trailerPreference) {
      parts.push(trailer ? `requested trailer ${trailer.regoNo} is available` : `requested trailer ${form.trailerPreference} is not available (status: ${trailers.find((t) => t.regoNo === form.trailerPreference)?.status || 'unknown'})`);
    }
    let assignmentReasoning;
    if (!usedPreference) {
      assignmentReasoning = (driver && primeMover && trailer)
        ? `Auto-assignment: selected ${driver.name}, prime mover ${primeMover.truckNo} and trailer ${trailer.regoNo} — nearest available match by current status.`
        : 'No available driver/prime mover/trailer — held pending assignment.';
    } else {
      assignmentReasoning = `${parts.join('; ')}.${(driver && primeMover && trailer) ? '' : ' Held pending manual assignment by ops.'}`;
    }

    const newLeg = {
      id: uid('LEG'),
      sequence: 1,
      loadNumber: form.loadNumber,
      pickLocation: form.pickLocation,
      dropLocation: form.dropLocation,
      primeMover: primeMover ? primeMover.truckNo : null,
      trailer: trailer ? trailer.regoNo : null,
      driver: driver ? driver.name : null,
      assignedAt: driver ? new Date().toISOString() : null,
      actualDeliveryDate: null,
      actualDeliveryTime: null,
      legStatus: (driver && primeMover && trailer) ? 'Assigned' : 'Pending Assignment',
      progress: 0,
      assignmentReasoning,
      pod: null,
      fuelEfficiency: null,
    };
    const woId = uid('WO');
    const newWO = {
      id: woId,
      client: form.client,
      consignmentType: form.consignmentType,
      targetDeliveryDate: form.targetDeliveryDate,
      targetDeliveryTime: form.targetDeliveryTime,
      reverseLogisticsPossible: form.reverseLogisticsPossible,
      status: newLeg.legStatus === 'Assigned' ? 'In Progress' : 'Created',
      createdAt: new Date().toISOString(),
      legs: [newLeg],
    };
    setWorkOrders((prev) => [newWO, ...prev]);
    markResourcesOnTrip({ driver, primeMover, trailer });
    pushNotification('WhatsApp', 'Driver', driver ? `New job ${woId} assigned — pickup at ${form.pickLocation}` : `Work order ${woId} created — awaiting available resources`);
    setActiveTab('dispatch');
  }

  function handleManualAssign(woId, legId, { driverId, pmId, trailerId }) {
    const driver = drivers.find((d) => d.id === driverId);
    const primeMover = primeMovers.find((p) => p.id === pmId);
    const trailer = trailers.find((t) => t.id === trailerId);
    if (!driver || !primeMover || !trailer) return;
    const wo = workOrders.find((w) => w.id === woId);
    const leg = wo?.legs.find((l) => l.id === legId);
    setWorkOrders((prev) => prev.map((w) => (w.id !== woId ? w : {
      ...w,
      status: w.status === 'Created' ? 'In Progress' : w.status,
      legs: w.legs.map((l) => (l.id !== legId ? l : {
        ...l,
        driver: driver.name,
        primeMover: primeMover.truckNo,
        trailer: trailer.regoNo,
        legStatus: 'Assigned',
        assignedAt: new Date().toISOString(),
        assignmentReasoning: `Manually assigned by ops/BA: ${driver.name}, ${primeMover.truckNo}, ${trailer.regoNo}.`,
      })),
    })));
    markResourcesOnTrip({ driver, primeMover, trailer });
    pushNotification('WhatsApp', 'Driver', `New job ${woId} manually assigned — pickup at ${leg?.pickLocation || 'assigned location'}`);
  }

  function handleApprove(woId, legId, signature) {
    let pickLoc = '';
    setWorkOrders((prev) => prev.map((wo) => {
      if (wo.id !== woId) return wo;
      return {
        ...wo,
        legs: wo.legs.map((leg) => {
          if (leg.id !== legId) return leg;
          pickLoc = leg.pickLocation;
          return { ...leg, legStatus: 'Dispatcher Approved', dispatcherSignature: signature, approvedAt: new Date().toISOString() };
        }),
      };
    }));
    pushNotification('SMS', 'Driver', `Job approved — proceed to pickup at ${pickLoc || 'assigned location'}`);
  }

  function handleStartTrip(woId, legId, receipts) {
    setWorkOrders((prev) => prev.map((wo) => (wo.id !== woId ? wo : {
      ...wo,
      legs: wo.legs.map((leg) => (leg.id !== legId ? leg : { ...leg, legStatus: 'In Transit', progress: 4, receipts })),
    })));
  }

  function handleArrive(woId, legId) {
    setWorkOrders((prev) => prev.map((wo) => (wo.id !== woId ? wo : {
      ...wo,
      legs: wo.legs.map((leg) => (leg.id !== legId ? leg : { ...leg, legStatus: 'At Warehouse', progress: 100 })),
    })));
  }

  function handleSubmitPOD(woId, legId, podForm) {
    const wo = workOrders.find((w) => w.id === woId);
    const leg = wo?.legs.find((l) => l.id === legId);
    const now = new Date();
    setWorkOrders((prev) => prev.map((w) => (w.id !== woId ? w : {
      ...w,
      legs: w.legs.map((l) => (l.id !== legId ? l : {
        ...l,
        legStatus: 'POD Captured',
        pod: podForm,
        actualDeliveryDate: now.toISOString().slice(0, 10),
        actualDeliveryTime: now.toTimeString().slice(0, 5),
        fuelEfficiency: +(2.6 + Math.random() * 1.0).toFixed(1),
        revenueAud: RATES.revenuePerRide,
        fuelCost: RATES.fuelChargePerRide,
        driverPay: DRIVER_PAY_PER_RIDE,
        waitingHours: +(Math.random() * 2.3 + 0.2).toFixed(1),
      })),
    })));
    releaseResources({ driverName: leg?.driver, primeMoverNo: leg?.primeMover, trailerNo: leg?.trailer });
    pushNotification('Email', 'Ops Manager', `POD captured for ${woId} — awaiting pickup decision`);
  }

  function handleDecidePickup(woId, yes) {
    if (!yes) {
      setWorkOrders((prev) => prev.map((wo) => {
        if (wo.id !== woId) return wo;
        const legs = wo.legs.map((l, idx) => (idx === wo.legs.length - 1 ? { ...l, legStatus: 'Completed' } : l));
        return { ...wo, legs, status: 'Completed' };
      }));
      return;
    }
    const wo = workOrders.find((w) => w.id === woId);
    const lastLeg = wo.legs[wo.legs.length - 1];
    const driver = drivers.find((d) => d.status === 'Available') || null;
    const primeMover = primeMovers.find((p) => p.status === 'Available') || null;
    const trailer = trailers.find((t) => t.status === 'Available') || null;
    const newLeg = {
      id: uid('LEG'),
      sequence: lastLeg.sequence + 1,
      loadNumber: `${lastLeg.loadNumber}-R${lastLeg.sequence + 1}`,
      pickLocation: lastLeg.dropLocation,
      dropLocation: lastLeg.pickLocation,
      primeMover: primeMover ? primeMover.truckNo : null,
      trailer: trailer ? trailer.regoNo : null,
      driver: driver ? driver.name : null,
      assignedAt: driver ? new Date().toISOString() : null,
      actualDeliveryDate: null,
      actualDeliveryTime: null,
      legStatus: (driver && primeMover && trailer) ? 'Assigned' : 'Pending Assignment',
      progress: 0,
      assignmentReasoning: driver
        ? `Return-leg auto-assignment — selected ${driver.name}, ${primeMover.truckNo}, ${trailer.regoNo} from currently available fleet.`
        : 'No available resources — held pending.',
      pod: null,
      fuelEfficiency: null,
    };
    setWorkOrders((prev) => prev.map((w) => (w.id !== woId ? w : {
      ...w,
      legs: [...w.legs.map((l, idx) => (idx === w.legs.length - 1 ? { ...l, legStatus: 'Completed' } : l)), newLeg],
      status: 'In Progress',
    })));
    markResourcesOnTrip({ driver, primeMover, trailer });
    pushNotification('WhatsApp', 'Driver', `New return-leg job assigned for ${woId}`);
  }

  function handleBackendApprove(woId, actualDropLocation) {
    setWorkOrders((prev) => prev.map((wo) => {
      if (wo.id !== woId) return wo;
      const legs = wo.legs.map((l, idx) => (idx === wo.legs.length - 1 && actualDropLocation ? { ...l, dropLocation: actualDropLocation } : l));
      return { ...wo, legs, status: 'Closed' };
    }));
    pushNotification('WhatsApp', 'Driver', `Work order ${woId} closed — thanks for the delivery`);
    pushNotification('SMS', 'Driver', `Work order ${woId} closed`);
    pushNotification('Email', 'Ops Manager', `Work order ${woId} closed and approved`);
  }

  const tabs = [
    { id: 'create', label: 'Create order', icon: <Package size={15} /> },
    { id: 'dispatch', label: 'Dispatch & approvals', icon: <ClipboardList size={15} /> },
    { id: 'driver', label: 'Driver app', icon: <Smartphone size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'kpi', label: 'KPI dashboard', icon: <DollarSign size={15} /> },
    { id: 'finance', label: 'Finance', icon: <TrendingUp size={15} /> },
    { id: 'leakage', label: 'Revenue leakage', icon: <TrendingDown size={15} /> },
  ];

  return (
    <div className="w-full min-h-[600px] bg-slate-50">
      <div className="bg-slate-900 text-white px-5 py-5 border-b-4 border-amber-500">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <Truck size={20} className="text-slate-900" />
            </div>
            <div>
              <div className="text-lg tracking-tight" style={{ fontFamily: HEADING_FONT, fontWeight: 600 }}>Apex Freight Logistics (Your Company name Here)</div>
              <div className="text-xs text-slate-300">Committed to being the most trusted name in logistics. (Your Caption here)</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live demo
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-3">Work order → auto-assignment → dispatch → driver → POD → KPIs → Finance</div>
      </div>
      <div className="flex gap-1 px-3 pt-2 border-b border-slate-200 bg-white overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === t.id ? 'border-amber-500 text-slate-900 font-medium' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div className="p-5">
        {activeTab === 'create' && <CreateWorkOrderView onCreate={handleCreateWorkOrder} primeMovers={primeMovers} trailers={trailers} />}
        {activeTab === 'dispatch' && (
          <DispatchConsoleView
            workOrders={workOrders}
            drivers={drivers}
            primeMovers={primeMovers}
            trailers={trailers}
            onApprove={handleApprove}
            onDecidePickup={handleDecidePickup}
            onBackendApprove={handleBackendApprove}
            onManualAssign={handleManualAssign}
          />
        )}
        {activeTab === 'driver' && (
          <DriverAppView drivers={drivers} workOrders={workOrders} onStartTrip={handleStartTrip} onArrive={handleArrive} onSubmitPOD={handleSubmitPOD} />
        )}
        {activeTab === 'notifications' && <NotificationsView notifications={notifications} />}
        {activeTab === 'kpi' && <KpiView workOrders={workOrders} drivers={drivers} primeMovers={primeMovers} />}
        {activeTab === 'finance' && <FinanceView workOrders={workOrders} />}
        {activeTab === 'leakage' && <LeakageView workOrders={workOrders} />}
      </div>
    </div>
  );
}
