import { NextResponse } from "next/server";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// OSM-теги для категорий
const CATEGORY_TAGS = {
  food: [
    '["amenity"~"cafe|restaurant|fast_food|food_court|bar"]',
  ],
  pharmacy: [
    '["amenity"="pharmacy"]',
    '["shop"="chemist"]',
  ],
  toilet: [
    '["amenity"="toilets"]',
  ],
};

// Человекочитаемые названия категорий
const CATEGORY_LABELS = {
  cafe: "Кафе",
  restaurant: "Ресторан",
  fast_food: "Фастфуд",
  food_court: "Фудкорт",
  bar: "Бар",
  pharmacy: "Аптека",
  chemist: "Аптека",
  toilets: "Туалет",
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const category = searchParams.get("category") || "food";
    const radius = searchParams.get("radius") || "1000";

    if (!lat || !lng) {
      return NextResponse.json({ error: "lat и lng обязательны" }, { status: 400 });
    }

    // Валидация числовых параметров (защита от injection)
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = Math.min(Math.max(parseInt(radius, 10) || 1000, 100), 5000);

    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return NextResponse.json({ error: "Некорректные координаты" }, { status: 400 });
    }

    const tags = CATEGORY_TAGS[category] || CATEGORY_TAGS.food;

    // Строим Overpass QL запрос
    const queries = tags.map((tag) =>
      `node${tag}(around:${radiusNum},${latNum},${lngNum});`
    ).join("\n");

    const overpassQuery = `
      [out:json][timeout:10];
      (
        ${queries}
      );
      out body;
    `.trim();

    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!res.ok) {
      console.error("Overpass error:", res.status);
      return NextResponse.json({ error: "Ошибка Overpass API" }, { status: 502 });
    }

    const data = await res.json();
    const elements = data.elements || [];

    const places = elements
      .filter((el) => el.lat && el.lon && el.tags)
      .map((el) => {
        const tags = el.tags;
        const amenity = tags.amenity || tags.shop || "";
        return {
          id: String(el.id),
          name: tags.name || tags["name:ru"] || CATEGORY_LABELS[amenity] || "Без названия",
          lat: el.lat,
          lng: el.lon,
          rating: null, // OSM не хранит рейтинги
          reviewCount: 0,
          category: CATEGORY_LABELS[amenity] || category,
          address: formatAddress(tags),
          cuisine: tags.cuisine || null,
          openingHours: tags.opening_hours || null,
        };
      });

    return NextResponse.json({ places });
  } catch (err) {
    console.error("places/nearby error:", err);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}

function formatAddress(tags) {
  const parts = [];
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  return parts.join(", ");
}
