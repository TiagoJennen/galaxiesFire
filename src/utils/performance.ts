// Een Timer bevat alleen het moment waarop de timer gestart is.
// Dit gebruiken we later om de totale duur te berekenen.
type Timer = {
  start: number;
};

// Haalt de huidige tijd op voor nauwkeurige metingen.
// In een browser gebruiken we performance.now() omdat die preciezer is.
// Als dat niet beschikbaar is (bijv. in sommige omgevingen), dan gebruiken we Date.now().
const now = () => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now(); // hoge precisie, ideaal voor performancemetingen
  }
  return Date.now(); // terugvaloptie, minder precies maar altijd beschikbaar
};

// Start een nieuwe timer door het huidige tijdstip op te slaan.
export const startTimer = (): Timer => ({ start: now() });

// Stopt de timer en berekent hoe lang een taak geduurd heeft.
// De duur wordt in milliseconden gelogd met een label om te herkennen welke meting het was.
export const endTimer = (label: string, timer: Timer) => {
  const duration = now() - timer.start; // verschil tussen start en eindtijd
  console.log(`[perf] ${label}: ${duration.toFixed(1)}ms`); // log het resultaat netjes in de console
};

// Meet automatisch de tijd die een asynchrone functie (task) nodig heeft.
// - Start een timer
// - Voert de async taak uit
// - Stopt de timer wanneer de taak klaar is (ook bij errors)
// Dit maakt het meten van async code super makkelijk.
export const measureAsync = async <T>(
  label: string,
  task: () => Promise<T>
): Promise<T> => {
  const marker = startTimer(); // timer starten
  try {
    return await task(); // wacht tot de async taak klaar is
  } finally {
    endTimer(label, marker); // altijd meten, zelfs als er een error is
  }
};
