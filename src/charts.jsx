import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts';

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((p, i) => <div key={i}><i style={{ background: p.color }} />{p.name}<b>{p.value}{unit}</b></div>)}</div>;
}

/** 组织趋势面积图（Dashboard） */
export function TrendChart({ data, metric, name, unit }) {
  return (
    <div className="area-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="redArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4261a" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#d4261a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(30,26,21,.10)" strokeDasharray="0" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7b7266', fontSize: 11 }} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7b7266', fontSize: 11 }} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Area type="monotone" dataKey={metric} name={name} stroke="#d4261a" strokeWidth={2} fill="url(#redArea)" activeDot={{ r: 4, fill: '#d4261a', stroke: '#fffdf8', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 团队对比柱状图（Analytics） */
export function TeamBarChart({ data, dataKey, name }) {
  return (
    <div className="bar-chart-large">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 15, right: 5, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ececea" strokeDasharray="3 3" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#777772' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#999994' }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey={dataKey} name={name} radius={[5, 5, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => <Cell key={index} fill={index === 0 ? '#e62b1e' : '#deded9'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 积分类型分布环形图（Analytics） */
export function PointsPieChart({ data }) {
  return (
    <div className="distribution-chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={4} stroke="none">
            {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 团队近 6 个月工作量（TeamDetail） */
export function TeamWorkloadChart({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="teamAreaReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.25} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eee" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.3} fill="url(#teamAreaReal)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// 默认导出未使用；保留命名导出供 React.lazy 之外的直接引用。
export default { TrendChart, TeamBarChart, PointsPieChart, TeamWorkloadChart };
