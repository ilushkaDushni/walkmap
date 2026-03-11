import { getWeatherIcon, getWeatherTip } from "./helpers";

export default function WeatherWidget({ weather }) {
  if (!weather) return null;
  const { Icon, color, gradient } = getWeatherIcon(weather.code);
  const tip = getWeatherTip(weather.code, weather.temp);
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-gradient-to-r ${gradient} border border-[var(--border-color)] px-4 py-3`}>
      <Icon className={`h-9 w-9 ${color} shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[var(--text-primary)]">{Math.round(weather.temp)}°</span>
          <span className="text-sm text-[var(--text-secondary)] truncate">{tip}</span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">Ростов-на-Дону</div>
      </div>
    </div>
  );
}
