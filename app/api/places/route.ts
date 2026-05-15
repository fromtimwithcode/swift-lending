import { NextRequest, NextResponse } from "next/server";

type PlacePrediction = {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type AutocompleteSuggestion = {
  placePrediction?: PlacePrediction;
};

type AutocompleteResponse = {
  suggestions?: AutocompleteSuggestion[];
  error?: {
    message?: string;
    status?: string;
  };
};

function getGoogleErrorMessage(data: AutocompleteResponse | null, fallback: string) {
  if (!data?.error?.message) return fallback;
  return data.error.status ? `${data.error.status}: ${data.error.message}` : data.error.message;
}

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input");
  if (!input || input.trim().length < 3 || input.length > 200) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ predictions: [], error: "API key not configured" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const referer = request.headers.get("referer") ?? request.nextUrl.origin;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
        Referer: referer,
      },
      body: JSON.stringify({
        input: input.trim(),
        includedRegionCodes: ["us"],
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      }),
    });
    clearTimeout(timeout);

    const data = (await res.json().catch(() => null)) as AutocompleteResponse | null;

    if (!res.ok) {
      return NextResponse.json({
        predictions: [],
        error: getGoogleErrorMessage(data, "Places autocomplete request failed"),
      });
    }

    const predictions = (data?.suggestions ?? [])
      .map((suggestion) => {
        const prediction = suggestion.placePrediction;
        const description = prediction?.text?.text;
        const placeId = prediction?.placeId;

        if (!description || !placeId) return null;

        return {
          description,
          place_id: placeId,
          structured_formatting: {
            main_text: prediction.structuredFormat?.mainText?.text,
            secondary_text: prediction.structuredFormat?.secondaryText?.text,
          },
        };
      })
      .filter((prediction): prediction is NonNullable<typeof prediction> => prediction !== null);

    return NextResponse.json({ predictions });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ predictions: [] });
  }
}
