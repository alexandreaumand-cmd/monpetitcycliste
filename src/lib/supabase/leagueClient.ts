"use client";

/**
 * Client Supabase "ligué" :
 * - SELECT sur tables sensibles => filtre .eq('league_id', leagueId)
 * - INSERT/UPDATE/UPSERT => attache { league_id: leagueId } au payload
 *
 * Tables concernées : auctions, bids, rosters, points_ledger, transfers (si existe)
 */

import { supabase as createRawClient } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";

const TABLES_REQUIRE_LEAGUE = new Set([
  "auctions",
  "bids",
  "rosters",
  "transfers",
  "bonus_points",
  "manager_bonus_points",
  "bonus_rider_selections",
]);

type AnyObj = Record<string, any>;
type Payload = AnyObj | AnyObj[];

function attachLeagueId<T extends Payload>(payload: T, leagueId: string): T {
  if (Array.isArray(payload)) {
    return payload.map((p) => ({ league_id: leagueId, ...p })) as T;
  }
  return ({ league_id: leagueId, ...payload }) as T;
}

function wrapQueryBuilder(table: string, qb: any, leagueId: string) {
  if (!TABLES_REQUIRE_LEAGUE.has(table)) return qb;

  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === "select") {
        return (...args: any[]) => {
          const next = target.select(...args);
          return typeof next.eq === "function" ? next.eq("league_id", leagueId) : next;
        };
      }
      if (prop === "insert") {
        return (payload: Payload, opts?: any) =>
          target.insert(attachLeagueId(payload, leagueId), opts);
      }
      if (prop === "update") {
        return (payload: Payload, opts?: any) =>
          target.update(attachLeagueId(payload, leagueId), opts);
      }
      if (prop === "upsert") {
        return (payload: Payload, opts?: any) =>
          target.upsert(attachLeagueId(payload, leagueId), opts);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  };

  return new Proxy(qb, handler);
}

/** À utiliser dans les fichiers "use client": hooks & components */
export function useLeagueClient() {
  const { leagueId } = useLeague();
  const raw = createRawClient;
  return new Proxy(raw, {
    get(target, prop: string, receiver) {
      if (prop === "from") {
        return (table: string) => {
          const qb = (target as any).from(table);
          return leagueId ? wrapQueryBuilder(table, qb, leagueId) : qb;
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Variante serveur/Edge : on fournit explicitement leagueId à la création du client */
export function createLeagueServiceClient(leagueId: string, baseClient: any) {
  return new Proxy(baseClient, {
    get(target, prop: string, receiver) {
      if (prop === "from") {
        return (table: string) => {
          const qb = (target as any).from(table);
          return wrapQueryBuilder(table, qb, leagueId);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
