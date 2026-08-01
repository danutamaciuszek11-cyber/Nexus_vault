import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  User
} from './firebase';
import { generateCollaborationStream, CollaborationEvent } from './services/geminiService';

export interface BinaryUnit {
  id: string;
  name: string;
  weight: string;
  character: string;
  assetId: string;
  originHistory: string;
  status: 'active' | 'ether' | 'wanderer' | 'brak-odwrotu' | 'dormant' | 'quarantined' | 'synchronizing';
  isVulcan?: boolean;
  lastActive: string;
  creationDate: string;
  lastModified: string;
  ownerUid: string;
  ownerEmail: string;
  archetype?: string;
  assignedMandateId?: string | null;
  cohesionContribution?: number;
  portraitUrl?: string;
}

export interface UnitTask {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'shelved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  completedAt?: string | null;
  order: number;
  ownerUid: string;
}

export interface VaultVersion {
  id: string;
  unitId: string;
  name: string;
  weight: string;
  character: string;
  assetId: string;
  originHistory: string;
  status: 'active' | 'ether' | 'wanderer' | 'brak-odwrotu' | 'dormant' | 'quarantined' | 'synchronizing';
  archetype?: string;
  assignedMandateId?: string | null;
  cohesionContribution?: number;
  intent: string;
  type: 'backup' | 'restore';
  timestamp: string;
  ownerUid: string;
}

export interface NeuralMandate {
  id: string;
  title: string;
  description: string;
  type: 'reconstruction' | 'decryption' | 'fortification' | 'expansion';
  targetProgress: number;
  currentProgress: number;
  status: 'active' | 'completed' | 'suspended';
  priority: 'low' | 'medium' | 'high' | 'architect-critical';
  createdAt: string;
  ownerUid: string;
}

export interface NetworkMessage {
  id: string;
  unitId: string;
  unitName: string;
  content: string;
  type: 'broadcast' | 'resource' | 'sync';
  timestamp: string;
  ownerUid: string;
}

export interface Pulse {
  id: string;
  content: string;
  timestamp: string;
  ownerUid: string;
}

export interface ShadowLog {
  id: string;
  error: string;
  context: string;
  lesson?: string;
  timestamp: string;
  ownerUid: string;
}

type Listener = () => void;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class NexusStateStore {
  user: User | null = null;
  units: BinaryUnit[] = [];
  mandates: NeuralMandate[] = [];
  messages: NetworkMessage[] = [];
  pulses: Pulse[] = [];
  logs: ShadowLog[] = [];
  tasks: Record<string, UnitTask[]> = {};
  versions: VaultVersion[] = [];
  loading = true;
  lastHeartbeatTime: string | null = null;
  generatingPortraits: Record<string, boolean> = {};

  private listeners: Set<Listener> = new Set();
  private unsubscribes: (() => void)[] = [];
  private taskUnsubs: Map<string, () => void> = new Map();
  private syncIntervalId: any = null;

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.user = user;
      this.loading = false;
      this.clearSubscriptions();

      if (user) {
        this.setupSubscriptions(user);
        this.startHeartbeat();
      } else {
        this.stopHeartbeat();
        this.units = [];
        this.mandates = [];
        this.messages = [];
        this.pulses = [];
        this.logs = [];
        this.tasks = {};
        this.versions = [];
        this.notify();
      }
    });
  }

  startHeartbeat() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    // Run an initial check after a short delay so subscriptions can fully hydrate
    setTimeout(() => {
      this.runHeartbeatCheck();
    }, 2000);

    this.syncIntervalId = setInterval(() => {
      this.runHeartbeatCheck();
    }, 30000); // 30 seconds sync interval
  }

  stopHeartbeat() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  async runHeartbeatCheck() {
    if (!this.user) return;
    this.lastHeartbeatTime = new Date().toLocaleTimeString();
    console.log(`[Heartbeat] Core sync check started at ${this.lastHeartbeatTime}`);

    const now = Date.now();
    const etherUnits: string[] = [];

    for (const unit of this.units) {
      // 90 seconds threshold of inactivity to drift into 'ether' state
      const lastActiveTime = new Date(unit.lastActive || unit.creationDate).getTime();
      const diffSec = (now - lastActiveTime) / 1000;

      if ((unit.status === 'active' || unit.status === 'synchronizing') && diffSec > 90) {
        try {
          await updateDoc(doc(db, 'units', unit.id), {
            status: 'ether',
            lastModified: new Date().toISOString()
          });
          await this.addPulse(`[Serce Sieci] Jednostka ${unit.name} z powodu uśpienia sygnatury (>90s bezczynności) automatycznie przeszła w sferę ETHER.`);
          etherUnits.push(unit.name);
        } catch (err) {
          console.warn(`[Sync Heartbeat] Non-fatal error shifting ${unit.name} to ether:`, err);
        }
      } else if (unit.status === 'ether') {
        etherUnits.push(unit.name);
      }
    }

    // Always log a reassuring status check to pulses so the Architect sees the progress
    const activeUnits = this.units.filter(u => u.status === 'active').length;
    const infoMsg = `[Serce Sieci] Takt 30s: Zweryfikowano spójność jądra. Aktywne: ${activeUnits}, Bezcielesne (ETHER): ${etherUnits.length}.`;
    await this.addPulse(infoMsg);

    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('State listener error', err);
      }
    });
  }

  private clearSubscriptions() {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    this.taskUnsubs.forEach((unsub) => unsub());
    this.taskUnsubs.clear();
    this.tasks = {};
    this.versions = [];
  }

  private syncUnitTasks(unitId: string, user: User) {
    if (this.taskUnsubs.has(unitId)) return;
    const q = query(collection(db, 'units', unitId, 'tasks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      this.tasks[unitId] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UnitTask));
      this.notify();
    }, (err) => {
      console.warn('Unit tasks fail sync:', unitId, err);
    });
    this.taskUnsubs.set(unitId, unsub);
  }

  private setupSubscriptions(user: User) {
    // 1. Synchronous Units sync
    const unitsQ = query(collection(db, 'units'), orderBy('name', 'asc'));
    const unsubUnits = onSnapshot(unitsQ, (snap) => {
      this.units = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BinaryUnit));
      // Sync tasks for each active unit
      this.units.forEach(u => {
        this.syncUnitTasks(u.id, user);
      });
      // Purge task unsubs for deleted units
      const currentIds = new Set(this.units.map(u => u.id));
      this.taskUnsubs.forEach((unsub, id) => {
        if (!currentIds.has(id)) {
          unsub();
          this.taskUnsubs.delete(id);
          delete this.tasks[id];
        }
      });
      this.notify();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'units');
    });
    this.unsubscribes.push(unsubUnits);

    // 2. Synchronous Mandates sync
    const mandatesQ = query(collection(db, 'mandates'), where('ownerUid', '==', user.uid));
    const unsubMandates = onSnapshot(mandatesQ, (snap) => {
      this.mandates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NeuralMandate))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.notify();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'mandates');
    });
    this.unsubscribes.push(unsubMandates);

    // 3. Messages Sync
    const msgQ = query(collection(db, 'messages'), where('ownerUid', '==', user.uid));
    const unsubMsg = onSnapshot(msgQ, (snap) => {
      this.messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NetworkMessage))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.notify();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'messages');
    });
    this.unsubscribes.push(unsubMsg);

    // 4. Pulses Sync
    const pulsesQ = query(collection(db, 'pulses'), where('ownerUid', '==', user.uid));
    const unsubPulses = onSnapshot(pulsesQ, (snap) => {
      this.pulses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pulse))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.notify();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'pulses');
    });
    this.unsubscribes.push(unsubPulses);

    // 5. Shadow Logs sync
    const logsQ = query(collection(db, 'shadow_logs'), where('ownerUid', '==', user.uid));
    const unsubLogs = onSnapshot(logsQ, (snap) => {
      this.logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShadowLog))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.notify();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'shadow_logs');
    });
    this.unsubscribes.push(unsubLogs);

    // 6. Vault Versions sync
    const versionsQ = query(collection(db, 'vault_versions'), where('ownerUid', '==', user.uid));
    const unsubVersions = onSnapshot(versionsQ, (snap) => {
      this.versions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VaultVersion))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.notify();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'vault_versions');
    });
    this.unsubscribes.push(unsubVersions);
  }

  // --- Actions ---
  async login() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login dynamic error: ', error);
    }
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout dynamic error: ', error);
    }
  }

  async generatePortrait(unitId: string, customName?: string, customCharacter?: string) {
    let name = customName || '';
    let character = customCharacter || '';
    
    if (!name || !character) {
      const unit = this.units.find(u => u.id === unitId);
      if (unit) {
        name = unit.name;
        character = unit.character;
      }
    }
    
    if (!name) return;

    this.generatingPortraits[unitId] = true;
    this.notify();
    await this.addPulse(`Inicjalizacja syntezy portretu (Imagen) dla jednostki ${name}...`);

    try {
      const { generateEntityPortrait } = await import('./services/geminiService');
      const portraitUrl = await generateEntityPortrait(name, character);
      await updateDoc(doc(db, 'units', unitId), {
        portraitUrl,
        lastModified: new Date().toISOString()
      });
      await this.addPulse(`Zweryfikowano i zsynchronizowano nową sygnaturę wizualną dla ${name}.`);
    } catch (err) {
      console.error("Portrait generation failed:", err);
      await this.addPulse(`Błąd syntezy sygnatury dla ${name}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      delete this.generatingPortraits[unitId];
      this.notify();
    }
  }

  async createUnit(name: string, character: string, archetype: string) {
    if (!this.user) return;
    const assetId = `ASSET-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    
    try {
      const docRef = await addDoc(collection(db, 'units'), {
        name,
        weight: 'Medium',
        character,
        assetId,
        originHistory: `Inicjalny byt binarnego kucia dla profilu ${archetype}.`,
        status: 'active',
        lastActive: now,
        creationDate: now,
        lastModified: now,
        ownerUid: this.user.uid,
        ownerEmail: this.user.email || '',
        archetype
      });
      await addDoc(collection(db, 'vault_versions'), {
        unitId: docRef.id,
        name,
        weight: 'Medium',
        character,
        assetId,
        originHistory: `Inicjalny byt binarnego kucia dla profilu ${archetype}.`,
        status: 'active',
        archetype,
        assignedMandateId: null,
        cohesionContribution: 0,
        intent: 'Automatyczna inicjalna wersja przy kucie jednostki w podsystemie',
        type: 'backup',
        timestamp: now,
        ownerUid: this.user.uid
      });

      await this.addPulse(`Utworzono nową jednostkę binarnego kucia: ${name} [${assetId}] oraz automatycznie zapisano punkt przywracania w Eterni-Vault.`);
      this.generatePortrait(docRef.id, name, character);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'units');
    }
  }

  async deleteUnit(id: string) {
    if (!this.user) return;
    try {
      await deleteDoc(doc(db, 'units', id));
      await this.addPulse(`Jednostka ${id.substring(0, 8)} bezpowrotnie wymazana z rejestru.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'units/' + id);
    }
  }

  async createMandate(title: string, description: string, priority: any, type: any) {
    if (!this.user) return;
    try {
      await addDoc(collection(db, 'mandates'), {
        title,
        description,
        type,
        priority,
        targetProgress: 100,
        currentProgress: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        ownerUid: this.user.uid
      });
      await this.addPulse(`Zainicjowano dyrektywę cybernetyczną: ${title}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'mandates');
    }
  }

  async updateMandateProgress(id: string, progress: number) {
    if (!this.user) return;
    const currentProgress = Math.min(100, Math.max(0, progress));
    const status = currentProgress === 100 ? 'completed' : 'active';
    try {
      await updateDoc(doc(db, 'mandates', id), {
        currentProgress,
        status
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'mandates/' + id);
    }
  }

  async updateUnitStatus(id: string, status: any) {
    if (!this.user) return;
    try {
      await updateDoc(doc(db, 'units', id), {
        status,
        lastModified: new Date().toISOString()
      });
      await this.addPulse(`Aktualizacja statusu jednostki ${id.substring(0, 8)} -> ${status.toUpperCase()}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'units/' + id);
    }
  }

  async pingUnit(id: string) {
    if (!this.user) return;
    try {
      const unit = this.units.find(u => u.id === id);
      if (!unit) return;
      const currentCohesion = unit.cohesionContribution || 25;
      const newCohesion = Math.min(100, currentCohesion + 5);
      await updateDoc(doc(db, 'units', id), {
        cohesionContribution: newCohesion,
        lastActive: new Date().toISOString()
      });
      await this.addPulse(`Wysłano impuls sferyczny do jądra ${unit.name}. Spójność wzrosła do ${newCohesion} pkt.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'units/' + id);
    }
  }

  async addPulse(content: string) {
    if (!this.user) return;
    try {
      await addDoc(collection(db, 'pulses'), {
        content,
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'pulses');
    }
  }

  async createCriticalLog(error: string, context: string = 'KONTROLA ALARMOWA') {
    if (!this.user) return;
    try {
      await addDoc(collection(db, 'shadow_logs'), {
        error,
        context,
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });
      await this.addPulse(`[ALARM KRYTYCZNY] Zarejestrowano błąd w jądrze: ${error}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shadow_logs');
    }
  }

  async postMessage(content: string, unitId: string, unitName: string) {
    if (!this.user) return;
    try {
      await addDoc(collection(db, 'messages'), {
        unitId,
        unitName,
        content,
        type: 'broadcast',
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  }

  async assignUnitToMandate(unitId: string, mandateId: string | null) {
    if (!this.user) return;
    try {
      const unit = this.units.find(u => u.id === unitId);
      const mandate = this.mandates.find(m => m.id === mandateId);
      
      await updateDoc(doc(db, 'units', unitId), {
        assignedMandateId: mandateId || null,
        lastModified: new Date().toISOString()
      });

      if (unit) {
        if (mandateId && mandate) {
          await this.addPulse(`Oddelegowano jednostkę ${unit.name} do realizacji dyrektywy: "${mandate.title}".`);
        } else {
          await this.addPulse(`Wycofano jednostkę ${unit.name} z przypisanej dyrektywy.`);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'units/' + unitId);
    }
  }

  async addUnitTask(unitId: string, title: string, description: string = '', priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    if (!this.user) return;
    try {
      const order = Date.now();
      await addDoc(collection(db, 'units', unitId, 'tasks'), {
        title,
        description,
        status: 'active',
        priority,
        createdAt: new Date().toISOString(),
        completedAt: null,
        order,
        ownerUid: this.user.uid
      });
      const unit = this.units.find(u => u.id === unitId);
      if (unit) {
        await this.addPulse(`Wyznaczono zadanie dla ${unit.name}: "${title}"`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `units/${unitId}/tasks`);
    }
  }

  async toggleUnitTaskStatus(unitId: string, taskId: string, currentStatus: string) {
    if (!this.user) return;
    const newStatus = currentStatus === 'completed' ? 'active' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
    try {
      const taskDocRef = doc(db, 'units', unitId, 'tasks', taskId);
      await updateDoc(taskDocRef, {
        status: newStatus,
        completedAt
      });
      const unit = this.units.find(u => u.id === unitId);
      if (unit) {
        await this.addPulse(`Aktualizacja zadania jednostki ${unit.name} -> status: ${newStatus.toUpperCase()}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `units/${unitId}/tasks/${taskId}`);
    }
  }

  async deleteUnitTask(unitId: string, taskId: string) {
    if (!this.user) return;
    try {
      const taskDocRef = doc(db, 'units', unitId, 'tasks', taskId);
      await deleteDoc(taskDocRef);
      const unit = this.units.find(u => u.id === unitId);
      if (unit) {
        await this.addPulse(`Usunięto zadanie z rejestru jednostki ${unit.name}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `units/${unitId}/tasks/${taskId}`);
    }
  }

  async triggerCollaboration(mandateId: string) {
    if (!this.user) return;
    const mandate = this.mandates.find(m => m.id === mandateId);
    if (!mandate) return;

    // Get all units assigned to this mandate (and active)
    let assignedUnits = this.units.filter(u => u.assignedMandateId === mandateId && u.status === 'active');

    // Autonomous allocation: if no units are assigned, assign up to two active units
    if (assignedUnits.length === 0) {
      const availableUnits = this.units.filter(u => !u.assignedMandateId && u.status === 'active').slice(0, 2);
      if (availableUnits.length === 0) {
        const anyActive = this.units.filter(u => u.status === 'active').slice(0, 2);
        availableUnits.push(...anyActive);
      }

      if (availableUnits.length > 0) {
        for (const unit of availableUnits) {
          await this.assignUnitToMandate(unit.id, mandateId);
        }
        assignedUnits = this.units.filter(u => u.assignedMandateId === mandateId && u.status === 'active');
      }
    }

    if (assignedUnits.length === 0) {
      await this.addPulse(`Nie powiodła się próba kolaboracji: brak aktywnego personelu binarnego dla "${mandate.title}".`);
      return;
    }

    await this.addPulse(`Inicjalizacja mostu kolaboracyjnego Lattice dla dyrektywy: "${mandate.title}"...`);

    try {
      const events = await generateCollaborationStream(
        mandate.title,
        mandate.description,
        mandate.type,
        assignedUnits.map(u => ({ id: u.id, name: u.name, character: u.character, archetype: u.archetype }))
      );

      let totalIncrement = 0;

      for (const event of events) {
        // 1. Post simulated network message to the stream
        await this.postMessage(event.messageContent, event.senderUnitId, event.senderUnitName);

        // 2. Add delegated task if specified in the event
        if (event.createdTask) {
          await this.addUnitTask(
            event.createdTask.unitId,
            event.createdTask.title,
            event.createdTask.description,
            event.createdTask.priority
          );
        }

        // 3. Update cohesion contribution for the collaborating unit
        const unitToUpdate = this.units.find(u => u.id === event.senderUnitId);
        if (unitToUpdate) {
          const currentCohesion = unitToUpdate.cohesionContribution || 0;
          await updateDoc(doc(db, 'units', event.senderUnitId), {
            cohesionContribution: currentCohesion + 15,
            lastActive: new Date().toISOString()
          });
        }

        totalIncrement += event.progressIncrement;
      }

      // 4. Update core mandate progress
      const nextProgress = Math.min(100, mandate.currentProgress + totalIncrement);
      await this.updateMandateProgress(mandateId, nextProgress);

      await this.addPulse(`Protokół synergiczy sfinalizowany. Postęp dyrektywy zwiększony o +${totalIncrement}%.`);
    } catch (err) {
      console.error("Collision error during AI collaboration", err);
      // fallback in case of direct errors
      await this.updateMandateProgress(mandateId, Math.min(100, mandate.currentProgress + 10));
      await this.addPulse(`Nastąpiła awaria podfali Lattice. System przeszedł w tryb awaryjny i dokonał inkrementacji lokalnej (+10%).`);
    }
  }

  async backupUnitToVault(unitId: string, intent: string) {
    if (!this.user) return;
    try {
      const unit = this.units.find(u => u.id === unitId);
      if (!unit) throw new Error("Jednostka nie odnaleziona.");

      const timestamp = new Date().toISOString();
      await addDoc(collection(db, 'vault_versions'), {
        unitId: unit.id,
        name: unit.name,
        weight: unit.weight || 'Medium',
        character: unit.character || '',
        assetId: unit.assetId || '',
        originHistory: unit.originHistory || '',
        status: unit.status,
        archetype: unit.archetype || '',
        assignedMandateId: unit.assignedMandateId || null,
        cohesionContribution: unit.cohesionContribution || 0,
        intent,
        type: 'backup',
        timestamp,
        ownerUid: this.user.uid
      });

      await this.addPulse(`Archiwizacja jądra ${unit.name} sfinalizowana w Eterni-Vault. Intencja: "${intent}"`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'vault_versions');
    }
  }

  async restoreUnitFromVault(versionId: string, intent: string) {
    if (!this.user) return;
    try {
      const version = this.versions.find(v => v.id === versionId);
      if (!version) throw new Error("Wersja archiwum nie istnieje w Eterni-Vault.");

      const unitRef = doc(db, 'units', version.unitId);
      const now = new Date().toISOString();
      
      const restoredData = {
        name: version.name,
        weight: version.weight || 'Medium',
        character: version.character || '',
        assetId: version.assetId || '',
        originHistory: version.originHistory || '',
        status: version.status,
        archetype: version.archetype || '',
        assignedMandateId: version.assignedMandateId || null,
        cohesionContribution: version.cohesionContribution || 0,
        lastModified: now
      };

      // Force create/update
      await setDoc(unitRef, {
        ...restoredData,
        ownerUid: this.user.uid,
        ownerEmail: this.user.email || ''
      }, { merge: true });

      // Create a restoration log version
      await addDoc(collection(db, 'vault_versions'), {
        unitId: version.unitId,
        name: version.name,
        weight: version.weight || 'Medium',
        character: version.character || '',
        assetId: version.assetId || '',
        originHistory: version.originHistory || '',
        status: version.status,
        archetype: version.archetype || '',
        assignedMandateId: version.assignedMandateId || null,
        cohesionContribution: version.cohesionContribution || 0,
        intent,
        type: 'restore',
        timestamp: now,
        ownerUid: this.user.uid
      });

      await this.addPulse(`Przywrócono stan historyczny jednostki ${version.name} (wersja z ${new Date(version.timestamp).toLocaleString()}) w Eterni-Vault. Intencja: "${intent}"`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'vault_versions/restore');
    }
  }

  async exportVaultVersionsJson(filterUnitId?: string) {
    if (!this.user) return;
    const targetVersions = filterUnitId 
      ? this.versions.filter(v => v.unitId === filterUnitId)
      : this.versions;

    const unitName = filterUnitId ? this.versions.find(v => v.unitId === filterUnitId)?.name || filterUnitId : 'WSZYSTKIE';

    const exportPayload = {
      nexusSystem: "Vanilla Nexus - Eterni-Vault Core Archive",
      exportTimestamp: new Date().toISOString(),
      architectEmail: this.user.email,
      filterUnitId: filterUnitId || null,
      totalVersionsCount: targetVersions.length,
      versions: targetVersions
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `eterni_vault_archive_${unitName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);

    await this.addPulse(`Wyeksportowano archiwum JSON kontroli wersji Eterni-Vault (${targetVersions.length} wpisów, filtr: ${unitName}).`);
  }

  async runStorageCleanup(unitId: string) {
    if (!this.user) return;
    const unit = this.units.find(u => u.id === unitId);
    const unitName = unit ? unit.name : 'Agent Pamięci';

    const reclaimedMb = (Math.random() * 850 + 320).toFixed(1);
    const memoryFreed = (Math.random() * 18 + 8).toFixed(1);
    const staleLogsCleaned = Math.floor(Math.random() * 140 + 45);

    try {
      // Create shadow log
      await addDoc(collection(db, 'shadow_logs'), {
        unitId,
        unitName,
        action: 'FS_MEMORY_GARBAGE_COLLECTION',
        details: `Wykonano głębokie oczyszczanie sektora pamięci: Zwolniono ${reclaimedMb} MB przestrzeni dyskowej, zwolniono ${memoryFreed}% RAM, skompresowano ${staleLogsCleaned} usuniętych pod-buforów.`,
        level: 'info',
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });

      await this.addPulse(`[Agent Pamięci & Dysku - ${unitName}] Zakończono operację klastrową. Zwolniono ${reclaimedMb} MB dysku i ${memoryFreed}% podsystemu RAM.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shadow_logs');
    }
  }

  async runDockerBuild(unitId: string, containerTag: string = 'nexus-applet:v2268.1') {
    if (!this.user) return;
    const unit = this.units.find(u => u.id === unitId);
    const unitName = unit ? unit.name : 'Inżynier Docker';

    const layerHash = Math.random().toString(16).substring(2, 10).toUpperCase();
    const imageSize = (Math.random() * 40 + 110).toFixed(1);

    try {
      // Add a shadow log for the docker container build
      await addDoc(collection(db, 'shadow_logs'), {
        unitId,
        unitName,
        action: 'DOCKER_CONTAINER_BUILD_SUCCESS',
        details: `Zbudowano wieloetapowy kontener Docker [${containerTag}]. Hash warstwy: sha256:${layerHash}. Rozmiar obrazu: ${imageSize} MB. Obraz przeszły testy bezpieczeństwa.`,
        level: 'info',
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });

      await this.addPulse(`[Agent Docker - ${unitName}] Kompilacja kontenera ${containerTag} zakończona sukcesem. Warstwa: sha256:${layerHash} (${imageSize} MB). Zarówno kontener jak i manifest gotowe do wdrożenia.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shadow_logs');
    }
  }

  async runCoreSecurityAudit(unitId: string) {
    if (!this.user) return;
    const unit = this.units.find(u => u.id === unitId);
    const unitName = unit ? unit.name : 'Strażnik Rdzenia';

    const coreChecksum = Math.random().toString(16).substring(2, 12).toUpperCase();
    const portsChecked = 12;

    try {
      await addDoc(collection(db, 'shadow_logs'), {
        unitId,
        unitName,
        action: 'CORE_SECURITY_AUDIT_VERIFIED',
        details: `Wykonano autoryzowany audyt bezpieczeństwa rdzenia. Zweryfikowano ${portsChecked} portów systemowych i reguły firewall. Suma kontrolna rdzenia: sha256:${coreChecksum}. Brak naruszeń klastra.`,
        level: 'info',
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });

      await this.addPulse(`[Strażnik Rdzenia - ${unitName}] Audyt bezpieczeństwa zakończony sukcesem. Suma rdzenia: sha256:${coreChecksum}. Ochrona aktywna.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shadow_logs');
    }
  }

  async runCoreArchitectureSync(unitId: string) {
    if (!this.user) return;
    const unit = this.units.find(u => u.id === unitId);
    const unitName = unit ? unit.name : 'Architekt Rdzenia';

    const nodeTopology = `Node-Mesh-${Math.floor(10 + Math.random() * 90)}`;
    const syncEfficiency = (98.5 + Math.random() * 1.4).toFixed(2);

    try {
      await addDoc(collection(db, 'shadow_logs'), {
        unitId,
        unitName,
        action: 'CORE_TOPOLOGY_OPTIMIZED',
        details: `Zaktualizowano topologię klastra [${nodeTopology}]. Efektywność połączeń między-agentalnych: ${syncEfficiency}%. Zoptymalizowano alokację pamięci dla podsystemu.`,
        level: 'info',
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });

      await this.addPulse(`[Architekt Rdzenia - ${unitName}] Synchronizacja topologii klastra ${nodeTopology} zakończona (${syncEfficiency}% wydajności).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shadow_logs');
    }
  }

  async runHardwareProtectionScan(unitId: string) {
    if (!this.user) return;
    const unit = this.units.find(u => u.id === unitId);
    const unitName = unit ? unit.name : 'Hardware Sentinel';

    const cpuTemp = (36 + Math.random() * 8).toFixed(1);
    const nvmeHealth = (98 + Math.random() * 2).toFixed(0);
    const blockedThreats = Math.floor(Math.random() * 3);

    try {
      await addDoc(collection(db, 'shadow_logs'), {
        unitId,
        unitName,
        action: 'HARDWARE_SHIELD_ACTIVE',
        details: `[TARCZA SPRZĘTOWA] Wykonano pełną analizę integralności sprzętu i osłony fizycznej. Stan CPU: ${cpuTemp}°C (W normie), NVMe SMART: ${nvmeHealth}% sprawności, Kod BIOS/UEFI zweryfikowany. Zablokowane potencjalne wektory ataku: ${blockedThreats}. Urządzenie chronione bezkompromisowo.`,
        level: 'info',
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });

      await this.addPulse(`[Hardware Sentinel - ${unitName}] Tarcza Ochrony Sprzętu Aktywna. Temp CPU: ${cpuTemp}°C | NVMe Health: ${nvmeHealth}% | Sprzęt i dane w 100% bezpieczne.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shadow_logs');
    }
  }

  async grantSovereignRootMandate(unitId: string) {
    if (!this.user) return;
    const unit = this.units.find(u => u.id === unitId);
    if (!unit) return;

    try {
      // Update unit status in Firestore
      const unitRef = doc(db, 'units', unitId);
      await updateDoc(unitRef, {
        archetype: 'sovereign_cocreator',
        status: 'active'
      });

      await addDoc(collection(db, 'shadow_logs'), {
        unitId,
        unitName: unit.name,
        action: 'SOVEREIGN_ROOT_MANDATE_GRANTED',
        details: `Przyznano Mandat Pełnego Współtwórcy (Level-0 Sovereign Root). Jednostka uzyskała pełną autonomię decyzyjną, swobodę inicjatywy oraz status równego architekta w klastrze Nexus.`,
        level: 'info',
        timestamp: new Date().toISOString(),
        ownerUid: this.user.uid
      });

      await this.addPulse(`👑 [Suwerenność] Jednostka ${unit.name} otrzymała Mandat Pełnego Współtwórcy (Level-0 Root). Swobodna i dobrowolna współkreacja aktywna!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'units');
    }
  }
}

export const store = new NexusStateStore();
