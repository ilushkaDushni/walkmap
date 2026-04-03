import { NextResponse } from "next/server";

const OSRM_URL = "https://router.project-osrm.org/route/v1/foot";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromLat = searchParams.get("fromLat");
    const fromLng = searchParams.get("fromLng");
    const toLat = searchParams.get("toLat");
    const toLng = searchParams.get("toLng");

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return NextResponse.json(
        { error: "fromLat, fromLng, toLat, toLng обязательны" },
        { status: 400 }
      );
    }

    // OSRM формат: /foot/lng1,lat1;lng2,lat2
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&steps=false`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.error("OSRM error:", res.status);
      return fallbackResponse(fromLat, fromLng, toLat, toLng);
    }

    const data = await res.json();
    const route = data.routes?.[0];

    if (!route?.geometry?.coordinates?.length) {
      return fallbackResponse(fromLat, fromLng, toLat, toLng);
    }

    // OSRM возвращает GeoJSON [lng, lat] — конвертируем в наш формат
    const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));

    return NextResponse.json({
      fallback: false,
      path,
      distance: Math.round(route.distance), // метры
      duration: Math.round(route.duration), // секунды
    });
  } catch (err) {
    console.error("places/route-to error:", err);
    try {
      const { searchParams } = new URL(request.url);
      return fallbackResponse(
        searchParams.get("fromLat"),
        searchParams.get("fromLng"),
        searchParams.get("toLat"),
        searchParams.get("toLng")
      );
    } catch {
      return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
    }
  }
}

function fallbackResponse(fromLat, fromLng, toLat, toLng) {
  return NextResponse.json({
    fallback: true,
    path: [
      { lat: parseFloat(fromLat), lng: parseFloat(fromLng) },
      { lat: parseFloat(toLat), lng: parseFloat(toLng) },
    ],
    distance: null,
    duration: null,
  });
}
