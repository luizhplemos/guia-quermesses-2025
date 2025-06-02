import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const center = {
  lat: -23.420999,
  lng: -51.933055
};

const calendarId = '9f78ff2e81bd8d2a28ac890db6d792c653195d660c586c79efe528237375c282@group.calendar.google.com';
const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;

if (!apiKey) {
  throw new Error('API key do Google Calendar não definida. Verifique seu arquivo .env.');
}

export default function GuiaDeQuermesses() {
  const [selectedDate, setSelectedDate] = useState('');
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.warn('Usuário recusou geolocalização:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      const timeMin = new Date('2025-06-01').toISOString();
      const timeMax = new Date('2025-07-01').toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro na requisição: ${res.status}`);
        const data = await res.json();

        const geocode = async (address) => {
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const json = await response.json();
            if (json.length > 0) {
              return {
                lat: parseFloat(json[0].lat),
                lng: parseFloat(json[0].lon)
              };
            }
            return null;
          } catch (error) {
            console.error('Erro ao geocodificar endereço:', address, error);
            return null;
          }
        };

        const eventsWithCoords = await Promise.all(
          data.items.map(async (event) => {
            if (!event.location || !event.start?.date) {
              console.warn('Evento incompleto ignorado:', event);
              return null;
            }
            const coords = await geocode(event.location);
            if (!coords) return null;
            return {
              id: event.id,
              nome: event.summary,
              data: event.start.date,
              local: event.location,
              descricao: event.description,
              ...coords
            };
          })
        );

        const validEvents = eventsWithCoords.filter(e => e !== null);
        setEvents(validEvents);

        const uniqueDates = [...new Set(validEvents.map(e => e.data))].sort();
        setAvailableDates(uniqueDates);
      } catch (error) {
        console.error('Erro ao buscar eventos da agenda:', error);
      }
    };

    fetchEvents();
  }, []);

  const today = new Date();

  useEffect(() => {
    const filtered = events.filter(event => {
      const matchesDate = selectedDate ? event.data === selectedDate : true;
      const matchesSearch = event.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const eventDate = new Date(event.data);
      eventDate.setHours(0, 0, 0, 0);
      const isFutureOrToday = eventDate >= new Date(today.setHours(0, 0, 0, 0));
      return matchesDate && matchesSearch && isFutureOrToday;
    });

    const sorted = filtered.sort((a, b) => new Date(a.data) - new Date(b.data));
    setFilteredEvents(sorted);
  }, [selectedDate, events, searchTerm]);

  function MapaDinamico({ children }) {
    const map = useMap();
    useEffect(() => {
      if (selectedPosition) {
        map.setView(selectedPosition, 15);
      }
    }, [selectedPosition]);
    return children;
  }

  return (
    <div className="p-4 font-sans bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-center font-helvetica-condensed">Guia de Quermesses 2025 - Maringá e Região</h1>

      <div className="fixed top-4 right-4 z-50 bg-white border shadow-lg p-3 rounded-md w-64">
        <label className="block text-sm font-medium mb-2 font-montserrat">Todas as quermesses</label>
        <ul className="space-y-1 max-h-60 overflow-y-auto">
          <li>
            <button
              onClick={() => setSelectedDate('')}
              className={`w-full text-left px-2 py-1 rounded ${selectedDate === '' ? 'bg-yellow-300 font-semibold' : 'hover:bg-yellow-100'}`}
            >
              Mostrar todas
            </button>
          </li>
          {availableDates.map(date => {
            const isPast = new Date(date) < today;
            return (
              <li key={date}>
                <button
                  onClick={() => setSelectedDate(date)}
                  className={`w-full text-left px-2 py-1 rounded ${selectedDate === date ? 'bg-yellow-300 font-semibold' : ''} ${isPast ? 'text-gray-400' : 'text-black hover:bg-yellow-100'}`}
                >
                  {new Date(date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mt-20">
        <div className="w-full lg:w-3/4">
          <div className="rounded-lg shadow-md overflow-hidden">
            <MapContainer center={center} zoom={13} style={{ height: '500px', width: '100%' }} ref={mapRef}>
              <MapaDinamico>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredEvents.map(event => (
                  <Marker key={event.id} position={[event.lat, event.lng]}>
                    <Popup>
                      <strong>{event.nome}</strong><br />
                      {event.local}<br />
                      {event.descricao}<br />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.local)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        Ir com Google Maps
                      </a>
                    </Popup>
                  </Marker>
                ))}
                {userLocation && (
                  <Marker position={[userLocation.lat, userLocation.lng]}>
                    <Popup>📍 Você está aqui</Popup>
                  </Marker>
                )}
              </MapaDinamico>
            </MapContainer>
          </div>
        </div>

        <div className="w-full lg:w-1/4 max-h-[calc(100vh-150px)] overflow-y-auto pr-2">
          <input
            type="text"
            placeholder="Buscar festa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mb-4 font-montserrat"
          />

          <ul className="space-y-2">
            {filteredEvents.map(event => (
              <li key={event.id} className="p-2 border rounded-lg shadow bg-white">
                <strong className="font-helvetica-condensed block mb-1">{event.nome}</strong>
                <p className="text-sm text-gray-600 font-montserrat">{event.local}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setSelectedPosition([event.lat, event.lng]);
                    }}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm font-montserrat"
                  >
                    Ver no mapa
                  </button>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.local)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm font-montserrat"
                  >
                    Como chegar
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="mt-10 text-center">
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSdExemploFormulárioQuermesse/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-yellow-500 text-white font-bold py-2 px-4 rounded shadow hover:bg-yellow-600 font-montserrat"
        >
          ➕ Cadastre sua quermesse
        </a>
      </footer>
    </div>
  );
}
