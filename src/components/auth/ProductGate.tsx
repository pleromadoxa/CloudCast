import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessProduct, hasProductEntitlement } from '../../lib/productEntitlements';
import { isPlatformProductEnabled } from '../../lib/platformProductServices';
import type { CloudCastProductId } from '../../types/products';
import { getProduct } from '../../config/products';
import { isProductionHostProduct } from '../../lib/productionHostProducts';
import { RegalCloudBootScreen } from '../system/RegalCloudBootScreen';

interface ProductGateProps {
  product: CloudCastProductId;
  children: React.ReactNode;
}

/**
 * Route gate for product dashboards.
 * Platform-disabled or preference-disabled products redirect to /hub;
 * missing entitlement goes to pricing.
 */
export function ProductGate({ product, children }: ProductGateProps) {
  const { user, profile, loading, platformServices } = useAuth();
  const productMeta = getProduct(product);
  // Touch platformServices so gate re-renders when admin toggles services.
  void platformServices;

  if (loading) {
    return <RegalCloudBootScreen productLabel={productMeta.name} />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: productMeta.dashboardPath }} />;
  }
  if (!canAccessProduct(profile, product)) {
    if (!isPlatformProductEnabled(product) || hasProductEntitlement(profile, product)) {
      return <Navigate to="/hub" replace />;
    }
    return <Navigate to={productMeta.pricingPath} replace />;
  }

  if (isProductionHostProduct(product)) {
    return null;
  }

  return children;
}
