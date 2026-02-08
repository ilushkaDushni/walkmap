"use client";

import { useUser } from "@/components/UserProvider";
import RouteCard from "@/components/RouteCard";

export default function RoutesListClient({ routes }) {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  return (
    <div className="grid gap-4">
      {routes.map((route) => (
        <RouteCard key={route._id} route={route} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
