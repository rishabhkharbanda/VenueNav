import { Routes, Route } from "react-router-dom";
import { NavigationPage } from "@/pages/NavigationPage";

function Home() {
  return (
    <div className="app-screen home">
      <h1>VenueNav</h1>
      <p>Open a shared event link, or use:</p>
      <code className="block">/e/your-event/map-slug</code>
      <p>Dev shortcut with map id:</p>
      <code className="block">/m?mapId=UUID</code>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/e/:eventSlug/m/:mapSlug" element={<NavigationPage />} />
      <Route path="/m" element={<NavigationPage />} />
    </Routes>
  );
}
