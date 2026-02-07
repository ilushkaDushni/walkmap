import { MapPinOff } from "lucide-react";
import RouteCard from "@/components/RouteCard";
import routes from "@/data/routes.json";

export default function RoutesPage() {
  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Маршруты</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Выберите маршрут и отправляйтесь на прогулку
        </p>
      </div>

      {routes.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--text-muted)]">
          <MapPinOff className="mb-4 h-16 w-16" strokeWidth={1} />
          <p>Маршруты пока не добавлены</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      )}
    </div>
  );
}
