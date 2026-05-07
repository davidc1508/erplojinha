import axios from 'axios';
import type { AxiosError } from 'axios';
import type {
  AuthResponse,
  CardFeeReprocessResult,
  CardFeeSettings,
  DashboardSummary,
  Fair,
  FairReport,
  FinanceReport,
  FinancialEntry,
  InventoryMovement,
  Product,
  ProductMetadata,
  ProductPriceHistoryEntry,
  ProductPricing,
  ProductCategory,
  PrinterProfile,
  Project,
  ProjectStep,
  ProjectStepAttempt,
  PersonalizedPricingTier,
  PersonalizedProject,
  Sale,
  Supplier,
  Supply,
  User,
  OperationalRestockItem,
  OperationalTodoItem
} from './types';

const resolveApiBaseUrl = () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL;

  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    if (hostname === 'app.alojinhasemnome.com.br') {
      return 'https://api.alojinhasemnome.com.br';
    }

    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      if (protocol === 'https:') {
        return `https://${hostname}`;
      }

      return `http://${hostname}:8080`;
    }
  }

  return 'http://localhost:8080';
};

const api = axios.create({
  baseURL: `${resolveApiBaseUrl()}/api`
});

const UNAUTHORIZED_EVENT = 'lojinha:unauthorized';

let unauthorizedRedirectInFlight = false;

function clearStoredSession() {
  localStorage.removeItem('lojinha-token');
  localStorage.removeItem('lojinha-session');
  localStorage.removeItem('lojinha-original-token');
  localStorage.removeItem('lojinha-original-session');
}

function notifyUnauthorized() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
    return;
  }

  window.location.reload();
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lojinha-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';
    const hasStoredSession = Boolean(localStorage.getItem('lojinha-token') || localStorage.getItem('lojinha-session'));
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (status === 401 && hasStoredSession && !isLoginRequest && !unauthorizedRedirectInFlight) {
      unauthorizedRedirectInFlight = true;
      clearStoredSession();
      notifyUnauthorized();
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export function subscribeToUnauthorized(handler: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },
  impersonate: async (userId: string) => {
    const { data } = await api.post<AuthResponse>('/auth/impersonate', { userId });
    return data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    await api.put('/auth/change-password', { currentPassword, newPassword });
  }
};

export const usersApi = {
  getAll: async () => {
    const { data } = await api.get<User[]>('/users');
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<User>('/users', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<User>(`/users/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/users/${id}`);
  }
};

export const suppliersApi = {
  getAll: async () => {
    const { data } = await api.get<Supplier[]>('/suppliers');
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get<Supplier>(`/suppliers/${id}`);
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<Supplier>('/suppliers', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<Supplier>(`/suppliers/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/suppliers/${id}`);
  }
};

export const dashboardApi = {
  getSummary: async () => {
    const { data } = await api.get<DashboardSummary>('/dashboard');
    return data;
  }
};

export const productsApi = {
  getAll: async (params?: { isBudget?: boolean; includeAllForSupplier?: boolean }) => {
    const { data } = await api.get<Product[]>('/products', { params });
    return data;
  },
  getSalesCatalog: async () => {
    const { data } = await api.get<Product[]>('/products', { params: { includeAllForSupplier: true } });
    return data;
  },
  getMetadata: async () => {
    const { data } = await api.get<ProductMetadata>('/products/metadata');
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },
  getPricing: async (id: string) => {
    const { data } = await api.get<ProductPricing>(`/products/${id}/pricing`);
    return data;
  },
  getPriceHistory: async (id: string) => {
    const { data } = await api.get<ProductPriceHistoryEntry[]>(`/products/${id}/price-history`);
    return data;
  },
  previewPricing: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<ProductPricing>('/products/pricing-preview', payload);
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<Product>('/products', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<Product>(`/products/${id}`, payload);
    return data;
  },
  convertToProduct: async (id: string) => {
    const { data } = await api.post<Product>(`/products/${id}/convert-to-product`);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/products/${id}`);
  }
};

export const categoriesApi = {
  getAll: async () => {
    const { data } = await api.get<ProductCategory[]>('/categories');
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<ProductCategory>('/categories', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<ProductCategory>(`/categories/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/categories/${id}`);
  }
};

export const printersApi = {
  getAll: async () => {
    const { data } = await api.get<PrinterProfile[]>('/printers');
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<PrinterProfile>('/printers', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<PrinterProfile>(`/printers/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/printers/${id}`);
  }
};

export const suppliesApi = {
  getAll: async () => {
    const { data } = await api.get<Supply[]>('/supplies');
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get<Supply>(`/supplies/${id}`);
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<Supply>('/supplies', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<Supply>(`/supplies/${id}`, payload);
    return data;
  }
};

export const salesApi = {
  getAll: async () => {
    const { data } = await api.get<Sale[]>('/sales');
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<Sale>('/sales', payload);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/sales/${id}`);
  }
};

export const cardFeeSettingsApi = {
  get: async () => {
    const { data } = await api.get<CardFeeSettings>('/card-fee-settings');
    return data;
  },
  update: async (payload: Record<string, unknown>) => {
    const { data } = await api.put<CardFeeSettings>('/card-fee-settings', payload);
    return data;
  },
  reprocessSales: async () => {
    const { data } = await api.post<CardFeeReprocessResult>('/card-fee-settings/reprocess-sales');
    return data;
  }
};

export const financeApi = {
  getEntries: async () => {
    const { data } = await api.get<FinancialEntry[]>('/finance/entries');
    return data;
  },
  getReport: async (year?: number) => {
    const { data } = await api.get<FinanceReport>('/finance/report', { params: year ? { year } : undefined });
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<FinancialEntry>('/finance/entries', payload);
    return data;
  }
};

export const inventoryApi = {
  getMovements: async () => {
    const { data } = await api.get<InventoryMovement[]>('/inventory/movements');
    return data;
  },
  createMovement: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<InventoryMovement>('/inventory/movements', payload);
    return data;
  }
};

export const operationalListsApi = {
  getRestockItems: async () => {
    const { data } = await api.get<OperationalRestockItem[]>('/operational-lists/restock');
    return data;
  },
  createRestockItem: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<OperationalRestockItem>('/operational-lists/restock', payload);
    return data;
  },
  updateRestockItem: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<OperationalRestockItem>(`/operational-lists/restock/${id}`, payload);
    return data;
  },
  removeRestockItem: async (id: string) => {
    await api.delete(`/operational-lists/restock/${id}`);
  },
  getTodoItems: async () => {
    const { data } = await api.get<OperationalTodoItem[]>('/operational-lists/todo');
    return data;
  },
  createTodoItem: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<OperationalTodoItem>('/operational-lists/todo', payload);
    return data;
  },
  updateTodoItem: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<OperationalTodoItem>(`/operational-lists/todo/${id}`, payload);
    return data;
  },
  removeTodoItem: async (id: string) => {
    await api.delete(`/operational-lists/todo/${id}`);
  }
};

export const fairsApi = {
  getAll: async () => {
    const { data } = await api.get<Fair[]>('/fairs');
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get<Fair>(`/fairs/${id}`);
    return data;
  },
  getReport: async (id: string) => {
    const { data } = await api.get<FairReport>(`/fairs/${id}/report`);
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<Fair>('/fairs', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<Fair>(`/fairs/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/fairs/${id}`);
  },
  finalize: async (id: string) => {
    const { data } = await api.post<Fair>(`/fairs/${id}/finalize`);
    return data;
  },
  start: async (id: string) => {
    const { data } = await api.post<Fair>(`/fairs/${id}/start`);
    return data;
  },
  reopen: async (id: string) => {
    const { data } = await api.post<Fair>(`/fairs/${id}/reopen`);
    return data;
  },
  cancel: async (id: string) => {
    const { data } = await api.post<Fair>(`/fairs/${id}/cancel`);
    return data;
  },
  registerSale: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.post<Sale>(`/fairs/${id}/sales`, payload);
    return data;
  },
  exportReport: async (id: string) => {
    const response = await api.get<Blob>(`/fairs/${id}/report/export`, { responseType: 'blob' });
    return response.data;
  }
};

export const projectsApi = {
  getAll: async () => {
    const { data } = await api.get<Project[]>('/projects');
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get<Project>(`/projects/${id}`);
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<Project>('/projects', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<Project>(`/projects/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/projects/${id}`);
  },
  addStep: async (projectId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post<ProjectStep>(`/projects/${projectId}/steps`, payload);
    return data;
  },
  updateStep: async (projectId: string, stepId: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<ProjectStep>(`/projects/${projectId}/steps/${stepId}`, payload);
    return data;
  },
  deleteStep: async (projectId: string, stepId: string) => {
    await api.delete(`/projects/${projectId}/steps/${stepId}`);
  },
  addAttempt: async (projectId: string, stepId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post<ProjectStepAttempt>(`/projects/${projectId}/steps/${stepId}/attempts`, payload);
    return data;
  },
  completeAttempt: async (projectId: string, stepId: string, attemptId: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<ProjectStepAttempt>(`/projects/${projectId}/steps/${stepId}/attempts/${attemptId}/complete`, payload);
    return data;
  },
  failAttempt: async (projectId: string, stepId: string, attemptId: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<ProjectStepAttempt>(`/projects/${projectId}/steps/${stepId}/attempts/${attemptId}/fail`, payload);
    return data;
  },
  conclude: async (id: string) => {
    const { data } = await api.put<Project>(`/projects/${id}/conclude`);
    return data;
  }
  ,
    completeStep: async (projectId: string, stepId: string, payload: Record<string, unknown>) => {
      const { data } = await api.put<ProjectStep>(`/projects/${projectId}/steps/${stepId}/complete`, payload);
      return data;
    },
    failStep: async (projectId: string, stepId: string, payload: Record<string, unknown>) => {
      const { data } = await api.put<ProjectStep>(`/projects/${projectId}/steps/${stepId}/fail`, payload);
      return data;
    }
};

export const personalizadosApi = {
  getPricing: async () => {
    const { data } = await api.get<PersonalizedPricingTier[]>('/personalizados/pricing');
    return data;
  },
  savePricing: async (payload: Record<string, unknown>[]) => {
    const { data } = await api.put<PersonalizedPricingTier[]>('/personalizados/pricing', payload);
    return data;
  },
  getAll: async () => {
    const { data } = await api.get<PersonalizedProject[]>('/personalizados');
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post<PersonalizedProject>('/personalizados', payload);
    return data;
  },
  updateBudget: async (projectId: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<PersonalizedProject>(`/personalizados/${projectId}/orcamento`, payload);
    return data;
  },
  advanceBudget: async (projectId: string) => {
    const { data } = await api.post<PersonalizedProject>(`/personalizados/${projectId}/orcamento/avancar`);
    return data;
  },
  rejectBudget: async (projectId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post<PersonalizedProject>(`/personalizados/${projectId}/orcamento/rejeitar`, payload);
    return data;
  },
  advanceModeling: async (projectId: string) => {
    const { data } = await api.post<PersonalizedProject>(`/personalizados/${projectId}/elaboracao/avancar`);
    return data;
  },
  approve: async (projectId: string) => {
    const { data } = await api.post<PersonalizedProject>(`/personalizados/${projectId}/aprovacao/aprovar`);
    return data;
  },
  configurePrintProduct: async (projectId: string, payload: Record<string, unknown>) => {
    const { data } = await api.put<PersonalizedProject>(`/personalizados/${projectId}/impressao/produto`, payload);
    return data;
  },
  completePrinting: async (projectId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post<PersonalizedProject>(`/personalizados/${projectId}/impressao/finalizar`, payload);
    return data;
  },
  completeFinishing: async (projectId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post<PersonalizedProject>(`/personalizados/${projectId}/acabamento/finalizar`, payload);
    return data;
  },
  finalize: async (projectId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post<PersonalizedProject>(`/personalizados/${projectId}/finalizar`, payload);
    return data;
  }
};