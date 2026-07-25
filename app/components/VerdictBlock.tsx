export function VerdictBlock({ stats }: { stats: {totalPnl:number;benchmarkPnl:number;winRate:number;settled:number} }) {
  return (
    <div className="py-10">
      <div className={`text-7xl font-bold tabular-nums ${stats.totalPnl < 0 ? "text-red-500" : "text-green-500"}`}>
        {stats.totalPnl >= 0 ? "+" : ""}{(100 * stats.totalPnl / (1000 * Math.max(stats.settled,1))).toFixed(1)}%
      </div>
      <p className="mt-3 text-lg text-neutral-400">
        $1,000 into every call → ${(1000 * stats.settled + stats.totalPnl).toLocaleString()}.
        Holding ETH instead → ${(1000 * stats.settled + stats.benchmarkPnl).toLocaleString()}.
      </p>
      <p className="text-sm text-neutral-500 mt-1">{stats.settled} settled calls · {stats.winRate}% win rate</p>
    </div>);
}
