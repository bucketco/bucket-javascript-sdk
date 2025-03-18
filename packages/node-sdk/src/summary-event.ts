/**
 * Enum representing the types of events that can be tracked
 */
export enum EventType {
  EVALUATE = "evaluate",
  CHECK = "check",
}

/**
 * A dynamic bitset implementation for efficient boolean storage
 * that automatically resizes as needed
 */
class BitSet {
  private bits: Uint32Array;
  private _size: number;

  constructor(initialCapacity: number = 32) {
    const arraySize = Math.ceil(initialCapacity / 32);
    this.bits = new Uint32Array(arraySize);
    this._size = 0;
  }

  /**
   * Ensures the bitset has capacity for the specified position
   */
  private ensureCapacity(position: number): void {
    const requiredIndex = Math.floor(position / 32);

    if (requiredIndex >= this.bits.length) {
      // Calculate new size with growth factor for better amortized performance
      const newSize = Math.max(this.bits.length * 2, requiredIndex + 1);
      const newBits = new Uint32Array(newSize);
      newBits.set(this.bits);
      this.bits = newBits;
    }

    // Update size if we're setting a bit beyond our current size
    this._size = Math.max(this._size, position + 1);
  }

  /**
   * Sets a bit at the specified position
   */
  set(position: number, value: boolean): void {
    if (position < 0) {
      throw new Error("Bit position cannot be negative");
    }

    const index = Math.floor(position / 32);
    const offset = position % 32;

    // Ensure we have enough space
    if (value || index < this.bits.length) {
      // Only resize if setting true or within current capacity
      this.ensureCapacity(position);
    }

    if (value) {
      // Set the bit
      this.bits[index] |= 1 << offset;
    } else if (index < this.bits.length) {
      // Clear the bit if within range
      this.bits[index] &= ~(1 << offset);
    }
    // If out of range and setting to false, we do nothing as bits default to 0
  }

  /**
   * Gets the bit at the specified position
   */
  get(position: number): boolean {
    if (position < 0 || position >= this._size) {
      return false;
    }

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

  /**
   * Gets the current capacity of the bitset
   */
  get capacity(): number {
    return this.bits.length * 32;
  }

  /**
   * Gets the current logical size of the bitset
   */
  get size(): number {
    return this._size;
  }

  /**
   * Clear all bits in the bitset
   */
  clear(): void {
    this.bits.fill(0);
    this._size = 0;
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
  private companies: Map<
    string,
    Map<
      EventType,
      {
        trueValues: BitSet;
        falseValues: BitSet;
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
      };
      companyEvents.set(eventType, eventData);
    }

    // Mark the appropriate value bitset
    if (value) {
      eventData.trueValues.set(featureKeyId, true);
    } else {
      eventData.falseValues.set(featureKeyId, true);
    }
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
      // Check both true and false values bitsets
      for (let i = 0; i < this.featureKeyArray.length; i++) {
        if (eventData.trueValues.isSet(i) || eventData.falseValues.isSet(i)) {
          featureIds.add(i);
        }
      }
    }

    // Convert feature IDs to feature keys
    return Array.from(featureIds).map((id) => this.featureKeyArray[id]);
  }

  /**
   * Checks if an event exists for a given company, feature, event type, and value
   */
  public hasEvent(
    companyId: string,
    featureKey: string,
    eventType: EventType,
    value: boolean,
  ): boolean {
    const featureKeyId = this.featureKeyMap.get(featureKey);
    if (featureKeyId === undefined) return false;

    const companyEvents = this.companies.get(companyId);
    if (!companyEvents) return false;

    const eventData = companyEvents.get(eventType);
    if (!eventData) return false;

    return value
      ? eventData.trueValues.isSet(featureKeyId)
      : eventData.falseValues.isSet(featureKeyId);
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
        // Count features that have either true or false values
        let companyFeatureCount = 0;
        for (let i = 0; i < this.featureKeyArray.length; i++) {
          if (eventData.trueValues.isSet(i) || eventData.falseValues.isSet(i)) {
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
