import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Business,
  BusinessWithChildren,
  getBusinesses,
  getBusinessesTree,
  switchBusiness as apiSwitchBusiness,
  createBusiness as apiCreateBusiness,
  BusinessCreate,
} from '../lib/api';
import { useAuth } from './AuthContext';

interface BusinessContextType {
  // Current business context
  currentBusiness: Business | null;
  isOrgWide: boolean; // true when viewing all businesses

  // All businesses
  businesses: Business[];
  businessTree: BusinessWithChildren[];

  // Loading states
  isLoading: boolean;

  // Actions
  switchBusiness: (businessId: number | null) => Promise<void>;
  createBusiness: (business: BusinessCreate) => Promise<Business>;
  refreshBusinesses: () => Promise<void>;

  // Helpers
  getBusinessById: (id: number) => Business | undefined;
  getBusinessPath: (id: number) => Business[]; // Returns path from root to business
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessTree, setBusinessTree] = useState<BusinessWithChildren[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    if (!isAuthenticated) {
      setBusinesses([]);
      setBusinessTree([]);
      setCurrentBusiness(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [flat, tree] = await Promise.all([
        getBusinesses(),
        getBusinessesTree(),
      ]);
      setBusinesses(flat);
      setBusinessTree(tree);

      // If no current business is set but businesses exist, default to first top-level
      if (!currentBusiness && flat.length > 0) {
        const topLevel = flat.find(b => !b.parent_id);
        if (topLevel) {
          setCurrentBusiness(topLevel);
        }
      }
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentBusiness]);

  useEffect(() => {
    fetchBusinesses();
  }, [isAuthenticated]); // Only re-fetch when auth changes

  const switchBusiness = async (businessId: number | null) => {
    try {
      await apiSwitchBusiness(businessId);
      if (businessId === null) {
        setCurrentBusiness(null);
      } else {
        const business = businesses.find(b => b.id === businessId);
        setCurrentBusiness(business || null);
      }
    } catch (error) {
      console.error('Failed to switch business:', error);
      throw error;
    }
  };

  const createBusiness = async (business: BusinessCreate) => {
    const newBusiness = await apiCreateBusiness(business);
    await fetchBusinesses(); // Refresh the list
    return newBusiness;
  };

  const getBusinessById = (id: number) => {
    return businesses.find(b => b.id === id);
  };

  const getBusinessPath = (id: number): Business[] => {
    const path: Business[] = [];
    let current = businesses.find(b => b.id === id);

    while (current) {
      path.unshift(current);
      if (current.parent_id) {
        current = businesses.find(b => b.id === current!.parent_id);
      } else {
        break;
      }
    }

    return path;
  };

  const isOrgWide = currentBusiness === null;

  return (
    <BusinessContext.Provider
      value={{
        currentBusiness,
        isOrgWide,
        businesses,
        businessTree,
        isLoading,
        switchBusiness,
        createBusiness,
        refreshBusinesses: fetchBusinesses,
        getBusinessById,
        getBusinessPath,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
