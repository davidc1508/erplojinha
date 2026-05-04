import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './hooks/useAuth';
import { CategoriesPage } from './pages/CategoriesPage';
import { CardFeeSettingsPage } from './pages/CardFeeSettingsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { FairDetailsPage } from './pages/FairDetailsPage';
import { FairFormPage } from './pages/FairFormPage';
import { FairsPage } from './pages/FairsPage';
import { FinanceEntryFormPage } from './pages/FinanceEntryFormPage';
import { FinancePage } from './pages/FinancePage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { OperationalListsPage } from './pages/OperationalListsPage';
import { PrintersPage } from './pages/PrintersPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SalesEntryFormPage } from './pages/SalesEntryFormPage';
import { SalesPage } from './pages/SalesPage';
import { SupplyFormPage } from './pages/SupplyFormPage';
import { SuppliesPage } from './pages/SuppliesPage';
import { SupplierDetailsPage } from './pages/SupplierDetailsPage';
import { SupplierFormPage } from './pages/SupplierFormPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { UserFormPage } from './pages/UserFormPage';
import { UsersPage } from './pages/UsersPage';

function ProtectedApp() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/produtos/novo" element={<ProductFormPage />} />
        <Route path="/produtos/:id/editar" element={<ProductFormPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/impressoras" element={<PrintersPage />} />
        <Route path="/insumos" element={<SuppliesPage />} />
        {!isSupplier ? <Route path="/insumos/novo" element={<SupplyFormPage />} /> : null}
        {!isSupplier ? <Route path="/insumos/:id/editar" element={<SupplyFormPage />} /> : null}
        <Route path="/estoque" element={<InventoryPage />} />
        <Route path="/vendas" element={<SalesPage />} />
        <Route path="/vendas/nova" element={<SalesEntryFormPage />} />
        <Route path="/feiras" element={<FairsPage />} />
        <Route path="/feiras/:id" element={<FairDetailsPage />} />
        {!isSupplier ? <Route path="/feiras/nova" element={<FairFormPage />} /> : null}
        {!isSupplier ? <Route path="/feiras/:id/editar" element={<FairFormPage />} /> : null}
        <Route path="/financeiro" element={<FinancePage />} />
        <Route path="/financeiro/novo" element={<FinanceEntryFormPage />} />
        <Route path="/listas-operacionais" element={<OperationalListsPage />} />
        <Route path="/projetos" element={<ProjectsPage />} />
        <Route path="/projetos/:id" element={<ProjectDetailPage />} />
        <Route path="/minha-conta/senha" element={<ChangePasswordPage />} />
        {!isSupplier ? <Route path="/configuracoes/taxas" element={<CardFeeSettingsPage />} /> : null}
        {!isSupplier ? <Route path="/usuarios" element={<UsersPage />} /> : null}
        {!isSupplier ? <Route path="/usuarios/novo" element={<UserFormPage />} /> : null}
        {!isSupplier ? <Route path="/usuarios/:id/editar" element={<UserFormPage />} /> : null}
        {!isSupplier ? <Route path="/fornecedores" element={<SuppliersPage />} /> : null}
        {!isSupplier ? <Route path="/fornecedores/:id" element={<SupplierDetailsPage />} /> : null}
        {!isSupplier ? <Route path="/fornecedores/novo" element={<SupplierFormPage />} /> : null}
        {!isSupplier ? <Route path="/fornecedores/:id/editar" element={<SupplierFormPage />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const { session } = useAuth();

  if (!session) {
    return <LoginPage />;
  }

  return <ProtectedApp />;
}