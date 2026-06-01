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
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { PersonalizadosPage } from './pages/PersonalizadosPage';
import { SalesEntryFormPage } from './pages/SalesEntryFormPage';
import { SaleDetailsPage } from './pages/SaleDetailsPage';
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
  const isReseller = session?.role === 'Reseller';

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/produtos/:id" element={<ProductDetailsPage />} />
        {!isReseller ? <Route path="/produtos/novo" element={<ProductFormPage />} /> : null}
        {!isReseller ? <Route path="/produtos/:id/editar" element={<ProductFormPage />} /> : null}
        {!isReseller ? <Route path="/orcamentos" element={<ProductsPage />} /> : null}
        {!isReseller ? <Route path="/orcamentos/novo" element={<ProductFormPage />} /> : null}
        {!isReseller ? <Route path="/orcamentos/:id/editar" element={<ProductFormPage />} /> : null}
        {!isReseller ? <Route path="/categorias" element={<CategoriesPage />} /> : null}
        {!isReseller ? <Route path="/impressoras" element={<PrintersPage />} /> : null}
        {!isReseller ? <Route path="/insumos" element={<SuppliesPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/insumos/novo" element={<SupplyFormPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/insumos/:id/editar" element={<SupplyFormPage />} /> : null}
        {!isReseller ? <Route path="/estoque" element={<InventoryPage />} /> : null}
        <Route path="/vendas" element={<SalesPage />} />
        <Route path="/vendas/nova" element={<SalesEntryFormPage />} />
        <Route path="/vendas/:id" element={<SaleDetailsPage />} />
        {!isReseller ? <Route path="/feiras" element={<FairsPage />} /> : null}
        {!isReseller ? <Route path="/feiras/:id" element={<FairDetailsPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/feiras/nova" element={<FairFormPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/feiras/:id/editar" element={<FairFormPage />} /> : null}
        <Route path="/financeiro" element={<FinancePage />} />
        <Route path="/financeiro/novo" element={<FinanceEntryFormPage />} />
        {!isReseller ? <Route path="/listas-operacionais" element={<OperationalListsPage />} /> : null}
        {!isReseller ? <Route path="/projetos" element={<ProjectsPage />} /> : null}
        {!isReseller ? <Route path="/projetos/:id" element={<ProjectDetailPage />} /> : null}
        {!isReseller ? <Route path="/personalizados" element={<PersonalizadosPage />} /> : null}
        <Route path="/minha-conta/senha" element={<ChangePasswordPage />} />
        {!isSupplier && !isReseller ? <Route path="/configuracoes/taxas" element={<CardFeeSettingsPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/usuarios" element={<UsersPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/usuarios/novo" element={<UserFormPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/usuarios/:id/editar" element={<UserFormPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/fornecedores" element={<SuppliersPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/fornecedores/:id" element={<SupplierDetailsPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/fornecedores/novo" element={<SupplierFormPage />} /> : null}
        {!isSupplier && !isReseller ? <Route path="/fornecedores/:id/editar" element={<SupplierFormPage />} /> : null}
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