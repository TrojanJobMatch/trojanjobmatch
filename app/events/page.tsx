import { EventsExplorer } from "@/components/events/EventsExplorer";

export const metadata = { title: "Events for you | Trojan JobMatch" };

// Standalone, no-login demo of the events feature. Everything the student
// enters stays in their browser; nothing here touches a database.
export default function EventsPage() {
  return <EventsExplorer />;
}
