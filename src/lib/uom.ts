export interface UOMOption {
  value: string;
  label: string;
  category: 'count' | 'mass' | 'volume' | 'length' | 'packaging';
}

export const STANDARD_UOMS: UOMOption[] = [
  // Count
  { value: 'unit', label: 'Unit (u)', category: 'count' },
  { value: 'piece', label: 'Piece (pc)', category: 'count' },
  { value: 'pair', label: 'Pair (pr)', category: 'count' },
  { value: 'dozen', label: 'Dozen (dz, 12 units)', category: 'count' },
  { value: 'gross', label: 'Gross (144 units)', category: 'count' },

  // Mass / Weight
  { value: 'kg', label: 'Kilogram (kg)', category: 'mass' },
  { value: 'g', label: 'Gram (g)', category: 'mass' },
  { value: 'mg', label: 'Milligram (mg)', category: 'mass' },
  { value: 'ton', label: 'Metric Ton (t)', category: 'mass' },
  { value: 'lb', label: 'Pound (lb)', category: 'mass' },
  { value: 'oz', label: 'Ounce (oz)', category: 'mass' },

  // Volume / Liquid
  { value: 'l', label: 'Liter (L)', category: 'volume' },
  { value: 'ml', label: 'Milliliter (mL)', category: 'volume' },
  { value: 'gal', label: 'Gallon (gal)', category: 'volume' },

  // Length / Distance
  { value: 'm', label: 'Meter (m)', category: 'length' },
  { value: 'cm', label: 'Centimeter (cm)', category: 'length' },
  { value: 'mm', label: 'Millimeter (mm)', category: 'length' },
  { value: 'ft', label: 'Foot (ft)', category: 'length' },
  { value: 'in', label: 'Inch (in)', category: 'length' },

  // Packaging Units
  { value: 'Box', label: 'Box', category: 'packaging' },
  { value: 'Pack', label: 'Pack', category: 'packaging' },
  { value: 'Packet', label: 'Packet', category: 'packaging' },
  { value: 'Carton', label: 'Carton', category: 'packaging' },
  { value: 'Pallet', label: 'Pallet', category: 'packaging' },
  { value: 'Drum', label: 'Drum / Barrel', category: 'packaging' },
  { value: 'Bag', label: 'Bag / Sack', category: 'packaging' },
  { value: 'Pouch', label: 'Pouch', category: 'packaging' },
  { value: 'Bundle', label: 'Bundle', category: 'packaging' },
  { value: 'Container', label: 'Container', category: 'packaging' },
  { value: 'Roll', label: 'Roll', category: 'packaging' },
  { value: 'Sheet', label: 'Sheet', category: 'packaging' },
  { value: 'Bottle', label: 'Bottle / Can', category: 'packaging' },
  { value: 'Strip', label: 'Strip / Blister', category: 'packaging' }
];

export function getUOMCategory(uomName: string): string | null {
  if (!uomName) return null;
  const match = STANDARD_UOMS.find(u => u.value.toLowerCase() === uomName.toLowerCase() || u.label.toLowerCase().includes(uomName.toLowerCase()));
  return match ? match.category : null;
}

export function formatUOM(uom: string): string {
  if (!uom) return '';
  const match = STANDARD_UOMS.find(u => u.value.toLowerCase() === uom.toLowerCase());
  return match ? match.value : uom;
}
