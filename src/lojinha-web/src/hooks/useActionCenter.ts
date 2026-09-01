import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { fairsApi, operationalListsApi, productsApi } from '../services/api';
import { formatUtcDate, isUtcDateTodayOrPast } from '../services/date';

export type ActionItemTone = 'urgent' | 'warn' | 'info';

export interface ActionItem {
  key: string;
  label: string;
  detail: string;
  to: string;
  tone: ActionItemTone;
}

/**
 * Agrega o que precisa de atenção da lojinha agora — feiras a iniciar, feiras em aberto,
 * rupturas de estoque e reposições pendentes. Usado no painel "Precisa de você" do Dashboard
 * e no sino de notificações do AppShell. Só roda para o perfil admin da loja.
 */
export function useActionCenter() {
  const { session } = useAuth();
  const enabled = session?.role !== 'Supplier' && session?.role !== 'Reseller';

  const { data: fairs = [] } = useQuery({ queryKey: ['fairs'], queryFn: fairsApi.getAll, enabled });
  const { data: catalogProducts = [] } = useQuery({ queryKey: ['products', 'all', 'product'], queryFn: () => productsApi.getAll({ isBudget: false }), enabled });
  const { data: restockItems = [] } = useQuery({ queryKey: ['operational-restock'], queryFn: operationalListsApi.getRestockItems, enabled });

  return useMemo<ActionItem[]>(() => {
    if (!enabled) {
      return [];
    }

    const items: ActionItem[] = [];

    fairs
      .filter((fair) => fair.status === 'Awaiting' && isUtcDateTodayOrPast(fair.eventDateUtc))
      .forEach((fair) => items.push({
        key: `fair-start-${fair.id}`,
        label: `Iniciar feira: ${fair.name}`,
        detail: `Evento em ${formatUtcDate(fair.eventDateUtc)} ainda aguardando início`,
        to: `/feiras/${fair.id}`,
        tone: 'urgent'
      }));

    const openFairs = fairs.filter((fair) => fair.status === 'Open');
    if (openFairs.length > 0) {
      items.push({
        key: 'fairs-open',
        label: `${openFairs.length} feira(s) em aberto`,
        detail: 'Lançar despesas, conferir cotas e finalizar quando terminar',
        to: '/feiras',
        tone: 'warn'
      });
    }

    const outOfStock = catalogProducts.filter((product) => product.currentStock === 0);
    if (outOfStock.length > 0) {
      items.push({
        key: 'stock-out',
        label: `${outOfStock.length} produto(s) sem estoque`,
        detail: outOfStock.slice(0, 3).map((product) => product.name).join(', ') + (outOfStock.length > 3 ? '…' : ''),
        to: '/estoque',
        tone: 'urgent'
      });
    }

    const openRestock = restockItems.filter((item) => item.status === 'Open' || item.status === 'InProgress');
    if (openRestock.length > 0) {
      items.push({
        key: 'restock-open',
        label: `${openRestock.length} item(ns) de reposição em aberto`,
        detail: 'Planeje a produção na fila de reposição',
        to: '/listas-operacionais',
        tone: 'info'
      });
    }

    return items;
  }, [catalogProducts, enabled, fairs, restockItems]);
}
