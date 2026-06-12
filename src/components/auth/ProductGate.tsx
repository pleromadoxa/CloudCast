import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessProduct } from '../../lib/productEntitlements';
import type { CloudCastProductId } from '../../types/products';
import { getProduct } from '../../config/products';

interface ProductGateProps {
  product: CloudCastProductId;
  children: React.ReactNode;
}

/** Redirect to product pricing when the signed-in user lacks access. */
export function ProductGate({ product, children }: ProductGateProps) {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace state={{ from: getProduct(product).dashboardPath }} />;
  if (!canAccessProduct(profile, product)) {
    return <Navigate to={getProduct(product).pricingPath} replace />;
  }

  return children;
}
