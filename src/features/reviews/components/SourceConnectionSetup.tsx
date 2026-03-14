'use client'

import { useState, useTransition } from 'react'
import {
  searchPlacesForProperty,
  connectSource,
  disconnectSource,
} from '@/actions/review-sources'
import type { ReviewSourceConnection } from '@/types/hotelero'
import type { SearchPlaceResult } from '@/lib/serpapi/types'

// ─── i18n dict (Spanish primary; English equivalents in comments) ─────────────
const T = {
  tabGoogle: 'Google Maps',         // Google Maps
  tabTripadvisor: 'TripAdvisor',    // TripAdvisor
  connected: 'Conectado',           // Connected
  notConnected: 'Sin conectar',     // Not connected
  searchPlaceholder: 'Buscar tu hotel en',  // Search your hotel on
  searchBtn: 'Buscar',              // Search
  searching: 'Buscando…',          // Searching…
  disconnect: 'Desconectar',        // Disconnect
  disconnecting: 'Desconectando…', // Disconnecting…
  connect: 'Conectar',              // Connect
  connecting: 'Conectando…',       // Connecting…
  noResults: 'Sin resultados. Intenta con otro nombre.', // No results. Try another name.
  reviews: 'reseñas',              // reviews
  errorPrefix: 'Error:',           // Error:
} as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  propertyId: string
  connections: ReviewSourceConnection[]
}

// ─── Sub-component: single source tab ────────────────────────────────────────

interface SourceTabProps {
  propertyId: string
  source: 'google' | 'tripadvisor'
  connection: ReviewSourceConnection | null
  onConnectionChange: (conn: ReviewSourceConnection | null) => void
}

function SourceTab({ propertyId, source, connection, onConnectionChange }: SourceTabProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchPlaceResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [isPendingSearch, startSearch] = useTransition()
  const [isPendingConnect, startConnect] = useTransition()
  const [isPendingDisconnect, startDisconnect] = useTransition()

  const isPending = isPendingSearch || isPendingConnect || isPendingDisconnect

  const handleSearch = () => {
    if (!query.trim()) return
    setError(null)
    startSearch(async () => {
      try {
        const res = await searchPlacesForProperty(query.trim(), source)
        if (res.error) {
          setError(res.error)
          return
        }
        setResults(res.places ?? [])
        setSearched(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const handleConnect = (place: SearchPlaceResult) => {
    setError(null)
    startConnect(async () => {
      try {
        const res = await connectSource({
          propertyId,
          source,
          externalPlaceId: place.external_place_id,
          placeName: place.name,
          placeUrl: undefined,
        })
        if (res.error) {
          setError(res.error)
          return
        }
        // Optimistic update: build a synthetic connection
        const conn: ReviewSourceConnection = {
          id: '',
          property_id: propertyId,
          org_id: '',
          source,
          external_place_id: place.external_place_id,
          place_name: place.name,
          place_url: null,
          last_synced_at: null,
          last_sync_error: null,
          created_at: new Date().toISOString(),
        }
        onConnectionChange(conn)
        setResults([])
        setQuery('')
        setSearched(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const handleDisconnect = () => {
    setError(null)
    startDisconnect(async () => {
      try {
        const res = await disconnectSource(propertyId, source)
        if (res.error) {
          setError(res.error)
          return
        }
        onConnectionChange(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const sourceName = source === 'google' ? T.tabGoogle : T.tabTripadvisor

  return (
    <div className="space-y-4">
      {/* Connection status banner */}
      {connection ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-success-50 border border-success-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {T.connected}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {connection.place_name ?? connection.external_place_id}
            </p>
            <p className="text-xs text-foreground-muted">{sourceName}</p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-error-600 border border-error-200 rounded-lg hover:bg-error-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPendingDisconnect ? T.disconnecting : T.disconnect}
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-surface border border-border">
          <p className="text-xs text-foreground-muted">
            {T.notConnected} — {sourceName}
          </p>
        </div>
      )}

      {/* Search form (only shown when not connected) */}
      {!connection && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={`${T.searchPlaceholder} ${sourceName}…`}
              className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isPending}
              className="shrink-0 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPendingSearch ? T.searching : T.searchBtn}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-error-600">
              {T.errorPrefix} {error}
            </p>
          )}

          {/* Results */}
          {searched && results.length === 0 && !error && (
            <p className="text-xs text-foreground-muted">{T.noResults}</p>
          )}

          {results.length > 0 && (
            <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {results.map((place) => (
                <li
                  key={place.external_place_id}
                  className="flex items-center gap-3 p-3 bg-white hover:bg-surface transition-colors"
                >
                  {/* Thumbnail */}
                  {place.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={place.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                    <p className="text-xs text-foreground-muted truncate">{place.address}</p>
                    {place.rating !== null && (
                      <p className="text-xs text-foreground-secondary">
                        {place.rating.toFixed(1)} ★
                        {place.review_count !== null && (
                          <span> · {place.review_count.toLocaleString()} {T.reviews}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Connect button */}
                  <button
                    onClick={() => handleConnect(place)}
                    disabled={isPending}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPendingConnect ? T.connecting : T.connect}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SourceConnectionSetup({ propertyId, connections }: Props) {
  const [activeTab, setActiveTab] = useState<'google' | 'tripadvisor'>('google')

  const [googleConn, setGoogleConn] = useState<ReviewSourceConnection | null>(
    connections.find((c) => c.source === 'google') ?? null,
  )
  const [tripConn, setTripConn] = useState<ReviewSourceConnection | null>(
    connections.find((c) => c.source === 'tripadvisor') ?? null,
  )

  const tabs: Array<{ id: 'google' | 'tripadvisor'; label: string }> = [
    { id: 'google', label: T.tabGoogle },
    { id: 'tripadvisor', label: T.tabTripadvisor },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface p-1 rounded-xl border border-border w-full sm:w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-foreground shadow-sm'
                : 'text-foreground-secondary hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {activeTab === 'google' ? (
        <SourceTab
          propertyId={propertyId}
          source="google"
          connection={googleConn}
          onConnectionChange={setGoogleConn}
        />
      ) : (
        <SourceTab
          propertyId={propertyId}
          source="tripadvisor"
          connection={tripConn}
          onConnectionChange={setTripConn}
        />
      )}
    </div>
  )
}
