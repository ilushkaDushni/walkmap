"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/UserProvider";
import DashboardSkeleton from "./home/DashboardSkeleton";
import GuestView from "./home/GuestView";
import AuthenticatedView from "./home/AuthenticatedView";

export default function HomePage() {
  const { user, loading, authFetch } = useUser();
  const [publicStats, setPublicStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [weather, setWeather] = useState(null);
  const [routeOfDay, setRouteOfDay] = useState(null);
  const [featuredRoutes, setFeaturedRoutes] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/public").then((r) => r.json()).catch(() => ({ totalRoutes: 0, totalDistanceM: 0, totalUsers: 0 })),
      fetch("https://api.open-meteo.com/v1/forecast?latitude=47.2357&longitude=39.7015&current=temperature_2m,weather_code&timezone=Europe/Moscow")
        .then((r) => r.json())
        .then((d) => ({ temp: d.current.temperature_2m, code: d.current.weather_code }))
        .catch(() => null),
      fetch("/api/routes/featured").then((r) => r.json()).catch(() => ({ routes: [], manual: false })),
    ]).then(([stats, w, featured]) => {
      setPublicStats(stats);
      setWeather(w);
      const allRoutes = Array.isArray(featured.routes) ? featured.routes : [];
      setFeaturedRoutes(allRoutes);
      if (featured.manual && featured.route) {
        setRouteOfDay(featured.route);
      } else if (allRoutes.length > 0) {
        const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        setRouteOfDay(allRoutes[day % allRoutes.length]);
      }
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { setDataLoading(false); return; }

    setDataLoading(true);
    Promise.all([
      authFetch("/api/stats/user").then((r) => r.json()).catch(() => ({ completedRoutes: 0, totalDistanceM: 0, coins: 0 })),
      fetch("/api/stats/leaderboard").then((r) => r.json()).catch(() => []),
    ]).then(([stats, lb]) => {
      setUserStats(stats);
      setLeaders(Array.isArray(lb) ? lb : []);
    }).finally(() => setDataLoading(false));
  }, [user, loading]);

  if (loading || !publicStats || (user && dataLoading)) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <GuestView publicStats={publicStats} weather={weather} routeOfDay={routeOfDay} featuredRoutes={featuredRoutes} />;
  }

  return (
    <AuthenticatedView
      user={user}
      userStats={userStats || { completedRoutes: 0, totalDistanceM: 0, coins: 0, commentsCount: 0, hasNightCompletion: false, achievements: [] }}
      publicStats={publicStats}
      weather={weather}
      routeOfDay={routeOfDay}
      leaders={leaders}
      featuredRoutes={featuredRoutes}
    />
  );
}
