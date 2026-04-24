import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input");
  if (!input || input.trim().length < 3 || input.length > 200) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ predictions: [], error: "API key not configured" });
  }

  const params = new URLSearchParams({
    input: input.trim(),
    types: "address",
    components: "country:us",
    key: apiKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ predictions: [] });
    }

    const data = await res.json();
    const predictions = (data.predictions ?? []).map(
      (p: { description: string; place_id: string; structured_formatting?: { main_text?: string; secondary_text?: string } }) => ({
        description: p.description,
        place_id: p.place_id,
        structured_formatting: p.structured_formatting,
      })
    );

    return NextResponse.json({ predictions });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ predictions: [] });
  }
}
