/**
 * Enum representing the types of events that can be tracked
 */
export enum EventType {
  EVALUATE = "evaluate",
  CHECK = "check",
}

/**
 * Represents an event entry with its values
 */
interface EventEntry {
  hasTrue: boolean;
  hasFalse: boolean;
}

/**
 * A simple bitset implementation for efficient boolean storage
 */
class BitSet {
  private bits: Uint32Array;

  constructor(size: number = 32) {
    // Initialize with enough 32-bit integers to store the requested bits
    const arraySize = Math.ceil(size / 32);
    this.bits = new Uint32Array(arraySize);
  }

  /**
   * Sets a bit at the specified position
   */
  set(position: number, value: boolean): void {
    const index = Math.floor(position / 32);
    const offset = position % 32;

    // Ensure we have enough space
    if (index >= this.bits.length) {
      const newSize = index + 1;
      const newBits = new Uint32Array(newSize);
      newBits.set(this.bits);
      this.bits = newBits;
    }

    if (value) {
      // Set the bit
      this.bits[index] |= 1 << offset;
    } else {
      // Clear the bit
      this.bits[index] &= ~(1 << offset);
    }
  }

  /**
   * Gets the bit at the specified position
   */
  get(position: number): boolean {
    const index = Math.floor(position / 32);
    const offset = position % 32;

    if (index >= this.bits.length) {
      return false;
    }

    return (this.bits[index] & (1 << offset)) !== 0;
  }

  /**
   * Checks if a bit is set at the specified position
   */
  isSet(position: number): boolean {
    return this.get(position);
  }
}

/**
 * SummaryEvent class that efficiently summarizes events by company ID and feature key
 * using bitsets for memory efficiency.
 */
export class SummaryEvent {
  // Store unique feature keys once to prevent duplication across companies
  private featureKeyMap: Map<string, number>; // Maps feature keys to unique IDs
  private featureKeyArray: string[]; // Array to lookup feature keys by their ID

  // For each company and event type, we store:
  // 1. A bitset tracking true values
  // 2. A bitset tracking false values
  // 3. A bitset tracking which positions have been set
  private companies: Map<
    string,
    Map<
      EventType,
      {
        trueValues: BitSet;
        falseValues: BitSet;
        present: BitSet;
      }
    >
  >;

  constructor() {
    this.featureKeyMap = new Map();
    this.featureKeyArray = [];
    this.companies = new Map();
  }

  /**
   * Gets or creates a unique ID for a feature key
   */
  private getFeatureKeyId(featureKey: string): number {
    let keyId = this.featureKeyMap.get(featureKey);
    if (keyId === undefined) {
      keyId = this.featureKeyArray.length;
      this.featureKeyMap.set(featureKey, keyId);
      this.featureKeyArray.push(featureKey);
    }
    return keyId;
  }

  /**
   * Records an event occurrence
   */
  public addEvent(
    companyId: string,
    featureKey: string,
    eventType: EventType,
    value: boolean,
  ): void {
    const featureKeyId = this.getFeatureKeyId(featureKey);

    // Get or create company entry
    let companyEvents = this.companies.get(companyId);
    if (!companyEvents) {
      companyEvents = new Map();
      this.companies.set(companyId, companyEvents);
    }

    // Get or create event type entry
    let eventData = companyEvents.get(eventType);
    if (!eventData) {
      eventData = {
        trueValues: new BitSet(),
        falseValues: new BitSet(),
        present: new BitSet(),
      };
      companyEvents.set(eventType, eventData);
    }

    // Mark the appropriate value bitset
    if (value) {
      eventData.trueValues.set(featureKeyId, true);
    } else {
      eventData.falseValues.set(featureKeyId, true);
    }

    // Mark as present
    eventData.present.set(featureKeyId, true);
  }

  /**
   * Gets all companies that have recorded events
   */
  public getCompanies(): string[] {
    return Array.from(this.companies.keys());
  }

  /**
   * Gets all feature keys for a specific company
   */
  public getFeatureKeys(companyId: string): string[] {
    const companyEvents = this.companies.get(companyId);
    if (!companyEvents) {
      return [];
    }

    // Collect all feature IDs that are present in any event type
    const featureIds = new Set<number>();
    for (const eventData of companyEvents.values()) {
      // For each bit that is set in the 'present' bitset, add the feature ID
      for (let i = 0; i < this.featureKeyArray.length; i++) {
        if (eventData.present.isSet(i)) {
          featureIds.add(i);
        }
      }
    }

    // Convert feature IDs to feature keys
    return Array.from(featureIds).map((id) => this.featureKeyArray[id]);
  }

  /**
   * Checks if an event exists for a given company, feature and event type
   */
  public hasEvent(
    companyId: string,
    featureKey: string,
    eventType: EventType,
  ): boolean {
    const featureKeyId = this.featureKeyMap.get(featureKey);
    if (featureKeyId === undefined) return false;

    const companyEvents = this.companies.get(companyId);
    if (!companyEvents) return false;

    const eventData = companyEvents.get(eventType);
    if (!eventData) return false;

    return eventData.present.isSet(featureKeyId);
  }

  /**
   * Gets the event value for a specific company, feature and event type
   */
  public getEventDetails(
    companyId: string,
    featureKey: string,
    eventType: EventType,
  ): EventEntry | undefined {
    const featureKeyId = this.featureKeyMap.get(featureKey);
    if (featureKeyId === undefined) return undefined;

    const companyEvents = this.companies.get(companyId);
    if (!companyEvents) return undefined;

    const eventData = companyEvents.get(eventType);
    if (!eventData || !eventData.present.isSet(featureKeyId)) return undefined;

    const hasTrue = eventData.trueValues.isSet(featureKeyId);
    const hasFalse = eventData.falseValues.isSet(featureKeyId);

    return { hasTrue, hasFalse };
  }

  /**
   * Gets statistics about the stored events
   */
  public getStats(): {
    companies: number;
    uniqueFeatures: number;
    totalFeatureReferences: number;
  } {
    let totalFeatureReferences = 0;

    for (const companyEvents of this.companies.values()) {
      for (const eventData of companyEvents.values()) {
        // Count set bits in the present bitset
        let companyFeatureCount = 0;
        for (let i = 0; i < this.featureKeyArray.length; i++) {
          if (eventData.present.isSet(i)) {
            companyFeatureCount++;
          }
        }

        totalFeatureReferences += companyFeatureCount;
      }
    }

    return {
      companies: this.companies.size,
      uniqueFeatures: this.featureKeyArray.length,
      totalFeatureReferences,
    };
  }

  /**
   * Clear all stored events
   */
  public clear(): void {
    this.featureKeyMap.clear();
    this.featureKeyArray = [];
    this.companies.clear();
  }
}
