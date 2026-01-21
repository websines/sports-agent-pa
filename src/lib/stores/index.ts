import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Invoice, Athlete, Contact, Receipt, Company } from '@/lib/db/schema';

// Invoice Store
interface InvoiceState {
  invoices: Invoice[];
  loading: boolean;
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  loading: false,
  setInvoices: (invoices) => set({ invoices }),
  addInvoice: (invoice) => set((state) => ({ invoices: [invoice, ...state.invoices] })),
  updateInvoice: (id, updates) =>
    set((state) => ({
      invoices: state.invoices.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)),
    })),
  deleteInvoice: (id) =>
    set((state) => ({ invoices: state.invoices.filter((inv) => inv.id !== id) })),
  setLoading: (loading) => set({ loading }),
}));

// Athlete Store
interface AthleteState {
  athletes: Athlete[];
  loading: boolean;
  selectedIds: string[];
  filterPosition: string | null;
  setAthletes: (athletes: Athlete[]) => void;
  addAthlete: (athlete: Athlete) => void;
  updateAthlete: (id: string, updates: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFilterPosition: (position: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAthleteStore = create<AthleteState>((set, get) => ({
  athletes: [],
  loading: false,
  selectedIds: [],
  filterPosition: null,
  setAthletes: (athletes) => set({ athletes }),
  addAthlete: (athlete) => set((state) => ({ athletes: [athlete, ...state.athletes] })),
  updateAthlete: (id, updates) =>
    set((state) => ({
      athletes: state.athletes.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  deleteAthlete: (id) =>
    set((state) => ({
      athletes: state.athletes.filter((a) => a.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelected: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id],
    })),
  selectAll: () => {
    const { athletes, filterPosition } = get();
    const filtered = filterPosition
      ? athletes.filter((a) => a.position === filterPosition)
      : athletes;
    set({ selectedIds: filtered.map((a) => a.id) });
  },
  clearSelection: () => set({ selectedIds: [] }),
  setFilterPosition: (position) => set({ filterPosition: position, selectedIds: [] }),
  setLoading: (loading) => set({ loading }),
}));

// Contact Store
interface ContactState {
  contacts: Contact[];
  loading: boolean;
  selectedIds: string[];
  filterCountry: string | null;
  filterLeague: string | null;
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  addContacts: (contacts: Contact[]) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFilterCountry: (country: string | null) => void;
  setFilterLeague: (league: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  loading: false,
  selectedIds: [],
  filterCountry: null,
  filterLeague: null,
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) => set((state) => ({ contacts: [contact, ...state.contacts] })),
  addContacts: (newContacts) =>
    set((state) => ({ contacts: [...newContacts, ...state.contacts] })),
  updateContact: (id, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  deleteContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelected: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id],
    })),
  selectAll: () => {
    const { contacts, filterCountry, filterLeague } = get();
    let filtered = contacts;
    if (filterCountry) filtered = filtered.filter((c) => c.country === filterCountry);
    if (filterLeague) filtered = filtered.filter((c) => c.league === filterLeague);
    set({ selectedIds: filtered.map((c) => c.id) });
  },
  clearSelection: () => set({ selectedIds: [] }),
  setFilterCountry: (country) => set({ filterCountry: country, selectedIds: [] }),
  setFilterLeague: (league) => set({ filterLeague: league, selectedIds: [] }),
  setLoading: (loading) => set({ loading }),
}));

// Receipt Store
interface ReceiptState {
  receipts: Receipt[];
  loading: boolean;
  processing: boolean;
  setReceipts: (receipts: Receipt[]) => void;
  addReceipt: (receipt: Receipt) => void;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
  deleteReceipt: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
}

export const useReceiptStore = create<ReceiptState>((set) => ({
  receipts: [],
  loading: false,
  processing: false,
  setReceipts: (receipts) => set({ receipts }),
  addReceipt: (receipt) => set((state) => ({ receipts: [receipt, ...state.receipts] })),
  updateReceipt: (id, updates) =>
    set((state) => ({
      receipts: state.receipts.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  deleteReceipt: (id) =>
    set((state) => ({ receipts: state.receipts.filter((r) => r.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setProcessing: (processing) => set({ processing }),
}));

// Company Store
interface CompanyState {
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  companies: [],
  setCompanies: (companies) => set({ companies }),
  addCompany: (company) => set((state) => ({ companies: [...state.companies, company] })),
  updateCompany: (id, updates) =>
    set((state) => ({
      companies: state.companies.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
}));

// UI Store
interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  modalData: Record<string, unknown>;
  notifications: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modal: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  activeModal: null,
  modalData: {},
  notifications: [],
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (modal, data = {}) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: {} }),
  addNotification: (type, message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 5000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));

// Settings Store (persisted)
interface SettingsState {
  googleConnected: boolean;
  telegramConnected: boolean;
  notificationEmail: string;
  setGoogleConnected: (connected: boolean) => void;
  setTelegramConnected: (connected: boolean) => void;
  setNotificationEmail: (email: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      googleConnected: false,
      telegramConnected: false,
      notificationEmail: '',
      setGoogleConnected: (connected) => set({ googleConnected: connected }),
      setTelegramConnected: (connected) => set({ telegramConnected: connected }),
      setNotificationEmail: (email) => set({ notificationEmail: email }),
    }),
    {
      name: 'sports-agent-settings',
    }
  )
);
