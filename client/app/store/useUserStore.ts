import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { accountInterface } from '../types/account.type';

type UserStore = {
  user: accountInterface | null;
  setUser: (userData: NonNullable<accountInterface>) => void;
  clearUser: () => void;
};

const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (userData) => set({ user: userData }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
    }
  )
);

export default useUserStore;