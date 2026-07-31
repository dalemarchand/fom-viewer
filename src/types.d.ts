// Ambient TypeScript type declarations for IEEE 1516 FOM Viewer.

export interface Attribute {
  name: string;
  dataType?: string;
  transportation?: string;
  order?: string;
  dimensions?: string;
  notes?: string;
  description?: string;
}

export interface Parameter {
  name: string;
  dataType?: string;
  notes?: string;
  description?: string;
}

export interface ObjectClass {
  name: string;
  attributes: Attribute[];
  _sources?: string[];
}

export interface InteractionClass {
  name: string;
  parameters: Parameter[];
  transportation?: string;
  order?: string;
  dimensions?: string;
  notes?: string;
  description?: string;
  _sources?: string[];
}

export interface BasicDataType {
  name: string;
  representation?: string;
  size?: string;
  notes?: string;
}

export interface SimpleDataType {
  name: string;
  representation?: string;
  units?: string;
  resolution?: string;
  accuracy?: string;
  notes?: string;
}

export interface ArrayDataType {
  name: string;
  dataType?: string;
  cardinality?: string;
  encoding?: string;
  notes?: string;
}

export interface FixedRecordField {
  name: string;
  dataType: string;
  notes?: string;
}

export interface FixedRecordDataType {
  name: string;
  fields: FixedRecordField[];
  notes?: string;
}

export interface EnumValue {
  name: string;
  value: string;
  notes?: string;
}

export interface EnumDataType {
  name: string;
  representation?: string;
  values: EnumValue[];
  notes?: string;
}

export interface VariantAlternative {
  name: string;
  value: string;
  dataType?: string;
  notes?: string;
}

export interface VariantDataType {
  name: string;
  discriminant?: string;
  dataType?: string;
  alternatives: VariantAlternative[];
  notes?: string;
}

export interface Dimension {
  name: string;
  upperBound?: string;
  value?: string;
  notes?: string;
}

export interface Transportation {
  name: string;
  reliable?: string;
  semantics?: string;
  notes?: string;
}

export interface Note {
  name: string;
  text?: string;
}

export interface Switch {
  name: string;
  value?: string;
  notes?: string;
}

export interface Tag {
  name: string;
  value?: string;
  notes?: string;
}

export interface TimeConfig {
  name: string;
  value?: string;
  notes?: string;
}

export interface Issue {
  id: string;
  severity: 'error' | 'warning';
  category: string;
  type: string;
  title: string;
  detail: string;
  involved?: Array<{ tab: string; itemName: string; exists: boolean }>;
  sources?: string[];
  locations?: any[];
  timestamp: number;
}

export interface AppspaceEntry {
  className: string;
  apps: string[];
  matchedClass?: string;
}

export interface AppspaceData {
  fileName: string;
  rawContent: string;
  entries?: AppspaceEntry[];
  objects?: AppspaceEntry[];
  interactions?: AppspaceEntry[];
  unknown?: AppspaceEntry[];
}

declare global {
  interface Window {
    hashCode?: (str: string) => string;
    applyTheme?: (theme: string) => void;
    navigateToLocation?: (loc: any) => void;
    __switchToModule?: (source: string) => void;
    state?: any;
    showIssueDetail?: (id: string) => void;
    __selectTreeItem?: (item: any) => void;
    __moduleListComponent?: any;
    __dataTypeListComponent?: any;
    __onSearchItemClick?: (item: any) => void;
    __treeViewComponent?: any;
    updateUI?: (skipAutoSelect?: boolean) => void;
    parseAppspaceFile?: (content: string, filename?: string) => any;
    __showDetail?: (name: string, type: string, addToHistory?: boolean) => void;
    __showDataType?: (typeName: string, preferredCategory?: string) => void;
    __getPreferredType?: (typeName: string) => string;
    __moduleBodyHtml?: string;
    __appspaceBodyHtml?: string;
    __findNoteUsages?: (noteName: string) => any[];
    __findDataTypeUsages?: (typeName: string) => any[];
    loadFiles?: (files: any) => void;
    __mergedFOM?: any;
    __findDimensionByName?: (name: string) => any;
  }
}

