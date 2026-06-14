import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNetworkOptional } from '../../context/NetworkContext';
import { canAccessProduct } from '../../lib/productEntitlements';
import type { CloudCastProductId } from '../../types/products';
import { getProduct } from '../../config/products';
import { isProductionHostProduct } from '../../lib/productionHostProducts';
import { RegalCloudBootScreen } from '../system/RegalCloudBootScreen';

interface ProductGateProps {
  product: CloudCastProductId;
  children: React.ReactNode;
}

/** Redirect to product pricing when the signed-in user lacks access. */
export function ProductGate({ product, children }: ProductGateProps) {
  const { user, profile, loading } = useAuth();
  const { isOnline } = useNetworkOptional();
  const waitingForProfile = Boolean(user && !profile && isOnline);
  const productMeta = getProduct(product);

  if (loading || waitingForProfile) {
    return <RegalCloudBootScreen productLabel={productMeta.name} />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: productMeta.dashboardPath }} />;
  }
  if (!canAccessProduct(profile, product)) {
    return <Navigate to={productMeta.pricingPath} replace />;
  }

  if (isProductionHostProduct(product)) {
    return null;
  }

  return children;
}
